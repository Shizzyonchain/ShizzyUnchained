"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { confineBubble, layoutBubbles, stepBubbles, poolPockets, stepPoolPockets, rollBubble, type BubbleBody } from "./lib/bubble-physics";
import { matchesSubnetQuery } from "./lib/subnet-search";
import "./interactive-bubbles.css";
import { createBallPainter } from "./lib/ball-canvas";

export type FloatingSubnet = { id: number; name: string; size: number; change: number; changeLabel: string; price: string; marketCap: string; liquidity: string };
export function InteractiveBubbleField({ items, selected, onSelect, onChart, period }: { items: FloatingSubnet[]; selected: number; onSelect: (id: number) => void; onChart: (id: number) => void; period: string }) {
  const field = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const bodies = useRef<BubbleBody[]>([]);
  const itemsRef=useRef(items);
  const refresh=useRef<()=>void>(()=>{});
  useEffect(()=>{itemsRef.current=items;refresh.current();},[items]);
  const wake = useRef<() => void>(() => {});
  const syncButtons = useRef<() => void>(() => {});
  const focused = useRef<number|null>(null);
  const [paused, setPaused] = useState(false);
  const [reset, setReset] = useState(0);
  const [query, setQuery] = useState("");
  const queryRef = useRef("");
  useEffect(() => { queryRef.current=query; wake.current(); },[query]);
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
    if (!host || !canvas.current) return;
    const painter=createBallPainter(canvas.current,itemsRef.current);
    let width = host.clientWidth, height = host.clientHeight, raf = 0, last = 0, visible = true, disposed = false, settleUntil = 0;
    const painted = new Map<number, {x:number;y:number}>();
    const paint = () => {
      for (const body of bodies.current) {
        const prior = painted.get(body.id);
        if (prior && !body.pocket && !body.returning) rollBubble(body, body.x - prior.x, body.y - prior.y);
        
        if(prior){prior.x=body.x;prior.y=body.y;}else painted.set(body.id,{x:body.x,y:body.y});
      }
      painter.paint(bodies.current,queryRef.current,focused.current);
    };
    const sync = () => {for(const body of bodies.current){const node=buttons.current.get(body.id);if(!node)continue;node.style.transform=`translate(${body.x-body.r}px,${body.y-body.r}px) scale(${body.r*2/64})`;node.dataset.pocketed=String(Boolean(body.pocket));}};
    syncButtons.current=sync;
    const frame = (now: number) => {
      raf = 0;
      if (disposed || !visible || document.hidden) return;
      {
        const dt = last ? Math.min(2, (now - last) / 16.667) : 1; last = now;
        if (!paused || drag.current || now < settleUntil || bodies.current.some(body => body.pocket || body.returning)) {
          // Bound physics work during a slow frame instead of multiplying the backlog.
          const samples = dt>1.5 ? 2 : 1;
          for (let sample = 0; sample < samples; sample++) {
            if(!paused || drag.current) stepBubbles(bodies.current, width, height, dt / samples, now, !paused, drag.current?.id ?? null);
            stepPoolPockets(bodies.current, width, height, dt / samples, now, !paused, drag.current?.id ?? null);
          }
          paint();
        }
      }
      if (!paused || drag.current || now < settleUntil || bodies.current.some(body => body.pocket || body.returning)) raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!disposed && visible && !document.hidden && !raf) raf = requestAnimationFrame(frame); };
    wake.current = () => { settleUntil = performance.now() + 1100; start(); };
    const resize = () => {
      if(disposed || !host.isConnected || host.clientWidth<1) return;
      const oldWidth = width, oldHeight = height;
      const available = (window.visualViewport?.height ?? window.innerHeight) - (host.getBoundingClientRect().top + window.scrollY) - 12;
      const nextHeight = Math.max(80, Math.floor(available));
      if (host.style.height !== `${nextHeight}px`) host.style.height = `${nextHeight}px`;
      width = host.clientWidth; height = host.clientHeight;
      if (oldWidth && oldHeight) for (const body of bodies.current) { body.x *= width / oldWidth; body.y *= height / oldHeight; }
      bodies.current = layoutBubbles(itemsRef.current, width, height, bodies.current, reset);
      host.style.setProperty("--pool-pocket-radius", `${poolPockets(width, height)[0].r}px`);
      if (paused && !drag.current) {for (const body of bodies.current) {body.r=body.targetR;body.vx=0;body.vy=0;}for(let i=0;i<24;i++)stepBubbles(bodies.current,width,height,1,0,false);for(const body of bodies.current){body.vx=0;body.vy=0;}}
      painter.resize(width,height); painted.clear(); paint(); sync(); host.dataset.ready = "true"; wake.current();
    };
    refresh.current=()=>{painter.update(itemsRef.current);bodies.current=layoutBubbles(itemsRef.current,width,height,bodies.current,reset);wake.current();};
    resize();
    const observer = new ResizeObserver(resize); observer.observe(host);
    window.addEventListener("resize", resize); window.visualViewport?.addEventListener("resize", resize);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) { last = 0; start(); } else { cancelAnimationFrame(raf); raf = 0; } }); intersection.observe(host);
    const visibility = () => { cancelAnimationFrame(raf); raf = 0; last = 0; if (!document.hidden) start(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { disposed = true; cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("resize", resize); intersection.disconnect(); document.removeEventListener("visibilitychange", visibility); wake.current = () => {}; syncButtons.current=()=>{}; refresh.current=()=>{}; };
  }, [paused, reset]);

  const down = (event: PointerEvent<HTMLElement>, id: number) => {
    if (event.button !== 0 || !field.current || drag.current) return;
    focused.current=null;field.current.focus({preventScroll:true});
    const body = bodies.current.find(b => b.id === id); if (!body) return;
    const rect = field.current.getBoundingClientRect();
    drag.current = { id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: body.x - (event.clientX - rect.left), offsetY: body.y - (event.clientY - rect.top), lastX: body.x, lastY: body.y, time: event.timeStamp, moved: false };
    skipClick.current = false; event.currentTarget.setPointerCapture(event.pointerId); setDragging(id); wake.current();
  };
  const move = (event: PointerEvent<HTMLElement>) => {
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
  const end = (event: PointerEvent<HTMLElement>, cancelled = false) => {
    const held = drag.current; if (!held || held.pointer !== event.pointerId) return;
    skipClick.current = held.moved || cancelled;
    const body = bodies.current.find(b => b.id === held.id);
    if (body && (cancelled || paused || event.timeStamp - held.time > 140)) { body.vx = 0; body.vy = 0; }
    if (!held.moved && !cancelled) {onSelect(held.id);setInspecting(held.id);}
    drag.current = null; syncButtons.current(); setDragging(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); wake.current();
  };

  return <section className="bubble-explorer" aria-label="Interactive subnet ball map" onKeyDown={event=>{if(event.key==="Escape")setInspecting(null);}}>
    <div className="bubble-map-tools">
      <label>Find a subnet<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or SN51" /></label>
      {query && <button onClick={() => setQuery("")}>Clear search</button>}
      <button onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? "Resume motion" : "Pause motion"}</button>
      <button onClick={() => { bodies.current = []; setReset(value => value + 1); }}>Reset layout</button>
      <p role="status">{query ? `${items.filter(matches).length} matching subnets · clear search to see all` : "Drag & toss · fitting balls sink in corners, then return"}</p>
    </div>
    <div ref={field} tabIndex={-1} className="bubble-cloud bubble-field panel" aria-label="Floating subnet balls" data-motion={paused ? "paused" : "running"}
      onPointerDown={event=>{if(!field.current)return;const rect=field.current.getBoundingClientRect();const x=event.clientX-rect.left-field.current.clientLeft,y=event.clientY-rect.top-field.current.clientTop;const hit=[...bodies.current].reverse().find(b=>!b.pocket&&Math.hypot(b.x-x,b.y-y)<=b.r);if(hit)down(event,hit.id);}}
      onPointerMove={move} onPointerUp={event=>end(event)} onPointerCancel={event=>end(event,true)} onLostPointerCapture={event=>end(event,true)}>
      <canvas ref={canvas} className="ball-canvas" aria-hidden="true"/>
      <div className="pool-pockets" aria-hidden="true">{["top-left", "top-right", "bottom-left", "bottom-right"].map(corner => <i key={corner} className={`pool-pocket ${corner}`}/>)}</div>
      <div className="pool-sights" aria-hidden="true">{[25, 50, 75].flatMap(position => [<i key={`top-${position}`} className="top" style={{left:`${position}%`}}/>, <i key={`bottom-${position}`} className="bottom" style={{left:`${position}%`}}/>])}</div>
      {items.map(item => <button key={item.id} ref={node => { if (node) buttons.current.set(item.id, node); else buttons.current.delete(item.id); }}
        tabIndex={matches(item) ? 0 : -1} className={`market-bubble ${item.change > .005 ? "gain" : item.change < -.005 ? "loss" : "flat"} ${selected === item.id ? "selected" : ""} ${dragging === item.id ? "dragging" : ""} ${matches(item) ? "" : "search-dimmed"}`}
        onFocus={event=>{focused.current=event.currentTarget.matches(":focus-visible")?item.id:null;wake.current();}} onBlur={()=>{focused.current=null;wake.current();}}
        onClick={() => { if (skipClick.current) { skipClick.current = false; return; } onSelect(item.id); setInspecting(item.id); }}
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
