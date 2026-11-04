import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAllReviews, toggleReviewHidden, type AllReviewRow } from "../../lib/admin-data";
import { SelectField } from "./SelectField";
import { formatDate } from "./periods";
import { Pager, TableSearch } from "./shared";
import { Star } from "../../components/animate-ui/icons/hugeicons/star";
import { MessageSquareText } from "../../components/animate-ui/icons/hugeicons/message-square-text";
import { EyeOff } from "../../components/animate-ui/icons/hugeicons/eye-off";
import { ThumbsDown } from "../../components/animate-ui/icons/hugeicons/thumbs-down";

type Status = "loading" | "ready" | "error";
type Visibility = "all" | "visible" | "hidden";
const PAGE_SIZE = 12;

export function Reviews() {
  const [rows, setRows] = useState<AllReviewRow[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("all");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setStatus("loading");
    fetchAllReviews()
      .then((data) => {
        setRows(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const avgByProduct = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const r of rows) {
      const entry = map.get(r.product_name) ?? { sum: 0, count: 0 };
      entry.sum += r.rating;
      entry.count += 1;
      map.set(r.product_name, entry);
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, avg: v.sum / v.count, count: v.count }));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (visibility === "visible" && r.hidden) return false;
      if (visibility === "hidden" && !r.hidden) return false;
      if (needle && !`${r.profiles?.email ?? ""} ${r.comment} ${r.product_name}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, search, visibility]);

  useEffect(() => {
    setPage(1);
  }, [search, visibility]);

  const onToggle = async (row: AllReviewRow) => {
    setBusyId(row.id);
    try {
      await toggleReviewHidden(row.id, !row.hidden);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const average = rows.length ? rows.reduce((a, r) => a + r.rating, 0) / rows.length : 0;
  const hidden = rows.filter((r) => r.hidden).length;
  const lowRated = rows.filter((r) => r.rating <= 2).length;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="admin__page">
      <div className="admin__head">
        <h1 className="admin__title">Reseñas</h1>
      </div>

      <div className="admin__content">
        <div className="board">
          <div className="board__kpis">
            <div className="kpi">
              <p className="kpi__label">
                <Star size={14} />
                Calificación promedio
              </p>
              <p className="kpi__value rating-cell">
                {rows.length ? average.toFixed(1) : "—"} <Star size={15} />
              </p>
              <p className="kpi__foot">
                {avgByProduct.length > 1 ? avgByProduct.map((p) => `${p.name} ${p.avg.toFixed(1)}`).join(" · ") : "Todas con compra verificada"}
              </p>
            </div>
            <div className="kpi">
              <p className="kpi__label">
                <MessageSquareText size={14} />
                Reseñas
              </p>
              <p className="kpi__value">{rows.length}</p>
              <p className="kpi__foot">
                {rows.length - hidden} visible{rows.length - hidden === 1 ? "" : "s"} en la web
              </p>
            </div>
            <div className="kpi">
              <p className="kpi__label">
                <EyeOff size={14} />
                Ocultas
              </p>
              <p className="kpi__value">{hidden}</p>
              <p className="kpi__foot">Retiradas por moderación</p>
            </div>
            <div className="kpi">
              <p className="kpi__label">
                <ThumbsDown size={14} />
                Calificación baja
              </p>
              <p className="kpi__value">{lowRated}</p>
              <p className="kpi__foot">De 1 o 2 estrellas, para revisar</p>
            </div>
          </div>
        </div>

        <div className="board">
          <div className="board__toolbar">
            <p className="board__title">
              Todas las reseñas <span className="board__count">{filtered.length}</span>
            </p>
          </div>
          <div className="board__filterbar">
            <TableSearch value={search} onChange={setSearch} placeholder="Buscar por cliente o comentario" />
            <SelectField
              value={visibility}
              onChange={(v) => setVisibility(v as Visibility)}
              options={[
                { value: "all", label: "Todas" },
                { value: "visible", label: "Visibles" },
                { value: "hidden", label: "Ocultas" },
              ]}
            />
            <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
          </div>

          {status === "loading" && <p className="board__empty">Cargando reseñas…</p>}
          {status === "error" && <p className="board__empty">No pudimos cargar las reseñas.</p>}
          {status === "ready" && filtered.length === 0 && <p className="board__empty">{rows.length === 0 ? "Todavía no hay reseñas." : "Sin resultados."}</p>}

          {status === "ready" && filtered.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Producto</th>
                    <th>Calificación</th>
                    <th>Comentario</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => (
                    <tr key={row.id}>
                      <td>{row.profiles?.email ?? row.user_id.slice(0, 8)}</td>
                      <td>{row.product_name}</td>
                      <td>
                        <span className="rating-cell">
                          {row.rating} <Star size={13} />
                        </span>
                      </td>
                      <td className={"cell-wrap" + (row.comment ? "" : " is-muted")}>{row.comment || "Sin comentario"}</td>
                      <td>
                        <span className="status-pill" data-status={row.hidden ? "pending" : "paid"}>
                          {row.hidden ? "Oculta" : "Visible"}
                        </span>
                      </td>
                      <td className="is-muted">{formatDate(row.created_at)}</td>
                      <td>
                        <button type="button" className="row-action" disabled={busyId === row.id} onClick={() => onToggle(row)}>
                          {row.hidden ? "Mostrar" : "Ocultar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
