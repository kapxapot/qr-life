import type { MetadataRoute } from "next";
import { getSitePath } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: getSitePath("/sitemap.xml"),
  };
}
