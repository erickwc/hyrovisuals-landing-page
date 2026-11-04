import { Fragment, useCallback, useEffect, useState } from "react";
import { createSettlement, fetchFinancesSummary, fetchSettlements, type FinancesSummary, type Settlement } from "../../lib/admin-data";
import { presetPeriods, formatMoney, formatDateTime, type Period } from "./periods";
import { PARTNERS, PeriodFilter, STATUS_LABEL, TrendLine, capitalize, formatDay, periodRange, share } from "./shared";
import { Button } from "../../components/Button";
import { Hourglass } from "../../components/animate-ui/icons/hugeicons/hourglass";
import { Wallet } from "../../components/animate-ui/icons/hugeicons/wallet";
import { CreditCard } from "../../components/animate-ui/icons/hugeicons/credit-card";
import { TrendingUp } from "../../components/animate-ui/icons/hugeicons/trending-up";

type Status = "loading" | "ready" | "error";

function downloadSettlementSummary(s: Settlement) {
  const lines = [
    `Corte ${formatDay(s.period_start)} – ${formatDay(s.period_end)}`,
    `Estado: ${s.status === "completed" ? "Completado" : "Pendiente"}`,
    `Bruto: ${formatMoney(Number(s.gross_amount))}`,
    `Comisiones: ${formatMoney(Number(s.fees_amount))}`,
    `Neto: ${formatMoney(Number(s.net_amount))}`,
    `${PARTNERS.a}: ${formatMoney(Number(s.partner_a_share))}`,
    `${PARTNERS.b}: ${formatMoney(Number(s.partner_b_share))}`,
    `Creado: ${formatDateTime(s.created_at)}`,
    s.completed_at ? `Completado: ${formatDateTime(s.completed_at)}` : "",
  ].filter(Boolean);
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `corte-${s.period_start}-${s.period_end}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Finances() {
  const [period, setPeriod] = useState<Period>(presetPeriods()[3]);
  const [summary, setSummary] = useState<FinancesSummary | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [confirmA, setConfirmA] = useState(false);
  const [confirmB, setConfirmB] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleMsg, setSettleMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    Promise.all([fetchFinancesSummary(period.start, period.endExclusive), fetchSettlements()])
      .then(([s, list]) => {
        setSummary(s);
        setSettlements(list);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const onSettle = async () => {
    if (!confirmA || !confirmB) return;
    setSettling(true);
    setSettleMsg(null);
    try {
      await createSettlement(period.start, period.endExclusive, confirmA, confirmB);
      setSettleMsg("Corte registrado correctamente.");
      setConfirmA(false);
      setConfirmB(false);
      load();
    } catch {
      setSettleMsg("No pudimos registrar el corte. Intenta otra vez.");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="admin__page">
      <div className="admin__head">
        <h1 className="admin__title">Finanzas y cortes</h1>
      </div>

      <PeriodFilter period={period} onChange={setPeriod} hint="Solo cuenta ventas pagadas que aún no entran en un corte" />

      <div className="admin__content">
        {status === "loading" && <div className="admin-empty">Calculando ganancias…</div>}
        {status === "error" && (
          <div className="admin-empty">
            No pudimos cargar las finanzas.{" "}
            <button className="lnk" type="button" onClick={load}>
              Reintentar
            </button>
          </div>
        )}

        {status === "ready" && summary && (
          <>
            <div className="board">
              <div className="board__kpis">
                <div className="kpi">
                  <p className="kpi__label">
                    <Hourglass size={14} />
                    Ventas sin cortar
                  </p>
                  <p className="kpi__value">{summary.count}</p>
                  <p className="kpi__foot">Pagadas en el periodo</p>
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <Wallet size={14} />
                    Ingresos brutos
                  </p>
                  <p className="kpi__value">{formatMoney(summary.gross)}</p>
                  <p className="kpi__foot">Lo que pagaron los clientes</p>
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <CreditCard size={14} />
                    Comisiones
                  </p>
                  <p className="kpi__value">{formatMoney(summary.fees)}</p>
                  <TrendLine t={share(summary.fees, summary.gross, "Sin ventas en el periodo")} />
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <TrendingUp size={14} />
                    Ganancia neta
                  </p>
                  <p className="kpi__value">{formatMoney(summary.net)}</p>
                  <p className="kpi__foot">Lo que se reparte entre los socios</p>
                </div>
              </div>

              <div className="board__main">
                <section className="board__cell">
                  <div className="board__cell-head">
                    <p className="board__title">Desglose por pasarela</p>
                  </div>
                  {summary.byPlatform.length === 0 ? (
                    <p className="board__empty">Sin ventas sin cortar en este periodo.</p>
                  ) : (
                    <div className="inner-table">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Pasarela</th>
                            <th className="is-num">Ventas</th>
                            <th className="is-num">Bruto</th>
                            <th className="is-num">Comisiones</th>
                            <th className="is-num">Neto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.byPlatform.map((p) => (
                            <tr key={p.platform}>
                              <td>{capitalize(p.platform)}</td>
                              <td className="is-num">{p.count}</td>
                              <td className="is-num">{formatMoney(p.gross)}</td>
                              <td className="is-num">{formatMoney(p.fees)}</td>
                              <td className="is-num">{formatMoney(p.net)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="board__cell">
                  <div className="board__cell-head">
                    <p className="board__title">Realizar corte</p>
                    <span className="board__note">{periodRange(period)}</span>
                  </div>
                  <p className="split__lead">
                    {summary.count > 0
                      ? `Incluye ${summary.count} venta${summary.count === 1 ? "" : "s"} pagada${summary.count === 1 ? "" : "s"} y sin cortar. A cada socio le toca:`
                      : "No hay ventas sin cortar en este periodo."}
                  </p>
                  <div className="split__partners">
                    <div>
                      <p className="kpi__label">{PARTNERS.a}</p>
                      <div className="split__row">
                        <p className="split__amount">{formatMoney(summary.partnerAShare)}</p>
                        <p className="kpi__foot split__pct">
                          <b>50%</b> de la ganancia neta
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="kpi__label">{PARTNERS.b}</p>
                      <div className="split__row">
                        <p className="split__amount">{formatMoney(summary.partnerBShare)}</p>
                        <p className="kpi__foot split__pct">
                          <b>50%</b> de la ganancia neta
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="ov-split">
                    <div>
                      <span>Confirmación de ambos socios</span>
                      <span className="is-muted">{(confirmA ? 1 : 0) + (confirmB ? 1 : 0)} de 2</span>
                    </div>
                    <label className="check-row">
                      <span>
                        {PARTNERS.a} confirma que recibió {formatMoney(summary.partnerAShare)}
                      </span>
                      <input type="checkbox" checked={confirmA} onChange={(e) => setConfirmA(e.target.checked)} />
                    </label>
                    <label className="check-row">
                      <span>
                        {PARTNERS.b} confirma que recibió {formatMoney(summary.partnerBShare)}
                      </span>
                      <input type="checkbox" checked={confirmB} onChange={(e) => setConfirmB(e.target.checked)} />
                    </label>
                  </div>

                  <div className="settle-foot">
                    <p className="kpi__foot">Solo registra que ambos ya recibieron su parte; no transfiere dinero.</p>
                    <Button size="sm" loading={settling} disabled={!confirmA || !confirmB || summary.count === 0} onClick={onSettle}>
                      {settling ? "Registrando…" : "Realizar corte"}
                    </Button>
                  </div>
                  {settleMsg && <p className="kpi__foot">{settleMsg}</p>}
                </section>
              </div>
            </div>

            <div className="board">
              <div className="board__toolbar">
                <p className="board__title">
                  Historial de cortes <span className="board__count">{settlements.length}</span>
                </p>
              </div>
              {settlements.length === 0 ? (
                <p className="board__empty">Todavía no se ha realizado ningún corte.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Periodo</th>
                        <th className="is-num">Neto</th>
                        <th className="is-num">{PARTNERS.a}</th>
                        <th className="is-num">{PARTNERS.b}</th>
                        <th>Estado</th>
                        <th>Creado</th>
                        <th aria-label="Acciones" />
                      </tr>
                    </thead>
                    <tbody>
                      {settlements.map((s) => (
                        <Fragment key={s.id}>
                          <tr>
                            <td>
                              {formatDay(s.period_start)} – {formatDay(s.period_end)}
                            </td>
                            <td className="is-num">{formatMoney(Number(s.net_amount))}</td>
                            <td className="is-num">{formatMoney(Number(s.partner_a_share))}</td>
                            <td className="is-num">{formatMoney(Number(s.partner_b_share))}</td>
                            <td>
                              <span className="status-pill" data-status={s.status}>
                                {STATUS_LABEL[s.status] ?? s.status}
                              </span>
                            </td>
                            <td className="is-muted">{formatDateTime(s.created_at)}</td>
                            <td>
                              <div className="row-actions">
                                <button type="button" className="row-action" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                                  {expanded === s.id ? "Ocultar" : "Ver detalle"}
                                </button>
                                <button type="button" className="row-action" onClick={() => downloadSettlementSummary(s)}>
                                  Descargar
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expanded === s.id && (
                            <tr className="row-detail">
                              <td colSpan={7}>
                                Bruto {formatMoney(Number(s.gross_amount))} · Comisiones {formatMoney(Number(s.fees_amount))}
                                {s.completed_at && <> · Completado {formatDateTime(s.completed_at)}</>}
                              </td>
                            </tr>
                          )}
                        </Fragment>
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
