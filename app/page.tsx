import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { MainView } from "@/components/main-view";
import { createCanonicalValueOnlyHref } from "@/lib/qr/share-search-params";
import { siteDescription } from "@/lib/site-metadata";

export const metadata: Metadata = {
  description: siteDescription,
};

export default async function Home(props: PageProps<"/">) {
  const canonicalHref = createCanonicalValueOnlyHref(await props.searchParams);

  if (canonicalHref) {
    permanentRedirect(canonicalHref);
  }

  return (
    <main className="flex h-dvh w-full overflow-hidden">
      <MainView />
    </main>
  );
}
