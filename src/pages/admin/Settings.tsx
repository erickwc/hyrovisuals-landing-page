import { useCallback, useEffect, useState } from "react";
import {
  fetchGatewayFees,
  fetchPaymentMethods,
  fetchPaymentStatus,
  fetchSaleNotifications,
  sendTestSaleEmail,
  setPaymentMethodEnabled,
  setPaymentMethodMode,
  updateGatewayFee,
  updateSaleNotifications,
  type GatewayFee,
  type PaymentMethod,
  type PaymentMode,
  type PaymentStatus,
} from "../../lib/admin-data";
import { Button } from "../../components/Button";
import { AnimateIcon } from "../../components/animate-ui/icons/icon";
import { View } from "../../components/animate-ui/icons/hugeicons/view";
import { EyeOff } from "../../components/animate-ui/icons/hugeicons/eye-off";
import { CreditCard } from "../../components/animate-ui/icons/hugeicons/credit-card";
import { ComputerTerminal01 } from "../../components/animate-ui/icons/hugeicons/computer-terminal-01";
import { formatDateTime } from "./periods";
import { FormModal } from "./shared";

type Status = "loading" | "ready" | "error";

const PROVIDER_LABEL: Record<string, string> = { paypal: "PayPal" };

/* Configuración de la tienda: formas de pago (PayPal se enciende y apaga aquí, sin entrar a PayPal),
   a quién se le avisa por correo de cada venta y las comisiones de respaldo por pasarela. */
export function Settings() {
  return (
    <div className="admin__page">
      <div className="admin__head">
        <div>
          <h1 className="admin__title">Configuración</h1>
          <p className="admin__sub">Formas de pago, avisos de venta y comisiones.</p>
        </div>
      </div>
      <div className="admin__content">
        <PaymentMethods />
        <SaleAlerts />
        <Fees />
      </div>
    </div>
  );
}

function PaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchPaymentMethods()
      .then((rows) => {
        setMethods(rows);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    fetchPaymentStatus()
      .then(setPaymentStatus)
      .catch(() => setPaymentStatus(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onToggle = async (method: PaymentMethod) => {
    setBusy(method.provider);
    setError(null);
    try {
      await setPaymentMethodEnabled(method.provider, !method.enabled);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(null);
    }
  };

  // volver a cobros reales se confirma en un modal del panel (window.confirm no aparece en todos los navegadores)
  const [confirmLive, setConfirmLive] = useState<PaymentMethod | null>(null);

  const onMode = (method: PaymentMethod, mode: PaymentMode) => {
    if (mode === "live") setConfirmLive(method);
    else applyMode(method, mode);
  };

  const applyMode = async (method: PaymentMethod, mode: PaymentMode) => {
    setConfirmLive(null);
    setBusy(method.provider);
    setError(null);
    try {
      await setPaymentMethodMode(method.provider, mode);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="board">
      <div className="board__toolbar">
        <p className="board__title">Formas de pago</p>
        <p className="board__note">Lo que cobra el checkout sale de Productos y Cupones</p>
      </div>
      {status === "loading" && <p className="board__empty">Cargando…</p>}
      {status === "error" && <p className="board__empty">No pudimos cargar las formas de pago.</p>}
      {status === "ready" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Forma de pago</th>
                <th>En el checkout</th>
                <th>Credenciales</th>
                <th>Modo</th>
                <th>Actualizada</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => {
                const ready = m.provider !== "paypal" || paymentStatus?.credentialsOk === true;
                const credentialsLabel = !paymentStatus?.configured
                  ? m.mode === "sandbox"
                    ? "Faltan las de Sandbox en Supabase"
                    : "Faltan en Supabase"
                  : paymentStatus.credentialsOk
                    ? "Aceptadas por PayPal"
                    : m.mode === "live"
                      ? "PayPal las rechazó (¿son de Live?)"
                      : "PayPal las rechazó (¿son de Sandbox?)";
                const otherMode: PaymentMode = m.mode === "live" ? "sandbox" : "live";
                const otherReady = paymentStatus?.[otherMode]?.credentialsOk === true;
                return (
                  <tr key={m.provider}>
                    <td>{PROVIDER_LABEL[m.provider] ?? m.provider}</td>
                    <td>
                      <span className="status-pill is-sentence" data-status={m.enabled && ready ? "paid" : "pending"}>
                        {m.enabled ? (ready ? "Encendido" : "Encendido, sin credenciales") : "Apagado"}
                      </span>
                    </td>
                    <td>
                      {paymentStatus === null ? (
                        <span className="is-muted">—</span>
                      ) : (
                        <span className="status-pill is-sentence" data-status={ready ? "paid" : "failed"}>
                          {credentialsLabel}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="status-pill is-sentence" data-status={m.mode === "live" ? "completed" : "pending"}>
                        {m.mode === "live" ? "Real" : "Pruebas (sin dinero real)"}
                      </span>
                    </td>
                    <td>{formatDateTime(m.updated_at)}</td>
                    <td>
                      {/* solo iconos: el nombre de cada acción va en el aviso al pasar el mouse y para lectores de pantalla */}
                      <div className="row-actions row-actions--end">
                        <AnimateIcon animateOnHover asChild>
                          <button
                            type="button"
                            className="icon-btn"
                            disabled={busy === m.provider || (!m.enabled && !ready)}
                            aria-label={m.enabled ? "Ocultar PayPal del checkout" : "Mostrar PayPal en el checkout"}
                            title={
                              !m.enabled && !ready
                                ? "PayPal tiene que aceptar las credenciales antes de mostrarlo"
                                : m.enabled
                                  ? "Ocultar del checkout"
                                  : "Mostrar en el checkout"
                            }
                            onClick={() => onToggle(m)}
                          >
                            {m.enabled ? <EyeOff size={14} /> : <View size={14} />}
                          </button>
                        </AnimateIcon>
                        <AnimateIcon animateOnHover asChild>
                          <button
                            type="button"
                            className="icon-btn"
                            disabled={busy === m.provider || !otherReady}
                            aria-label={otherMode === "sandbox" ? "Pasar a modo pruebas" : "Pasar a modo real"}
                            title={
                              otherReady
                                ? otherMode === "sandbox"
                                  ? "Pasar a modo pruebas (sin dinero real)"
                                  : "Pasar a cobros reales"
                                : otherMode === "sandbox"
                                  ? "Carga PAYPAL_SANDBOX_CLIENT_ID y PAYPAL_SANDBOX_CLIENT_SECRET en Supabase"
                                  : "PayPal tiene que aceptar las credenciales reales"
                            }
                            onClick={() => onMode(m, otherMode)}
                          >
                            {/* el icono muestra a qué modo se pasa: terminal = pruebas, tarjeta = cobros reales */}
                            {otherMode === "sandbox" ? <ComputerTerminal01 size={14} /> : <CreditCard size={14} />}
                          </button>
                        </AnimateIcon>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {methods.some((m) => m.mode === "sandbox") && (
        <p className="admin-field__hint" style={{ padding: "0 12px 12px" }}>
          Modo pruebas: el checkout usa el sandbox de PayPal y no cobra dinero real. Esas compras quedan como «PayPal (pruebas)»
          y generan claves de verdad; bórralas al terminar.
        </p>
      )}
      {error && <p className="form-error" style={{ padding: 12 }}>{error}</p>}
      {confirmLive && (
        <FormModal
          title="¿Pasar a cobros reales?"
          onClose={() => setConfirmLive(null)}
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => setConfirmLive(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => applyMode(confirmLive, "live")}>
                Pasar a real
              </Button>
            </>
          }
        >
          <p className="admin-field__hint">Desde ahora el checkout cobra dinero de verdad con PayPal.</p>
        </FormModal>
      )}
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SaleAlerts() {
  const [status, setStatus] = useState<Status>("loading");
  const [enabled, setEnabled] = useState(true);
  const [draft, setDraft] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  useEffect(() => {
    fetchSaleNotifications()
      .then((row) => {
        setEnabled(row?.enabled ?? true);
        setDraft((row?.emails ?? []).join("\n"));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    fetchPaymentStatus()
      .then(setPaymentStatus)
      .catch(() => setPaymentStatus(null));
  }, []);

  const emails = draft
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const invalid = emails.filter((e) => !EMAIL_RE.test(e));

  const onSave = async () => {
    if (invalid.length) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateSaleNotifications(enabled, Array.from(new Set(emails)));
      setMessage({ tone: "ok", text: "Guardado." });
    } catch (err) {
      setMessage({ tone: "bad", text: err instanceof Error ? err.message : "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const sentTo = await sendTestSaleEmail();
      setMessage({ tone: "ok", text: `Correo de prueba enviado a ${sentTo.join(", ")}.` });
    } catch (err) {
      setMessage({ tone: "bad", text: err instanceof Error ? err.message : "No se pudo enviar." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="board">
      <div className="board__toolbar">
        <p className="board__title">Avisos de venta por correo</p>
        <div className="board__tools">
          <Button variant="ghost" size="sm" loading={testing} disabled={status !== "ready"} onClick={onTest}>
            {testing ? "Enviando…" : "Enviar prueba"}
          </Button>
          <Button size="sm" loading={saving} disabled={status !== "ready" || invalid.length > 0} onClick={onSave}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
      {status === "loading" && <p className="board__empty">Cargando…</p>}
      {status === "error" && <p className="board__empty">No pudimos cargar los avisos.</p>}
      {status === "ready" && (
        <div className="form-body">
          <label className="check-row">
            <span>Enviar un correo por cada venta (PayPal y cupones del 100 %)</span>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          </label>
          <div className="admin-field">
            <label htmlFor="sale-emails">Correos que reciben el aviso (uno por línea)</label>
            <textarea id="sale-emails" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
            {invalid.length > 0 && <p className="form-error">Revisa: {invalid.join(", ")}</p>}
          </div>
          <p className="admin-field__hint">
            {paymentStatus === null
              ? "No pudimos revisar el servicio de correo."
              : paymentStatus.emailConfigured
                ? `Se envía desde ${paymentStatus.emailFrom}.`
                : "Falta cargar RESEND_API_KEY en los secretos de Supabase: hasta entonces no sale ningún correo."}
          </p>
          {message && (
            <p className={message.tone === "bad" ? "form-error" : "admin-field__hint"} role="status">
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Fees() {
  const [fees, setFees] = useState<GatewayFee[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchGatewayFees()
      .then((data) => {
        setFees(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async (provider: string) => {
    const value = Number(draft);
    if (Number.isNaN(value) || value < 0) return;
    setSaving(true);
    try {
      await updateGatewayFee(provider, value);
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="board">
      <div className="board__toolbar">
        <p className="board__title">Comisiones de respaldo</p>
        <p className="board__note">PayPal informa su comisión real en cada venta; esta solo se usa si no llega</p>
      </div>
      {status === "loading" && <p className="board__empty">Cargando…</p>}
      {status === "error" && <p className="board__empty">No pudimos cargar las comisiones.</p>}
      {status === "ready" && fees.length === 0 && <p className="board__empty">No hay comisiones configuradas.</p>}
      {status === "ready" && fees.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pasarela</th>
                <th>Comisión</th>
                <th>Actualizada</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <tr key={fee.provider}>
                  <td>{PROVIDER_LABEL[fee.provider] ?? fee.provider}</td>
                  <td>
                    {editing === fee.provider ? (
                      <span className="admin-field">
                        <input value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: 80 }} autoFocus />
                      </span>
                    ) : (
                      `${fee.fee_percent}%`
                    )}
                  </td>
                  <td>{formatDateTime(fee.updated_at)}</td>
                  <td>
                    {editing === fee.provider ? (
                      <span className="row-actions">
                        <button type="button" className="row-action" disabled={saving} onClick={() => onSave(fee.provider)}>
                          {saving ? "Guardando…" : "Guardar"}
                        </button>
                        <button type="button" className="row-action" onClick={() => setEditing(null)}>
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="row-action"
                        onClick={() => {
                          setEditing(fee.provider);
                          setDraft(String(fee.fee_percent));
                        }}
                      >
                        Editar
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
  );
}
