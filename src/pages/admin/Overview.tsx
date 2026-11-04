import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAlerts, fetchOverview, type Alert, type OverviewData } from "../../lib/admin-data";
import { SelectField } from "./SelectField";
import { presetPeriods, formatMoney, formatDate, formatTime, type Period } from "./periods";
import { PARTNERS, Pager, PeriodFilter, PlanCell, STATUS_LABEL, TrendLine, capitalize, share, trend } from "./shared";
import { AnimateIcon } from "../../components/animate-ui/icons/icon";
import { TriangleAlert } from "../../components/animate-ui/icons/hugeicons/triangle-alert";
import { Search01 } from "../../components/animate-ui/icons/hugeicons/search-01";
import { ArrowRight01 } from "../../components/animate-ui/icons/hugeicons/arrow-right-01";
import { Wallet } from "../../components/animate-ui/icons/hugeicons/wallet";
import { ShoppingBag } from "../../components/animate-ui/icons/hugeicons/shopping-bag";
import { CreditCard } from "../../components/animate-ui/icons/hugeicons/credit-card";
import { Undo02 } from "../../components/animate-ui/icons/hugeicons/undo-02";
import { UserRound } from "../../components/animate-ui/icons/hugeicons/user-round";
import { TrendingUp } from "../../components/animate-ui/icons/hugeicons/trending-up";
import { Calendar } from "../../components/animate-ui/icons/hugeicons/calendar";

type Status = "loading" | "ready" | "error";
const PAGE_SIZE = 8;

type RecentRow = OverviewData["recent"][number];
type SearchColumn = "all" | "client" | "plan" | "amount" | "discount" | "status" | "date";

const SEARCH_COLUMNS: { value: SearchColumn; label: string }[] = [
  { value: "all", label: "Todo" },
  { value: "client", label: "Cliente" },
  { value: "plan", label: "Plan" },
  { value: "amount", label: "Monto vendido" },
  { value: "discount", label: "Descuento" },
  { value: "status", label: "Estado" },
  { value: "date", label: "Fecha" },
];

// Texto de cada columna tal como se ve en la tabla, para que la búsqueda encuentre lo que el usuario lee.
function cellText(r: RecentRow, col: Exclude<SearchColumn, "all">): string {
  if (col === "client") return r.profiles?.email ?? "";
  if (col === "plan") return r.plan_id;
  if (col === "amount") return `${formatMoney(Number(r.amount))} ${r.amount}`;
  if (col === "discount") return r.coupons?.code ?? "";
  if (col === "status") return `${STATUS_LABEL[r.status] ?? ""} ${r.status}`;
  return `${formatDate(r.created_at)} ${formatTime(r.created_at)}`;
}

export function Overview() {
  const [period, setPeriod] = useState<Period>(presetPeriods()[2]);
  const [data, setData] = useState<OverviewData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [planFilter, setPlanFilter] = useState("all");
  const [searchColumn, setSearchColumn] = useState<SearchColumn>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setStatus("loading");
    fetchOverview(period.start, period.endExclusive)
      .then((d) => {
        setData(d);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    fetchAlerts()
      .then(setAlerts)
      .catch(() => setAlerts([]));
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  // Solo se muestran ventas pagadas: un intento de compra sin terminar no es una venta todavía.
  const paidRecent = useMemo(() => (data?.recent ?? []).filter((r) => r.status === "paid"), [data]);
  const plansInRecent = useMemo(() => Array.from(new Set(paidRecent.map((r) => r.plan_id))), [paidRecent]);

  const filteredRecent = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const columns = searchColumn === "all" ? (["client", "plan", "amount", "discount", "status", "date"] as const) : [searchColumn];
    return paidRecent.filter((r) => {
      if (planFilter !== "all" && r.plan_id !== planFilter) return false;
      if (needle && !columns.some((c) => cellText(r, c).toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [paidRecent, planFilter, search, searchColumn]);

  useEffect(() => {
    setPage(1);
  }, [search, searchColumn, planFilter, data]);

  // Lo cobrado hoy (fecha local), sin importar el periodo elegido: lo primero que conviene ver al entrar.
  const today = useMemo(() => {
    const key = new Date().toLocaleDateString("en-CA");
    const paid = (data?.recent ?? []).filter((r) => r.status === "paid" && new Date(r.paid_at ?? r.created_at).toLocaleDateString("en-CA") === key);
    return { count: paid.length, gross: Math.round(paid.reduce((a, r) => a + Number(r.amount), 0) * 100) / 100 };
  }, [data]);
  const todayText = today.count === 0 ? "Todavía sin ventas hoy" : today.count === 1 ? "1 pedido pagado hoy" : today.count + " pedidos pagados hoy";

  const pagedRecent = filteredRecent.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const columnLabel = SEARCH_COLUMNS.find((c) => c.value === searchColumn)!.label.toLowerCase();

  return (
    <div className="admin__page">
      <div className="admin__head">
        <h1 className="admin__title">Resumen</h1>
      </div>

      <PeriodFilter period={period} onChange={setPeriod} />

      <div className="admin__content">
        {status === "loading" && <div className="admin-empty">Cargando datos…</div>}
        {status === "error" && (
          <div className="admin-empty">
            No pudimos cargar el resumen.{" "}
            <button className="lnk" type="button" onClick={load}>
              Reintentar
            </button>
          </div>
        )}

        {status === "ready" && data && (
          <>
            <div className="board">
              {alerts.length > 0 && (
                <div className="board__alerts">
                  {alerts.map((a) => (
                    <div className="ov-alert" key={a.id}>
                      <TriangleAlert size={15} />
                      <span>{a.message}</span>
                      <AnimateIcon animateOnHover asChild>
                        <Link to={a.link}>
                          Revisar <ArrowRight01 size={13} />
                        </Link>
                      </AnimateIcon>
                    </div>
                  ))}
                </div>
              )}

              <div className="board__kpis">
                <div className="kpi">
                  <p className="kpi__label">
                    <Wallet size={14} />
                    Ventas brutas
                  </p>
                  <p className="kpi__value">{formatMoney(data.grossAmount)}</p>
                  <TrendLine t={trend(data.grossAmount, data.previousPeriod.grossAmount)} />
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <CreditCard size={14} />
                    Comisiones
                  </p>
                  <p className="kpi__value">{formatMoney(data.feesAmount)}</p>
                  <TrendLine t={share(data.feesAmount, data.grossAmount, "Sin ventas en el periodo")} />
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <TrendingUp size={14} />
                    Ganancia neta
                  </p>
                  <p className="kpi__value">{formatMoney(data.netAmount)}</p>
                  <TrendLine t={trend(data.netAmount, data.previousPeriod.netAmount)} />
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <Undo02 size={14} />
                    Devoluciones
                  </p>
                  <p className="kpi__value">{formatMoney(data.refundsAmount)}</p>
                  <TrendLine
                    t={data.refundsAmount === 0 ? { value: "", tone: "flat", rest: "Ninguna en el periodo" } : share(data.refundsAmount, data.grossAmount, "")}
                  />
                </div>
              </div>

              <div className="board__kpis">
                <div className="kpi">
                  <p className="kpi__label">
                    <ShoppingBag size={14} />
                    Pedidos pagados
                  </p>
                  <p className="kpi__value">{data.orders}</p>
                  <TrendLine t={trend(data.orders, data.previousPeriod.orders)} />
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <Calendar size={14} />
                    Ventas de hoy
                  </p>
                  <p className="kpi__value">{formatMoney(today.gross)}</p>
                  <p className="kpi__foot">{todayText}</p>
                </div>
                {[
                  { name: PARTNERS.a, share: data.partnerAShare },
                  { name: PARTNERS.b, share: data.partnerBShare },
                ].map((partner) => (
                  <div className="kpi" key={partner.name}>
                    <p className="kpi__label">
                      <UserRound size={14} />
                      {partner.name}
                    </p>
                    <p className="kpi__value">{formatMoney(partner.share)}</p>
                    <p className="kpi__foot">
                      {data.availableToSettle > 0 ? (
                        <>
                          <span className="kpi__delta" data-tone="accent">
                            50%
                          </span>
                          de {formatMoney(data.availableToSettle)} por repartir
                        </>
                      ) : (
                        "No hay dinero pendiente de repartir"
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="board">
              <div className="board__toolbar">
                <p className="board__title">
                  Ventas recientes <span className="board__count">{filteredRecent.length}</span>
                </p>
              </div>
              <div className="board__filterbar">
                <div className="search-group">
                  <SelectField
                    className="search-group__column"
                    value={searchColumn}
                    onChange={(v) => setSearchColumn(v as SearchColumn)}
                    options={SEARCH_COLUMNS}
                  />
                  <label className="search-group__input">
                    <Search01 size={14} />
                    <input
                      placeholder={searchColumn === "all" ? "Buscar en la tabla" : `Buscar por ${columnLabel}`}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                {plansInRecent.length > 1 && (
                  <SelectField
                    value={planFilter}
                    onChange={setPlanFilter}
                    options={[
                      { value: "all", label: "Todos los planes" },
                      ...plansInRecent.map((p) => ({
                        value: p,
                        label: capitalize(p),
                      })),
                    ]}
                  />
                )}
                <Pager page={page} pageSize={PAGE_SIZE} total={filteredRecent.length} onPage={setPage} />
              </div>
              {filteredRecent.length === 0 ? (
                <p className="board__empty">Sin resultados.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Plan</th>
                        <th className="is-num">Monto vendido</th>
                        <th>Descuento</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th>Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRecent.map((row) => (
                        <tr key={row.id}>
                          <td>{row.profiles?.email ?? "—"}</td>
                          <td>
                            <PlanCell planId={row.plan_id} />
                          </td>
                          <td className="is-num">{formatMoney(Number(row.amount))}</td>
                          <td>
                            {row.coupons?.code ? (
                              <span className="coupon-cell">
                                <b>{row.coupons.code}</b>
                                {row.discount_amount ? <span>−{formatMoney(Number(row.discount_amount))}</span> : null}
                              </span>
                            ) : (
                              <span className="is-muted">Sin cupón</span>
                            )}
                          </td>
                          <td>
                            <span className="status-pill" data-status={row.status}>
                              {STATUS_LABEL[row.status] ?? row.status}
                            </span>
                          </td>
                          <td className="is-muted">{formatDate(row.created_at)}</td>
                          <td className="is-muted">{formatTime(row.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
