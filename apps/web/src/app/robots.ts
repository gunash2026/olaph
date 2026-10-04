import { siteUrl, locales, basePath } from "@/lib/config";
export const dynamic = "force-static";
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: locales.flatMap((l) => [
        `${basePath}/${l}/app/`,
        `${basePath}/${l}/portal/`,
      ]),
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
