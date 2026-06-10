import type { Metadata } from "next";
import { MainView } from "@/components/main-view";
import { siteDescription } from "@/lib/site-metadata";

export const metadata: Metadata = {
  description: siteDescription,
};

export default function Home() {
  return (
    <main className="flex h-dvh w-full overflow-hidden">
      <MainView />
    </main>
  );
}
