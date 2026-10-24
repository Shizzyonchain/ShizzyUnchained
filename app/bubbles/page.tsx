import { permanentRedirect } from "next/navigation";

export default function LegacyBubblesPage() {
  permanentRedirect("/balls");
}
