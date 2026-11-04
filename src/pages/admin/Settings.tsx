import { useCallback, useEffect, useState } from "react";
import { fetchGatewayFees, updateGatewayFee, type GatewayFee } from "../../lib/admin-data";
import { formatDateTime } from "./periods";

type Status = "loading" | "ready" | "error";

export function Settings() {
  const [fees, setFees] = useState<GatewayFee[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setStatus("loading");
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

  const onSave = async (platform: string) => {
    const value = Number(draft);
    if (Number.isNaN(value) || value < 0) return;
    setSaving(true);
    try {
      await updateGatewayFee(platform, value);
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin__page">
      <div className="admin__head">
        <div>
          <h1 className="admin__title">Configuración</h1>
          <p className="admin__sub">Tarifas de comisión por pasarela. Cambiarlas no altera ventas ya registradas.</p>
        </div>
      </div>

      {status === "loading" && <div className="admin-empty">Cargando…</div>}
      {status === "error" && <div className="admin-empty">No pudimos cargar la configuración.</div>}

      {status === "ready" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Plataforma</th>
                <th>Comisión</th>
                <th>Actualizada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <tr key={fee.platform}>
                  <td style={{ textTransform: "capitalize" }}>{fee.platform}</td>
                  <td>
                    {editing === fee.platform ? (
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        style={{
                          width: 70,
                          height: 30,
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          padding: "0 8px",
                          background: "var(--bg)",
                          color: "var(--text)",
                        }}
                        autoFocus
                      />
                    ) : (
                      `${fee.fee_percent}%`
                    )}
                  </td>
                  <td>{formatDateTime(fee.updated_at)}</td>
                  <td>
                    {editing === fee.platform ? (
                      <div style={{ display: "flex", gap: 10 }}>
                        <button type="button" className="lnk" disabled={saving} onClick={() => onSave(fee.platform)}>
                          {saving ? "Guardando…" : "Guardar"}
                        </button>
                        <button type="button" className="lnk" onClick={() => setEditing(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="lnk"
                        onClick={() => {
                          setEditing(fee.platform);
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
