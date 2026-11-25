import asyncio
import json
import logging
import math
from dataclasses import asdict, is_dataclass
from decimal import Decimal
from typing import Any

import httpx

from app.config import Settings
from app.liquidation import liquidation_price

RAO_PER_TAO = Decimal(1_000_000_000)
logger = logging.getLogger(__name__)

TRACKED_EVENTS = {
    "StakeLocked": ("coldkey", "hotkey", "netuid", "amount_alpha"),
    "StakeUnlocked": ("coldkey", "hotkey", "netuid", "amount_alpha"),
    "LockMoved": ("coldkey", "hotkey", "destination_hotkey", "netuid"),
    "PerpetualLockUpdated": ("coldkey", "netuid", "perpetual"),
    "StakeMoved": (
        "coldkey", "hotkey", "netuid", "destination_hotkey",
        "destination_netuid", "amount_tao",
    ),
    "StakeSwapped": (
        "coldkey", "hotkey", "netuid", "destination_netuid", "amount_tao",
    ),
    "StakeTransferred": (
        "coldkey", "destination_coldkey", "hotkey", "netuid",
        "destination_netuid", "amount_tao",
    ),
    "HotkeySwapped": ("coldkey", "hotkey", "destination_hotkey"),
    "HotkeySwappedOnSubnet": (
        "coldkey", "hotkey", "destination_hotkey", "netuid",
    ),
    "SubnetOwnerChanged": ("netuid", "coldkey", "destination_coldkey"),
}

EVENT_FIELD_ALIASES = {
    "coldkey": ("coldkey", "who", "origin_coldkey", "old_owner", "owner"),
    "destination_coldkey": (
        "destination_coldkey", "dest_coldkey", "new_owner",
    ),
    "hotkey": ("hotkey", "origin_hotkey", "old_hotkey"),
    "destination_hotkey": (
        "destination_hotkey", "dest_hotkey", "new_hotkey",
    ),
    "netuid": ("netuid", "origin_netuid"),
    "destination_netuid": ("destination_netuid", "dest_netuid"),
    "amount_alpha": ("amount_alpha", "alpha", "amount"),
    "amount_tao": ("amount_tao", "tao", "amount"),
    "perpetual": ("perpetual", "enabled", "is_perpetual"),
}


def scale_int(value: Any) -> int:
    """Unwrap integer-like SCALE codec values returned by Bittensor v11."""
    raw_value = getattr(value, "value", value)
    while isinstance(raw_value, dict):
        for key in ("bits", "value", "inner", "raw"):
            if key in raw_value:
                raw_value = raw_value[key]
                break
        else:
            if len(raw_value) != 1:
                raise TypeError(
                    f"unsupported fixed-point mapping fields: {sorted(raw_value)}"
                )
            raw_value = next(iter(raw_value.values()))
        raw_value = getattr(raw_value, "value", raw_value)
    return int(raw_value)


def fixed_to_decimal(value: Any, frac_bits: int = 32) -> Decimal:
    """Decode a SCALE fixed-point value without relying on SDK internals."""
    return Decimal(scale_int(value)) / Decimal(1 << frac_bits)


def emission_shares(
    tao_in: dict[int, Decimal], excess_tao: dict[int, Decimal]
) -> dict[int, Decimal]:
    """Return each subnet's total TAO allocation share for the block.

    Subtensor splits a subnet's allocation between direct pool injection
    (SubnetTaoInEmission) and excess TAO used for protocol chain buys
    (SubnetExcessTao). Market dashboards call their sum "Emission".
    """
    netuids = tao_in.keys() | excess_tao.keys()
    allocations = {
        netuid: tao_in.get(netuid, Decimal(0))
        + excess_tao.get(netuid, Decimal(0))
        for netuid in netuids
    }
    total = sum(allocations.values(), Decimal(0))
    return {
        netuid: value / total if total > 0 else Decimal(0)
        for netuid, value in allocations.items()
    }


def circulating_alpha_supply(
    alpha_reserve: Decimal, staked_alpha: Decimal
) -> Decimal:
    """Return pool alpha plus alpha actually held in live stake positions."""
    return max(alpha_reserve + staked_alpha, Decimal(0))


def amount(value: Any) -> Decimal:
    """Convert v11 Balance/numeric values without crossing TAO/alpha units."""
    if value is None:
        return Decimal(0)
    raw = getattr(value, "amount", value)
    return Decimal(str(raw))


def token_units(value: Any) -> Decimal:
    """Convert SDK Balance values to whole TAO/alpha units."""
    if value is None:
        return Decimal(0)
    decimal_value = getattr(value, "decimal", None)
    if decimal_value is not None:
        return Decimal(str(decimal_value))
    rao_value = getattr(value, "rao", None)
    if rao_value is not None:
        return Decimal(str(rao_value)) / RAO_PER_TAO
    amount_value = getattr(value, "amount", None)
    if amount_value is not None:
        return Decimal(str(amount_value))
    return Decimal(str(value))


def event_token_units(value: Any) -> Decimal:
    """Convert raw SCALE event balances (rao) or SDK Balance objects."""
    if hasattr(value, "decimal") or hasattr(value, "rao") or hasattr(value, "amount"):
        return token_units(value)
    return Decimal(scale_int(value)) / RAO_PER_TAO


def total_locked_alpha(result: Any) -> Decimal:
    """Read the rolled-forward total lock mass returned by Bittensor v11."""
    total = field(result, "total_locked_alpha")
    if total is not None:
        return token_units(total)

    entries = field(result, "entries", "convictions", "hotkeys", default=[])
    if isinstance(entries, dict):
        entries = entries.values()
    return sum(
        (
            token_units(
                field(
                    entry,
                    "locked_alpha",
                    "locked_mass",
                    "locked",
                    "alpha_locked",
                    default=0,
                )
            )
            for entry in entries or []
        ),
        Decimal(0),
    )


def rolled_locked_alpha(
    value: Any,
    block_number: int,
    unlock_rate: int,
    *,
    decaying: bool,
) -> Decimal:
    """Return a stored lock's current alpha mass in whole-token units."""
    if value is None:
        return Decimal(0)
    raw = getattr(value, "value", value)
    locked_mass = scale_int(field(raw, "locked_mass", default=0))
    if decaying and locked_mass > 0:
        last_update = scale_int(field(raw, "last_update", default=block_number))
        elapsed = max(0, block_number - last_update)
        rate = max(1, unlock_rate)
        decay = math.exp(-min(elapsed / rate, 40.0))
        locked_mass = int(locked_mass * decay)
    return Decimal(locked_mass) / RAO_PER_TAO


def field(obj: Any, *names: str, default=None):
    data = asdict(obj) if is_dataclass(obj) else obj
    for name in names:
        if isinstance(data, dict) and name in data:
            return data[name]
        if hasattr(obj, name):
            return getattr(obj, name)
    return default


def _plain(value: Any) -> Any:
    """Turn decoded SCALE values into JSON-safe primitives."""
    value = getattr(value, "value", value)
    if is_dataclass(value):
        value = asdict(value)
    if isinstance(value, dict):
        return {str(key): _plain(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [_plain(item) for item in value]
    if isinstance(value, bytes):
        return "0x" + value.hex()
    if isinstance(value, Decimal):
        return str(value)
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _event_value(attributes: Any, position: int, logical_name: str) -> Any:
    if isinstance(attributes, (list, tuple)):
        return attributes[position] if position < len(attributes) else None
    if isinstance(attributes, dict):
        lowered = {str(key).lower(): value for key, value in attributes.items()}
        for alias in EVENT_FIELD_ALIASES[logical_name]:
            if alias.lower() in lowered:
                return lowered[alias.lower()]
    return None


def parse_chain_events(records: Any) -> list[dict]:
    """Normalize the Bittensor v11 decoded System.Events storage value."""
    records = getattr(records, "value", records) or []
    if isinstance(records, dict):
        records = field(records, "records", "events", default=[])
    parsed = []
    for index, record in enumerate(records):
        record = getattr(record, "value", record)
        event = field(record, "event", default=record)
        event = getattr(event, "value", event)
        module = field(event, "module_id", "module", "pallet", "pallet_name")
        name = field(event, "event_id", "event", "name", "variant")
        if str(module).lower() not in {"subtensormodule", "subtensor"}:
            continue
        if name not in TRACKED_EVENTS:
            continue
        attributes = field(event, "attributes", "params", "fields", "data", default=[])
        row = {
            "event_index": index,
            "event_type": name,
            "netuid": None,
            "destination_netuid": None,
            "coldkey": None,
            "destination_coldkey": None,
            "hotkey": None,
            "destination_hotkey": None,
            "amount_alpha": None,
            "amount_tao": None,
            "perpetual": None,
            "raw": json.dumps(_plain(record), separators=(",", ":")),
        }
        for position, logical_name in enumerate(TRACKED_EVENTS[name]):
            value = _event_value(attributes, position, logical_name)
            if value is None:
                continue
            if logical_name in {"netuid", "destination_netuid"}:
                row[logical_name] = scale_int(value)
            elif logical_name in {"amount_alpha", "amount_tao"}:
                row[logical_name] = event_token_units(value)
            elif logical_name == "perpetual":
                row[logical_name] = bool(getattr(value, "value", value))
            else:
                row[logical_name] = str(getattr(value, "value", value))
        parsed.append(row)
    return parsed


class ChainClient:
    """Small adapter around the current Bittensor v11 SDK; easy to fake in tests."""

    def __init__(self, settings: Settings, endpoint_url: str | None = None):
        self.settings = settings
        self.endpoint_url = endpoint_url or settings.subtensor_ws_url
        self.client = None
        self._conviction_locked: dict[int, Decimal | None] = {}
        self._conviction_refresh_block = -1
        self._yield_metrics: dict[int, tuple[int | None, Decimal | None]] = {}
        self._yield_refresh_block = -1
        self._circulating_stake: dict[int, Decimal] = {}
        self._circulating_stake_refresh_block = -1
        self._stake_identity: dict[int, tuple[int, int]] = {}
        self._stake_fallback_task: asyncio.Task | None = None

    async def __aenter__(self):
        import bittensor as bt

        self.client = await bt.Subtensor(self.endpoint_url)
        return self

    async def __aexit__(self, *args):
        if self._stake_fallback_task is not None:
            self._stake_fallback_task.cancel()
            await asyncio.gather(self._stake_fallback_task, return_exceptions=True)
        close = getattr(self.client, "close", None)
        if close:
            result = close()
            if asyncio.iscoroutine(result):
                await result

    async def block_info(self, block: int | None = None):
        return await self.client.block_info(block)

    async def prices_at(self, block_number: int) -> dict[int, Decimal]:
        """Read every subnet spot price with one runtime API call."""
        view = await self.client.at(block_number)
        prices = await view.prices.alpha_prices()
        return {
            int(netuid): Decimal(str(price))
            for netuid, price in (prices or {}).items()
        }

    async def events_at(self, block_number: int) -> list[dict]:
        view = await self.client.at(block_number)
        return parse_chain_events(await view.query(("System", "Events")))

    async def subnets_at(
        self,
        block_number: int,
        *,
        include_auxiliary: bool = True,
        include_yield_metrics: bool | None = None,
        include_lock_metrics: bool | None = None,
    ) -> list[dict]:
        if include_yield_metrics is None:
            include_yield_metrics = include_auxiliary
        if include_lock_metrics is None:
            include_lock_metrics = include_auxiliary
        view = await self.client.at(block_number)
        (
            infos,
            prices,
            tao_rows,
            alpha_rows,
            out_rows,
            volume_rows,
            tao_emission_rows,
            excess_tao_rows,
            alpha_emission_rows,
            root_prop_rows,
            symbol_rows,
            identity_rows,
            total_issuance_raw,
        ) = await asyncio.gather(
            view.subnets.all(),
            view.prices.alpha_prices(),
            view.query_map(("SubtensorModule", "SubnetTAO")),
            view.query_map(("SubtensorModule", "SubnetAlphaIn")),
            view.query_map(("SubtensorModule", "SubnetAlphaOut")),
            view.query_map(("SubtensorModule", "SubnetVolume")),
            view.query_map(("SubtensorModule", "SubnetTaoInEmission")),
            view.query_map(("SubtensorModule", "SubnetExcessTao")),
            view.query_map(("SubtensorModule", "SubnetAlphaOutEmission")),
            view.query_map(("SubtensorModule", "RootProp")),
            view.query_map(("SubtensorModule", "TokenSymbol")),
            view.query_map(("SubtensorModule", "SubnetIdentitiesV3")),
            view.query(("SubtensorModule", "TotalIssuance")),
        )
        tao = {int(k): Decimal(scale_int(v)) / RAO_PER_TAO for k, v in tao_rows}
        alpha = {int(k): Decimal(scale_int(v)) / RAO_PER_TAO for k, v in alpha_rows}
        alpha_out = {int(k): Decimal(scale_int(v)) / RAO_PER_TAO for k, v in out_rows}
        total_issuance = Decimal(scale_int(total_issuance_raw)) / RAO_PER_TAO
        netuids = [int(field(info, "netuid")) for info in infos]
        volume = {int(k): Decimal(scale_int(v)) / RAO_PER_TAO for k, v in volume_rows}
        tao_emission = {
            int(k): Decimal(scale_int(v)) / RAO_PER_TAO for k, v in tao_emission_rows
        }
        excess_tao = {
            int(k): Decimal(scale_int(v)) / RAO_PER_TAO for k, v in excess_tao_rows
        }
        alpha_emission = {
            int(k): Decimal(scale_int(v)) / RAO_PER_TAO for k, v in alpha_emission_rows
        }
        emission_share = emission_shares(tao_emission, excess_tao)
        root_prop = {
            int(k): fixed_to_decimal(v)
            for k, v in root_prop_rows
        }
        symbols = {int(k): self._text(v) for k, v in symbol_rows}
        identities = {
            int(k): {
                "name": self._text(field(v, "subnet_name")),
                "github_repo": self._text(field(v, "github_repo")),
                "contact": self._text(field(v, "subnet_contact")),
                "website": self._text(field(v, "subnet_url")),
                "discord": self._text(field(v, "discord")),
                "description": self._text(field(v, "description")),
                "logo_url": self._text(field(v, "logo_url")),
                "additional": self._text(field(v, "additional")),
            }
            for k, v in identity_rows
        }
        if include_auxiliary and (
            not self._circulating_stake
            or block_number - self._circulating_stake_refresh_block >= 25
        ):
            try:
                self._circulating_stake = await self._taomarketcap_stake_by_subnet(
                    block_number
                )
                self._circulating_stake_refresh_block = block_number
            except Exception as exc:
                # Keep only bounded-age snapshots while the complete chain scan
                # runs separately from the fast price/indexing connection.
                if block_number - self._circulating_stake_refresh_block > 100:
                    self._circulating_stake = {}
                logger.warning("circulating stake refresh failed: %s", exc)
                if self._stake_fallback_task is None or self._stake_fallback_task.done():
                    self._stake_fallback_task = asyncio.create_task(
                        self._refresh_chain_stake(block_number)
                    )
        if include_lock_metrics and (
            not self._conviction_locked
            or block_number - self._conviction_refresh_block >= 25
        ):
            refreshed_locks = await self._locked_alpha_by_subnet(
                view, netuids, block_number
            )
            self._conviction_locked = {
                netuid: (
                    refreshed_locks.get(netuid)
                    if refreshed_locks.get(netuid) is not None
                    else self._conviction_locked.get(netuid)
                )
                for netuid in netuids
            }
            valid_locks = sum(
                value is not None for value in self._conviction_locked.values()
            )
            self._conviction_refresh_block = (
                block_number
                if valid_locks >= len(netuids)
                else block_number - 15
            )
            logger.info(
                "subnet lock metrics refreshed block=%s valid_subnets=%s expected_subnets=%s",
                block_number,
                valid_locks,
                len(netuids),
            )
        if include_yield_metrics and (
            not self._yield_metrics
            or block_number - self._yield_refresh_block >= 100
        ):
            refreshed_yields = await self._subnet_yield_metrics(
                view, netuids
            )
            # Keep the last completed epoch for subnets whose individual RPC
            # page failed. One slow subnet must not blank APY for every subnet.
            self._yield_metrics = {
                netuid: (
                    refreshed_yields.get(netuid, (None, None))
                    if all(
                        value is not None
                        for value in refreshed_yields.get(netuid, (None, None))
                    )
                    else self._yield_metrics.get(
                        netuid, refreshed_yields.get(netuid, (None, None))
                    )
                )
                for netuid in netuids
            }
            valid_yields = sum(
                tempo is not None and dividends is not None
                for tempo, dividends in self._yield_metrics.values()
            )
            expected_yields = sum(netuid != 0 for netuid in netuids)
            # Successful reads are stable for roughly 20 minutes. A transient
            # or partial failure retries after 10 blocks without blanking the
            # subnets that did complete.
            self._yield_refresh_block = (
                block_number
                if valid_yields >= expected_yields
                else block_number - 90
            )
            logger.info(
                "subnet yield metrics refreshed block=%s valid_subnets=%s expected_subnets=%s",
                block_number,
                valid_yields,
                expected_yields,
            )
        rows = []
        protocol, registrations, refund_deployment = {}, {}, None
        if include_auxiliary:
            try:
                protocol_rows, registration_rows, refund_raw = await asyncio.wait_for(
                    asyncio.gather(
                        view.query_map(("SubtensorModule", "SubnetProtocolAlpha")),
                        view.query_map(("SubtensorModule", "NetworkRegisteredAt")),
                        view.query(("SubtensorModule", "TaoInRefundDeploymentBlock")),
                    ), timeout=12,
                )
                protocol = {int(k): Decimal(scale_int(v)) / RAO_PER_TAO
                            for k, v in protocol_rows}
                registrations = {int(k): scale_int(v) for k, v in registration_rows}
                refund_deployment = scale_int(refund_raw)
            except Exception as exc:
                logger.warning("liquidation inputs unavailable: %s", type(exc).__name__)
        for info in infos:
            netuid = int(field(info, "netuid"))
            price = prices.get(netuid) if isinstance(prices, dict) else None
            identity = identities.get(netuid, {})
            alpha_reserve = alpha.get(netuid)
            outstanding_alpha = alpha_out.get(netuid)
            live_staked_alpha = self._circulating_stake.get(netuid)
            registered_at = registrations.get(netuid)
            stake_registration, stake_block = self._stake_identity.get(netuid, (None, None))
            payout_price = None
            if (include_auxiliary and netuid != 0 and registered_at is not None
                    and stake_registration == registered_at and stake_block is not None
                    and abs(block_number - stake_block) <= 100):
                payout_price = liquidation_price(
                    tao.get(netuid), live_staked_alpha,
                    protocol.get(netuid, Decimal(0)), alpha_reserve,
                    registered_at, refund_deployment,
                )
            circulating_alpha = None
            if include_auxiliary and netuid == 0:
                circulating_alpha = total_issuance
            elif (
                include_auxiliary
                and alpha_reserve is not None
                and live_staked_alpha is not None
                and stake_registration == registered_at
                and stake_block is not None
                and abs(block_number - stake_block) <= 100
            ):
                circulating_alpha = circulating_alpha_supply(
                    alpha_reserve,
                    live_staked_alpha,
                )
            rows.append({
                "netuid": netuid,
                "price_tao": Decimal(str(price or 0)),
                "tao_reserve": tao.get(netuid),
                "alpha_reserve": alpha_reserve,
                "alpha_out": outstanding_alpha,
                "circulating_alpha": circulating_alpha,
                "liquidation_price_tao": payout_price,
                "liquidation_stake_block": stake_block,
                "volume_tao": volume.get(netuid),
                "tao_in_emission": tao_emission.get(netuid, Decimal(0)),
                "alpha_out_emission": alpha_emission.get(netuid, Decimal(0)),
                "emission_share": emission_share.get(netuid, Decimal(0)),
                "root_prop": root_prop.get(netuid),
                "tempo": (
                    self._yield_metrics.get(netuid, (None, None))[0]
                    if include_yield_metrics else None
                ),
                "staker_epoch_dividends_alpha": (
                    self._yield_metrics.get(netuid, (None, None))[1]
                    if include_yield_metrics else None
                ),
                "conviction_locked_alpha": (
                    self._conviction_locked.get(netuid)
                    if include_lock_metrics else None
                ),
                "name": identity.get("name"),
                "symbol": symbols.get(netuid),
                "description": identity.get("description"),
                "website": identity.get("website"),
                "github_repo": identity.get("github_repo"),
                "discord": identity.get("discord"),
                "contact": identity.get("contact"),
                "logo_url": identity.get("logo_url"),
                "additional": identity.get("additional"),
            })
        return rows

    async def _refresh_chain_stake(self, block_number):
        try:
            from app.stake_supply import complete_stake_totals

            async with asyncio.timeout(120):
                raw_totals = await complete_stake_totals(self.endpoint_url, block_number)
                view = await self.client.at(block_number)
                registration_rows = await view.query_map(("SubtensorModule", "NetworkRegisteredAt"))
                registrations = {scale_int(k): scale_int(v) for k, v in registration_rows}
                if not registrations:
                    raise ValueError("Missing subnet registrations")
                totals = {n: raw_totals.get(n, Decimal(0)) for n in registrations}
                identities = {n: (registered, block_number) for n, registered in registrations.items()}
            # An older background result must never overwrite a newer refresh.
            if block_number >= self._circulating_stake_refresh_block:
                self._circulating_stake = totals
                self._stake_identity = identities
                self._circulating_stake_refresh_block = block_number
            logger.info("on-chain supply refreshed block=%s subnets=%s", block_number, len(totals))
        except Exception:
            logger.exception("on-chain supply fallback failed block=%s", block_number)

    async def _taomarketcap_stake_by_subnet(
        self, block_number: int
    ) -> dict[int, Decimal]:
        """Load complete subnet stake totals with an explicit freshness gate.

        The chain metagraph only contains currently registered hotkeys, so it
        omits live stake left on deregistered hotkeys. TAOMarketCap's public
        snapshot aggregates the complete TotalHotkeyAlpha map and exposes the
        pinned block alongside the value. We retain our own on-chain pool and
        price and use only that complete stake total.
        """
        url = "https://api.taomarketcap.com/internal/v1/subnets/?limit=200"
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            payload = response.json()
        results = payload.get("results")
        if not isinstance(results, list) or len(results) < 100:
            raise ValueError("TAOMarketCap returned an incomplete subnet list")
        totals: dict[int, Decimal] = {}
        identities: dict[int, tuple[int, int]] = {}
        snapshot_blocks: list[int] = []
        for row in results:
            snapshot = row.get("latest_snapshot") or {}
            netuid = row.get("netuid")
            raw_total = row.get("total_subnet_stake")
            snapshot_block = snapshot.get("block_number")
            if netuid is None or raw_total is None or snapshot_block is None:
                continue
            totals[int(netuid)] = Decimal(str(raw_total)) / RAO_PER_TAO
            snapshot_blocks.append(int(snapshot_block))
            registered_at = snapshot.get("network_registered_at")
            if registered_at is not None:
                identities[int(netuid)] = (int(registered_at), int(snapshot_block))
        if len(totals) < 100 or not snapshot_blocks:
            raise ValueError("TAOMarketCap stake snapshot is incomplete")
        newest_snapshot = max(snapshot_blocks)
        if abs(block_number - newest_snapshot) > 100:
            raise ValueError(
                f"TAOMarketCap stake snapshot is stale by "
                f"{abs(block_number - newest_snapshot)} blocks"
            )
        self._stake_identity = identities
        return totals

    async def _actual_stake_by_subnet(self, view) -> dict[int, Decimal]:
        """Sum live alpha stake from the chain's bounded metagraph runtime call.

        Iterating ``TotalHotkeyAlpha`` directly walks the global hotkey/subnet
        double map and is rejected by some public RPC providers. The runtime
        API returns the same live stake grouped by subnet in one supported
        call, including stake that is no longer represented by AlphaOut.
        """
        graphs = await view.runtime(
            ("SubnetInfoRuntimeApi", "get_all_metagraphs"), []
        )
        totals: dict[int, Decimal] = {}
        for graph in graphs or []:
            if graph is None:
                continue
            netuid = scale_int(field(graph, "netuid"))
            alpha_stake = field(graph, "alpha_stake", default=[]) or []
            totals[netuid] = sum(
                (Decimal(scale_int(value)) / RAO_PER_TAO for value in alpha_stake),
                Decimal(0),
            )
        return totals

    async def _subnet_yield_metrics(
        self, view, netuids: list[int]
    ) -> dict[int, tuple[int | None, Decimal | None]]:
        """Read latest realized validator dividends; these change once per tempo.

        AlphaDividendsPerSubnet is a double map keyed by (netuid, hotkey).
        Reading it without a fixed netuid asks the RPC for every dividend row on
        Finney and can take minutes. Prefix each map request with one active
        netuid and limit concurrency so responses stay small and bounded.
        """
        try:
            async with asyncio.timeout(8):
                tempo_rows = await view.query_map(("SubtensorModule", "Tempo"))
        except Exception as exc:  # noqa: BLE001 -- isolate SDK/RPC failures
            logger.warning("subnet tempo read failed: %s", type(exc).__name__)
            return {netuid: (None, None) for netuid in netuids}

        tempos = {int(k): scale_int(v) for k, v in tempo_rows}
        semaphore = asyncio.Semaphore(12)

        async def dividends_for(netuid: int) -> tuple[int, Decimal | None]:
            if netuid == 0:
                return netuid, None
            try:
                async with semaphore, asyncio.timeout(8):
                    rows = await view.query_map(
                        ("SubtensorModule", "AlphaDividendsPerSubnet"),
                        [netuid],
                    )
                return netuid, sum(
                    (
                        Decimal(scale_int(value)) / RAO_PER_TAO
                        for _, value in rows
                    ),
                    Decimal(0),
                )
            except Exception as exc:  # noqa: BLE001 -- isolate one subnet's RPC page
                logger.warning(
                    "subnet dividend read failed netuid=%s error=%s",
                    netuid,
                    type(exc).__name__,
                )
                return netuid, None

        total_timeout = max(
            10,
            min(35, self.settings.rpc_block_timeout_seconds - 5),
        )
        tasks = [
            asyncio.create_task(dividends_for(netuid))
            for netuid in netuids
            if netuid != 0
        ]
        totals: dict[int, Decimal | None] = {}
        try:
            async with asyncio.timeout(total_timeout):
                totals.update(await asyncio.gather(*tasks))
        except TimeoutError:
            for task in tasks:
                if task.done() and not task.cancelled():
                    netuid, total = task.result()
                    totals[netuid] = total
                else:
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            logger.warning(
                "subnet dividend refresh timed out completed=%s total=%s",
                len(totals),
                len(tasks),
            )

        return {
            netuid: (tempos.get(netuid), totals.get(netuid))
            for netuid in netuids
        }

    @classmethod
    def _first_int(cls, value: Any) -> int | None:
        """Extract a netuid from SDK composite storage keys across codec versions."""
        if isinstance(value, int):
            return value
        if isinstance(value, (tuple, list)):
            for item in value:
                result = cls._first_int(item)
                if result is not None:
                    return result
        if isinstance(value, dict):
            for item in value.values():
                result = cls._first_int(item)
                if result is not None:
                    return result
        raw = getattr(value, "value", None)
        if raw is not None and raw is not value:
            return cls._first_int(raw)
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _last_int(cls, value: Any) -> int | None:
        """Extract the trailing netuid from account-first composite storage keys."""
        if isinstance(value, int):
            return value
        if isinstance(value, (tuple, list)):
            for item in reversed(value):
                result = cls._last_int(item)
                if result is not None:
                    return result
        if isinstance(value, dict):
            for item in reversed(list(value.values())):
                result = cls._last_int(item)
                if result is not None:
                    return result
        raw = getattr(value, "value", None)
        if raw is not None and raw is not value:
            return cls._last_int(raw)
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    async def _locked_alpha_by_subnet(
        self,
        view,
        netuids: list[int],
        block_number: int,
    ) -> dict[int, Decimal | None]:
        """Sum current lock mass with a small, fixed number of storage reads."""
        try:
            timeout = max(
                1,
                min(12, self.settings.rpc_block_timeout_seconds / 2),
            )
            async with asyncio.timeout(timeout):
                # Read the migration at this exact block. After it runs, the
                # hotkey maps already include owner locks and legacy maps vanish.
                unified = _plain(await view.query(
                    ("SubtensorModule", "HasMigrationRun"),
                    [list(b"migrate_one_lock_bucket_per_hotkey")],
                ))
                if not isinstance(unified, bool):
                    raise ValueError("Invalid lock migration state")
                async def owner_rows(name):
                    return [] if unified else await view.query_map(("SubtensorModule", name))
                (
                    perpetual_hotkeys,
                    decaying_hotkeys,
                    perpetual_owners,
                    decaying_owners,
                    unlock_rate_value,
                ) = await asyncio.gather(
                    view.query_map(("SubtensorModule", "HotkeyLock")),
                    view.query_map(("SubtensorModule", "DecayingHotkeyLock")),
                    owner_rows("OwnerLock"),
                    owner_rows("DecayingOwnerLock"),
                    view.query(("SubtensorModule", "UnlockRate")),
                )
        except Exception as exc:  # noqa: BLE001 -- isolate optional SDK/RPC reads
            logger.warning("subnet lock metric read failed: %s", type(exc).__name__)
            return {netuid: None for netuid in netuids}

        unlock_rate = scale_int(unlock_rate_value) if unlock_rate_value else 934_866
        totals = {netuid: Decimal(0) for netuid in netuids}

        def add_rows(rows, *, decaying: bool) -> None:
            for key, value in rows:
                netuid = self._first_int(key)
                if netuid in totals:
                    totals[netuid] += rolled_locked_alpha(
                        value,
                        block_number,
                        unlock_rate,
                        decaying=decaying,
                    )

        add_rows(perpetual_hotkeys, decaying=False)
        add_rows(decaying_hotkeys, decaying=True)
        add_rows(perpetual_owners, decaying=False)
        add_rows(decaying_owners, decaying=True)
        return totals

    @staticmethod
    def _text(value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, bytes):
            return value.decode("utf-8", errors="replace")
        if isinstance(value, list) and all(isinstance(item, int) for item in value):
            return bytes(value).decode("utf-8", errors="replace")
        return str(value)

    async def wallet(self, address: str, block_number: int, subnet_prices: dict[int, Decimal] | None = None) -> dict:
        view = await self.client.at(block_number)
        free, positions = await asyncio.gather(
            view.balances.get(address),
            view.staking.stake_for_coldkey(coldkey_ss58=address),
        )
        prices = subnet_prices or {}
        stakes = []
        for position in positions:
            netuid = int(field(position, "netuid"))
            alpha = amount(field(position, "stake", "alpha", "amount"))
            price = Decimal(1) if netuid == 0 else prices.get(netuid)
            stakes.append({
                "hotkey": str(field(position, "hotkey_ss58", "hotkey")),
                "netuid": netuid,
                "alpha": alpha,
                "tao_value": alpha * price if price is not None else None,
            })
        stake_values = [stake["tao_value"] for stake in stakes]
        staked = sum(stake_values, Decimal(0)) if all(value is not None for value in stake_values) else None
        free_tao = amount(free)
        return {
            "address": address,
            "block_number": block_number,
            "free_tao": free_tao,
            "staked_tao_value": staked,
            "total_tao_value": free_tao + staked if staked is not None else None,
            "stakes": stakes,
        }

    async def wallets(self, addresses: list[str], block_number: int, subnet_prices: dict[int, Decimal] | None = None) -> list[dict]:
        """Read many coldkeys with the SDK's batched runtime and balance calls."""
        view = await self.client.at(block_number)
        free_by_address, positions_by_address = await asyncio.gather(
            view.balances.get_many(addresses),
            view.staking.stake_for_coldkeys(coldkey_ss58s=addresses),
        )
        prices = subnet_prices or {}
        results = []
        for address in addresses:
            stakes = []
            for position in positions_by_address.get(address, []):
                netuid = int(field(position, "netuid"))
                alpha = amount(field(position, "stake", "alpha", "amount"))
                price = Decimal(1) if netuid == 0 else prices.get(netuid)
                stakes.append({
                    "hotkey": str(field(position, "hotkey_ss58", "hotkey")),
                    "netuid": netuid,
                    "alpha": alpha,
                    "tao_value": alpha * price if price is not None else None,
                })
            stake_values = [stake["tao_value"] for stake in stakes]
            staked = sum(stake_values, Decimal(0)) if all(value is not None for value in stake_values) else None
            free_tao = amount(free_by_address.get(address, 0))
            results.append({
                "address": address,
                "block_number": block_number,
                "free_tao": free_tao,
                "staked_tao_value": staked,
                "total_tao_value": free_tao + staked if staked is not None else None,
                "stakes": stakes,
            })
        return results
