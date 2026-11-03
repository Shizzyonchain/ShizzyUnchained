import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../site-header";
import { withSocialMetadata } from "../lib/social-metadata";
import styles from "./privacy.module.css";

export const metadata: Metadata = withSocialMetadata({
  title: "Privacy & data | ShizzyUnchained",
  description: "What ShizzyUnchained processes, what stays in your browser, how wallet lookups work, and how to clear saved data or contact us.",
}, "/privacy");

const sections = [
  ["wallets", "Wallet lookups"], ["storage", "On your device"], ["retention", "Storage & deletion"],
  ["services", "Other services"], ["analytics", "Analytics & performance"], ["contact", "Questions & requests"],
] as const;

export default function PrivacyPage() {
  return <div className={styles.page}>
    <SiteHeader hideCurrency />
    <main className={styles.content}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>YOUR DATA · YOUR CONTROLS</p>
        <h1>Privacy &amp; data</h1>
        <p className={styles.lead}>Here’s what happens when you browse the site or look up a wallet—and what you can clear yourself.</p>
        <p className={styles.updated}>Last updated <time dateTime="2026-10-22">October 22, 2026</time></p>
      </header>
      <div className={styles.quick}>
        <article><h2>Read-only wallets</h2><p>Enter public coldkeys only. The tracker does not need a seed phrase, private key or signing permission.</p></article>
        <article><h2>Saved on this device</h2><p>Your last wallet results and some preferences can be saved in this browser. Clearing them does not erase server copies or chain history.</p></article>
        <article><h2>Services receive requests</h2><p>Hosting, data providers and embedded media can receive information needed to serve your visit. A public wallet address is not anonymous.</p></article>
      </div>
      <nav className={styles.contents} aria-label="Privacy topics">{sections.map(([id, title]) => <a href={`#${id}`} key={id}>{title}<span aria-hidden="true">↓</span></a>)}</nav>
      <section id="wallets" className={styles.section}>
        <h2>When you look up a wallet</h2>
        <p>The tracker sends the public addresses you enter to our server to read balances and stake from Bittensor through a chain node. Server lookup jobs store those addresses, progress and results so the check can finish and resume. A job identifier retrieves the results; avoid sharing it if you do not want others to see the lookup.</p>
        <p>Opening recent activity sends that wallet address through our server to TaoStats for indexed signed transactions and incoming/outgoing TAO transfers. Responses are cached for reuse. Public-chain balances and transactions can reveal financial activity even without a name attached.</p>
        <p>Wallet links can include an address in the URL. Anyone you share that link with can see it. Requests and URLs may also be visible to hosting, network and data providers. Hiding amounts changes the display; it does not remove the underlying data or hide it from those providers.</p>
      </section>
      <section id="storage" className={styles.section}>
        <h2>What stays in your browser</h2>
        <p>The site uses local storage for last-checked wallets and holdings, a resumable job identifier, market/price caches, chart drawings, indicator colors and drawing-tool preferences. Some notices use session storage to remember dismissal for the current browser session. These copies are specific to this browser and profile; people using the same profile may see them.</p>
        <div className={styles.callout}><h3>Clear saved wallets</h3><p>Open <Link href="/wallet-tracker">Wallet Tracker</Link> and choose <strong>Clear saved wallets &amp; cache</strong>. A wallet’s <strong>Remove</strong> button forgets that wallet. These controls also clear the relevant in-memory activity cache.</p><p>To remove other saved settings or drawings, use the chart controls or your browser’s site-data settings for shizzyunchained.com. Clearing site data resets local preferences; it does not delete server records, third-party records or blockchain history.</p></div>
        <p>Saved wallet results do not have an automatic browser expiry. They may remain until you remove them, clear site data or the browser removes them. A saved snapshot is not a fresh lookup.</p>
      </section>
      <section id="retention" className={styles.section}>
        <h2>Server storage &amp; deletion</h2>
        <p>Our wallet worker’s configured default makes completed and failed lookup jobs eligible for deletion after 24 hours without an update. Cleanup checks run about hourly while the worker is operating. This is not a promise of deletion exactly 24 hours after you submit a lookup; queued or processing jobs are not covered by that cleanup rule.</p>
        <p>Recent-activity responses normally use a five-minute cache, with stale responses sometimes served during refresh. A cache’s refresh interval is not a guarantee that every stored copy has been erased.</p>
        <p>Application jobs, hosting/security logs, backups and provider caches are different records. We have not established one verified deletion period covering all of them. Older wallet snapshot records, where present, are not covered by the job cleanup rule. Browser clear/remove controls do not issue a server-side deletion request.</p>
        <p>For help with server-held lookup data, <a href="mailto:shizzyunchained@gmail.com?subject=Privacy%20request">email a privacy request</a>. We can review what we control; we cannot erase Bittensor’s public history or promise deletion of records independently held by other services.</p>
      </section>
      <section id="services" className={styles.section}>
        <h2>Other services you may interact with</h2>
        <ul>
          <li><strong>Hosting and chain data:</strong> Vercel serves the website, and the backend is hosted on Render. Requests can include IP address, browser information, URL and diagnostic information. Chain/RPC providers and TaoStats receive the public data queries needed for their features.</li>
          <li><strong>Videos:</strong> embedded players use YouTube’s privacy-enhanced youtube-nocookie.com domain. Loading or playing a video contacts Google/YouTube; privacy-enhanced mode does not mean no data is transferred. Membership access is handled by YouTube.</li>
          <li><strong>Bookings, purchases and community:</strong> Calendly, Stripe, the merchandise store, Telegram, X, partners and other linked sites handle their own interactions. Affiliate/referral links may identify Shizzy as the referrer. Their policies apply after you follow those links; we do not receive your payment-card details through the site’s checkout links.</li>
          <li><strong>Contact:</strong> if you email or message us, the service you choose processes that communication. We use what you provide to respond and handle the request. No fixed deletion period for correspondence has been established.</li>
        </ul>
        <p>Provider information: <a href="https://vercel.com/legal/privacy-notice" target="_blank" rel="noreferrer">Vercel privacy notice</a> · <a href="https://render.com/privacy" target="_blank" rel="noreferrer">Render privacy policy</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google privacy policy</a>.</p>
      </section>
      <section id="analytics" className={styles.section}>
        <h2>Traffic &amp; performance measurements</h2>
        <p>The site includes Vercel Web Analytics and Speed Insights to understand visits and real loading performance. Measurements can include page/route, referrer, browser/device information, approximate location and performance timings. Hosting and security logging are separate from analytics.</p>
        <p>Vercel describes Web Analytics as cookie-free and uses an anonymous visitor identifier rather than a persistent tracking cookie. That does not make every service on this site cookie-free, or mean your IP address never reaches a server. Embedded media and linked services have their own storage and data practices.</p>
        <p>We measure clicks to a fixed list of site sections and partner services. These events identify the destination category only, not a purchase or completed booking. They do not include wallet lists, balances or raw search text. Analytics URLs have query strings, fragments and recognized wallet addresses removed. The subnet news watchlist stores selected subnet numbers in this browser’s local storage, without an account or cross-device sync. These selections are not included in destination events. Remove entries in the watchlist or clear this site’s browser data to remove saved selections. If storage is unavailable, selections last only for the open session. URLs themselves can carry information, so do not place secrets in links or inputs. Your browser’s privacy controls and content-blocking tools may limit third-party measurement; clearing local site data alone does not disable future analytics.</p>
        <p><a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noreferrer">How Vercel Web Analytics handles data</a> · <a href="https://vercel.com/docs/speed-insights" target="_blank" rel="noreferrer">About Speed Insights</a></p>
      </section>
      <section id="contact" className={styles.section}>
        <h2>Questions, corrections or privacy requests</h2>
        <p>Contact Shizzy Unchained at <a href="mailto:shizzyunchained@gmail.com">shizzyunchained@gmail.com</a>. Tell us the feature and approximate date involved, and what you want us to review. Include a public address or job identifier only if needed—never a seed phrase, private key or password.</p>
        <p>This notice describes the current site. We will update its date when these practices change.</p>
        <Link className={styles.button} href="/wallet-tracker">Open Wallet Tracker →</Link>
      </section>
    </main>
  </div>;
}
