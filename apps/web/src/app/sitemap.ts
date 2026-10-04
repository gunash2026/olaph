import { siteUrl, locales } from "@/lib/config";
export const dynamic = "force-static";
export default function sitemap() {
  return locales.flatMap((locale) =>
    [
      "",
      "platform",
      "solutions",
      "pricing",
      "resources",
      "help",
      "about",
      "security",
      "changelog",
      "privacy",
      "terms",
      ...Array.from({ length: 6 }, (_, i) => `module-${i}`),
    ].map((page) => ({
      url: `${siteUrl}/${locale}/${page ? `${page}/` : ""}`,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${siteUrl}/${l}/${page ? `${page}/` : ""}`]),
        ),
      },
    })),
  );
}
