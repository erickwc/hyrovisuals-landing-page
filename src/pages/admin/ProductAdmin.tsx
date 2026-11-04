import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createPlan,
  fetchPlanPriceHistory,
  fetchPlans,
  fetchProductOptions,
  fetchVersions,
  updatePlan,
  type AdminPlan,
  type ProductOption,
  type ProductVersion,
} from "../../lib/admin-data";
import { SelectField } from "./SelectField";
import { formatMoney, formatDate, formatDateTime } from "./periods";
import { PlanCell } from "./shared";
import { PlanEditor } from "./PlanEditor";
import { VersionsBoard } from "./VersionsBoard";
import { InstallerUploader } from "./InstallerUploader";
import { NewProductPanel } from "./NewProductPanel";
import { Button } from "../../components/Button";
import { PlusSign } from "../../components/animate-ui/icons/hugeicons/plus-sign";
import { Upload01 } from "../../components/animate-ui/icons/hugeicons/upload-01";
import { ArrowRight01 } from "../../components/animate-ui/icons/hugeicons/arrow-right-01";
import { PencilEdit02 } from "../../components/animate-ui/icons/hugeicons/pencil-edit-02";
import { Clock01 } from "../../components/animate-ui/icons/hugeicons/clock-01";
import { AnimateIcon } from "../../components/animate-ui/icons/icon";
import { Layers01 } from "../../components/animate-ui/icons/hugeicons/layers-01";
import { TrendingDown } from "../../components/animate-ui/icons/hugeicons/trending-down";
import { CircleCheckBig } from "../../components/animate-ui/icons/hugeicons/circle-check-big";
import { FileClock } from "../../components/animate-ui/icons/hugeicons/file-clock";

type Status = "loading" | "ready" | "error";
type History = { id: string; old_price: number; new_price: number; changed_at: string }[];

// Al volver a Productos se abre el último producto revisado (solo en este navegador).
const LAST_PRODUCT_KEY = "hyro.admin.lastProduct";

export function lastProductId(): string | null {
  try {
    return localStorage.getItem(LAST_PRODUCT_KEY);
  } catch {
    return null;
  }
}

function rememberProduct(id: string) {
  try {
    localStorage.setItem(LAST_PRODUCT_KEY, id);
  } catch {
    /* almacenamiento bloqueado: solo se pierde el recuerdo del último producto */
  }
}

// Página de un producto: selector arriba con las acciones, y debajo sus métricas, planes y versiones.
export function ProductPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [versions, setVersions] = useState<ProductVersion[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [history, setHistory] = useState<Record<string, History>>({});
  // anchor: el lápiz de la fila que se edita; sin él la mini ventana sale debajo de "Nuevo plan de compra".
  const [planEditor, setPlanEditor] = useState<{ open: boolean; target: string; anchor?: HTMLElement }>({ open: false, target: "new" });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  // cada apertura arranca con el formulario vacío
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(() => {
    setStatus("loading");
    setHistory({});
    Promise.all([fetchProductOptions(), fetchPlans(id), fetchVersions(id)])
      .then(([list, planRows, versionRows]) => {
        setProducts(list);
        setPlans(planRows);
        setVersions(versionRows);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const product = products.find((p) => p.id === id);
  useEffect(() => {
    if (product) rememberProduct(product.id);
  }, [product]);

  const prices = plans.map((p) => Number(p.price_usd));
  const published = plans.filter((p) => p.active).length;
  const currentVersion = versions.find((v) => v.status === "published");
  const unpublished = versions.filter((v) => v.status === "draft" || v.status === "ready").length;

  const toggleHistory = async (planId: string) => {
    if (history[planId]) {
      setHistory((h) => {
        const next = { ...h };
        delete next[planId];
        return next;
      });
      return;
    }
    const rows = await fetchPlanPriceHistory(id, planId);
    setHistory((h) => ({ ...h, [planId]: rows as History }));
  };

  const editingPlan = planEditor.target !== "new" ? plans.find((p) => p.id === planEditor.target) : undefined;
  const closePlanEditor = () => setPlanEditor((e) => ({ ...e, open: false }));

  const onSavePlan = async (plan: { id: string; price: number; keys: number; active?: boolean }) => {
    if (editingPlan) {
      await updatePlan(id, editingPlan.id, { priceUsd: plan.price, licenseCount: plan.keys, active: plan.active ?? editingPlan.active });
    } else {
      await createPlan({ productId: id, id: plan.id, priceUsd: plan.price, licenseCount: plan.keys });
    }
    closePlanEditor();
    load();
  };

  return (
    <div className="admin__page">
      <div className="admin__head">
        <h1 className="admin__title">Productos</h1>
      </div>

      <div className="board__filters">
        {products.length > 0 && (
          <SelectField value={id} onChange={(next) => navigate(`/admin/productos/${next}`)} options={products.map((p) => ({ value: p.id, label: p.name }))} />
        )}
        <div className="board__end">
          {product && (
            <>
              <div className="mini-anchor">
                <Button
                  variant="ghost"
                  size="sm"
                  data-mini-trigger
                  onClick={() => (planEditor.open && planEditor.target === "new" ? closePlanEditor() : (setUploadOpen(false), setPlanEditor({ open: true, target: "new" })))}
                >
                  <PlusSign size={14} />
                  Nuevo plan de compra
                </Button>
                <PlanEditor
                  key={planEditor.target}
                  open={planEditor.open}
                  anchor={planEditor.anchor}
                  stored={editingPlan !== undefined}
                  initial={
                    editingPlan && {
                      id: editingPlan.id,
                      name: editingPlan.id.charAt(0).toUpperCase() + editingPlan.id.slice(1),
                      price: Number(editingPlan.price_usd),
                      keys: editingPlan.license_count,
                      active: editingPlan.active,
                    }
                  }
                  takenIds={plans.map((p) => p.id)}
                  onClose={closePlanEditor}
                  onSave={onSavePlan}
                />
              </div>
              <div className="mini-anchor">
                <Button variant="ghost" size="sm" data-mini-trigger onClick={() => (closePlanEditor(), setUploadOpen((v) => !v))}>
                  <Upload01 size={14} />
                  Actualizar instaladores
                </Button>
                <InstallerUploader open={uploadOpen} productId={product.id} productSlug={product.slug} onClose={() => setUploadOpen(false)} onUploaded={load} />
              </div>
            </>
          )}
          <div className="mini-anchor">
            <Button
              size="sm"
              data-mini-trigger
              aria-expanded={creating}
              onClick={() => {
                closePlanEditor();
                setUploadOpen(false);
                if (!creating) setFormKey((k) => k + 1);
                setCreating((v) => !v);
              }}
            >
              <PlusSign size={14} />
              Nuevo producto
            </Button>
            <NewProductPanel
              key={formKey}
              open={creating}
              onClose={() => setCreating(false)}
              onCreated={(created) => {
                setCreating(false);
                navigate(`/admin/productos/${created.id}`);
              }}
            />
          </div>
        </div>
      </div>

      <div className="admin__content">
        {status === "loading" && <div className="admin-empty">Cargando producto…</div>}
        {status === "error" && (
          <div className="admin-empty">
            No pudimos cargar el producto.{" "}
            <button className="lnk" type="button" onClick={load}>
              Reintentar
            </button>
          </div>
        )}
        {status === "ready" && !product && <div className="admin-empty">Este producto no existe.</div>}

        {status === "ready" && product && (
          <>
            <div className="board">
              <div className="board__kpis">
                <div className="kpi">
                  <p className="kpi__label">
                    <Layers01 size={14} />
                    Planes
                  </p>
                  <p className="kpi__value">{plans.length}</p>
                  <p className="kpi__foot">
                    {published} publicado{published === 1 ? "" : "s"}, {plans.length - published} oculto{plans.length - published === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <TrendingDown size={14} />
                    Precio desde
                  </p>
                  <p className="kpi__value">{prices.length ? formatMoney(Math.min(...prices)) : "—"}</p>
                  <p className="kpi__foot">
                    {prices.length > 1 ? `Hasta ${formatMoney(Math.max(...prices))}` : prices.length ? "Un solo precio" : "Sin planes todavía"}
                  </p>
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <CircleCheckBig size={14} />
                    Versión publicada
                  </p>
                  <p className="kpi__value">{currentVersion?.version ?? "—"}</p>
                  <p className="kpi__foot">
                    {currentVersion?.published_at ? `Desde el ${formatDate(currentVersion.published_at)}` : "Ninguna publicada todavía"}
                  </p>
                </div>
                <div className="kpi">
                  <p className="kpi__label">
                    <FileClock size={14} />
                    Sin publicar
                  </p>
                  <p className="kpi__value">{unpublished}</p>
                  <p className="kpi__foot">Borradores y versiones listas</p>
                </div>
              </div>
            </div>

            <div className="board">
              <div className="board__toolbar">
                <p className="board__title">
                  Planes <span className="board__count">{plans.length}</span>
                </p>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th className="is-num">Claves</th>
                      <th className="is-num">Precio</th>
                      <th>Estado</th>
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {plans.length === 0 && (
                      <tr className="row-empty">
                        <td colSpan={5}>Todavía no hay planes. Agrega el primero con Nuevo plan de compra.</td>
                      </tr>
                    )}
                    {plans.map((plan) => (
                      <Fragment key={plan.id}>
                        <tr>
                          <td>
                            <PlanCell planId={plan.id} />
                          </td>
                          <td className="is-num">{plan.license_count}</td>
                          <td className="is-num">{formatMoney(Number(plan.price_usd))}</td>
                          <td>
                            <span className="status-pill" data-status={plan.active ? "paid" : "pending"}>
                              {plan.active ? "Publicado" : "Oculto"}
                            </span>
                          </td>
                          <td>
                            <div className="row-actions row-actions--end">
                              <AnimateIcon animateOnHover asChild>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  data-mini-trigger
                                  aria-label={`Editar el plan ${plan.id}`}
                                  title="Editar plan"
                                  onClick={(e) => (setUploadOpen(false), setPlanEditor({ open: true, target: plan.id, anchor: e.currentTarget }))}
                                >
                                  <PencilEdit02 size={14} />
                                </button>
                              </AnimateIcon>
                              <AnimateIcon animateOnHover asChild>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  aria-label={history[plan.id] ? "Ocultar historial de precios" : "Ver historial de precios"}
                                  aria-pressed={Boolean(history[plan.id])}
                                  title="Historial de precios"
                                  onClick={() => toggleHistory(plan.id)}
                                >
                                  <Clock01 size={14} />
                                </button>
                              </AnimateIcon>
                            </div>
                          </td>
                        </tr>
                        {history[plan.id] && (
                          <tr className="row-detail">
                            <td colSpan={5}>
                              {history[plan.id].length === 0 ? (
                                "Sin cambios de precio registrados."
                              ) : (
                                <ul className="history-list">
                                  {history[plan.id].map((h) => (
                                    <li key={h.id}>
                                      {formatDateTime(h.changed_at)}: {formatMoney(h.old_price)} <ArrowRight01 size={12} /> {formatMoney(h.new_price)}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <VersionsBoard versions={versions} status={status} onChange={load} />
          </>
        )}
      </div>
    </div>
  );
}
