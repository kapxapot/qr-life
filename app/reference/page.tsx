import type { Metadata } from "next";
import { QrLifeReference } from "@/components/qr-life-reference";

export const metadata: Metadata = {
  title: "QR Life Reference",
  description: "Reference mock for the original QR Life concept screen.",
};

export default function ReferencePage() {
  return <QrLifeReference />;
}
