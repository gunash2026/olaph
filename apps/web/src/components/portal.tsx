"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Search,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Download,
  Package,
  Layers,
  Check,
  ChevronRight,
} from "lucide-react";
import { href, type Locale } from "@/lib/config";
import { authClient } from "@/lib/auth-client";
import {
  portalResources,
  columnLabels,
  valueLabels,
  type Field,
} from "@/lib/portal-resources";
import { Logo } from "./site";
import { Captcha, captchaSiteKey } from "./captcha";
type Row = Record<string, unknown>;
type Workspace = {
  id: string;
  name: string;
  role: string;
  permissions: string[];
  mfa_required: boolean;
};
type Session = {
  user: { id: string; name: string; email: string; twoFactorEnabled?: boolean };
  workspaces: Workspace[];
};
const enabled = process.env.NEXT_PUBLIC_APP_ENABLED === "true";
async function api(path: string, body?: unknown, method?: string) {
  const response = await fetch(`/api${path}`, {
    method: method || (body ? "POST" : "GET"),
    credentials: "same-origin",
    headers:
      body instanceof FormData ? {} : { "Content-Type": "application/json" },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.message || `HTTP_${response.status}`);
  return data;
}
const errors: Record<string, string> = {
  SIGN_IN_REQUIRED: "Lütfen giriş yapın.",
  MFA_SETUP_REQUIRED:
    "Yönetici erişimi için iki aşamalı doğrulamayı tamamlayın.",
  REAUTHENTICATION_REQUIRED:
    "Bu işlem için Güvenlik ekranından yeniden doğrulama yapın.",
  PERMISSION_DENIED: "Bu işlem için yetkiniz yok.",
  SUBSCRIPTION_REQUIRED:
    "Deneme veya abonelik süresi sona erdi. Verilerinizi görüntüleyip dışa aktarabilirsiniz.",
  INSUFFICIENT_AVAILABLE_STOCK: "Kullanılabilir stok yeterli değil.",
  RECIPE_CYCLE: "Bu alt ürün, reçetede döngü oluşturuyor.",
  CONFLICT_OR_INVALID_REFERENCE:
    "Kod zaten var veya bağlı kayıt geçerli değil.",
  STALE_VERSION_RELOAD_BEFORE_RETRY:
    "Kayıt başka bir kullanıcı tarafından değiştirildi. Yenileyip tekrar kontrol edin.",
  UNKNOWN_CODE:
    "Dosyada katalogda bulunmayan kodlar var. Önce katalog kayıtlarını oluşturun.",
  IMPORT_ALREADY_PROCESSED: "Bu dosya daha önce işlendi.",
  REQUEST_FAILED: "İşlem tamamlanamadı. Tekrar deneyin.",
};
export function Portal({ locale }: { locale: Locale }) {
  const [session, setSession] = useState<Session | null>(null),
    [workspace, setWorkspace] = useState(""),
    [section, setSection] = useState("overview"),
    [rows, setRows] = useState<Row[]>([]),
    [lookups, setLookups] = useState<Record<string, Row[]>>({}),
    [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState<{
      fields: Field[];
      path: string;
      method?: string;
      values?: Row;
      title: string;
    } | null>(null),
    [authMode, setAuthMode] = useState("login"),
    [totp, setTotp] = useState(""),
    [backup, setBackup] = useState<string[]>([]),
    [captchaToken, setCaptchaToken] = useState(""),
    [captchaNonce, setCaptchaNonce] = useState(0);
  const captchaRequired =
    Boolean(captchaSiteKey) && ["login", "signup", "forgot"].includes(authMode);
  const dialog = useRef<HTMLDialogElement>(null),
    form = useRef<HTMLFormElement>(null),
    operationKey = useRef("");
  const tenant = session?.workspaces.find((x) => x.id === workspace),
    resource = portalResources[section];
  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      const message = (e as Error).message;
      setError(errors[message] || message);
    } finally {
      setBusy(false);
    }
  }, []);
  const refreshSession = useCallback(async () => {
    const data: Session = await api("/session");
    setSession(data);
    setWorkspace((previous) =>
      data.workspaces.some((w) => w.id === previous)
        ? previous
        : data.workspaces[0]?.id || "",
    );
  }, []);
  useEffect(() => {
    if (enabled) void refreshSession().catch(() => {});
    const token = new URLSearchParams(location.search).get("token");
    if (token) setAuthMode("reset");
  }, [refreshSession]);
  useEffect(() => {
    if (modal) {
      dialog.current?.showModal();
      form.current?.reset();
    }
  }, [modal]);
  const path = (suffix: string) =>
    `/workspaces/${encodeURIComponent(workspace)}/${suffix}`;
  const refresh = useCallback(async () => {
    if (!workspace) return;
    if (portalResources[section]) {
      const data = await api(
        `/workspaces/${workspace}/resources/${section}?page=${page}`,
      );
      setRows(data.items);
    } else if (section === "needs" || section === "members") {
      const data = await api(`/workspaces/${workspace}/${section}`);
      setRows(data.items);
    }
  }, [workspace, section, page]);
  useEffect(() => {
    setRows([]);
    setSearch("");
    if (workspace && (!tenant?.mfa_required || session?.user.twoFactorEnabled))
      void run(refresh);
  }, [
    workspace,
    section,
    page,
    run,
    refresh,
    tenant?.mfa_required,
    session?.user.twoFactorEnabled,
  ]);
  async function openForm(
    title: string,
    fields: Field[],
    target: string,
    values?: Row,
    method?: string,
  ) {
    await run(async () => {
      const references = [
          ...new Set(
            fields.flatMap((field) => (field.relation ? [field.relation] : [])),
          ),
        ],
        loaded: Record<string, Row[]> = {};
      for (const key of references)
        loaded[key] = (await api(path(`resources/${key}`))).items;
      setLookups(loaded);
      setModal({ title, fields, path: target, values, method });
    });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(async () => {
      const payload: Row = {};
      for (const field of modal!.fields) {
        const raw = String(data.get(field.key) || "");
        if (!raw && field.optional) {
          if (field.relation) payload[field.key] = null;
          continue;
        }
        payload[field.key] =
          field.type === "number"
            ? Number(raw)
            : field.type === "datetime-local"
              ? new Date(raw).toISOString()
              : raw;
      }
      if (modal!.path.endsWith("/movements")) {
        operationKey.current ||= crypto.randomUUID();
        payload.idempotency_key = operationKey.current;
      }
      if (modal!.values?.version) payload.version = modal!.values.version;
      await api(modal!.path, payload, modal!.method);
      operationKey.current = "";
      dialog.current?.close();
      setModal(null);
      setNotice("Kaydedildi.");
      await refresh();
    });
  }
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      email = String(data.get("email")),
      password = String(data.get("password"));
    await run(async () => {
      if (captchaRequired && !captchaToken)
        throw Error("Güvenlik doğrulamasını tamamlayın.");
      const captchaOptions = {
        headers: { "x-captcha-response": captchaToken },
      };
      if (authMode === "signup") {
        const result = await authClient.signUp.email(
          {
            email,
            password,
            name: String(data.get("name")),
            callbackURL: href(locale, "portal"),
          },
          captchaOptions,
        );
        if (result.error) throw Error(result.error.message);
        setNotice("Doğrulama bağlantısı e-posta adresinize gönderildi.");
        setAuthMode("login");
      } else if (authMode === "forgot") {
        const result = await authClient.requestPasswordReset(
          {
            email,
            redirectTo: href(locale, "portal"),
          },
          captchaOptions,
        );
        if (result.error) throw Error(result.error.message);
        setNotice("Adres kayıtlıysa parola yenileme bağlantısı gönderildi.");
      } else if (authMode === "reset") {
        const result = await authClient.resetPassword({
          newPassword: password,
          token: new URLSearchParams(location.search).get("token") || "",
        });
        if (result.error) throw Error(result.error.message);
        history.replaceState(null, "", location.pathname);
        setAuthMode("login");
        setNotice("Parolanız yenilendi.");
      } else if (authMode === "mfa") {
        const result = await authClient.twoFactor.verifyTotp({
          code: String(data.get("code")),
          trustDevice: false,
        });
        if (result.error) throw Error(result.error.message);
        await refreshSession();
      } else {
        const result = await authClient.signIn.email(
          { email, password },
          captchaOptions,
        );
        if (result.error) throw Error(result.error.message);
        if ("twoFactorRedirect" in (result.data || {})) setAuthMode("mfa");
        else await refreshSession();
      }
    });
    setCaptchaToken("");
    setCaptchaNonce((previous) => previous + 1);
  }
  const status = (
    <>
      {error && (
        <div role="alert" className="portal-alert error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="portal-alert">
          {notice}
        </div>
      )}
    </>
  );
  if (!enabled)
    return (
      <main className="portal-entry">
        <a href={href(locale)}>
          <Logo />
        </a>
        <span className="eyebrow">OLAPH / ÇALIŞMA ALANI</span>
        <h1>
          İşletmenizin
          <br />
          ortak çalışma alanı.
        </h1>
        <p>
          Hesaplar, firma verileri ve ekip yetkileri için hazırlanan kalıcı
          portal. Bu GitHub yayını önizleme ortamıdır; sunucu kurulumu henüz
          yapılmadı.
        </p>
        <div className="portal-feature-grid">
          {[
            [
              "01",
              "Katalog & stok",
              "Çok seviyeli reçete, depo, sahiplik ve rezervasyon.",
            ],
            [
              "02",
              "Sipariş & tedarik",
              "Excel eşleme, ihtiyaç hesabı ve yönetici onayı.",
            ],
            [
              "03",
              "Üretim & ekip",
              "İş emri, kalite, istasyon, vardiya ve personel.",
            ],
            [
              "04",
              "Erişim & izlenebilirlik",
              "Doğrulanmış e-posta, MFA, roller ve denetim kaydı.",
            ],
          ].map(([n, title, description]) => (
            <article key={n}>
              <span>{n}</span>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </div>
        <a className="button dark" href={href(locale, "app")}>
          Etkileşimli demoyu aç <ArrowRight size={18} />
        </a>
        <a
          href="https://github.com/gunash2026/olaph/pull/1"
          className="text-link"
        >
          Geliştirme kaydı
        </a>
      </main>
    );
  if (!session)
    return (
      <main className="portal-entry portal-auth">
        <a href={href(locale)}>
          <Logo />
        </a>
        <span className="eyebrow">GÜVENLİ ÇALIŞMA ALANI</span>
        <h1>
          {authMode === "signup"
            ? "Hesabınızı oluşturun"
            : authMode === "mfa"
              ? "İki aşamalı doğrulama"
              : authMode === "forgot" || authMode === "reset"
                ? "Parolanızı yenileyin"
                : "Tekrar hoş geldiniz."}
        </h1>
        {status}
        <form onSubmit={authenticate}>
          {authMode === "signup" && (
            <label>
              Ad soyad
              <input name="name" autoComplete="name" required />
            </label>
          )}
          {!["mfa", "reset"].includes(authMode) && (
            <label>
              E-posta
              <input name="email" type="email" autoComplete="email" required />
            </label>
          )}
          {!["mfa", "forgot"].includes(authMode) && (
            <label>
              Parola
              <input
                name="password"
                type="password"
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                minLength={authMode === "login" ? 1 : 12}
                maxLength={128}
                required
              />
            </label>
          )}
          {authMode === "mfa" && (
            <label>
              Doğrulama kodu
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                required
              />
            </label>
          )}
          {captchaRequired && (
            <Captcha
              key={`${authMode}:${captchaNonce}`}
              onToken={setCaptchaToken}
            />
          )}
          <button
            disabled={busy || (captchaRequired && !captchaToken)}
            className="button dark"
          >
            {busy
              ? "İşleniyor…"
              : authMode === "signup"
                ? "Kayıt ol"
                : authMode === "forgot"
                  ? "Bağlantı gönder"
                  : "Devam et"}
            <ArrowRight size={18} />
          </button>
        </form>
        <div className="portal-inline">
          <button
            onClick={() =>
              setAuthMode(authMode === "signup" ? "login" : "signup")
            }
          >
            {authMode === "signup" ? "Giriş yap" : "Hesap oluştur"}
          </button>
          <button onClick={() => setAuthMode("forgot")}>
            Parolamı unuttum
          </button>
          <button
            onClick={() =>
              void run(async () => {
                const result = await authClient.signIn.passkey();
                if (result.error) throw Error(result.error.message);
                await refreshSession();
              })
            }
          >
            Passkey ile giriş
          </button>
        </div>
      </main>
    );
  const security =
    section === "security" ||
    (tenant?.mfa_required && !session.user.twoFactorEnabled);
  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <a href={href(locale)}>
          <Logo />
        </a>
        <label className="portal-workspace">
          Çalışma alanı
          <select
            value={workspace}
            onChange={(e) => {
              setWorkspace(e.target.value);
              setPage(0);
            }}
          >
            {session.workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Çalışma alanı">
          <button
            className={section === "overview" ? "selected" : ""}
            onClick={() => setSection("overview")}
          >
            <Layers size={17} /> Genel bakış
          </button>
          {Object.entries(portalResources)
            .filter(([, r]) =>
              tenant?.permissions.includes(`${r.permission}:read`),
            )
            .map(([key, r], index, array) => (
              <div key={key}>
                {(index === 0 || array[index - 1][1].group !== r.group) && (
                  <span className="portal-nav-group">{r.group}</span>
                )}
                <button
                  className={key === section ? "selected" : ""}
                  onClick={() => {
                    setSection(key);
                    setPage(0);
                  }}
                >
                  {r.title}
                </button>
              </div>
            ))}
          {tenant?.permissions.includes("orders:read") && (
            <button onClick={() => setSection("needs")}>İhtiyaç analizi</button>
          )}
          {tenant?.permissions.includes("orders:write") && (
            <button onClick={() => setSection("import")}>
              Excel içe aktarımı
            </button>
          )}
          {tenant?.permissions.includes("settings:read") && (
            <button onClick={() => setSection("members")}>Ekip üyeleri</button>
          )}
          <button onClick={() => setSection("security")}>
            <ShieldCheck size={17} /> Hesap güvenliği
          </button>
        </nav>
        <button
          onClick={() =>
            void run(async () => {
              await authClient.signOut();
              setSession(null);
            })
          }
        >
          <LogOut size={16} /> Çıkış yap
        </button>
      </aside>
      <main className="portal-main">
        <header className="portal-top">
          <span>{tenant?.name || "Yeni çalışma alanı"}</span>
          <span>
            {session.user.name}{" "}
            <span className="portal-role">{tenant?.role}</span>
          </span>
        </header>
        {status}
        {!workspace ? (
          <section className="portal-welcome">
            <span className="eyebrow">İLK ADIM</span>
            <h1>Firmanızı oluşturun.</h1>
            <p>
              Boş bir çalışma alanıyla başlayın. Birimleri, istasyonları ve
              kataloğu işletmenize göre tanımlayın.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = String(new FormData(e.currentTarget).get("name"));
                void run(async () => {
                  await api("/workspaces", { name });
                  await refreshSession();
                });
              }}
            >
              <label>
                Firma adı
                <input name="name" required minLength={2} maxLength={120} />
              </label>
              <button className="button dark" disabled={busy}>
                Çalışma alanını oluştur
              </button>
            </form>
            <button
              onClick={() =>
                void run(async () => {
                  const token = new URLSearchParams(location.search).get(
                    "invite",
                  );
                  if (!token)
                    throw Error(
                      "Bu sayfayı e-postadaki davet bağlantısıyla açın.",
                    );
                  await api("/invitations/accept", { token });
                  history.replaceState(null, "", location.pathname);
                  await refreshSession();
                })
              }
            >
              E-posta davetimi kabul et
            </button>
          </section>
        ) : security ? (
          <section className="portal-content">
            <span className="eyebrow">HESAP / GÜVENLİK</span>
            <h1>Hesap güvenliği</h1>
            <p>
              Yönetici ve onay yetkisine sahip roller için iki aşamalı doğrulama
              zorunludur.
            </p>
            {!session.user.twoFactorEnabled ? (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const password = String(
                      new FormData(e.currentTarget).get("password"),
                    );
                    void run(async () => {
                      const result = await authClient.twoFactor.enable({
                        password,
                      });
                      if (result.error) throw Error(result.error.message);
                      if (result.data?.method !== "totp")
                        throw Error("TOTP_REQUIRED");
                      setTotp(result.data.totpURI);
                      setBackup(result.data.backupCodes);
                    });
                  }}
                >
                  <label>
                    Mevcut parola
                    <input
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                    />
                  </label>
                  <button className="button dark" disabled={busy}>
                    Doğrulamayı kur
                  </button>
                </form>
                {totp && (
                  <div className="portal-card">
                    <p>Doğrulayıcı uygulamanıza şu anahtarı ekleyin:</p>
                    <code className="portal-secret">
                      {new URL(totp).searchParams.get("secret")}
                    </code>
                    <p>Yedek kodlarınızı güvenli bir yerde saklayın.</p>
                    <pre>{backup.join("\n")}</pre>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const code = String(
                          new FormData(e.currentTarget).get("code"),
                        );
                        void run(async () => {
                          const result = await authClient.twoFactor.verifyTotp({
                            code,
                          });
                          if (result.error) throw Error(result.error.message);
                          setTotp("");
                          setBackup([]);
                          await refreshSession();
                          setNotice("İki aşamalı doğrulama etkin.");
                        });
                      }}
                    >
                      <label>
                        6 haneli kod
                        <input
                          name="code"
                          required
                          pattern="[0-9]{6}"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                        />
                      </label>
                      <button className="button dark" disabled={busy}>
                        Kurulumu doğrula
                      </button>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="portal-alert">
                  <Check size={18} /> İki aşamalı doğrulama etkin.
                </p>
                <h2>Kritik işlem doğrulaması</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void run(async () => {
                      await api("/reauthenticate", {
                        password: data.get("password"),
                        code: data.get("code"),
                      });
                      setNotice("Kritik işlemler 5 dakika için doğrulandı.");
                    });
                  }}
                >
                  <label>
                    Parola
                    <input
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                    />
                  </label>
                  <label>
                    Doğrulama kodu
                    <input
                      name="code"
                      pattern="[0-9]{6}"
                      inputMode="numeric"
                      required
                      autoComplete="one-time-code"
                    />
                  </label>
                  <button disabled={busy} className="button dark">
                    Yeniden doğrula
                  </button>
                </form>
                <button
                  className="button light"
                  onClick={() =>
                    void run(async () => {
                      const result = await authClient.passkey.addPasskey({
                        name: "OLAPH cihazım",
                      });
                      if (result.error) throw Error(result.error.message);
                      setNotice("Passkey kaydedildi.");
                    })
                  }
                >
                  Bu cihaza passkey ekle
                </button>
                <button
                  className="text-link"
                  onClick={() =>
                    void run(async () => {
                      await authClient.revokeOtherSessions();
                      setNotice("Diğer oturumlar kapatıldı.");
                    })
                  }
                >
                  Diğer oturumları kapat
                </button>
              </>
            )}
          </section>
        ) : section === "overview" ? (
          <section className="portal-content">
            <span className="eyebrow">
              {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
                new Date(),
              )}
            </span>
            <h1>Her adım, tek yerde.</h1>
            <p>
              Çalışma alanınız boş bir katalogla başlar. Eklediğiniz kayıtlar
              yalnızca firmanızın yetkili üyeleri tarafından görülür.
            </p>
            <div className="portal-feature-grid">
              {[
                [
                  "materials",
                  "01",
                  "Kataloğunuzu tanımlayın",
                  "Malzeme, ürün ve birimlerinizi ekleyin.",
                ],
                [
                  "warehouses",
                  "02",
                  "Depolarınızı oluşturun",
                  "Firma ve müşteri stoklarını ayrı izleyin.",
                ],
                [
                  "orders",
                  "03",
                  "Siparişinizi planlayın",
                  "Kalemleri girin veya Excel dosyasını eşleyin.",
                ],
                [
                  "work-orders",
                  "04",
                  "Üretimi takip edin",
                  "İstasyon, iş emri ve kaliteyi yönetin.",
                ],
              ]
                .filter(([key]) =>
                  tenant?.permissions.includes(
                    `${portalResources[key].permission}:read`,
                  ),
                )
                .map(([key, n, title, description]) => (
                  <button
                    className="portal-card"
                    key={key}
                    onClick={() => setSection(key)}
                  >
                    <span>{n}</span>
                    <h2>{title}</h2>
                    <p>{description}</p>
                    <ChevronRight size={20} />
                  </button>
                ))}
            </div>
          </section>
        ) : section === "import" ? (
          <ImportPanel workspace={workspace} run={run} busy={busy} />
        ) : (
          <section className="portal-content">
            <span className="eyebrow">
              {resource?.group || "ÇALIŞMA ALANI"}
            </span>
            <div className="portal-title">
              <h1>
                {resource?.title ||
                  (section === "needs" ? "İhtiyaç analizi" : "Ekip üyeleri")}
              </h1>
              <div className="portal-inline">
                <button
                  title="Yenile"
                  className="icon-button"
                  disabled={busy}
                  onClick={() => void run(refresh)}
                >
                  <RefreshCw size={18} />
                </button>
                {resource &&
                  !resource.readOnly &&
                  tenant?.permissions.includes(
                    `${resource.permission}:write`,
                  ) && (
                    <button
                      className="button dark"
                      onClick={() =>
                        void openForm(
                          "Yeni kayıt",
                          resource.fields,
                          path(`resources/${section}`),
                        )
                      }
                    >
                      <Plus size={18} /> Yeni kayıt
                    </button>
                  )}
              </div>
            </div>
            <div className="portal-toolbar">
              <label>
                <Search size={16} />
                <input
                  aria-label="Tabloda ara"
                  placeholder="Bu sayfada ara…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {resource && (
                <a
                  className="button light"
                  href={`/api${path(`export/${section}`)}`}
                >
                  <Download size={16} /> Excel
                </a>
              )}
              {section === "movements" &&
                tenant?.permissions.includes("stock:write") && (
                  <button
                    className="button dark"
                    onClick={() =>
                      void openForm(
                        "Stok hareketi",
                        [
                          {
                            key: "material_id",
                            label: "Malzeme",
                            relation: "materials",
                          },
                          {
                            key: "warehouse_id",
                            label: "Depo",
                            relation: "warehouses",
                          },
                          {
                            key: "direction",
                            label: "Yön",
                            options: ["in", "out"],
                          },
                          { key: "quantity", label: "Miktar", type: "decimal" },
                          { key: "note", label: "Açıklama", optional: true },
                        ],
                        path("movements"),
                      )
                    }
                  >
                    Stok giriş / çıkış
                  </button>
                )}
              {section === "reservations" && (
                <button
                  className="button dark"
                  onClick={() =>
                    void openForm(
                      "Stok rezerve et",
                      [
                        {
                          key: "order_id",
                          label: "Sipariş",
                          relation: "orders",
                        },
                        {
                          key: "material_id",
                          label: "Malzeme",
                          relation: "materials",
                        },
                        {
                          key: "warehouse_id",
                          label: "Depo",
                          relation: "warehouses",
                        },
                        { key: "quantity", label: "Miktar", type: "decimal" },
                      ],
                      path("reservations"),
                    )
                  }
                >
                  Rezervasyon oluştur
                </button>
              )}
              {section === "members" &&
                tenant?.permissions.includes("settings:write") && (
                  <button
                    className="button dark"
                    onClick={() =>
                      void openForm(
                        "Üye davet et",
                        [
                          { key: "email", label: "E-posta", type: "email" },
                          { key: "role_id", label: "Rol", relation: "roles" },
                        ],
                        path("invitations"),
                      )
                    }
                  >
                    Davet et
                  </button>
                )}
            </div>
            <DataTable
              rows={rows.filter((row) =>
                JSON.stringify(row)
                  .toLocaleLowerCase(locale)
                  .includes(search.toLocaleLowerCase(locale)),
              )}
              locale={locale}
              action={(row) => (
                <>
                  {resource &&
                    !resource.immutable &&
                    !resource.readOnly &&
                    tenant?.permissions.includes(
                      `${resource.permission}:write`,
                    ) && (
                      <button
                        onClick={() =>
                          void openForm(
                            "Kaydı düzenle",
                            resource.fields,
                            path(`resources/${section}/${row.id}`),
                            row,
                            "PATCH",
                          )
                        }
                      >
                        Düzenle
                      </button>
                    )}
                  {section === "purchases" &&
                    row.status === "pending" &&
                    tenant?.permissions.includes("purchasing:approve") && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api(path(`purchases/${row.id}/decision`), {
                                decision: "approved",
                              });
                              await refresh();
                            })
                          }
                        >
                          Onayla
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api(path(`purchases/${row.id}/decision`), {
                                decision: "rejected",
                              });
                              await refresh();
                            })
                          }
                        >
                          Reddet
                        </button>
                      </>
                    )}
                  {section === "work-orders" && (
                    <button
                      onClick={() =>
                        void openForm(
                          "Üretim ilerlemesi",
                          [
                            {
                              key: "completed",
                              label: "Tamamlanan miktar",
                              type: "decimal",
                            },
                            {
                              key: "scrap",
                              label: "Fire miktarı",
                              type: "decimal",
                            },
                            {
                              key: "status",
                              label: "Durum",
                              options: [
                                "queued",
                                "running",
                                "paused",
                                "done",
                                "cancelled",
                              ],
                            },
                          ],
                          path(`work-orders/${row.id}/progress`),
                          row,
                        )
                      }
                    >
                      İlerleme gir
                    </button>
                  )}
                </>
              )}
            />
            <div className="portal-pagination">
              <button
                disabled={page === 0 || busy}
                onClick={() => setPage(page - 1)}
              >
                <ArrowLeft size={16} /> Önceki
              </button>
              <span>
                Sayfa {page + 1} · {rows.length} kayıt
              </span>
              <button
                disabled={rows.length < 100 || busy}
                onClick={() => setPage(page + 1)}
              >
                Sonraki <ArrowRight size={16} />
              </button>
            </div>
          </section>
        )}
      </main>
      <dialog
        ref={dialog}
        className="portal-dialog"
        onCancel={() => setModal(null)}
      >
        <form ref={form} onSubmit={save}>
          <div className="portal-title">
            <h2>{modal?.title}</h2>
            <button
              type="button"
              onClick={() => {
                dialog.current?.close();
                setModal(null);
              }}
              aria-label="Kapat"
            >
              ×
            </button>
          </div>
          {modal?.fields.map((field) => (
            <label key={field.key}>
              {field.label}
              {field.optional ? " (isteğe bağlı)" : ""}
              {field.options || field.relation ? (
                <select
                  name={field.key}
                  required={!field.optional}
                  defaultValue={String(modal.values?.[field.key] || "")}
                >
                  <option value="">Seçin</option>
                  {field.options?.map((value) => (
                    <option key={value} value={value}>
                      {valueLabels[value] || value}
                    </option>
                  ))}
                  {field.relation &&
                    lookups[field.relation]?.map((row) => (
                      <option value={String(row.id)} key={String(row.id)}>
                        {String(row.name || row.code || row.id)}
                        {row.code && row.name ? ` · ${row.code}` : ""}
                      </option>
                    ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  name={field.key}
                  required={!field.optional}
                  maxLength={2000}
                  defaultValue={String(modal.values?.[field.key] || "")}
                />
              ) : (
                <input
                  name={field.key}
                  type={
                    field.type === "decimal" ? "text" : field.type || "text"
                  }
                  inputMode={field.type === "decimal" ? "decimal" : undefined}
                  pattern={
                    field.type === "decimal"
                      ? "[0-9]+([.][0-9]{1,6})?"
                      : undefined
                  }
                  required={!field.optional}
                  defaultValue={String(modal.values?.[field.key] ?? "")}
                  maxLength={field.type === "decimal" ? 20 : 160}
                />
              )}
            </label>
          ))}
          {error && (
            <p role="alert" className="portal-alert error">
              {error}
            </p>
          )}
          <button className="button dark" disabled={busy}>
            Kaydet
          </button>
        </form>
      </dialog>
    </div>
  );
}
function DataTable({
  rows,
  locale,
  action,
}: {
  rows: Row[];
  locale: string;
  action?: (row: Row) => React.ReactNode;
}) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter(
    (key) =>
      ![
        "tenant_id",
        "id",
        "custom_fields",
        "idempotency_key",
        "sha256",
        "rows",
      ].includes(key),
  );
  return rows.length ? (
    <div className="portal-table-wrap">
      <table>
        <thead>
          <tr>
            {keys.map((key) => (
              <th key={key}>{columnLabels[key] || key.replaceAll("_", " ")}</th>
            ))}
            {action && <th>İşlem</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id || i)}>
              {keys.map((key) => (
                <td key={key}>
                  {typeof row[key] === "boolean" ? (
                    row[key] ? (
                      "Evet"
                    ) : (
                      "Hayır"
                    )
                  ) : row[key] && typeof row[key] === "object" ? (
                    <details>
                      <summary>Ayrıntı</summary>
                      <pre>{JSON.stringify(row[key], null, 2)}</pre>
                    </details>
                  ) : (
                    valueLabels[String(row[key])] || String(row[key] ?? "—")
                  )}
                </td>
              ))}
              {action && <td className="portal-row-actions">{action(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="portal-empty">
      <Package size={40} />
      <h2>Henüz kayıt yok</h2>
      <p>İlk kaydınızı ekleyerek başlayın.</p>
    </div>
  );
}
function ImportPanel({
  workspace,
  run,
  busy,
}: {
  workspace: string;
  run: (fn: () => Promise<void>) => Promise<void>;
  busy: boolean;
}) {
  const [job, setJob] = useState<{
      id: string;
      rows: { name: string; rows: string[][] }[];
    } | null>(null),
    [mapping, setMapping] = useState({
      sheet: 0,
      headerRow: 0,
      codeColumn: 0,
      quantityColumn: 1,
      mode: "order_lines",
      orderId: "",
    }),
    [preview, setPreview] = useState<Row[]>([]),
    [orders, setOrders] = useState<Row[]>([]),
    [done, setDone] = useState(false);
  useEffect(() => {
    void run(async () =>
      setOrders((await api(`/workspaces/${workspace}/resources/orders`)).items),
    );
  }, [workspace, run]);
  return (
    <section className="portal-content">
      <span className="eyebrow">DOSYA → EŞLEME → KONTROL → ONAY</span>
      <h1>Excel içe aktarımı</h1>
      <p>
        .xlsx dosyası · en fazla 8 MB. Dosya taranır; hiçbir satır siz
        onaylamadan iş kayıtlarına eklenmez. Formüllü hücreleri önce değer
        olarak dışa aktarın.
      </p>
      <input
        type="file"
        accept=".xlsx"
        aria-label="Excel dosyası"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void run(async () => {
            const data = new FormData();
            data.set("file", file);
            setJob(await api(`/workspaces/${workspace}/imports`, data));
            setPreview([]);
            setDone(false);
          });
        }}
      />
      {job && (
        <div className="portal-card">
          <div className="portal-form-grid">
            <label>
              Sayfa
              <select
                value={mapping.sheet}
                onChange={(e) => {
                  setMapping({ ...mapping, sheet: Number(e.target.value) });
                  setPreview([]);
                }}
              >
                {job.rows.map((sheet, i) => (
                  <option key={i} value={i}>
                    {sheet.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sipariş
              <select
                value={mapping.orderId}
                onChange={(e) => {
                  setMapping({ ...mapping, orderId: e.target.value });
                  setPreview([]);
                }}
              >
                <option value="">Taslak sipariş seçin</option>
                {orders
                  .filter((row) => row.status === "draft")
                  .map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>
                      {String(row.code)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              İçerik
              <select
                value={mapping.mode}
                onChange={(e) => {
                  setMapping({ ...mapping, mode: e.target.value });
                  setPreview([]);
                }}
              >
                <option value="order_lines">Ürün / sipariş kalemleri</option>
                <option value="requirements">
                  Hazır malzeme ihtiyaç listesi
                </option>
              </select>
            </label>
            {(["headerRow", "codeColumn", "quantityColumn"] as const).map(
              (key, i) => (
                <label key={key}>
                  {["Başlık satırı", "Kod sütunu", "Miktar sütunu"][i]} (1’den
                  başlar)
                  <input
                    type="number"
                    min={1}
                    value={mapping[key] + 1}
                    onChange={(e) => {
                      setMapping({
                        ...mapping,
                        [key]: Number(e.target.value) - 1,
                      });
                      setPreview([]);
                    }}
                  />
                </label>
              ),
            )}
          </div>
          <button
            className="button dark"
            disabled={busy || !mapping.orderId || done}
            onClick={() =>
              void run(async () =>
                setPreview(
                  (
                    await api(
                      `/workspaces/${workspace}/imports/${job.id}/preview`,
                      mapping,
                    )
                  ).items,
                ),
              )
            }
          >
            Eşlemeyi kontrol et
          </button>
          <DataTable locale="tr" rows={preview} />
          {preview.length > 0 && (
            <button
              className="button dark"
              disabled={busy || done || preview.some((row) => row.error)}
              onClick={() =>
                void run(async () => {
                  await api(
                    `/workspaces/${workspace}/imports/${job.id}/confirm`,
                    mapping,
                  );
                  setDone(true);
                })
              }
            >
              {done
                ? "Aktarım tamamlandı"
                : `${preview.length} satırı onayla ve içe aktar`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
