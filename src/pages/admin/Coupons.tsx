import { useCallback, useEffect, useMemo, useState } from "react";
import { createCoupon, fetchCoupons, fetchProductOptions, setCouponActive, type Coupon, type CouponInput, type ProductOption } from "../../lib/admin-data";
import { SelectField } from "./SelectField";
import { formatMoney } from "./periods";
import { FormModal, Pager, TableSearch, formatDay } from "./shared";
import { Button } from "../../components/Button";
import { Tag } from "../../components/animate-ui/icons/hugeicons/tag";
import { ShoppingCart } from "../../components/animate-ui/icons/hugeicons/shopping-cart";
import { Trophy } from "../../components/animate-ui/icons/hugeicons/trophy";
import { Hourglass } from "../../components/animate-ui/icons/hugeicons/hourglass";

type Status = "loading" | "ready" | "error";
const PAGE_SIZE = 12;

const EMPTY_FORM: CouponInput = { code: "", discountType: "percent", discountValue: 10, productId: null, maxUses: null, expiresAt: null };

// Un cupón activo puede seguir sin servir si ya venció o se acabaron sus usos.
function couponState(c: Coupon): { label: string; tone: string } {
  if (!c.active) return { label: "Inactivo", tone: "pending" };
  if (c.expires_at && new Date(c.expires_at) < new Date()) return { label: "Vencido", tone: "failed" };
  if (c.max_uses !== null && c.uses_count >= c.max_uses) return { label: "Agotado", tone: "failed" };
  return { label: "Activo", tone: "paid" };
}

export function Coupons() {
  const [rows, setRows] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CouponInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setStatus("loading");
    fetchCoupons()
      .then((data) => {
        setRows(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    load();
    fetchProductOptions().then(setProducts);
  }, [load]);

  const productName = (id: string | null) => (id ? (products.find((p) => p.id === id)?.name ?? "—") : "Todos");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? rows.filter((c) => c.code.toLowerCase().includes(needle)) : rows;
  }, [rows, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const onCreate = async () => {
    if (!form.code.trim() || form.discountValue <= 0) return;
    setSaving(true);
    setFormError(null);
    try {
      await createCoupon(form);
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo crear el cupón");
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (c: Coupon) => {
    await setCouponActive(c.id, !c.active);
    load();
  };

  const usable = rows.filter((c) => couponState(c).label === "Activo").length;
  const totalUses = rows.reduce((a, c) => a + c.uses_count, 0);
  const weekAhead = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const expiringSoon = rows.filter((c) => couponState(c).label === "Activo" && c.expires_at && new Date(c.expires_at).getTime() < weekAhead).length;
  const topCoupon = rows.reduce<Coupon | null>((top, c) => (!top || c.uses_count > top.uses_count ? c : top), null);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="admin__page">
      <div className="admin__head">
        <h1 className="admin__title">Cupones</h1>
      </div>

      <div className="admin__content">
        <div className="board">
          <div className="board__kpis">
            <div className="kpi">
              <p className="kpi__label">
                <Tag size={14} />
                Cupones activos
              </p>
              <p className="kpi__value">{usable}</p>
              <p className="kpi__foot">De {rows.length} creados</p>
            </div>
            <div className="kpi">
              <p className="kpi__label">
                <ShoppingCart size={14} />
                Usos totales
              </p>
              <p className="kpi__value">{totalUses}</p>
              <p className="kpi__foot">Ventas con algún cupón</p>
            </div>
            <div className="kpi">
              <p className="kpi__label">
                <Trophy size={14} />
                Más usado
              </p>
              <p className="kpi__value">{topCoupon && topCoupon.uses_count > 0 ? topCoupon.code : "—"}</p>
              <p className="kpi__foot">
                {topCoupon && topCoupon.uses_count > 0 ? `${topCoupon.uses_count} uso${topCoupon.uses_count === 1 ? "" : "s"}` : "Sin usos todavía"}
              </p>
            </div>
            <div className="kpi">
              <p className="kpi__label">
                <Hourglass size={14} />
                Vencen esta semana
              </p>
              <p className="kpi__value">{expiringSoon}</p>
              <p className="kpi__foot">Activos que vencen en 7 días</p>
            </div>
          </div>
        </div>

        {showForm && (
          <FormModal
            onClose={() => setShowForm(false)}
            title="Nuevo cupón"
            error={formError}
            actions={
              <>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button size="sm" loading={saving} disabled={!form.code.trim()} onClick={onCreate}>
                  {saving ? "Guardando…" : "Crear cupón"}
                </Button>
              </>
            }
          >
            <div className="form-grid">
              <div className="admin-field">
                <label>Código</label>
                <input placeholder="PRODUCTOR20" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
              <div className="admin-field">
                <label>Tipo</label>
                <SelectField
                  value={form.discountType}
                  onChange={(v) => setForm({ ...form, discountType: v as CouponInput["discountType"] })}
                  options={[
                    { value: "percent", label: "Porcentaje" },
                    { value: "fixed", label: "Monto fijo (USD)" },
                  ]}
                />
              </div>
              <div className="admin-field">
                <label>Valor</label>
                <input type="number" min={0} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} />
              </div>
              <div className="admin-field">
                <label>Producto</label>
                <SelectField
                  value={form.productId ?? ""}
                  onChange={(v) => setForm({ ...form, productId: v || null })}
                  options={[{ value: "", label: "Todos" }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
                />
              </div>
              <div className="admin-field">
                <label>Usos máximos</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Ilimitado"
                  value={form.maxUses ?? ""}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div className="admin-field">
                <label>Vence</label>
                <input type="date" value={form.expiresAt ?? ""} onChange={(e) => setForm({ ...form, expiresAt: e.target.value || null })} />
              </div>
            </div>
          </FormModal>
        )}

        <div className="board">
          <div className="board__toolbar">
            <p className="board__title">
              Todos los cupones <span className="board__count">{filtered.length}</span>
            </p>
            <div className="board__tools">
              <Button
                size="sm"
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setFormError(null);
                  setShowForm(true);
                }}
              >
                Nuevo cupón
              </Button>
            </div>
          </div>
          <div className="board__filterbar">
            <TableSearch value={search} onChange={setSearch} placeholder="Buscar por código" />
            <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
          </div>

          {status === "loading" && <p className="board__empty">Cargando cupones…</p>}
          {status === "error" && <p className="board__empty">No pudimos cargar los cupones.</p>}
          {status === "ready" && filtered.length === 0 && <p className="board__empty">{rows.length === 0 ? "Todavía no hay cupones." : "Sin resultados."}</p>}

          {status === "ready" && filtered.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descuento</th>
                    <th>Producto</th>
                    <th className="is-num">Usos</th>
                    <th>Vence</th>
                    <th>Estado</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c) => {
                    const state = couponState(c);
                    return (
                      <tr key={c.id}>
                        <td>
                          <span className="coupon-cell">
                            <b>{c.code}</b>
                          </span>
                        </td>
                        <td>{c.discount_type === "percent" ? `${c.discount_value}%` : formatMoney(Number(c.discount_value))}</td>
                        <td>{productName(c.product_id)}</td>
                        <td className="is-num">
                          {c.uses_count}
                          {c.max_uses ? <span className="is-muted"> / {c.max_uses}</span> : null}
                        </td>
                        <td className={c.expires_at ? undefined : "is-muted"}>{c.expires_at ? formatDay(c.expires_at) : "Sin vencimiento"}</td>
                        <td>
                          <span className="status-pill" data-status={state.tone}>
                            {state.label}
                          </span>
                        </td>
                        <td>
                          <button type="button" className="row-action" onClick={() => onToggle(c)}>
                            {c.active ? "Desactivar" : "Activar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
