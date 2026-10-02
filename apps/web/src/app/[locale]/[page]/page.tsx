import { notFound } from "next/navigation";
import { Header, Footer, Pricing, FAQ, ModuleGrid } from "@/components/site";
import { getMessages } from "@/lib/translations";
import { copy } from "@/lib/content";
import { href, locales, type Locale, siteUrl } from "@/lib/config";
const pages = [
  "platform",
  "solutions",
  "resources",
  "pricing",
  "about",
  "contact",
  "security",
  "changelog",
  "privacy",
  "terms",
  "help",
  ...Array.from({ length: 6 }, (_, i) => `module-${i}`),
  ...Array.from({ length: 3 }, (_, i) => `guide-${i}`),
];
export function generateStaticParams() {
  return pages.map((page) => ({ page }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; page: string }>;
}) {
  const { locale, page } = await params;
  const t = getMessages(locale);
  const title = page.startsWith("module-")
    ? t.modules[Number(page.slice(7))]
    : page.startsWith("guide-")
      ? copy[locale].guides[Number(page.slice(6))]
      : t.links[page as keyof typeof t.links];
  return {
    title,
    description: page === "pricing" ? t.pricingIntro : t.platformIntro,
    alternates: {
      canonical: `${siteUrl}/${locale}/${page}/`,
      languages: Object.fromEntries(
        locales.map((l) => [l, `${siteUrl}/${l}/${page}/`]),
      ),
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: Locale; page: string }>;
}) {
  const { locale, page } = await params;
  if (!pages.includes(page)) notFound();
  const t = getMessages(locale);
  const c = copy[locale];
  const moduleIndex = page.startsWith("module-") ? Number(page.slice(7)) : -1;
  const guideIndex = page.startsWith("guide-") ? Number(page.slice(6)) : -1;
  const title =
    moduleIndex >= 0
      ? t.modules[moduleIndex]
      : guideIndex >= 0
        ? c.guides[guideIndex]
        : t.links[page as keyof typeof t.links];
  return (
    <>
      <Header locale={locale} t={t} current={page} />
      <main>
        {page === "pricing" ? (
          <>
            <h1 className="sr-only">{t.links.pricing}</h1>
            <Pricing locale={locale} t={t} />
            <FAQ t={t} />
          </>
        ) : (
          <>
            <section className="content-hero">
              <span className="eyebrow">
                OLAPH /{" "}
                {moduleIndex >= 0
                  ? t.nav[0]
                  : guideIndex >= 0
                    ? t.nav[2]
                    : title}
              </span>
              <h1>{title}</h1>
              <p>
                {moduleIndex >= 0
                  ? t.moduleText[moduleIndex]
                  : page === "platform"
                    ? t.platformIntro
                    : page === "solutions"
                      ? t.flexText
                      : page === "resources" || page === "help"
                        ? t.closingText
                        : c.status}
              </p>
            </section>
            {page === "platform" ? (
              <section className="section" style={{ paddingTop: 20 }}>
                <ModuleGrid locale={locale} t={t} />
              </section>
            ) : (
              <div className="content-body">
                {moduleIndex >= 0 && (
                  <>
                    <div className="notice">
                      {moduleIndex > 2 ? c.roadmap : c.scope}
                    </div>
                    <h2>{moduleIndex > 2 ? t.soon : t.preview}</h2>
                    <p>
                      {moduleIndex < 3
                        ? c.guideText[moduleIndex]
                        : t.moduleText[moduleIndex]}
                    </p>
                    <a href={href(locale, "app")} className="button copper">
                      {t.cta}
                    </a>
                  </>
                )}
                {guideIndex >= 0 && (
                  <>
                    <p>{c.guideText[guideIndex]}</p>
                    <div className="notice">{c.scope}</div>
                    <a className="button copper" href={href(locale, "app")}>
                      {t.cta}
                    </a>
                  </>
                )}
                {page === "solutions" && (
                  <>
                    <h2>{t.flexTitle}</h2>
                    <div className="content-cards">
                      {c.models.map((m, i) => (
                        <article className="content-card" key={m}>
                          <span className="eyebrow">0{i + 1}</span>
                          <h2>{m}</h2>
                          <p>{t.platformIntro}</p>
                        </article>
                      ))}
                    </div>
                    <h2>{c.roles.join(" · ")}</h2>
                    <p>{t.securityText}</p>
                    <a className="button copper" href={href(locale, "app")}>
                      {t.cta}
                    </a>
                  </>
                )}
                {(page === "resources" || page === "help") && (
                  <>
                    <div className="content-cards">
                      {c.guides.map((g, i) => (
                        <a
                          className="content-card"
                          href={href(locale, `guide-${i}`)}
                          key={g}
                        >
                          <span className="eyebrow">OLAPH / 0{i + 1}</span>
                          <h2>{g}</h2>
                          <p>{c.guideText[i].split(". ")[0]}.</p>
                        </a>
                      ))}
                    </div>
                    {page === "help" && <div className="notice">{c.scope}</div>}
                  </>
                )}
                {page === "about" && (
                  <>
                    <p>{c.about}</p>
                    <div className="notice">{c.scope}</div>
                  </>
                )}
                {page === "contact" && (
                  <>
                    <p>{c.contact}</p>
                    <a
                      className="button outline"
                      href="https://github.com/gunash2026/olaph/issues"
                    >
                      GitHub Issues
                    </a>
                  </>
                )}
                {page === "security" && (
                  <>
                    <p>{c.security}</p>
                    <ul>
                      {t.securityItems.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                    <div className="notice">{c.scope}</div>
                  </>
                )}
                {page === "changelog" && (
                  <>
                    <span className="pill">v0.1 · 02.10.2026</span>
                    <h2>{c.status}</h2>
                    <p>{c.change}</p>
                    <div className="notice">{c.scope}</div>
                  </>
                )}
                {page === "privacy" && (
                  <>
                    <p>{c.privacy}</p>
                    <a
                      href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
                      className="button outline"
                    >
                      GitHub Privacy Statement
                    </a>
                  </>
                )}
                {page === "terms" && <p>{c.terms}</p>}
              </div>
            )}
          </>
        )}
      </main>
      <Footer locale={locale} t={t} />
    </>
  );
}
