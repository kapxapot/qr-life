import type { Metadata } from "next";
import { MainView } from "@/components/main-view";

export const metadata: Metadata = {
  title: "QR Life",
  description:
    "Scan a QR code, turn it into a Conway's Game of Life seed, and bring it to life.",
};

export default function Home() {
  return (
    <main className="flex h-dvh w-full overflow-hidden">
      <MainView />
    </main>
  );
}
