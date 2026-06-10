import type { Metadata } from "next";
import { MainView } from "@/components/main-view";
import { siteDescription, siteTitle } from "@/lib/site-metadata";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
};

export default function Home() {
  return (
    <main className="flex h-dvh w-full overflow-hidden">
      <MainView />
    </main>
  );
}
