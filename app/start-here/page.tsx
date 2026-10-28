import Link from "next/link";
import { SiteHeader } from "../site-header";
import { withSocialMetadata } from "../lib/social-metadata";
import { beginnerLessons } from "./lessons";
import { FeaturedVideo } from "./featured-video";
import styles from "./start.module.css";

export const metadata = withSocialMetadata({ title: "Understand Bittensor with Shizzy | Start Here", description: "Watch Shizzy’s website walkthrough, learn the basics of Bittensor and explore your first subnet." }, "/start-here");
const summaries = [
  "One network. Many teams solving different problems.",
  "The network’s token and each subnet’s token are different assets.",
  "A specialized task, competitors and a way to score the work.",
  "Miners do the work. Validators evaluate the results.",
  "Token rewards fund participation. They aren’t customer revenue.",
  "Product. Users. Incentives. Evidence. Start with those four.",
];
export default function StartHere() {
  return <div className={styles.page}><SiteHeader hideCurrency /><main className={styles.wrap}>
    <header className={styles.hero}><div><p className={styles.eyebrow}>START HERE · WITH SHIZZY</p><h1>Understand Bittensor.<br /><span>Then explore it.</span></h1></div><p className={styles.intro}>Meet the builders. Understand the tokens. Learn what to look for before you pick a subnet.</p></header>
    <section className={styles.feature} aria-labelledby="walkthrough-title"><FeaturedVideo /><div className={styles.featureCopy}><p className={styles.eyebrow}>WATCH FIRST · 16:27</p><h2 id="walkthrough-title">Read a subnet page<br /> with me.</h2><p>I’ll walk you through the website and the tools I use to research Bittensor subnets.</p><ul><li>Make sense of the market data</li><li>Find owner activity and sources</li><li>Go deeper with the builders</li></ul><a data-onboarding="walkthrough" href="https://www.youtube.com/watch?v=AeDXwWTAaf0" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a></div></section>
    <section className={styles.course} aria-labelledby="course-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE BASICS</p><h2 id="course-title">Six things worth understanding.</h2></div><span className={styles.readLabel}>SHORT READS · GO IN ORDER OR PICK A TOPIC</span></div><div className={styles.lessonGrid}>{beginnerLessons.map((lesson,index)=><article key={lesson.slug} id={lesson.slug}><div className={styles.lessonTop}><span className={styles.number}>{lesson.number}</span><span className={styles.format}>EXPLAINED SIMPLY</span></div><h3>{lesson.title}</h3><p className={styles.summary}>{summaries[index]}</p><details><summary>Read the explanation <span aria-hidden="true">＋</span></summary><div className={styles.transcript}>{lesson.script.split(/(?<=\.) /).reduce<string[][]>((groups,sentence,index)=>{if(index%4===0)groups.push([]);groups[groups.length-1].push(sentence);return groups;},[]).map((paragraph,index)=><p key={index}>{paragraph.join(" ")}</p>)}<a href={lesson.source} target="_blank" rel="noopener noreferrer">Bittensor documentation ↗</a></div></details></article>)}</div></section>
    <section className={styles.next}><div><p className={styles.eyebrow}>PUT IT INTO PRACTICE</p><h2>Find your first subnet.</h2><p>Choose a sector you understand. Find a product you can explain.</p></div><Link data-onboarding="sectors" href="/sectors" prefetch={false}>Explore the sectors <span aria-hidden="true">→</span></Link></section>
  </main></div>;
}
