"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { confineBubble, layoutBubbles, stepBubbles, poolPockets, stepPoolPockets, type BubbleBody } from "./lib/bubble-physics";
import { matchesSubnetQuery } from "./lib/subnet-search";
import "./interactive-bubbles.css";

export type FloatingSubnet = { id: number; name: string; size: number; change: number; changeLabel: string; price: string; marketCap: string; liquidity: string };
export function InteractiveBubbleField({ items, selected, onSelect, onChart, period }: { items: FloatingSubnet[]; selected: number; onSelect: (id: number) => void; onChart: (id: number) => void; period: string }) {
  const field = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const bodies = useRef<BubbleBody[]>([]);
  const wake = useRef<() => void>(() => {});
  const [paused, setPaused] = useState(false);
  const [reset, setReset] = useState(0);
  const [query, setQuery] = useState("");
  const [inspecting, setInspecting] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const skipClick = useRef(false);
  const drag = useRef<{ id: number; pointer: number; startX: number; startY: number; offsetX: number; offsetY: number; lastX: number; lastY: number; time: number; moved: boolean } | null>(null);
  const detail = items.find(item => item.id === inspecting);
  const matches = (item: FloatingSubnet) => !query.trim() || matchesSubnetQuery({ name: item.name, netuid: item.id }, query);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) queueMicrotask(() => setPaused(true));
    const changed = () => { if (media.matches) setPaused(true); };
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);

  useEffect(() => {
    const host = field.current;
    if (!host) return;
    let width = host.clientWidth, height = host.clientHeight, raf = 0, last = 0, visible = true, disposed = false, settleUntil = 0;
    const paint = () => {
      for (const body of bodies.current) {
        const node = buttons.current.get(body.id); if (!node) continue;
        node.style.width = `${body.r * 2}px`; node.style.height = `${body.r * 2}px`;
        const scale = body.pocket ? Math.max(.02, 1 - body.pocket.progress) : body.returning ? 1 - body.returning * .35 : 1;
        node.style.transform = `translate3d(${body.x - body.r}px,${body.y - body.r}px,0) scale(${scale})`;
        node.style.opacity = body.pocket ? String(1 - body.pocket.progress * .8) : body.returning ? String(1 - body.returning) : "";
        node.dataset.pocketed = String(Boolean(body.pocket));
        node.dataset.small = String(body.r < 32);
        node.style.setProperty("--bubble-label-size", `${Math.min(18, Math.max(8, (body.r * 2 - 8) / 3.2))}px`);
      }
    };
    const frame = (now: number) => {
      raf = 0;
      if (disposed || !visible || document.hidden) return;
      {
        const dt = last ? Math.min(2, (now - last) / 16.667) : 1; last = now;
        if (!paused || drag.current || now < settleUntil || bodies.current.some(body => body.pocket || body.returning)) {
          stepBubbles(bodies.current, width, height, dt, now, !paused, drag.current?.id ?? null);
          stepPoolPockets(bodies.current, width, height, dt, now, !paused, drag.current?.id ?? null);
          paint();
        }
      }
      if (!paused || drag.current || now < settleUntil || bodies.current.some(body => body.pocket || body.returning)) raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!disposed && visible && !document.hidden && !raf) raf = requestAnimationFrame(frame); };
    wake.current = () => { settleUntil = performance.now() + 1100; start(); };
    const resize = () => {
      const oldWidth = width, oldHeight = height;
      const available = (window.visualViewport?.height ?? window.innerHeight) - (host.getBoundingClientRect().top + window.scrollY) - 12;
      const nextHeight = Math.max(80, Math.floor(available));
      if (host.style.height !== `${nextHeight}px`) host.style.height = `${nextHeight}px`;
      width = host.clientWidth; height = host.clientHeight;
      if (oldWidth && oldHeight) for (const body of bodies.current) { body.x *= width / oldWidth; body.y *= height / oldHeight; }
      bodies.current = layoutBubbles(items, width, height, bodies.current, reset);
      host.style.setProperty("--pool-pocket-radius", `${poolPockets(width, height)[0].r}px`);
      if (paused && !drag.current) for (const body of bodies.current) { body.vx = 0; body.vy = 0; }
      paint(); host.dataset.ready = "true"; wake.current();
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(host);
    window.addEventListener("resize", resize); window.visualViewport?.addEventListener("resize", resize);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) { last = 0; start(); } else { cancelAnimationFrame(raf); raf = 0; } }); intersection.observe(host);
    const visibility = () => { cancelAnimationFrame(raf); raf = 0; last = 0; if (!document.hidden) start(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { disposed = true; cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("resize", resize); intersection.disconnect(); document.removeEventListener("visibilitychange", visibility); wake.current = () => {}; };
  }, [items, paused, reset]);

  const down = (event: PointerEvent<HTMLButtonElement>, id: number) => {
    if (event.button !== 0 || !field.current || drag.current) return;
    const body = bodies.current.find(b => b.id === id); if (!body) return;
    const rect = field.current.getBoundingClientRect();
    drag.current = { id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: body.x - (event.clientX - rect.left), offsetY: body.y - (event.clientY - rect.top), lastX: body.x, lastY: body.y, time: event.timeStamp, moved: false };
    skipClick.current = false; event.currentTarget.setPointerCapture(event.pointerId); setDragging(id); wake.current();
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const held = drag.current, host = field.current; if (!held || !host || held.pointer !== event.pointerId) return;
    if (Math.hypot(event.clientX - held.startX, event.clientY - held.startY) > 6) held.moved = true;
    if (!held.moved) return;
    const body = bodies.current.find(b => b.id === held.id); if (!body) return;
    const rect = host.getBoundingClientRect(), dt = Math.max(8, event.timeStamp - held.time) / 16.667;
    body.x = event.clientX - rect.left + held.offsetX; body.y = event.clientY - rect.top + held.offsetY;
    confineBubble(body, host.clientWidth, host.clientHeight);
    body.vx = Math.max(-3.5, Math.min(3.5, (body.x - held.lastX) / dt)); body.vy = Math.max(-3.5, Math.min(3.5, (body.y - held.lastY) / dt));
    held.lastX = body.x; held.lastY = body.y; held.time = event.timeStamp;
    wake.current();
  };
  const end = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const held = drag.current; if (!held || held.pointer !== event.pointerId) return;
    skipClick.current = held.moved || cancelled;
    const body = bodies.current.find(b => b.id === held.id);
    if (body && (cancelled || paused || event.timeStamp - held.time > 140)) { body.vx = 0; body.vy = 0; }
    drag.current = null; setDragging(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); wake.current();
  };

  return <section className="bubble-explorer" aria-label="Interactive subnet ball map">
    <div className="bubble-map-tools">
      <label>Find a subnet<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or SN51" /></label>
      {query && <button onClick={() => setQuery("")}>Clear search</button>}
      <button onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? "Resume motion" : "Pause motion"}</button>
      <button onClick={() => { bodies.current = []; setReset(value => value + 1); }}>Reset layout</button>
      <p role="status">{query ? `${items.filter(matches).length} matching subnets · clear search to see all` : "Drag & toss · fitting balls sink in corners, then return"}</p>
    </div>
    <div ref={field} className="bubble-cloud bubble-field panel" aria-label="Floating subnet balls" data-motion={paused ? "paused" : "running"}>
      <div className="pool-pockets" aria-hidden="true">{["top-left", "top-right", "bottom-left", "bottom-right"].map(corner => <i key={corner} className={`pool-pocket ${corner}`}/>)}</div>
      <div className="pool-sights" aria-hidden="true">{[25, 50, 75].flatMap(position => [<i key={`top-${position}`} className="top" style={{left:`${position}%`}}/>, <i key={`bottom-${position}`} className="bottom" style={{left:`${position}%`}}/>])}</div>
      {items.map(item => <button key={item.id} ref={node => { if (node) buttons.current.set(item.id, node); else buttons.current.delete(item.id); }}
        tabIndex={matches(item) ? 0 : -1} className={`market-bubble ${item.change > .005 ? "gain" : item.change < -.005 ? "loss" : "flat"} ${selected === item.id ? "selected" : ""} ${dragging === item.id ? "dragging" : ""} ${matches(item) ? "" : "search-dimmed"}`}
        onPointerDown={event => down(event, item.id)} onPointerMove={move} onPointerUp={event => end(event)} onPointerCancel={event => end(event, true)}
        onLostPointerCapture={event => end(event, true)} onClick={() => { if (skipClick.current) { skipClick.current = false; return; } onSelect(item.id); setInspecting(item.id); }}
        onKeyDown={event => { if (event.key === "Escape") setInspecting(null); if (event.key === "Enter" || event.key === " ") skipClick.current = false; }}
        title={`SN${item.id} ${item.name} · ${item.changeLabel} · ${period}`}
        aria-label={`SN${item.id} ${item.name}, ${item.changeLabel}, ${period}. Drag to move or activate for details.`}>
        <small>{item.name}</small><strong>SN{item.id}</strong><em>{item.changeLabel}</em>
      </button>)}
    </div>
    {detail && <aside className="bubble-inspector" aria-label={`SN${detail.id} details`} onKeyDown={event => { if (event.key === "Escape") setInspecting(null); }}>
      <button className="bubble-inspector-close" onClick={() => setInspecting(null)} aria-label="Close subnet details">×</button>
      <small>SN{detail.id} · {period}</small><h2>{detail.name}</h2><strong className={detail.change > .005 ? "positive" : detail.change < -.005 ? "negative" : ""}>{detail.changeLabel}</strong>
      <dl><div><dt>Price</dt><dd>{detail.price}</dd></div><div><dt>Market cap</dt><dd>{detail.marketCap}</dd></div><div><dt>Pool reserve</dt><dd>{detail.liquidity}</dd></div></dl>
      <button className="bubble-open-chart" onClick={() => onChart(detail.id)}>Open subnet chart →</button>
    </aside>}
  </section>;
}
