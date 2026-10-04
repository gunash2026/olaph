"use client";
import { useEffect, useRef, useState } from "react";
import {
  Box,
  Package,
  ClipboardList,
  ShoppingCart,
  Users,
  Settings,
  History,
  LayoutDashboard,
  ListChecks,
  Search,
  Plus,
  Download,
  Upload,
  Menu,
  X,
  CalendarDays,
  Info,
  LogOut,
  Globe,
  Layers,
  Check,
  Warehouse,
  ArrowDownUp,
} from "lucide-react";
import {
  materialSchema,
  movementSchema,
  isLowStock,
  stockAfter,
  shortage,
  decimal,
  parseCsv,
  toCsv,
  type Material,
} from "@olaph/core";
import { href, locales, type Locale } from "@/lib/config";
import type { Messages } from "@/lib/messages";
import { Logo } from "./site";
type Partner = {
  id: string;
  name: string;
  type: "customer" | "supplier" | "both";
};
type Order = {
  id: string;
  code: string;
  customer: string;
  name: string;
  quantity: string;
  due: string;
  status: "draft" | "active" | "done";
};
type Purchase = {
  id: string;
  materialId: string;
  quantity: string;
  price: string;
  partner: string;
  status: "pending" | "approved";
};
type Audit = {
  id: string;
  date: string;
  kind: string;
  name: string;
  note: string;
};
type Data = {
  version: 1;
  name: string;
  materials: Material[];
  partners: Partner[];
  orders: Order[];
  purchases: Purchase[];
  audit: Audit[];
};
const blank: Data = {
  version: 1,
  name: "",
  materials: [],
  partners: [],
  orders: [],
  purchases: [],
  audit: [],
};
const storageKey = "olaph-demo-v1";
const icons = [
  LayoutDashboard,
  Package,
  ClipboardList,
  ListChecks,
  Users,
  ShoppingCart,
  History,
  Settings,
];
const pages = [
  "overview",
  "inventory",
  "orders",
  "needs",
  "partners",
  "purchasing",
  "audit",
  "settings",
];
type Modal =
  | "material"
  | "movement"
  | "order"
  | "partner"
  | "purchase"
  | "import"
  | null;
export function Dashboard({ locale, t }: { locale: Locale; t: Messages }) {
  const a = t.app;
  const [data, setData] = useState<Data>(blank);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState(0);
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [imports, setImports] = useState<Material[]>([]);
  const [needMaterial, setNeedMaterial] = useState("");
  const [needAmount, setNeedAmount] = useState("");
  const [needResult, setNeedResult] = useState<{
    required: string;
    available: string;
    missing: string;
  } | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const d = JSON.parse(saved);
        if (
          d.version === 1 &&
          Array.isArray(d.materials) &&
          Array.isArray(d.orders) &&
          Array.isArray(d.partners) &&
          Array.isArray(d.purchases) &&
          Array.isArray(d.audit)
        )
          setData(d);
      }
    } catch {
      setToast(a.error);
    }
    setLoaded(true);
    const hash = location.hash.slice(1);
    if (pages.includes(hash)) setTab(pages.indexOf(hash));
  }, [a.error]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (modal) modalRef.current?.showModal();
    else modalRef.current?.close();
  }, [modal]);
  function navigate(i: number) {
    setTab(i);
    setSearch("");
    setFilter("all");
    setMenu(false);
    history.replaceState(null, "", `#${pages[i]}`);
  }
  function open(kind: Modal) {
    setError("");
    setImports([]);
    setModal(kind);
  }
  function persist(next: Data, kind?: string, name = "", note = "") {
    if (!loaded) return false;
    const updated = {
      ...next,
      audit: kind
        ? [
            {
              id: crypto.randomUUID(),
              date: new Date().toISOString(),
              kind,
              name,
              note,
            },
            ...next.audit,
          ].slice(0, 500)
        : next.audit,
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setData(updated);
      setToast(a.saved);
      return true;
    } catch {
      setError(a.error);
      setToast(a.error);
      return false;
    }
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    ) as Record<string, string>;
    for (const key of Object.keys(values)) values[key] = values[key].trim();
    try {
      let next = { ...data };
      let name = values.name || values.code;
      let note = "";
      if (modal === "material") {
        const item = materialSchema.parse({
          ...values,
          id: crypto.randomUUID(),
        });
        if (
          data.materials.some(
            (m) => m.code.toLocaleLowerCase() === item.code.toLocaleLowerCase(),
          )
        )
          throw Error();
        next.materials = [...data.materials, item];
      }
      if (modal === "movement") {
        const v = movementSchema.parse(values);
        const material = data.materials.find((m) => m.id === v.materialId);
        if (!material) throw Error();
        next.materials = data.materials.map((m) =>
          m.id === material.id
            ? {
                ...m,
                quantity: stockAfter(m.quantity, v.quantity, v.direction),
              }
            : m,
        );
        name = material.name;
        note = `${v.direction === "in" ? "+" : "−"}${v.quantity} ${material.unit}${v.note ? ` · ${v.note}` : ""}`;
      }
      if (modal === "order") {
        decimal.parse(values.quantity);
        if (
          Number(values.quantity) <= 0 ||
          !values.name ||
          !values.code ||
          !values.due ||
          data.orders.some(
            (o) => o.code.toLowerCase() === values.code.toLowerCase(),
          )
        )
          throw Error();
        next.orders = [
          ...data.orders,
          {
            id: crypto.randomUUID(),
            name: values.name,
            code: values.code,
            customer: values.customer,
            quantity: values.quantity,
            due: values.due,
            status: "draft",
          },
        ];
      }
      if (modal === "partner") {
        if (!values.name) throw Error();
        next.partners = [
          ...data.partners,
          {
            id: crypto.randomUUID(),
            name: values.name,
            type: values.type as Partner["type"],
          },
        ];
      }
      if (modal === "purchase") {
        decimal.parse(values.quantity);
        decimal.parse(values.price);
        if (
          Number(values.quantity) <= 0 ||
          !data.materials.some((m) => m.id === values.materialId)
        )
          throw Error();
        next.purchases = [
          ...data.purchases,
          {
            id: crypto.randomUUID(),
            materialId: values.materialId,
            quantity: values.quantity,
            price: values.price,
            partner: values.partner,
            status: "pending",
          },
        ];
        name =
          data.materials.find((m) => m.id === values.materialId)?.name || "";
      }
      if (persist(next, modal || "", name, note)) setModal(null);
    } catch {
      setError(modal === "movement" ? a.stockError : a.error);
    }
  }
  function exportData() {
    const collections: Record<number, string[][]> = {
      1: [
        ["code", "name", "unit", "quantity", "minimum"],
        ...data.materials.map((m) => [
          m.code,
          m.name,
          m.unit,
          m.quantity,
          m.minimum,
        ]),
      ],
      2: [
        ["code", "name", "customer", "quantity", "due", "status"],
        ...data.orders.map((o) => [
          o.code,
          o.name,
          o.customer,
          o.quantity,
          o.due,
          o.status,
        ]),
      ],
      4: [["name", "type"], ...data.partners.map((p) => [p.name, p.type])],
      5: [
        ["material", "quantity", "unit_price_usd", "partner", "status"],
        ...data.purchases.map((p) => [
          data.materials.find((m) => m.id === p.materialId)?.name || "",
          p.quantity,
          p.price,
          p.partner,
          p.status,
        ]),
      ],
      6: [
        ["date", "action", "name", "note"],
        ...data.audit.map((e) => [e.date, e.kind, e.name, e.note]),
      ],
    };
    const blob = new Blob([toCsv(collections[tab] || collections[1])], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `olaph-${pages[tab]}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file: File) {
    setError("");
    setImports([]);
    try {
      if (file.size > 2_000_000) throw Error();
      const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
      const headers = rows.shift()?.map((v) => v.trim().toLowerCase());
      if (
        !headers ||
        !["code", "name", "unit", "quantity", "minimum"].every((k) =>
          headers.includes(k),
        )
      )
        throw Error();
      const imported = rows.map((row) =>
        materialSchema.parse({
          ...Object.fromEntries(
            headers.map((key, i) => [key, row[i]?.trim() || ""]),
          ),
          id: crypto.randomUUID(),
        }),
      );
      const codes = [...data.materials, ...imported].map((m) =>
        m.code.toLowerCase(),
      );
      if (new Set(codes).size !== codes.length || imported.length === 0)
        throw Error();
      setImports(imported);
    } catch {
      setError(a.importInvalid);
    }
  }
  const low = data.materials.filter(isLowStock);
  const numeric = (v: string) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(
      Number(v),
    );
  const date = (v: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(v));
  const matches = (values: string[]) =>
    values.some((v) =>
      v.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    );
  const filteredMaterials = data.materials.filter(
    (m) =>
      matches([m.name, m.code]) && (filter !== "critical" || isLowStock(m)),
  );
  const modalTitle =
    modal === "material"
      ? a.addMaterial
      : modal === "movement"
        ? a.movement
        : modal === "order"
          ? a.newOrder
          : modal === "partner"
            ? a.newPartner
            : modal === "purchase"
              ? a.newPurchase
              : a.import;
  const empty = (action?: () => void, label?: string) => (
    <div className="empty-state">
      <span className="empty-icon">
        <Package size={28} strokeWidth={1.3} />
      </span>
      <h2>{a.empty}</h2>
      <p>{a.emptyText}</p>
      {action && (
        <button onClick={action} className="button copper">
          <Plus size={16} />
          {label || a.add}
        </button>
      )}
    </div>
  );
  const auditList = (limit = 50) =>
    data.audit.length ? (
      <div className="panel-body">
        {data.audit.slice(0, limit).map((log) => (
          <div className="audit-item" key={log.id}>
            <History size={16} />
            <div>
              <strong>{log.name}</strong> ·{" "}
              {a[log.kind as keyof typeof a] || log.kind}
              {log.note && <div>{log.note}</div>}
              <small>
                {date(log.date)} ·{" "}
                {new Date(log.date).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="empty-state">
        <History size={27} strokeWidth={1.1} />
        <p style={{ marginTop: 15, marginBottom: 0 }}>{a.noAudit}</p>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${menu ? "open" : ""}`}>
        <Logo />
        <div className="workspace-chip">
          <span>
            <Box size={18} />
          </span>
          <div>
            {data.name || a.workspace}
            <small>{a.demo}</small>
          </div>
        </div>
        <nav aria-label={a.workspace}>
          {a.nav.map((n, i) => {
            const Icon = icons[i];
            return (
              <button
                className={tab === i ? "selected" : ""}
                aria-current={tab === i ? "page" : undefined}
                onClick={() => navigate(i)}
                key={n}
              >
                <Icon size={18} strokeWidth={1.6} />
                {n}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <a href={href(locale)}>
            <LogOut size={16} />
            {a.back}
          </a>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label={a.cancel}
          onClick={() => setMenu(false)}
        />
      )}
      <main className="app-main">
        <header className="app-topbar">
          <div className="app-breadcrumb">
            <button
              className="icon-button app-menu-button"
              aria-label={a.workspace}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            <span>{data.name || a.workspace}</span>
            <span>/</span>
            <span>{a.nav[tab]}</span>
          </div>
          <div className="app-top-actions">
            <label className="language">
              <Globe size={14} />
              <select
                aria-label={a.language}
                value={locale}
                onChange={(e) =>
                  location.assign(
                    `${href(e.target.value, "app")}#${pages[tab]}`,
                  )
                }
              >
                {locales.map((l) => (
                  <option value={l} key={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <div className="user-icon">O</div>
          </div>
        </header>
        <div className="demo-banner">
          <Info size={14} />
          {a.demoNote}
        </div>
        <div className="app-content">
          <div className="app-page-heading">
            <div>
              {tab === 0 && (
                <div className="date-label">
                  <CalendarDays size={13} />
                  {loaded
                    ? new Date().toLocaleDateString(locale, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })
                    : "OLAPH"}
                </div>
              )}
              <h1>{tab === 0 ? a.greeting : a.nav[tab]}</h1>
              <p>
                {tab === 0
                  ? a.greetingText
                  : tab === 3
                    ? a.needsHelp
                    : tab === 7
                      ? a.settingsText
                      : a.draftHelp}
              </p>
            </div>
            {[0, 1, 2, 4, 5].includes(tab) && (
              <button
                className="button copper"
                onClick={() =>
                  open(
                    tab === 2
                      ? "order"
                      : tab === 4
                        ? "partner"
                        : tab === 5
                          ? "purchase"
                          : "material",
                  )
                }
              >
                <Plus size={16} />
                {tab === 2
                  ? a.newOrder
                  : tab === 4
                    ? a.newPartner
                    : tab === 5
                      ? a.newPurchase
                      : a.addMaterial}
              </button>
            )}
          </div>
          {tab === 0 && (
            <>
              <div className="stats-grid">
                {[
                  [a.materials, data.materials.length, Package],
                  [
                    a.orders,
                    data.orders.filter((o) => o.status !== "done").length,
                    ClipboardList,
                  ],
                  [a.critical, low.length, Warehouse],
                  [
                    a.approvals,
                    data.purchases.filter((p) => p.status === "pending").length,
                    ShoppingCart,
                  ],
                ].map(([label, count, Icon], i) => {
                  const I = Icon as typeof Package;
                  return (
                    <div className="stat" key={i}>
                      <div>
                        {label as string}
                        <I size={18} />
                      </div>
                      <strong>{count as number}</strong>
                    </div>
                  );
                })}
              </div>
              <div className="dashboard-columns">
                <div>
                  <section className="panel">
                    <div className="panel-title">
                      <h2>{a.nav[1]}</h2>
                      <button onClick={() => navigate(1)}>{a.allStock}</button>
                    </div>
                    {data.materials.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>{a.material}</th>
                              <th>{a.quantity}</th>
                              <th>{a.status}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.materials.slice(0, 5).map((m) => (
                              <tr key={m.id}>
                                <td>
                                  <strong>{m.name}</strong>
                                  <small>{m.code}</small>
                                </td>
                                <td>
                                  {numeric(m.quantity)} {m.unit}
                                </td>
                                <td>
                                  <span
                                    className={`badge ${isLowStock(m) ? "warning" : ""}`}
                                  >
                                    {isLowStock(m) ? a.critical : a.normal}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      empty(() => open("material"), a.addMaterial)
                    )}
                  </section>
                  <section className="panel">
                    <div className="panel-title">
                      <h2>{a.recent}</h2>
                      <History size={15} />
                    </div>
                    {auditList(4)}
                  </section>
                </div>
                <div>
                  <section className="panel">
                    <div className="panel-title">
                      <h2>{a.quick}</h2>
                      <Plus size={16} />
                    </div>
                    <div className="panel-body quick-actions">
                      <button
                        onClick={() => open("movement")}
                        disabled={!data.materials.length}
                      >
                        <ArrowDownUp size={17} />
                        {a.movement}
                      </button>
                      <button onClick={() => open("order")}>
                        <ClipboardList size={17} />
                        {a.newOrder}
                      </button>
                      <button onClick={() => open("import")}>
                        <Upload size={17} />
                        {a.import}
                      </button>
                    </div>
                  </section>
                  <div className="welcome-panel">
                    <Layers size={28} strokeWidth={1.2} />
                    <h3>{a.welcome}</h3>
                    <p>{a.welcomeText}</p>
                  </div>
                </div>
              </div>
            </>
          )}
          {[1, 2, 4, 5].includes(tab) && (
            <section className="panel">
              <div className="toolbar">
                <label className="search-box">
                  <Search size={15} />
                  <input
                    className="search-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={a.search}
                    aria-label={a.search}
                  />
                </label>
                <div className="toolbar-actions">
                  {tab === 1 && (
                    <>
                      <select
                        className="filter-select"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        aria-label={a.status}
                      >
                        <option value="all">{a.all}</option>
                        <option value="critical">{a.critical}</option>
                      </select>
                      <button
                        className="button outline"
                        onClick={() => open("movement")}
                        disabled={!data.materials.length}
                      >
                        <ArrowDownUp size={14} />
                        {a.movement}
                      </button>
                      <button
                        className="button outline"
                        onClick={() => open("import")}
                        aria-label={a.import}
                      >
                        <Upload size={14} />
                      </button>
                    </>
                  )}
                  <button className="button outline" onClick={exportData}>
                    <Download size={14} />
                    {a.export}
                  </button>
                </div>
              </div>
              {tab === 1 &&
                (filteredMaterials.length ? (
                  <>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{a.material}</th>
                            <th>{a.code}</th>
                            <th>{a.quantity}</th>
                            <th>{a.minimum}</th>
                            <th>{a.status}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMaterials.map((m) => (
                            <tr key={m.id}>
                              <td>
                                <strong>{m.name}</strong>
                              </td>
                              <td>{m.code}</td>
                              <td>
                                {numeric(m.quantity)} {m.unit}
                              </td>
                              <td>
                                {numeric(m.minimum)} {m.unit}
                              </td>
                              <td>
                                <span
                                  className={`badge ${isLowStock(m) ? "warning" : ""}`}
                                >
                                  {isLowStock(m) ? a.critical : a.normal}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="table-footer">
                      {filteredMaterials.length} {a.count}
                    </div>
                  </>
                ) : (
                  empty(() => open("material"), a.addMaterial)
                ))}
              {tab === 2 &&
                (data.orders.filter((o) =>
                  matches([o.name, o.code, o.customer]),
                ).length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{a.order}</th>
                          <th>{a.customer}</th>
                          <th>{a.quantity}</th>
                          <th>{a.due}</th>
                          <th>{a.status}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.orders
                          .filter((o) => matches([o.name, o.code, o.customer]))
                          .map((o) => (
                            <tr key={o.id}>
                              <td>
                                <strong>{o.name}</strong>
                                <small>{o.code}</small>
                              </td>
                              <td>{o.customer || "—"}</td>
                              <td>{numeric(o.quantity)}</td>
                              <td>{date(o.due)}</td>
                              <td>
                                <select
                                  className="filter-select"
                                  aria-label={`${o.code} ${a.status}`}
                                  value={o.status}
                                  onChange={(e) =>
                                    persist(
                                      {
                                        ...data,
                                        orders: data.orders.map((row) =>
                                          row.id === o.id
                                            ? {
                                                ...row,
                                                status: e.target
                                                  .value as Order["status"],
                                              }
                                            : row,
                                        ),
                                      },
                                      "status",
                                      o.code,
                                      a[e.target.value as "draft"],
                                    )
                                  }
                                >
                                  {["draft", "active", "done"].map((status) => (
                                    <option key={status} value={status}>
                                      {a[status as "draft"]}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  empty(() => open("order"), a.newOrder)
                ))}
              {tab === 4 &&
                (data.partners.filter((p) => matches([p.name])).length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{a.partner}</th>
                          <th>{a.type}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.partners
                          .filter((p) => matches([p.name]))
                          .map((p) => (
                            <tr key={p.id}>
                              <td>
                                <strong>{p.name}</strong>
                              </td>
                              <td>
                                <span className="badge neutral">
                                  {a[p.type]}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  empty(() => open("partner"), a.newPartner)
                ))}
              {tab === 5 &&
                (data.purchases.filter((p) =>
                  matches([
                    p.partner,
                    data.materials.find((m) => m.id === p.materialId)?.name ||
                      "",
                  ]),
                ).length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{a.material}</th>
                          <th>{a.supplier}</th>
                          <th>{a.quantity}</th>
                          <th>{a.price}</th>
                          <th>{a.status}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.purchases
                          .filter((p) =>
                            matches([
                              p.partner,
                              data.materials.find((m) => m.id === p.materialId)
                                ?.name || "",
                            ]),
                          )
                          .map((p) => (
                            <tr key={p.id}>
                              <td>
                                <strong>
                                  {
                                    data.materials.find(
                                      (m) => m.id === p.materialId,
                                    )?.name
                                  }
                                </strong>
                              </td>
                              <td>{p.partner || "—"}</td>
                              <td>{numeric(p.quantity)}</td>
                              <td>${numeric(p.price)}</td>
                              <td>
                                {p.status === "pending" ? (
                                  <button
                                    className="button outline compact"
                                    title={a.previewApproval}
                                    onClick={() =>
                                      persist(
                                        {
                                          ...data,
                                          purchases: data.purchases.map(
                                            (row) =>
                                              row.id === p.id
                                                ? { ...row, status: "approved" }
                                                : row,
                                          ),
                                        },
                                        "approved",
                                        data.materials.find(
                                          (m) => m.id === p.materialId,
                                        )?.name,
                                        a.previewApproval,
                                      )
                                    }
                                  >
                                    <Check size={13} />
                                    {a.approve}
                                  </button>
                                ) : (
                                  <span className="badge">{a.approved}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  empty(() => open("purchase"), a.newPurchase)
                ))}
            </section>
          )}
          {tab === 3 && (
            <section className="panel">
              <div className="panel-body">
                <form
                  className="form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    try {
                      const m = data.materials.find(
                        (m) => m.id === needMaterial,
                      );
                      if (!m) throw Error();
                      setNeedResult({
                        required: needAmount,
                        available: m.quantity,
                        missing: shortage(needAmount, m.quantity),
                      });
                    } catch {
                      setToast(a.error);
                    }
                  }}
                >
                  <label className="field">
                    {a.material}
                    <select
                      required
                      value={needMaterial}
                      onChange={(e) => {
                        setNeedMaterial(e.target.value);
                        setNeedResult(null);
                      }}
                    >
                      <option value="">—</option>
                      {data.materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    {a.required}
                    <input
                      required
                      inputMode="decimal"
                      value={needAmount}
                      onChange={(e) => {
                        setNeedAmount(e.target.value);
                        setNeedResult(null);
                      }}
                      placeholder={a.quantityPlaceholder}
                    />
                  </label>
                  <button
                    className="button copper"
                    disabled={!data.materials.length}
                  >
                    {a.calculate}
                  </button>
                </form>
                {needResult && (
                  <div className="needs-result">
                    {(["required", "available", "missing"] as const).map(
                      (key) => (
                        <div key={key}>
                          <span>{a[key]}</span>
                          <strong>{numeric(needResult[key])}</strong>
                        </div>
                      ),
                    )}
                  </div>
                )}
                {!data.materials.length &&
                  empty(() => open("material"), a.addMaterial)}
              </div>
            </section>
          )}
          {tab === 6 && (
            <section className="panel">
              <div className="panel-title">
                <h2>{a.nav[6]}</h2>
                <button className="button outline" onClick={exportData}>
                  <Download size={14} />
                  {a.export}
                </button>
              </div>
              {auditList()}
            </section>
          )}
          {tab === 7 && (
            <section className="panel">
              <div className="panel-body">
                <form
                  className="settings-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = String(
                      new FormData(e.currentTarget).get("name"),
                    ).trim();
                    if (name) persist({ ...data, name }, "settings", name);
                  }}
                >
                  <label className="field">
                    {a.workspaceName}
                    <input
                      name="name"
                      required
                      maxLength={80}
                      defaultValue={data.name}
                      placeholder={a.workspace}
                    />
                  </label>
                  <label className="field">
                    {a.language}
                    <select
                      value={locale}
                      onChange={(e) =>
                        location.assign(
                          `${href(e.target.value, "app")}#settings`,
                        )
                      }
                    >
                      {locales.map((l) => (
                        <option key={l} value={l}>
                          {
                            {
                              tr: "Türkçe",
                              en: "English",
                              ar: "العربية",
                              zh: "中文",
                              ru: "Русский",
                            }[l]
                          }
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="button copper">{a.save}</button>
                </form>
                <div className="notice">{a.demoNote}</div>
                <button
                  className="button outline danger"
                  onClick={() => {
                    if (confirm(a.resetQuestion)) {
                      try {
                        localStorage.removeItem(storageKey);
                        setData(blank);
                        setToast(a.saved);
                      } catch {
                        setToast(a.error);
                      }
                    }
                  }}
                >
                  {a.reset}
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
      <dialog
        className="modal app-dialog"
        ref={modalRef}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
      >
        {modal && (
          <>
            <button
              className="modal-close icon-button"
              aria-label={a.cancel}
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            <h2>{modalTitle}</h2>
            {modal === "import" ? (
              <>
                <p>{a.importNote}</p>
                <input
                  ref={fileRef}
                  aria-label={a.import}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    if (e.target.files?.[0]) void importFile(e.target.files[0]);
                  }}
                />
                {imports.length > 0 && (
                  <div className="import-preview">
                    <table>
                      <thead>
                        <tr>
                          <th>{a.code}</th>
                          <th>{a.name}</th>
                          <th>{a.quantity}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imports.slice(0, 30).map((m) => (
                          <tr key={m.id}>
                            <td>{m.code}</td>
                            <td>{m.name}</td>
                            <td>
                              {m.quantity} {m.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p>
                      {imports.length} {a.count}
                    </p>
                  </div>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="form-actions">
                  <button
                    className="button outline"
                    onClick={() => setModal(null)}
                  >
                    {a.cancel}
                  </button>
                  <button
                    className="button copper"
                    disabled={!imports.length}
                    onClick={() => {
                      if (
                        persist(
                          {
                            ...data,
                            materials: [...data.materials, ...imports],
                          },
                          "import",
                          `${imports.length} ${a.count}`,
                        )
                      )
                        setModal(null);
                    }}
                  >
                    {a.importConfirm}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={submit} key={modal}>
                <div className="form-grid">
                  {["material", "order", "partner"].includes(modal) && (
                    <label className="field full">
                      {a.name}
                      <input autoFocus required name="name" maxLength={120} />
                    </label>
                  )}
                  {["material", "order"].includes(modal) && (
                    <label className="field">
                      {a.code}
                      <input required name="code" maxLength={40} />
                    </label>
                  )}
                  {modal === "material" && (
                    <>
                      <label className="field">
                        {a.unit}
                        <input required name="unit" maxLength={20} />
                      </label>
                      <label className="field">
                        {a.quantity}
                        <input
                          required
                          name="quantity"
                          inputMode="decimal"
                          defaultValue="0"
                        />
                      </label>
                      <label className="field">
                        {a.minimum}
                        <input
                          required
                          name="minimum"
                          inputMode="decimal"
                          defaultValue="0"
                        />
                      </label>
                    </>
                  )}
                  {["movement", "purchase"].includes(modal) && (
                    <label className="field full">
                      {a.material}
                      <select required name="materialId" defaultValue="">
                        <option value="" disabled>
                          —
                        </option>
                        {data.materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.quantity} {m.unit})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {modal === "movement" && (
                    <label className="field">
                      {a.type}
                      <select name="direction">
                        <option value="in">{a.in}</option>
                        <option value="out">{a.out}</option>
                      </select>
                    </label>
                  )}
                  {["movement", "order", "purchase"].includes(modal) && (
                    <label className="field">
                      {a.quantity}
                      <input
                        required
                        name="quantity"
                        inputMode="decimal"
                        placeholder={a.quantityPlaceholder}
                      />
                    </label>
                  )}
                  {modal === "movement" && (
                    <label className="field full">
                      {a.note}
                      <textarea name="note" maxLength={300} />
                    </label>
                  )}
                  {modal === "order" && (
                    <>
                      <label className="field">
                        {a.due}
                        <input required name="due" type="date" />
                      </label>
                      <label className="field full">
                        {a.customer}
                        <select name="customer">
                          <option value="">—</option>
                          {data.partners
                            .filter((p) => p.type !== "supplier")
                            .map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    </>
                  )}
                  {modal === "partner" && (
                    <label className="field full">
                      {a.type}
                      <select name="type">
                        <option value="customer">{a.customer}</option>
                        <option value="supplier">{a.supplier}</option>
                        <option value="both">{a.both}</option>
                      </select>
                    </label>
                  )}
                  {modal === "purchase" && (
                    <>
                      <label className="field">
                        {a.price}
                        <input required name="price" inputMode="decimal" />
                      </label>
                      <label className="field full">
                        {a.supplier}
                        <select name="partner">
                          <option value="">—</option>
                          {data.partners
                            .filter((p) => p.type !== "customer")
                            .map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <p className="field full check-detail">
                        {a.previewApproval}
                      </p>
                    </>
                  )}
                </div>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="form-actions">
                  <button
                    type="button"
                    className="button outline"
                    onClick={() => setModal(null)}
                  >
                    {a.cancel}
                  </button>
                  <button type="submit" className="button copper">
                    {a.save}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </dialog>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
