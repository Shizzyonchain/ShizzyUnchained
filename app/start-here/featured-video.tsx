"use client";
import { useState } from "react";
import Image from "next/image";
import styles from "./start.module.css";

export function FeaturedVideo() {
  const [playing, setPlaying] = useState(false);
  return <div className={styles.player}>{playing ? <iframe title="Shizzy’s Bittensor website walkthrough" src="https://www.youtube-nocookie.com/embed/AeDXwWTAaf0?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen onLoad={event=>event.currentTarget.focus()} /> : <button type="button" className={styles.playButton} aria-label="Play the website walkthrough" onClick={()=>setPlaying(true)}><Image src="https://i.ytimg.com/vi/AeDXwWTAaf0/maxresdefault.jpg" alt="Shizzy introduces his Bittensor research website" fill sizes="(max-width: 760px) 100vw, 66vw" priority /><span className={styles.playIcon} aria-hidden="true">▶</span><span className={styles.videoBadge}>WEBSITE WALKTHROUGH <span>16:27</span></span></button>}</div>;
}
