import { useEffect, useState } from "react";
import {
  adminIssueLicenses,
  adminReleaseActivation,
  adminSetLicenseStatus,
  fetchPlans,
  fetchProductOptions,
  type AdminLicense,
  type AdminPlan,
  type ProductOption,
} from "../../lib/admin-data";
import { platformName } from "../../lib/account-data";
import { Button } from "../../components/Button";
import { SelectField } from "./SelectField";
import { FormModal } from "./shared";
import { formatDate, formatTime } from "./periods";
import { PlanCell } from "./shared";

/* Licencias de un cliente: clave, plan, origen (compra o emitida a mano), equipo donde está activada y acciones.
   "Emitir licencias" crea tantas claves como dice el plan elegido, sin pasar por una compra. */
export function LicensesBoard({ userId, licenses, onChanged }: { userId: string; licenses: AdminLicense[]; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [form, setForm] = useState({ productId: "", planId: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // acción por fila: primer clic pide confirmar
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  useEffect(() => {
    if (!showForm || products.length) return;
    fetchProductOptions()
      .then((list) => {
        setProducts(list);
        const first = list.find((p) => p.slug === "hyro-visuals") ?? list[0];
        if (first) setForm((f) => ({ ...f, productId: f.productId || first.id }));
      })
      .catch(() => setFormError("No se pudieron cargar los productos."));
  }, [showForm, products.length]);

  useEffect(() => {
    if (!form.productId) return;
    fetchPlans(form.productId)
      .then((list) => {
        setPlans(list);
        setForm((f) => ({ ...f, planId: list.some((p) => p.id === f.planId) ? f.planId : (list.find((p) => p.active)?.id ?? list[0]?.id ?? "") }));
      })
      .catch(() => setFormError("No se pudieron cargar los planes."));
  }, [form.productId]);

  const plan = plans.find((p) => p.id === form.planId);

  const onIssue = async () => {
    if (!form.productId || !form.planId) return;
    setSaving(true);
    setFormError(null);
    try {
      await adminIssueLicenses({ userId, ...form });
      setShowForm(false);
      setForm((f) => ({ ...f, note: "" }));
      onChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudieron emitir las licencias.");
    } finally {
      setSaving(false);
    }
  };

  const run = async (id: string, action: () => Promise<void>) => {
    if (confirm !== id) return setConfirm(id);
    setBusy(id);
    setRowError(null);
    try {
      await action();
      setConfirm(null);
      onChanged();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="board">
      <div className="board__toolbar">
        <p className="board__title">
          Licencias <span className="board__count">{licenses.length}</span>
        </p>
        <div className="board__tools">
          <Button
            size="sm"
            onClick={() => {
              setFormError(null);
              setShowForm(true);
            }}
          >
            Emitir licencias
          </Button>
        </div>
      </div>

      {rowError && (
        <p className="board__empty" role="alert">
          {rowError}
        </p>
      )}

      {licenses.length === 0 ? (
        <p className="board__empty">Sin licencias.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Clave</th>
                <th>Plan</th>
                <th>Origen</th>
                <th>Equipo</th>
                <th>Estado</th>
                <th>Creada</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {licenses.map((l) => {
                const releaseId = `release-${l.id}`;
                const statusId = `status-${l.id}`;
                return (
                  <tr key={l.id}>
                    <td className="mono">{l.license_key}</td>
                    <td>
                      <PlanCell planId={l.plan_id} />
                      {l.products?.name && <span className="is-muted"> · {l.products.name}</span>}
                    </td>
                    <td className={l.note ? "" : "is-muted"} title={l.note ?? undefined}>
                      {l.source === "manual" ? "Emitida" : "Compra"}
                      {l.note && <span className="is-muted"> · {l.note}</span>}
                    </td>
                    <td>
                      {l.activation ? (
                        <span title={l.activation.app_version ? `Hyro Visuals ${l.activation.app_version}` : undefined}>
                          {l.activation.device_name || "Equipo"}
                          {l.activation.platform && <span className="is-muted"> · {platformName(l.activation.platform)}</span>}
                          <span className="is-muted">
                            {" "}
                            · visto {formatDate(l.activation.last_seen_at)}, {formatTime(l.activation.last_seen_at)}
                          </span>
                        </span>
                      ) : (
                        <span className="is-muted">Sin activar</span>
                      )}
                    </td>
                    <td>
                      <span className="status-pill" data-status={l.status === "active" ? "paid" : "refunded"}>
                        {l.status === "active" ? "Activa" : "Revocada"}
                      </span>
                    </td>
                    <td className="is-muted">{formatDate(l.created_at)}</td>
                    <td>
                      <div className="row-actions row-actions--end">
                        {l.activation && (
                          <button
                            type="button"
                            className="row-action"
                            disabled={busy === releaseId}
                            onBlur={() => setConfirm((c) => (c === releaseId ? null : c))}
                            onClick={() => run(releaseId, () => adminReleaseActivation(l.activation!.id))}
                          >
                            {busy === releaseId ? "Liberando…" : confirm === releaseId ? "¿Liberar equipo?" : "Liberar equipo"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="row-action"
                          disabled={busy === statusId}
                          onBlur={() => setConfirm((c) => (c === statusId ? null : c))}
                          onClick={() => run(statusId, () => adminSetLicenseStatus(l.id, l.status === "active" ? "revoked" : "active"))}
                        >
                          {busy === statusId
                            ? "Guardando…"
                            : l.status === "active"
                              ? confirm === statusId
                                ? "¿Revocar?"
                                : "Revocar"
                              : confirm === statusId
                                ? "¿Reactivar?"
                                : "Reactivar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <FormModal
          onClose={() => setShowForm(false)}
          title="Emitir licencias"
          error={formError}
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button size="sm" loading={saving} disabled={!form.planId} onClick={onIssue}>
                {saving ? "Emitiendo…" : plan ? `Emitir ${plan.license_count} clave${plan.license_count === 1 ? "" : "s"}` : "Emitir"}
              </Button>
            </>
          }
        >
          <div className="form-grid">
            <div className="admin-field">
              <label>Producto</label>
              <SelectField
                value={form.productId}
                onChange={(v) => setForm({ ...form, productId: v })}
                options={products.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div className="admin-field">
              <label>Plan</label>
              <SelectField
                value={form.planId}
                onChange={(v) => setForm({ ...form, planId: v })}
                options={plans.map((p) => ({
                  value: p.id,
                  label: `${p.id.charAt(0).toUpperCase() + p.id.slice(1)} · ${p.license_count} clave${p.license_count === 1 ? "" : "s"}`,
                }))}
              />
            </div>
            <div className="admin-field">
              <label>Nota (opcional)</label>
              <input placeholder="Regalo, soporte, prueba…" value={form.note} maxLength={120} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
}
