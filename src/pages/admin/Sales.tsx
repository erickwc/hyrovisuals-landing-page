import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSales, markPurchaseRefunded, type PurchaseStatus, type SaleRow } from "../../lib/admin-data";
import { SelectField } from "./SelectField";
import { presetPeriods, formatMoney, formatDate, formatTime, type Period } from "./periods";
import { Pager, PeriodFilter, PlanCell, STATUS_LABEL, capitalize } from "./shared";
import { Button } from "../../components/Button";
import { Search01 } from "../../components/animate-ui/icons/hugeicons/search-01";
import { Download01 } from "../../components/animate-ui/icons/hugeicons/download-01";
import { ShoppingBag } from "../../components/animate-ui/icons/hugeicons/shopping-bag";
import { Wallet } from "../../components/animate-ui/icons/hugeicons/wallet";
import { CreditCard } from "../../components/animate-ui/icons/hugeicons/credit-card";
import { Tag } from "../../components/animate-ui/icons/hugeicons/tag";

type Status = "loading" | "ready" | "error";
type SearchColumn = "all" | "client" | "plan" | "platform" | "discount" | "id";
const PAGE_SIZE = 12;

// "Todo el historial" deja el rango vacío: fetchSales no filtra por fecha.
const PERIODS: Period[] = [{ label: "Todo el historial", start: "", endExclusive: "" }, ...presetPeriods()];

const SEARCH_COLUMNS: { value: SearchColumn; label: string }[] = [
  { value: "all", label: "Todo" },
  { value: "client", label: "Cliente" },
  { value: "plan", label: "Plan" },
  { value: "platform", label: "Pasarela" },
  { value: "discount", label: "Descuento" },
  { value: "id", label: "ID" },
];

function cellText(r: SaleRow, col: Exclude<SearchColumn, "all">): string {
  if (col === "client") return r.profiles?.email ?? "";
  if (col === "plan") return r.plan_id;
  if (col === "platform") return r.platform;
  if (col === "discount") return r.coupons?.code ?? "";
  return r.id;
}

function toCsv(rows: SaleRow[]): string {
  const header = ["id", "fecha", "cliente", "plan", "plataforma", "importe", "cupon", "descuento", "comision", "neto", "estado"];
  const lines = rows.map((r) =>
    [
      r.id,
      r.created_at,
      r.profiles?.email ?? "",
      r.plan_id,
      r.platform,
      r.amount,
      r.coupons?.code ?? "",
      r.discount_amount ?? "",
      r.fee_amount ?? "",
      r.net_amount ?? "",
      r.status,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function Sales() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [period, setPeriod] = useState<Period>(PERIODS[0]);
  // Por defecto solo se ven las ventas pagadas, para no confundir intentos de compra sin terminar
  // con ventas reales; el filtro de abajo sigue disponible para revisar pendientes/fallidas cuando haga falta.
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | "all">("paid");
  const [searchColumn, setSearchColumn] = useState<SearchColumn>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setStatus("loading");
    fetchSales({ status: statusFilter, startDate: period.start || undefined, endExclusive: period.endExclusive || undefined })
      .then((data) => {
        setRows(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [statusFilter, period]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    const columns = searchColumn === "all" ? (["client", "plan", "platform", "discount", "id"] as const) : [searchColumn];
    return rows.filter((r) => columns.some((c) => cellText(r, c).toLowerCase().includes(needle)));
  }, [rows, search, searchColumn]);

  useEffect(() => {
    setPage(1);
  }, [search, searchColumn, statusFilter, period]);

  // Las métricas cuentan solo lo cobrado de verdad (pagado) dentro de lo que muestra la tabla.
  const totals = useMemo(() => {
    const paid = filtered.filter((r) => r.status === "paid");
    const add = (vals: (number | null)[]) => Math.round(vals.reduce<number>((a, v) => a + Number(v ?? 0), 0) * 100) / 100;
    return {
      paid: paid.length,
      gross: add(paid.map((r) => r.amount)),
      fees: add(paid.map((r) => r.fee_amount)),
      net: add(paid.map((r) => r.net_amount)),
      discounts: add(paid.map((r) => r.discount_amount)),
      withCoupon: paid.filter((r) => r.coupon_id).length,
    };
  }, [filtered]);

  const onRefund = async (id: string) => {
    if (!confirm("¿Marcar esta compra como reembolsada?")) return;
    await markPurchaseRefunded(id);
    load();
  };

  const onExport = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const columnLabel = SEARCH_COLUMNS.find((c) => c.value === searchColumn)!.label.toLowerCase();

  return (
    <div className="admin__page">
      <div className="admin__head">
        <h1 className="admin__title">Ventas</h1>
      </div>

      <PeriodFilter period={period} onChange={setPeriod} periods={PERIODS} hint="Las cifras cuentan solo las ventas pagadas de la lista" />

      <div className="admin__content">
        {status === "error" && (
          <div className="admin-empty">
            No pudimos cargar las ventas.{" "}
            <button className="lnk" type="button" onClick={load}>
              Reintentar
            </button>
          </div>
        )}

        {status !== "error" && (
          <>
            <div className="board">
              <div className="board__kpis">
                <div className="kpi">
                  <p className="kpi__label">
                    <ShoppingBag size={14} />
                    Ventas pagadas
                  </p>
                  <p className="kpi__value">{totals.paid}</p>
                  <p className="kpi__foot">De {filtered.length} transacciones en la lista</p>
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <Wallet size={14} />
                    Ventas brutas
                  </p>
                  <p className="kpi__value">{formatMoney(totals.gross)}</p>
                  <p className="kpi__foot">Lo que pagaron los clientes</p>
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <CreditCard size={14} />
                    Comisiones
                  </p>
                  <p className="kpi__value">{formatMoney(totals.fees)}</p>
                  <p className="kpi__foot">Lo que se quedan las pasarelas</p>
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <Tag size={14} />
                    Descuentos
                  </p>
                  <p className="kpi__value">{formatMoney(totals.discounts)}</p>
                  <p className="kpi__foot">
                    En {totals.withCoupon} venta{totals.withCoupon === 1 ? "" : "s"} con cupón
                  </p>
                </div>
              </div>
            </div>

            <div className="board">
              <div className="board__toolbar">
                <p className="board__title">
                  Todas las ventas <span className="board__count">{filtered.length}</span>
                </p>
                <div className="board__tools">
                  <Button variant="ghost" size="sm" onClick={onExport} disabled={filtered.length === 0}>
                    <Download01 size={14} />
                    Exportar CSV
                  </Button>
                </div>
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
                <SelectField
                  value={statusFilter}
                  onChange={(v) => setStatusFilter(v as PurchaseStatus | "all")}
                  options={[
                    { value: "all", label: "Todos los estados" },
                    { value: "paid", label: "Pagado" },
                    { value: "pending", label: "Pendiente" },
                    { value: "failed", label: "Fallido" },
                    { value: "refunded", label: "Reembolsado" },
                  ]}
                />
                <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
              </div>

              {status === "loading" ? (
                <p className="board__empty">Cargando ventas…</p>
              ) : filtered.length === 0 ? (
                <p className="board__empty">No hay ventas con estos filtros.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Plan</th>
                        <th>Pasarela</th>
                        <th className="is-num">Bruto</th>
                        <th>Descuento</th>
                        <th className="is-num">Comisión</th>
                        <th className="is-num">Neto</th>
                        <th>Estado</th>
                        <th>Corte</th>
                        <th>Fecha</th>
                        <th aria-label="Acciones" />
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <Link className="table-link" to={`/admin/clientes/${row.user_id}`}>
                              {row.profiles?.email ?? row.user_id.slice(0, 8)}
                            </Link>
                          </td>
                          <td>
                            <PlanCell planId={row.plan_id} />
                          </td>
                          <td>{capitalize(row.platform)}</td>
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
                          <td className="is-num">{row.fee_amount != null ? formatMoney(Number(row.fee_amount)) : <span className="is-muted">—</span>}</td>
                          <td className="is-num">{row.net_amount != null ? formatMoney(Number(row.net_amount)) : <span className="is-muted">—</span>}</td>
                          <td>
                            <span className="status-pill" data-status={row.status}>
                              {STATUS_LABEL[row.status] ?? row.status}
                            </span>
                          </td>
                          <td className={row.settlement_id ? undefined : "is-muted"}>{row.settlement_id ? "Incluida" : "Sin cortar"}</td>
                          <td className="is-muted">
                            {formatDate(row.created_at)}, {formatTime(row.created_at)}
                          </td>
                          <td>
                            {row.status === "paid" && (
                              <button type="button" className="row-action" onClick={() => onRefund(row.id)}>
                                Reembolsar
                              </button>
                            )}
                          </td>
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
