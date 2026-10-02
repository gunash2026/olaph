import { siteUrl, locales } from "@/lib/config";
export const dynamic = "force-static";
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: locales.map((l) => `/${l}/app/`),
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
