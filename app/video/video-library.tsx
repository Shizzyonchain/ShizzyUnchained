"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MembershipPromo } from "../membership-promo";
import { latestMemberVideo, promotedLivestream, youtubeMembershipUrl } from "../lib/channel-promotions";

type ChannelVideo = {
  id: string;
  title: string;
  meta: string;
  membersOnly?: boolean;
  upcoming?: boolean;
  startsAt?: string;
};

const channelVideos: ChannelVideo[] = [
  { id: "9orJTIbMwmQ", title: "Bittensor Subnets CRASHING! Sell Now or MORE PAIN Ahead?", meta: "20:48 · Public video · October 22, 2026" },
  { id: "3i9F3_Ku8Fo", title: "Bittensor’s Next Big Robotics Breakthrough? | Attune SN58", meta: "46:18 · Livestream replay · October 21, 2026" },
  ...(promotedLivestream.listed && !promotedLivestream.upcoming ? [promotedLivestream] : []),
  {
    id: "ac6bldErBFU",
    title: "Can Bittensor Make AI Faster and Cheaper? Inside Pareton SN10",
    meta: "36:34 · Livestream replay · October 20, 2026",
  },
  {
    id: "0SNqFLlw3oQ",
    title: "The BEST Bittensor Subnets To Buy Before The Next Leg Up! Ft. Shizzy",
    meta: "26:36 · Invest with Doc · Guest appearance · October 20, 2026",
  },
  {
    id: "gMXHteCtXbA",
    title: "Bittensor TAO vs AI Tyranny: Who Controls the Future?",
    meta: "20:29 · October 19, 2026",
  },
  {
    id: "AeDXwWTAaf0",
    title: "Buying Bittensor Subnets? Watch This Before You Buy Another One!",
    meta: "16:27 · October 19, 2026",
  },
  {
    id: "HT5bXLvAYwc",
    title: "10/16/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "9:03 · Members-only video · October 16, 2026",
    membersOnly: true,
  },
  {
    id: "lPKnwlkAWdQ",
    title: "TAO RISES FROM HELL! 🔥 Bittensor Is Making HUGE Moves!",
    meta: "18:44 · October 15, 2026",
  },
  {
    id: "02ZUtgwaUAQ",
    title: "Bittensor TAO: The Greatest Generational Wealth Opportunity of Our Lifetime?",
    meta: "22:30 · October 12, 2026",
  },
  {
    id: "q4QrIy3lBEA",
    title: "LIUM SN51: The First BILLION DOLLAR Subnet on Bittensor?",
    meta: "11:29 · October 11, 2026",
  },
  {
    id: "KvPXO07ehdE",
    title: "10/9/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "10:14 · Members-only video · October 9, 2026",
    membersOnly: true,
  },
  {
    id: "u388cY3nvQk",
    title: "Bittensor TAO Below $300 | Shakeout or More Pain Ahead?",
    meta: "25:53 · October 8, 2026",
  },
  {
    id: "w7yEF24XuFc",
    title: "10/6/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "5:28 · Members-only video · October 6, 2026",
    membersOnly: true,
  },
  {
    id: "EY-s2-882uA",
    title: "Bittensor TAO at $300: Is This the Launchpad for Liftoff?",
    meta: "22:09 · October 5, 2026",
  },
  {
    id: "PQ7gRxDG1Sg",
    title: "How to Buy Bittensor Subnet Tokens: Set Up a TAO Wallet in Minutes",
    meta: "10:25 · October 4, 2026",
  },
  {
    id: "rEaGFK5yn8g",
    title: "Quantum Computing Is Already on Bittensor?! | SN48 Quantum Compute",
    meta: "59:18 · Livestream replay · October 14, 2026",
  },
  {
    id: "OWQoSVN3M9s",
    title: "Can AI Predict the Future? Inside Bittensor’s Cascade SN91",
    meta: "54:15 · Livestream replay · October 7, 2026",
  },
  {
    id: "mTJBFowN4Yo",
    title: "Your Stake. Your Decision. Inside Bittensor’s First Democratised Validator",
    meta: "49:17 · Livestream replay · October 6, 2026",
  },
  {
    id: "M2nWtKAkw6I",
    title: "10/4/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "10:11 · Members-only video · October 4, 2026",
    membersOnly: true,
  },
  {
    id: "NAbCyYwZ_5w",
    title: "Can Bittensor Train Real Robots? Inside Nepher Robotics SN49",
    meta: "52:47 · Livestream replay · October 1, 2026",
  },
  {
    id: "TmGJBuSoqrI",
    title: "$400 TAO NEXT WEEK? Bittensor Is Ready to Explode!",
    meta: "31:03 · September 30, 2026",
  },
  {
    id: "1J8va16QaMQ",
    title: "Stablecoins on Bittensor… But NOT What You Think",
    meta: "44:44 · September 30, 2026",
  },
  {
    id: "VQAAbraL8Xk",
    title: "Const Just Dropped GAMMA Tokens: Bittensor’s Next Big Thing?",
    meta: "40:59 · September 29, 2026",
  },
  {
    id: "LR3wKS9n0B8",
    title: "Was I WRONG About Bittensor TAO? | Subnet Update",
    meta: "25:37 · September 24, 2026",
  },
  {
    id: "300LNwdErug",
    title: "Zcash Tags Out, Bittensor TAO Enters the Ring",
    meta: "24:37 · Latest episode · September 21, 2026",
  },
  {
    id: "le63VDOvQoA",
    title: "Bittensor vs Big AI | Can TAO Take On OpenAI & Anthropic?",
    meta: "25:20 · September 17, 2026",
  },
  {
    id: "OEoYrwtw1aM",
    title: "TAO CLARITY NOW! | Bittensor Market Update",
    meta: "20:56 · September 14, 2026",
  },
  latestMemberVideo,
  {
    id: "Oo9VcUot7GI",
    title: "10/18/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "14:33 · Members-only video · Published October 19, 2026",
    membersOnly: true,
  },
  {
    id: "e5MbgqtTh5E",
    title: "10/13/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "12:22 · Members-only video · October 13, 2026",
    membersOnly: true,
  },
  {
    id: "VoXAV91L9RU",
    title: "10/11/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "10:40 · Members-only video · October 11, 2026",
    membersOnly: true,
  },
  {
    id: "ChgsHOGC1hM",
    title: "10/2/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "8:46 · Members-only video · October 2, 2026",
    membersOnly: true,
  },
  {
    id: "FqFmRffEgVU",
    title: "9/29/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "9:13 · Members-only video · September 29, 2026",
    membersOnly: true,
  },
  {
    id: "4JHTcfpT28M",
    title: "9/25/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "9:06 · Members-only video · September 25, 2026",
    membersOnly: true,
  },
  {
    id: "b3yTGrM1RYM",
    title: "9/20/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "10:21 · Members only · September 20, 2026",
    membersOnly: true,
  },
  {
    id: "NnYp42IMcAo",
    title: "9/18/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "10:13 · Members only · September 18, 2026",
    membersOnly: true,
  },
  {
    id: "w-1v70FPNlY",
    title: "9/16/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "10:12 · Members only · September 16, 2026",
    membersOnly: true,
  },
  {
    id: "UgjayLzGqks",
    title: "9/15/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "8:12 · Members only · September 15, 2026",
    membersOnly: true,
  },
  {
    id: "gnAxV7cTUhU",
    title: "9/12/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "9:17 · Members only · September 12, 2026",
    membersOnly: true,
  },
  {
    id: "9unkZUzL-Ps",
    title: "TAO Broke Down… What Happens Next? | Bittensor Subnet Market",
    meta: "19:48 · September 10, 2026",
  },
  {
    id: "bUPt2C9_irc",
    title: "9/8/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "18:35 · Members only · September 8, 2026",
    membersOnly: true,
  },
  {
    id: "L3wLKIoYz1c",
    title: "TAO Breakout Is NOW! | Bittensor Subnet Update",
    meta: "22:44 · September 7, 2026",
  },
  {
    id: "mu-qKyEkKpU",
    title: "9/6/26 Bittensor News Updates & TAO Price Action | Members Video",
    meta: "10:11 · Members only · September 6, 2026",
    membersOnly: true,
  },
  {
    id: "T_KsttRZ9pk",
    title: "TAO to $300? | Bittensor Market & Subnet Update",
    meta: "26:42",
  },
  {
    id: "fYObv1EvoZw",
    title: "TAO VS BEARS",
    meta: "28:21",
  },
  {
    id: "4AbH1FSdjtI",
    title: "CLIMB TO $1,000 TAO | Bittensor Subnet Update",
    meta: "27:07",
  },
  {
    id: "QmDlpkGxZ8U",
    title: "You Know I Need More TAO | Bittensor Subnet Update",
    meta: "31:29",
  },
  {
    id: "3pxxCOBit2Q",
    title: "Subnets Are Better Than Altcoins | Bittensor TAO",
    meta: "24:46",
  },
  {
    id: "VdR1zT4BIxM",
    title: "I AIN’T GOT NO WORRIES | TAO | Week 14",
    meta: "25:01",
  },
  {
    id: "uEB3rUEQlnk",
    title: "TAO Is Better Than Bitcoin?! Bittensor Price Target w/ @Shizzyunchained",
    meta: "25:30 · Featured interview",
  },
  {
    id: "wVVI3NAr-bE",
    title: "Borrow Against Your Bittensor Subnet Tokens | SCORE SN44 on Mentat Lend",
    meta: "12:22",
  },
  {
    id: "HoIJXaD_zOY",
    title: "Bitcoin Dreams It Was Bittensor",
    meta: "27:35",
  },
  {
    id: "tIszrpO_1nQ",
    title: "The Great Rotation Into Bittensor Has Begun | Week 13",
    meta: "26:00",
  },
  {
    id: "RqhuuOXTsbA",
    title: "All In on TAO | Bittensor Subnet Market Update",
    meta: "25:36",
  },
  {
    id: "CinoduAcgCs",
    title: "Bittensor TAO Is Going Up Only | 10 to 100 TAO Challenge Week 12",
    meta: "18:53",
  },
  {
    id: "-PbwvYo6c4U",
    title: "State of Bittensor: The Breakout Subnet Is Here",
    meta: "23:07",
  },
  {
    id: "_2VA_b-HRnw",
    title: "Getting Out of Everything besides Compute - Week 11 10 to 100 TAO Challenge",
    meta: "20:28",
  },
  {
    id: "RfiDazAg8r8",
    title: "Compute Wars: The Battle for AI Infrastructure Has Begun on Bittensor",
    meta: "35:17",
  },
  {
    id: "AuUwiV1r_cs",
    title: "Bittensor TAO: Patience Pays Off - Week 10",
    meta: "20:39",
  },
  {
    id: "tdZGVfadd00",
    title: "The 10 to 100 TAO Challenge Is Getting Dangerous. Week 9",
    meta: "22:45",
  },
  {
    id: "6oSJxSfVUBk",
    title: "The Bittensor Move No One Is Ready For",
    meta: "26:35",
  },
  {
    id: "E8sZrmYiQ5Y",
    title: "The Trade Everyone Missed. Week 8 of the 10 to 100 TAO Challenge",
    meta: "23:48",
  },
  {
    id: "AymnXq08VDM",
    title: "Bittensor Subnet Update: Subnet Summer Is Canceled?",
    meta: "24:46",
  },
  {
    id: "beZ18Hdka0Q",
    title: "Week 7: 10 to 100 TAO Challenge. I’m Not Giving Up!",
    meta: "22:36",
  },
  {
    id: "pFPd1BoUe00",
    title: "Bittensor Subnet Update: Move Fast and Break People",
    meta: "24:23",
  },
  {
    id: "X3n7DVacpJA",
    title: "Week 6: 10 TAO to 100 TAO Challenge | Down But Not Out",
    meta: "22:30",
  },
  {
    id: "vXSlbxzwPJw",
    title: "Subnet Summer Just Got Real",
    meta: "25:35",
  },
];
const liveStreams: ChannelVideo[] = [
  { id: "q2pGNLUvCm4", title: "Leadpoet’s Latest Updates: From Leads to Action | Bittensor SN71", meta: "Upcoming livestream · October 28, 2026 · 11:00 AM ET / 8:00 AM PT", startsAt: "2026-10-28T15:00:00Z", upcoming: true },
  { id: "RnnWezJOuE8", title: "Bittensor Gets Expressive and Conviction Runs Deep with TAO Templar", meta: "Upcoming livestream · October 29, 2026 · 1:00 PM ET / 10:00 AM PT", startsAt: "2026-10-29T17:00:00Z", upcoming: true },

  {
    id: "ac6bldErBFU",
    title: "Can Bittensor Make AI Faster and Cheaper? Inside Pareton SN10",
    meta: "36:34 · Livestream replay · October 20, 2026",
  },
  {
    id: "rEaGFK5yn8g",
    title: "Quantum Computing Is Already on Bittensor?! | SN48 Quantum Compute",
    meta: "59:18 · Livestream replay · October 14, 2026",
  },
  {
    id: "fTlViZhXXzQ",
    title: "TAO, XRP, CC & NEAR: Which Crypto Wins BIG? Experts Debate LIVE!",
    meta: "1:51:56 · Guest appearance on Crypto Verdict · October 15, 2026",
  },
  ...(promotedLivestream.listed ? [promotedLivestream] : []),
  {
    id: "OWQoSVN3M9s",
    title: "Can AI Predict the Future? Inside Bittensor’s Cascade SN91",
    meta: "54:15 · Livestream replay · October 7, 2026",
  },
  {
    id: "mTJBFowN4Yo",
    title: "Your Stake. Your Decision. Inside Bittensor’s First Democratised Validator",
    meta: "49:17 · Livestream replay · October 6, 2026",
  },
  {
    id: "NAbCyYwZ_5w",
    title: "Can Bittensor Train Real Robots? Inside Nepher Robotics SN49",
    meta: "52:47 · Livestream replay · October 1, 2026",
  },
  {
    id: "MHGlnZgsUQI",
    title: "Should TAO Be In YOUR Portfolio??",
    meta: "46:58 · Livestream replay · September 24, 2026",
  },
  {
    id: "bCYDUY0c7kQ",
    title: "TAO Is Going Everywhere? Phil from ForeverMoney Explains Base & Robinhood Chain",
    meta: "45:11 · Livestream replay · September 23, 2026",
  },
  {
    id: "a1Gz_cQl5Ak",
    title: "UMI Goes Multichain: Bittensor’s SN78 Expands to Base & Robinhood Chain!",
    meta: "38:05 · Livestream replay · September 22, 2026",
  },
  {
    id: "oKl61Awh36Y",
    title: "MEMBERS ONLY LIVE STREAM: TAO AUTOPILOT? Inside AlphaChaser",
    meta: "1:07:31 · Members-only replay · September 22, 2026",
    membersOnly: true,
  },
  {
    id: "Upop6uigIa0",
    title: "XRP Flips ETH & TAO 20X by 2029?! @Shizzyunchained + 4 Experts Debate",
    meta: "1:24:43 · Guest appearance on Crypto Verdict · September 10, 2026",
  },
  {
    id: "x_cABVBK2Qc",
    title: "2009 Bitcoin OG’s Next Big Bet: TAO | Ride of a Lifetime with RL Bryer",
    meta: "1:02:17 · Livestream replay · September 9, 2026",
  },
  {
    id: "gRND9G1t-Bg",
    title: "AI Agents Are Downloading Malware… This Subnet Catches It | Phylax SN76",
    meta: "31:21 · Streamed September 2, 2026",
  },
  {
    id: "g-1j1yD79qY",
    title: "Shizzy VS Seby: The Bittensor Showdown | Subnet Update",
    meta: "1:29:44 · Streamed August 28, 2026",
  },
  {
    id: "eETePHcENvs",
    title: "Building the Robot Brain on Bittensor | Cameron, OpenRoboto",
    meta: "35:06 · Streamed August 26, 2026",
  },
  {
    id: "vif3oxM-IMo",
    title: "TAO BLASTING OFF | Bittensor Subnet Update",
    meta: "40:31",
  },
  {
    id: "QEJqBPAwo4w",
    title: "Universal Motion to Meaning | Bittensor SN78 with Michael Parker & Special K",
    meta: "30:08",
  },
  {
    id: "ItwKUo5Niz0",
    title: "You Stake It. You Earn Compute. | Nodexo SN106",
    meta: "57:52",
  },
  {
    id: "EViJzvUKPOE",
    title: "This AI Knows What You’re Going to Say Before You Say It | Babelbit w/ Tom Tensor",
    meta: "1:06:39",
  },
  {
    id: "8hJYqoRrdV8",
    title: "Bittensor Is Taking Over the AI Industry | Live with Michael Parker",
    meta: "1:08:46",
  },
  {
    id: "2XH-XnwwdPE",
    title: "Bittensor Subnets Are Entering a New Era | Live with James Altucher",
    meta: "1:00:02",
  },
  {
    id: "yZceSNu4ugc",
    title: "The TAO Thesis Nobody Is Ready For | Mark Jeffrey Live",
    meta: "1:28:37",
  },
  {
    id: "ealfKQI1q2g",
    title: "ChronoLLM SN38: The AI That Never Cheats Time | Live With Jean Hérelle, Founder of CrunchDAO",
    meta: "51:47",
  },
  {
    id: "T0BbzWFS7EE",
    title: "Bittensor Subnet update with Crypto Millie",
    meta: "1:35:16",
  },
  {
    id: "EJMXtvxC6Qo",
    title: "AI That Finds DNA Mutations: Minos SN107 Built on Bittensor",
    meta: "1:03:36",
  },
  {
    id: "F3ogKcX3xpE",
    title: "Leadpoet SN71 Deep Dive with Gavin Zaentz | AI Sales Intelligence on Bittensor",
    meta: "58:46",
  },
  {
    id: "wyif_M_zbwg",
    title: "Bittensor Subnet 85 VIDAIO: AI Video Enhancement With Gareth Howells",
    meta: "42:43",
  },
  {
    id: "rvfP0aSEGkQ",
    title: "Live With Tom From Bitcast and Stitch3. Attention pays on Bittensor!",
    meta: "44:15",
  },
  {
    id: "_DAintx1Zfs",
    title: "Live with Mark Jeffrey",
    meta: "1:21:33",
  },
  {
    id: "qxr-Q9d9Elw",
    title: "BITTENSOR’S SPECIAL K LIVE SN26 PERTURB, SN78 VOCENCE, AND THE FUTURE OF AI SUBNETS",
    meta: "48:22",
  },
  {
    id: "4VOSqr9zmaM",
    title: "Can Bittensor Get Its Own Stablecoin? LIVE with TensorUSD",
    meta: "57:35",
  },
];
// Upcoming streams never belong in the completed episode/replay shelves.
const recentVideos = channelVideos.filter(video => !video.upcoming);
const upcomingStreams = [...new Map([...channelVideos, ...liveStreams].filter(video => video.upcoming).map(video => [video.id, video])).values()].sort((a, b) => (a.startsAt ?? "9999").localeCompare(b.startsAt ?? "9999"));
const streamReplays = liveStreams.filter(video => !video.upcoming);
function episodeSubnets(title: string) { return [...new Set([...title.matchAll(/\bSN\s*(\d{1,3})\b/gi)].map(match => Number(match[1])).filter(id => id > 0 && id <= 128))]; }
export function VideoLibrary() {
 const [query, setQuery] = useState("");
 const matches = (video: ChannelVideo) => `${video.title} ${video.meta}`.toLowerCase().includes(query.trim().toLowerCase().replace(/^sn\s+(\d+)$/i, "sn$1"));
 const [activeVideo, setActiveVideo] = useState<ChannelVideo>(recentVideos.find(video => !video.membersOnly) ?? recentVideos[0]);
 return (
        <section className="videos-page">
          <div className="videos-intro">
            <div>
              <p className="eyebrow">Shizzy Unchained TV</p>
              <h1>
                Watch the latest.
                <br />
                <span>Stay ahead of TAO.</span>
              </h1>
            </div>
            <p>Deep dives, subnet updates, interviews, and the 10 to 100 TAO challenge. Watch public episodes here, catch upcoming streams, and open members videos on YouTube.</p>
          </div>
          <div className="featured-video panel">
            <div className="video-frame">
              {activeVideo.membersOnly ? (
                <a className="member-video-link" href={`https://www.youtube.com/watch?v=${activeVideo.id}`} target="_blank" rel="noreferrer">
                  <Image src={`https://i.ytimg.com/vi/${activeVideo.id}/hqdefault.jpg`} alt="" width={480} height={360} sizes="(max-width: 900px) 100vw, 70vw" />
                  <span><strong>Watch members video on YouTube ↗</strong><small>Sign in with your channel membership to watch.</small></span>
                </a>
              ) : (
                <iframe key={activeVideo.id} src={`https://www.youtube-nocookie.com/embed/${activeVideo.id}?rel=0`} title={activeVideo.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
              )}
            </div>
            <div className="video-caption">
              <span>{activeVideo.membersOnly ? "Members video" : activeVideo.upcoming ? "Upcoming live stream" : "Now playing"}</span>
              <h2>{activeVideo.title}</h2>
              <small>{activeVideo.meta}</small>
              <p>{episodeSubnets(activeVideo.title).map(id => <Link key={id} href={`/charts/${id}`} prefetch={false} style={{display:"inline-block",padding:"12px",color:"white",textDecoration:"underline"}}>SN{id} · chart, news &amp; history →</Link>)}</p>
              {activeVideo.membersOnly && <a className="channel-promo-button membership-join video-membership-join" href={youtubeMembershipUrl} target="_blank" rel="noreferrer">Join on YouTube <span aria-hidden="true">↗</span></a>}
            </div>
          </div>
          <MembershipPromo />
          <div style={{padding:"16px",border:"1px solid #333",margin:"16px 0"}}><label htmlFor="episode-search">Find an episode by title, date or SN</label><input id="episode-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try SN51 or robotics" style={{display:"block",width:"100%",padding:"14px",background:"#111",color:"white",border:"1px solid #555",marginTop:"10px"}} /><p>Searches titles and dates. Chapters and transcripts are not indexed.</p>{query && <button onClick={() => setQuery("")} style={{background:"white",color:"black",padding:"12px"}}>Clear episode search</button>}{![...liveStreams,...channelVideos].some(matches) && <p role="status">No matching episodes. Try a subnet number or a shorter title.</p>}</div>
          {[
            { id: "upcoming-livestreams", title: "Upcoming livestreams", eyebrow: "Scheduled · Set a reminder", videos: upcomingStreams, upcoming: true },
            { id: "livestream-replays", title: "Livestream replays", eyebrow: "Shizzy live", videos: streamReplays, upcoming: false },
          ].filter(section => section.videos.some(matches)).map(section => <section className="live-library" key={section.id} aria-labelledby={section.id}>
            <div className="library-head">
              <div>
                <p className="eyebrow">{section.eyebrow}</p>
                <h2 id={section.id}>{section.title}</h2>
              </div>
              <span>{section.videos.filter(matches).length} {section.upcoming ? "scheduled" : "replays"}</span>
            </div>
            <div className="live-grid">
              {section.videos.filter(matches).map((video, index) => (
                <button
                  key={video.id}
                  className={video.id === activeVideo.id ? "active" : ""}
                  onClick={() => {
                    setActiveVideo(video);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <span className="video-thumb">
                    <Image src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" width={480} height={360} sizes="(max-width: 700px) 100vw, 25vw" />
                    <i>▶</i>
                    <em className={`stream-badge${video.upcoming ? " upcoming-badge" : ""}`}>{video.upcoming ? "Upcoming livestream" : "Live replay"}</em>
                  </span>
                  <span className="video-info">
                    <small>{String(index + 1).padStart(2, "0")}</small>
                    <span>
                      <b>{video.title}</b>
                      <em>{video.meta}</em>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>)}
          <div className="video-library">
            <div className="library-head">
              <div>
                <p className="eyebrow">From the channel</p>
                <h2>Recent videos</h2>
              </div>
              <span>{recentVideos.length} episodes</span>
            </div>
            <div className="video-grid">
              {recentVideos.filter(matches).map((video, index) => (
                <button
                  key={video.id}
                  className={video.id === activeVideo.id ? "active" : ""}
                  onClick={() => {
                    setActiveVideo(video);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <span className="video-thumb">
                    <Image src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" width={480} height={360} sizes="(max-width: 700px) 100vw, 25vw" />
                    <i>▶</i>
                    <em>{video.meta.split(" · ")[0]}</em>
                    {video.membersOnly && <em className="stream-badge members-badge">Members only</em>}
                  </span>
                  <span className="video-info">
                    <small>{String(index + 1).padStart(2, "0")}</small>
                    <b>{video.title}</b>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
);
}
