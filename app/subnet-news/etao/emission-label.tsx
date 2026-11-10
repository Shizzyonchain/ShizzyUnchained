"use client";

import { useId, useState } from "react";
import styles from "./page.module.css";

export const emissionLabels = ["Burn", "Recycle", "Owner", "Validators", "Miners"] as const;
type EmissionLabelName = typeof emissionLabels[number];

const explanations: Record<EmissionLabelName, string> = {
  Burn: "Share of new alpha emissions destroyed instead of paid out. Burned alpha still counts toward total issuance. This is an allocation, not a total of past burns.",
  Recycle: "Share of new alpha emissions removed from outstanding alpha and total issuance instead of paid out. Unlike Burn, this reduces the amount counted as issued.",
  Owner: "Share of new alpha emissions reserved for the subnet owner and paid to the owner’s hotkey each epoch. This is the owner cut.",
  Validators: "Share funding validator dividends and eligible staker rewards. Root’s baseline is paid first, capped by this bucket; alpha validators share the rest. Individual yields also depend on stake, performance and fees.",
  Miners: "Share funding rewards for miners who perform the subnet’s task. Rewards are divided across its mechanisms and participants according to scoring, rather than equally among all miners.",
};

export function EmissionLabel({ label }: { label: EmissionLabelName }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <span className={styles.allocationHelp} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button type="button" className={styles.allocationLabel} aria-label={`Explain ${label}`} aria-describedby={open ? id : undefined}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}
      onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
      {label}<span aria-hidden="true">ⓘ</span>
    </button>
    <span id={id} role="tooltip" className={styles.allocationTooltip} hidden={!open}>{explanations[label]}</span>
  </span>;
}
