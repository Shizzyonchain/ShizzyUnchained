import { withSocialMetadata } from "../../lib/social-metadata";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import { DeepDivesHeader } from "../deep-dives-header";

export const metadata = withSocialMetadata({ title: "Compute Wars | Shizzy Deep Dives", description: "The battle to control the decentralized AI compute stack has already begun.", alternates: { canonical: "/deep-dives/compute-wars" } }, "/deep-dives/compute-wars", { article: true });

function clean(line: string) {
  return line.replaceAll("\u00e2\u20ac\u0153", "“").replaceAll("\u00e2\u20ac\u009d", "”").replaceAll("\u00e2\u20ac\u2122", "’").replaceAll("\u00cf\u201e", "τ")
    .replace(/\bIm\b/g, "I’m").replace(/\bdont\b/gi, m => m[0] === "D" ? "Don’t" : "don’t").replace(/\bdoesnt\b/gi, "doesn’t")
    .replace(/\bisnt\b/gi, "isn’t").replace(/\bcant\b/gi, "can’t").replace(/\barent\b/gi, "aren’t").replace(/\bwont\b/gi, "won’t")
    .replace(/\balot\b/gi, "a lot").replace(/\bworlds\b/gi, "world’s");
}

export default function ComputeWarsPage() {
  const raw = readFileSync(join(process.cwd(), "content/deep-dives/compute-wars.txt"), "utf8");
  const lines = raw.split(/\r?\n/).map(line => clean(line.trim())).filter(Boolean).slice(3);
  return <main className="deep-shell"><DeepDivesHeader />
    <article className="deep-article">
      <header className="article-hero"><Link href="/sectors">← Sectors</Link><p>AI infrastructure · Bittensor</p><h1>Compute Wars:<br/><span>The Battle for AI Infrastructure Has Begun</span></h1><div><b>Shizzy</b><span>@ShizzyUnchained</span><span>18 min read</span></div></header>
      <Image className="article-cover" src="/deep-dives/compute-wars.png" alt="Compute Wars: The battle for Bittensor AI infrastructure" width={900} height={360} sizes="100vw"/>
      <div className="article-layout"><aside><span>Inside the battle</span><ol><li>Inference</li><li>Distributed compute</li><li>GPU marketplace</li><li>Private compute</li><li>Developer access</li><li>Optimization</li><li>Retrieval</li><li>Verification</li><li>Proof</li><li>Sustainability</li></ol></aside>
        <div className="article-body">{lines.map((line, index) => {
          if (/^SN\d+\s/.test(line)) { const [sn, ...name] = line.split(" "); return <h2 key={index}><span>{sn}</span>{name.join(" ")}</h2>; }
          if (line === line.toUpperCase() && line.length > 12) return <h2 className="article-thesis" key={index}>{line}</h2>;
          if (/^The .+ War$/.test(line)) return <h3 key={index}>{line}</h3>;
          if (line === "Shizzy") return <p className="article-signoff" key={index}>— Shizzy</p>;
          return <p key={index}>{line}</p>;
        })}</div>
      </div>
    </article>
  </main>;
}
