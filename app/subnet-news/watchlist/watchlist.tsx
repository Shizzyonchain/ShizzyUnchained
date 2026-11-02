"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { readWatchlist, WATCHLIST_KEY } from "../../lib/watchlist";
import styles from "./page.module.css";
type Option = { id: number; name: string; stories: { key: string; date: string; name: string; headline: string; status: string }[] };
let fallback = "";
let sessionOnly = false;
const snapshot = () => { if (sessionOnly) return fallback; try { return localStorage.getItem(WATCHLIST_KEY) || ""; } catch { return fallback; } };
const subscribe = (notify: () => void) => { window.addEventListener("storage", notify); window.addEventListener("shizzy-watchlist", notify); return () => { window.removeEventListener("storage", notify); window.removeEventListener("shizzy-watchlist", notify); }; };
export function Watchlist({ options }: { options: Option[] }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const selected = readWatchlist(raw, options.map(row => row.id));
  const [choice, setChoice] = useState(String(options[0]?.id || ""));
  const [message, setMessage] = useState("");
  function save(ids: number[]) {
    fallback = JSON.stringify(ids);
    try { localStorage.setItem(WATCHLIST_KEY, fallback); setMessage("Saved in this browser."); }
    catch { sessionOnly = true; setMessage("Browser storage is unavailable. Changes last only in this open session."); }
    window.dispatchEvent(new Event("shizzy-watchlist"));
  }
  return <><form className={styles.controls} onSubmit={event => { event.preventDefault(); const id = Number(choice); if (selected.includes(id)) { setMessage("That subnet is already on your list."); return; } if (selected.length >= 20) { setMessage("Your list has 20 subnets. Remove one before adding another."); return; } if (options.some(row => row.id === id)) save([...selected, id]); }}><label htmlFor="watchlist-subnet">Choose subnet<select id="watchlist-subnet" value={choice} onChange={event => setChoice(event.target.value)}>{options.map(row => <option key={row.id} value={row.id}>SN{row.id} · {row.name}</option>)}</select></label><button type="submit">Add to watchlist</button></form><p role="status" aria-live="polite">{message}</p><h2>{selected.length} / 20 saved subnets</h2>{!selected.length && <p>Your watchlist is empty. Add a subnet to start your catch-up.</p>}<div className={styles.cards}>{selected.map(id => { const row = options.find(option => option.id === id)!; return <article key={id} aria-label={`SN${id} watchlist card`}><div className={styles.cardHeader}><h2>SN{id} · {row.name}</h2><button type="button" aria-label={`Remove SN${id}`} onClick={() => save(selected.filter(value => value !== id))}>Remove</button></div>{row.stories.length ? <ul>{row.stories.map(story => <li key={story.key}><p>{story.date} edition · {story.name} · {story.status}</p><Link href={`/subnet-news/${story.date}`}>{story.headline}</Link></li>)}</ul> : <p>No published stories found for this slot in the available archive.</p>}<div className={styles.links}><Link href={`/subnet-news/search?subnet=${id}`}>All SN{id} stories →</Link><Link href={`/charts/${id}`}>Subnet chart →</Link></div></article>; })}</div></>;
}



