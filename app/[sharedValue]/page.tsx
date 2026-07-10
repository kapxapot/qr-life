import type { Metadata } from "next";
import { MainView } from "@/components/main-view";
import { siteDescription } from "@/lib/site-metadata";

export const metadata: Metadata = {
  description: siteDescription,
};

export default async function SharedValuePage(
  props: PageProps<"/[sharedValue]">,
) {
  const { sharedValue } = await props.params;

  return (
    <main className="flex h-dvh w-full overflow-hidden">
      <MainView initialPathValue={sharedValue} />
    </main>
  );
}
