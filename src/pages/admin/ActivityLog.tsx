import { useEffect, useState } from "react";
import { fetchAuditLog, type AuditLogEntry } from "../../lib/admin-data";
import { formatDateTime } from "./periods";

type Status = "loading" | "ready" | "error";

export function ActivityLog() {
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    fetchAuditLog()
      .then((data) => {
        setRows(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="admin__page">
      <div className="admin__head">
        <div>
          <h1 className="admin__title">Registro de actividad</h1>
          <p className="admin__sub">Qué cambió, quién y cuándo.</p>
        </div>
      </div>

      {status === "loading" && <div className="admin-empty">Cargando…</div>}
      {status === "error" && <div className="admin-empty">No pudimos cargar el registro.</div>}
      {status === "ready" && rows.length === 0 && <div className="admin-empty">Todavía no hay actividad registrada.</div>}

      {status === "ready" && rows.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>{row.action}</td>
                  <td>
                    {row.entity}
                    {row.entity_id ? ` · ${row.entity_id}` : ""}
                  </td>
                  <td>{row.detail ? JSON.stringify(row.detail) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
