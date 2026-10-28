import Link from "next/link";
import styles from "./privacy-footer.module.css";

export function PrivacyFooter() {
  return <footer className={styles.footer} aria-label="Privacy and contact">
    <a href="mailto:shizzyunchained@gmail.com?subject=Site%20feedback%20or%20correction">Feedback &amp; corrections</a>
    <Link href="/privacy" prefetch={false}>Privacy &amp; data</Link>
    <a href="mailto:shizzyunchained@gmail.com?subject=Privacy%20question">Privacy questions</a>
  </footer>;
}
