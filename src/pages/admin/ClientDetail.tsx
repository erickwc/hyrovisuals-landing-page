import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchClientDetail, type ClientDetail as ClientDetailData } from "../../lib/admin-data";
import { formatMoney, formatDate, formatTime } from "./periods";
import { PlanCell, STATUS_LABEL } from "./shared";
import { ArrowLeft02 } from "../../components/animate-ui/icons/hugeicons/arrow-left-02";
import { Star } from "../../components/animate-ui/icons/hugeicons/star";
import { Calendar } from "../../components/animate-ui/icons/hugeicons/calendar";
import { ShoppingBag } from "../../components/animate-ui/icons/hugeicons/shopping-bag";
import { Wallet } from "../../components/animate-ui/icons/hugeicons/wallet";
import { Key01 } from "../../components/animate-ui/icons/hugeicons/key-01";

type Status = "loading" | "ready" | "error";

export function ClientDetail() {
  const { id = "" } = useParams();
  const [data, setData] = useState<ClientDetailData | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    fetchClientDetail(id)
      .then((d) => {
        setData(d);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  const paid = data?.purchases.filter((p) => p.status === "paid") ?? [];
  const spent = Math.round(paid.reduce((a, p) => a + Number(p.amount), 0) * 100) / 100;

  return (
    <div className="admin__page">
      <div className="admin__head">
        <div className="admin__crumbs">
          <Link to="/admin/clientes">
            <ArrowLeft02 size={14} /> Clientes
          </Link>
          <span className="is-muted">/</span>
          <h1 className="admin__title">{data?.profile.email ?? "Cliente"}</h1>
        </div>
      </div>

      <div className="admin__content">
        {status === "loading" && <div className="admin-empty">Cargando cliente…</div>}
        {(status === "error" || (status === "ready" && !data)) && <div className="admin-empty">No pudimos cargar este cliente.</div>}

        {status === "ready" && data && (
          <>
            <div className="board">
              <div className="board__kpis">
                <div className="kpi">
                  <p className="kpi__label">
                    <Calendar size={14} />
                    Cliente desde
                  </p>
                  <p className="kpi__value">{formatDate(data.profile.createdAt)}</p>
                  <p className="kpi__foot">Fecha de registro</p>
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <ShoppingBag size={14} />
                    Compras pagadas
                  </p>
                  <p className="kpi__value">{paid.length}</p>
                  <p className="kpi__foot">De {data.purchases.length} intentos de compra</p>
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <Wallet size={14} />
                    Total gastado
                  </p>
                  <p className="kpi__value">{formatMoney(spent)}</p>
                  <p className="kpi__foot">Solo compras pagadas</p>
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <Key01 size={14} />
                    Licencias
                  </p>
                  <p className="kpi__value">{data.licenses.length}</p>
                  <p className="kpi__foot">Claves de activación generadas</p>
                </div>
              </div>
            </div>

            <div className="board">
              <div className="board__toolbar">
                <p className="board__title">
                  Compras <span className="board__count">{data.purchases.length}</span>
                </p>
              </div>
              {data.purchases.length === 0 ? (
                <p className="board__empty">Sin compras.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th className="is-num">Importe</th>
                        <th>Descuento</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.purchases.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <PlanCell planId={p.plan_id} />
                          </td>
                          <td className="is-num">{formatMoney(Number(p.amount))}</td>
                          <td>
                            {p.coupons?.code ? (
                              <span className="coupon-cell">
                                <b>{p.coupons.code}</b>
                                {p.discount_amount ? <span>−{formatMoney(Number(p.discount_amount))}</span> : null}
                              </span>
                            ) : (
                              <span className="is-muted">Sin cupón</span>
                            )}
                          </td>
                          <td>
                            <span className="status-pill" data-status={p.status}>
                              {STATUS_LABEL[p.status] ?? p.status}
                            </span>
                          </td>
                          <td className="is-muted">
                            {formatDate(p.created_at)}, {formatTime(p.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="board">
              <div className="board__main">
                <section className="board__cell">
                  <p className="board__title">
                    Licencias <span className="board__count">{data.licenses.length}</span>
                  </p>
                  {data.licenses.length === 0 ? (
                    <p className="board__empty">Sin licencias.</p>
                  ) : (
                    <div className="inner-table">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Clave</th>
                            <th>Plan</th>
                            <th>Creada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.licenses.map((l) => (
                            <tr key={l.id}>
                              <td className="mono">{l.license_key}</td>
                              <td>
                                <PlanCell planId={l.plan_id} />
                              </td>
                              <td className="is-muted">{formatDate(l.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="board__cell">
                  <p className="board__title">
                    Reseñas <span className="board__count">{data.reviews.length}</span>
                  </p>
                  {data.reviews.length === 0 ? (
                    <p className="board__empty">Sin reseñas.</p>
                  ) : (
                    <div className="inner-table">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Calificación</th>
                            <th>Comentario</th>
                            <th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.reviews.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <span className="rating-cell">
                                  {r.rating} <Star size={13} />
                                </span>
                              </td>
                              <td className={"cell-wrap" + (r.comment ? "" : " is-muted")}>{r.comment || "Sin comentario"}</td>
                              <td className="is-muted">{formatDate(r.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
