import Link from "next/link";
import styles from "./privacy-footer.module.css";

export function PrivacyFooter() {
  return <footer className={styles.footer} aria-label="Privacy and contact">
    <Link href="/start-here" prefetch={false}>New to Bittensor? Start here</Link>
    <a href="mailto:shizzyunchained@gmail.com?subject=Site%20feedback%20or%20correction">Feedback &amp; corrections</a>
    <Link href="/privacy" prefetch={false}>Privacy &amp; data</Link>
    <a href="mailto:shizzyunchained@gmail.com?subject=Privacy%20question">Privacy questions</a>
  </footer>;
}
