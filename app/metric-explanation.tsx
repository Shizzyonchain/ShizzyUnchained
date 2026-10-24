import styles from "./metric-explanation.module.css";

type Guide = { meaning: string; example: [string, string][]; takeaway: string; details: string };
const momentum: Guide = {
  meaning: "Which subnet has the strongest price move over the last hour?",
  example: [["Subnet A", "+3%"], ["Subnet B", "+1%"], ["Leader", "Subnet A"]],
  takeaway: "A price leader is not automatically the best project or a recommendation to buy.",
  details: "Uses the highest available rolling 1-hour return. USD mode compares dollar returns; TAO mode compares alpha/TAO returns, so the leader can change. If all subnets are down, the leader is the one with the smallest decline. Missing hourly returns are excluded.",
};
const guides: Record<string, Guide> = {
  "Momentum": momentum,
  "Top mover": momentum,
  "Weakest mover": {
    meaning: "Which subnet has the lowest price return over the last hour?",
    example: [["Subnet A", "−3%"], ["Subnet B", "+1%"], ["Weakest mover", "Subnet A"]],
    takeaway: "A weak price move does not establish a bad project or a reason to sell.",
    details: "Uses the lowest available rolling 1-hour return among alpha subnets. Root and invalid or missing returns are excluded. USD mode uses dollar returns; TAO mode uses alpha/TAO returns. If every subnet is rising, this shows the smallest gain. This complements Top mover, which shows the strongest return.",
  },
  "Volume pulse": {
    meaning: "Is trading busier or quieter than the previous hour?",
    example: [["Previous hour", "100 TAO"], ["Latest hour", "200 TAO"], ["Volume pulse", "2× · twice as busy"]],
    takeaway: "More trading does not mean more buying. Both buys and sells contribute to activity.",
    details: "Compares trading volume in the latest rolling hour with the preceding hour, measured in TAO. 1× means equal activity; 0.5× means half as much. Green means at least 1×; red means below 1×. Only subnets with positive volume and a usable comparison enter the total. A dash means no usable comparison. Switching USD/TAO does not change the ratio.",
  },
  "Emission": {
    meaning: "Which subnet gained the most emission share over the last hour?",
    example: [["Previous share", "2.0%"], ["Current share", "2.1%"], ["Change", "+0.1 points"]],
    takeaway: "This tracks reward allocation—not price gains or the return you earn from staking.",
    details: "Shows the subnet with the largest available hourly increase in its share of network emissions. Changes are percentage points: 2% to 2.1% is +0.1 points, not +0.1%. If every available change is negative, the leader has the smallest decline. Switching USD/TAO does not change emission share.",
  },
  "Liquidity flow": {
    meaning: "Did subnet pools gain or lose TAO reserves over the last hour?",
    example: [["Previous reserves", "1,000 TAO"], ["Current reserves", "1,050 TAO"], ["Net flow", "+50 TAO"]],
    takeaway: "Green means reserves grew; red means they fell. This is not the same as trading volume.",
    details: "Each available pool reserve change is estimated from its current TAO reserve and hourly percentage change, then summed across subnets. USD mode converts the TAO change at the current reference price. It is not a direct measure of new money entering Bittensor. Missing reserve history is excluded. A dash means zero or unavailable.",
  },
  "Markets rising": {
    meaning: "How much of the subnet market is moving up over the last hour?",
    example: [["Moving up", "8 subnets"], ["Moving down", "2 subnets"], ["Markets rising", "80%"]],
    takeaway: "This measures how widespread the gains are—not how big they are.",
    details: "Rising subnets divided by all subnets that rose or fell over the rolling last hour. Unchanged and missing returns are excluded. USD mode uses dollar returns; TAO mode uses alpha/TAO returns. Green means at least half of the moving markets are rising; red means fewer than half.",
  },
  "TAO price": {
    meaning: "How many dollars is one TAO worth at the current reference price?",
    example: [["Example TAO price", "$300"], ["Example amount", "10 TAO"], ["Dollar value", "$3,000"]],
    takeaway: "In TAO mode, one TAO is always τ 1. The dollar price is used to convert values across the page.",
    details: "Tap the price or chart link to open TAO/USD history. A current reference price does not prove every subnet snapshot is current; check the Finney feed status too.",
  },
  "24h volume": {
    meaning: "How much TAO was traded across subnet markets in the last 24 hours?",
    example: [["Subnet A volume", "80 TAO"], ["Subnet B volume", "120 TAO"], ["Combined volume", "200 TAO"]],
    takeaway: "Volume is trading activity—not market value, available liquidity or profit.",
    details: "Sums reported rolling 24-hour volume across the current subnet snapshot. TAO mode shows TAO; USD mode converts the total at the current TAO/USD reference price, rather than using each trade’s historical dollar price. Missing history may make the total incomplete. A dash means it is not ready.",
  },
};

export function MetricExplanation({ title }: { title: string }) {
  const guide = guides[title];
  if (!guide) return null;
  return <div className={styles.body}>
    <p className={styles.meaning}>{guide.meaning}</p>
    <section className={styles.example} aria-label="Illustrative example">
      <h3>A simple example <span>Illustrative numbers</span></h3>
      <dl>{guide.example.map(([label, value], index) => <div key={label} className={index === 2 ? styles.result : undefined}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
    <div className={styles.takeaway}><h3>What to remember</h3><p>{guide.takeaway}</p></div>
    <details className={styles.details}><summary>How it’s calculated</summary><p>{guide.details}</p></details>
    <p className={styles.freshness}>Check the feed status: delayed snapshots can show older figures.</p>
  </div>;
}
