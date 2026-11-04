import { publishVersion, type ProductVersion, type VersionInstaller } from "../../lib/admin-data";
import { formatDateTime } from "./periods";

type Status = "loading" | "ready" | "error";

const VERSION_LABEL: Record<ProductVersion["status"], string> = {
  draft: "Borrador",
  ready: "Lista",
  published: "Publicada",
  previous: "Anterior",
  failed: "Fallida",
};

// Publicada en blanco, fallida en rojo; borrador, lista y anterior en gris.
const VERSION_TONE: Record<ProductVersion["status"], string> = {
  draft: "pending",
  ready: "pending",
  published: "paid",
  previous: "previous",
  failed: "failed",
};

function formatBytes(n: number | null): string {
  if (!n) return "—";
  const mb = n / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

function InstallerCell({ installer }: { installer?: VersionInstaller }) {
  if (!installer) return <span className="is-muted">Sin instalador</span>;
  const uploaded = installer.status === "uploaded";
  return (
    <span className="coupon-cell">
      <span className="status-pill" data-status={uploaded ? "paid" : "pending"}>
        {uploaded ? "Subido" : "Pendiente"}
      </span>
      {uploaded && <span>{formatBytes(installer.size_bytes)}</span>}
    </span>
  );
}

// Versiones e instaladores de un producto, dentro de su página (debajo de los planes).
// Se suben con "Actualizar instaladores", en la barra de arriba de la página.
export function VersionsBoard({ versions, status, onChange }: { versions: ProductVersion[]; status: Status; onChange: () => void }) {
  const onPublish = async (v: ProductVersion) => {
    const verb = v.status === "previous" ? "volver a publicar" : "publicar";
    if (!confirm(`¿Seguro que quieres ${verb} la versión ${v.version}? Quedará disponible para los compradores.`)) return;
    try {
      await publishVersion(v.id);
      onChange();
    } catch (err) {
      alert((err as { message?: string } | null)?.message ?? "No se pudo publicar la versión");
    }
  };

  return (
    <>
      <div className="board">
        <div className="board__toolbar">
          <p className="board__title">
            Versiones <span className="board__count">{versions.length}</span>
          </p>
        </div>

        {status === "loading" && <p className="board__empty">Cargando versiones…</p>}
        {status === "error" && <p className="board__empty">No pudimos cargar las versiones.</p>}
        {status === "ready" && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Versión</th>
                  <th>Estado</th>
                  <th>Windows</th>
                  <th>macOS</th>
                  <th>Novedades</th>
                  <th>Creada</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {versions.length === 0 && (
                  <tr className="row-empty">
                    <td colSpan={7}>Todavía no hay versiones. Sube la primera con Actualizar instaladores.</td>
                  </tr>
                )}
                {versions.map((v) => {
                  const hasUpload = v.installers.some((i) => i.status === "uploaded");
                  const canPublish = (v.status === "draft" || v.status === "ready") && hasUpload;
                  return (
                    <tr key={v.id}>
                      <td>
                        <b>{v.version}</b>
                      </td>
                      <td>
                        <span className="status-pill" data-status={VERSION_TONE[v.status]}>
                          {VERSION_LABEL[v.status]}
                        </span>
                      </td>
                      <td>
                        <InstallerCell installer={v.installers.find((i) => i.platform === "windows")} />
                      </td>
                      <td>
                        <InstallerCell installer={v.installers.find((i) => i.platform === "macos")} />
                      </td>
                      <td className={"cell-wrap" + (v.changelog ? "" : " is-muted")}>{v.changelog || "Sin notas"}</td>
                      <td className="is-muted">{formatDateTime(v.created_at)}</td>
                      <td>
                        {(canPublish || (v.status === "previous" && hasUpload)) && (
                          <button type="button" className="row-action" onClick={() => onPublish(v)}>
                            {v.status === "previous" ? "Volver a publicar" : "Publicar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
