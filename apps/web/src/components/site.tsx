"use client";
import { useState } from "react";
import {
  Menu,
  X,
  Globe,
  Layers,
  Package,
  ClipboardList,
  ShoppingCart,
  Factory,
  Users,
  ChartNoAxesCombined,
  Check,
  ShieldCheck,
  LockKeyhole,
  History,
  Plus,
  Minus,
} from "lucide-react";
import { href, asset, locales, type Locale } from "@/lib/config";
import type { Messages } from "@/lib/messages";
import { plans, planPrice } from "@olaph/core";
export const moduleIcons = [
  Package,
  ClipboardList,
  ShoppingCart,
  Factory,
  Users,
  ChartNoAxesCombined,
];
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo ${light ? "logo-light" : ""}`} aria-label="OLAPH">
      OLΛPH
      <span className="logo-point" />
    </span>
  );
}
export function Header({
  locale,
  t,
  current = "",
}: {
  locale: Locale;
  t: Messages;
  current?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <a href={href(locale)} aria-label="OLAPH">
        <Logo />
      </a>
      <nav
        className={open ? "site-nav open" : "site-nav"}
        aria-label={t.footerProduct}
      >
        {["platform", "solutions", "resources", "pricing"].map((p, i) => (
          <a
            className={current === p ? "active" : ""}
            href={href(locale, p)}
            key={p}
          >
            {t.nav[i]}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <label className="language">
          <Globe size={15} />
          <span className="sr-only">{t.app.language}</span>
          <select
            aria-label={t.app.language}
            value={locale}
            onChange={(e) => location.assign(href(e.target.value, current))}
          >
            {locales.map((l) => (
              <option value={l} key={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <a href={href(locale, "portal")} className="button dark compact">
          {t.login}
        </a>
        <button
          className="icon-button mobile-menu"
          aria-expanded={open}
          aria-label={t.footerProduct}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
export function Footer({ locale, t }: { locale: Locale; t: Messages }) {
  const [cookies, setCookies] = useState(false);
  return (
    <>
      <footer className="site-footer">
        <div>
          <a href={href(locale)}>
            <Logo />
          </a>
          <p>{t.footerText}</p>
        </div>
        <div>
          <h3>{t.footerProduct}</h3>
          {["platform", "solutions", "pricing"].map((key) => (
            <a key={key} href={href(locale, key)}>
              {t.links[key as keyof typeof t.links]}
            </a>
          ))}
        </div>
        <div>
          <h3>{t.footerCompany}</h3>
          {["about", "resources", "security", "changelog"].map((key) => (
            <a key={key} href={href(locale, key)}>
              {t.links[key as keyof typeof t.links]}
            </a>
          ))}
        </div>
        <div>
          <h3>{t.footerLegal}</h3>
          {["privacy", "terms", "help"].map((key) => (
            <a key={key} href={href(locale, key)}>
              {t.links[key as keyof typeof t.links]}
            </a>
          ))}
          <button className="text-link" onClick={() => setCookies(true)}>
            {t.links.cookies}
          </button>
        </div>
        <div className="footer-bottom">
          <span>© 2026 {t.rights}</span>
          <span>TR / EN / AR / 中文 / RU</span>
        </div>
      </footer>
      {cookies && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t.links.cookies}
          >
            <button
              autoFocus
              className="modal-close icon-button"
              aria-label={t.app.cancel}
              onClick={() => setCookies(false)}
            >
              <X />
            </button>
            <h2>{t.links.cookies}</h2>
            <p>{t.faq[2][1]}</p>
            <p>
              {locale === "tr"
                ? "Bu önizlemede reklam veya analiz çerezi kullanılmaz. Demo kayıtları cihazınızdaki yerel depolamaya yazılır."
                : locale === "en"
                  ? "This preview uses no advertising or analytics cookies. Demo records use local storage on your device."
                  : t.app.demoNote}
            </p>
            <button className="button dark" onClick={() => setCookies(false)}>
              {t.app.done}
            </button>
          </section>
        </div>
      )}
    </>
  );
}
export function Pricing({ locale, t }: { locale: Locale; t: Messages }) {
  const [year, setYear] = useState(false);
  return (
    <section className="pricing section" id="pricing">
      <div className="section-heading">
        <span className="eyebrow">OLAPH / {t.links.pricing}</span>
        <h2>{t.pricingTitle}</h2>
        <p>{t.pricingIntro}</p>
      </div>
      <div className="billing-switch">
        <button
          aria-pressed={!year}
          className={!year ? "selected" : ""}
          onClick={() => setYear(false)}
        >
          {t.monthly}
        </button>
        <button
          aria-pressed={year}
          className={year ? "selected" : ""}
          onClick={() => setYear(true)}
        >
          {t.yearly} <span>{t.gift}</span>
        </button>
      </div>
      <div className="price-grid">
        {plans.map((p, i) => (
          <article
            className={`price-card ${i === 1 ? "featured" : ""}`}
            key={p.id}
          >
            {i === 1 && <span className="popular">{t.popular}</span>}
            <h3>{t.plans[i]}</h3>
            <div className="price">
              <span>
                ${Number(planPrice(p.usd, year))}
                {i === 2 ? "+" : ""}
              </span>
              <small>{year ? t.perYear : t.perMonth}</small>
            </div>
            <p>{p.users ? `${p.users} ${t.users}` : t.unlimited}</p>
            <a
              className={`button ${i === 1 ? "copper" : "outline"}`}
              href={href(locale, "app")}
            >
              {t.cta}
            </a>
            <ul>
              {t.planFeatures[i].map((f) => (
                <li key={f}>
                  <Check size={16} />
                  {f}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p className="price-note">{t.priceNote}</p>
    </section>
  );
}
export function FAQ({ t }: { t: Messages }) {
  const [active, setActive] = useState<number | null>(0);
  return (
    <section className="faq section">
      <div>
        <span className="eyebrow">OLAPH / FAQ</span>
        <h2>{t.faqTitle}</h2>
      </div>
      <div>
        {t.faq.map(([q, a], i) => (
          <article key={q} className="faq-row">
            <h3>
              <button
                aria-expanded={active === i}
                aria-controls={`faq-${i}`}
                onClick={() => setActive(active === i ? null : i)}
              >
                {q}
                {active === i ? <Minus size={18} /> : <Plus size={18} />}
              </button>
            </h3>
            <p id={`faq-${i}`} hidden={active !== i}>
              {a}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
export function ModuleGrid({ locale, t }: { locale: Locale; t: Messages }) {
  return (
    <div className="module-grid">
      {t.modules.map((title, i) => {
        const Icon = moduleIcons[i];
        return (
          <a
            href={href(locale, `module-${i}`)}
            key={title}
            className={`module-item module-${i}`}
          >
            <div className="module-top">
              <Icon size={25} strokeWidth={1.4} />
              <span className="pill">{i > 2 ? t.soon : t.preview}</span>
            </div>
            <span className="module-number">0{i + 1}</span>
            <h3>{title}</h3>
            <p>{t.moduleText[i]}</p>
          </a>
        );
      })}
    </div>
  );
}
export function Home({ locale, t }: { locale: Locale; t: Messages }) {
  return (
    <>
      <Header locale={locale} t={t} />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="copper-line" />
              {t.eyebrow}
            </span>
            <h1>
              {t.hero[0]}
              <br />
              <span>{t.hero[1]}</span>
            </h1>
            <p>{t.intro}</p>
            <div className="hero-buttons">
              <a className="button copper" href={href(locale, "app")}>
                {t.cta}
              </a>
              <a className="button text" href="#journey">
                <span className="play-icon">▷</span>
                {t.secondary}
              </a>
            </div>
            <small>{t.note}</small>
          </div>
          <div className="hero-visual">
            <img
              src={asset("hero.webp")}
              alt={t.storyTitle}
              width="1536"
              height="1024"
              fetchPriority="high"
            />
            <div className="scene-label scene-one">
              <Package size={18} />
              <span>{t.modules[0]}</span>
              <span className="label-number">01</span>
            </div>
            <div className="scene-label scene-two">
              <Factory size={18} />
              <span>{t.modules[3]}</span>
              <span className="label-number">02</span>
            </div>
            <div className="scene-label scene-three">
              <Check size={18} />
              <span>{t.flow[4]}</span>
              <span className="label-number">03</span>
            </div>
            <span className="scene-caption">OLAPH · CONNECTED OPERATIONS</span>
          </div>
        </section>
        <div className="flow-strip">
          {t.flow.map((label, i) => (
            <div key={label}>
              <span>0{i + 1}</span>
              {label}
              {i !== 4 && <i />}
            </div>
          ))}
        </div>
        <section className="section modules-section">
          <div className="section-heading split">
            <div>
              <span className="eyebrow">01 / {t.nav[0]}</span>
              <h2>{t.platformTitle}</h2>
            </div>
            <p>{t.platformIntro}</p>
          </div>
          <ModuleGrid locale={locale} t={t} />
        </section>
        <Journey t={t} />
        <section className="section flex-section">
          <div className="flex-art" aria-hidden="true">
            <div className="flex-orbit">
              <Layers size={52} strokeWidth={1} />
              <span>OLΛPH</span>
            </div>
            {[Package, ClipboardList, Users, Factory].map((I, i) => (
              <div key={i} className={`orbit-item orbit-${i}`}>
                <I size={24} strokeWidth={1.2} />
              </div>
            ))}
            <div className="diagram-grid" />
          </div>
          <div>
            <span className="eyebrow">03 / {t.nav[1]}</span>
            <h2>{t.flexTitle}</h2>
            <p>{t.flexText}</p>
            <a className="button outline" href={href(locale, "solutions")}>
              {t.links.solutions}
            </a>
          </div>
        </section>
        <section className="security-section">
          <div>
            <span className="eyebrow">04 / {t.links.security}</span>
            <h2>{t.securityTitle}</h2>
            <p>{t.securityText}</p>
            <a href={href(locale, "security")} className="button outline light">
              {t.links.security}
            </a>
          </div>
          <div className="security-list">
            {[ShieldCheck, LockKeyhole, History].map((I, i) => (
              <div key={i}>
                <I size={27} strokeWidth={1.2} />
                <span>{t.securityItems[i]}</span>
              </div>
            ))}
          </div>
        </section>
        <Pricing locale={locale} t={t} />
        <FAQ t={t} />
        <section className="closing">
          <span className="eyebrow">OLAPH</span>
          <h2>{t.closing}</h2>
          <p>{t.closingText}</p>
          <a className="button copper" href={href(locale, "app")}>
            {t.cta}
          </a>
        </section>
      </main>
      <Footer locale={locale} t={t} />
    </>
  );
}
function Journey({ t }: { t: Messages }) {
  const [stage, setStage] = useState(0);
  return (
    <section className="journey section" id="journey">
      <div className="section-heading">
        <span className="eyebrow">02 / {t.secondary}</span>
        <h2>{t.storyTitle}</h2>
      </div>
      <div className="journey-inner">
        <div className="journey-visual">
          <img
            src={asset("hero.webp")}
            alt=""
            width="1536"
            height="1024"
            loading="lazy"
            style={{
              transform: `translateX(${(stage - 2) * -8}px) scale(${1 + stage * 0.015})`,
            }}
          />
          <div className="journey-progress">
            <span>0{stage + 1} / 05</span>
            <div>
              <i style={{ width: `${(stage + 1) * 20}%` }} />
            </div>
          </div>
        </div>
        <div className="journey-steps">
          {t.flow.map((f, i) => (
            <button
              key={f}
              aria-pressed={stage === i}
              className={stage === i ? "selected" : ""}
              onClick={() => setStage(i)}
            >
              <span>0{i + 1}</span>
              <div>
                <h3>{f}</h3>
                <p>{t.storyText[i]}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
