import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { locales, type Locale, siteUrl } from "@/lib/config";
import { getMessages } from "@/lib/translations";
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return {
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `${siteUrl}/${locale}/`,
      languages: Object.fromEntries(
        locales.map((l) => [l, `${siteUrl}/${l}/`]),
      ),
    },
    openGraph: {
      title: "OLAPH",
      description: locales.includes(locale as Locale)
        ? getMessages(locale as Locale).intro
        : "OLAPH",
      type: "website",
      images: [`${siteUrl}/social.svg`],
    },
  };
}
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <head>
        <link
          rel="icon"
          href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon.svg`}
        />
        <meta name="theme-color" content="#f5f4f0" />
      </head>
      <body>
        <NextIntlClientProvider
          locale={locale}
          messages={getMessages(locale as Locale)}
          timeZone="Europe/Istanbul"
          now={new Date("2026-10-02T00:00:00Z")}
          formats={{}}
        >
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
