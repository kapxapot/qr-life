import type { MetadataRoute } from "next";
import { getSitePath } from "@/lib/site-url";

const routes = [
  {
    path: "/",
  },
] satisfies Array<{
  path: string;
}>;

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path }) => ({
    url: getSitePath(path),
  }));
}
