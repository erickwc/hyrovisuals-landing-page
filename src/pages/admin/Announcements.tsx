import { useCallback, useEffect, useState } from "react";
import {
  createAnnouncement,
  fetchAnnouncementsAdmin,
  setAnnouncementStatus,
  updateAnnouncement,
  type Announcement,
  type AnnouncementInput,
} from "../../lib/admin-data";
import { SelectField } from "./SelectField";
import { formatDay } from "./shared";
import { Button } from "../../components/Button";
import { MiniModal } from "../../components/MiniModal";
import { AnimateIcon } from "../../components/animate-ui/icons/icon";
import { PlusSign } from "../../components/animate-ui/icons/hugeicons/plus-sign";
import { View } from "../../components/animate-ui/icons/hugeicons/view";
import { EyeOff } from "../../components/animate-ui/icons/hugeicons/eye-off";
import { Megaphone } from "../../components/animate-ui/icons/hugeicons/megaphone";
import { PencilEdit02 } from "../../components/animate-ui/icons/hugeicons/pencil-edit-02";
import { CheckCheck } from "../../components/animate-ui/icons/hugeicons/check-check";

type Status = "loading" | "ready" | "error";

const EMPTY_FORM: AnnouncementInput = { title: "", body: "", audience: "general", placement: "landing_banner", startsAt: null, endsAt: null };

const STATUS_LABEL: Record<Announcement["status"], string> = {
  draft: "Borrador",
  scheduled: "Programado",
  published: "Publicado",
  finished: "Finalizado",
};

// Publicado en blanco; programado, borrador y finalizado en gris.
const STATUS_TONE: Record<Announcement["status"], string> = {
  draft: "pending",
  scheduled: "pending",
  published: "paid",
  finished: "finished",
};

const AUDIENCE = [
  { value: "general", label: "General" },
  { value: "buyers", label: "Solo compradores" },
];
const PLACEMENT = [
  { value: "landing_banner", label: "Banner de landing" },
  { value: "library", label: "Biblioteca del cliente" },
];

function vigencia(row: Announcement): string {
  if (!row.starts_at && !row.ends_at) return "Sin fechas";
  const from = row.starts_at ? formatDay(row.starts_at) : "Sin inicio";
  const to = row.ends_at ? formatDay(row.ends_at) : "sin fin";
  return `${from} – ${to}`;
}

export function Announcements() {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  // al editar, la mini ventana se abre junto al lápiz de la fila; al crear, debajo de «Nuevo anuncio»
  const [editAnchor, setEditAnchor] = useState<HTMLElement | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    fetchAnnouncementsAdmin()
      .then((data) => {
        setRows(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    if (showForm && !editingId) return setShowForm(false);
    setEditingId(null);
    setEditAnchor(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const startEdit = (row: Announcement, anchor: HTMLElement) => {
    if (showForm && editingId === row.id) return setShowForm(false);
    setEditingId(row.id);
    setEditAnchor(anchor);
    setForm({
      title: row.title,
      body: row.body,
      audience: row.audience,
      placement: row.placement,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    });
    setShowForm(true);
  };

  const onSave = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateAnnouncement(editingId, form);
      } else {
        await createAnnouncement(form);
      }
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const onSetStatus = async (id: string, next: Announcement["status"]) => {
    await setAnnouncementStatus(id, next);
    load();
  };

  const count = (s: Announcement["status"]) => rows.filter((r) => r.status === s).length;

  const formWindow = (
    <MiniModal
      open={showForm}
      anchor={editingId ? editAnchor : undefined}
      onClose={() => setShowForm(false)}
      locked={saving}
      title={editingId ? "Editar anuncio" : "Nuevo anuncio"}
      wide
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" loading={saving} disabled={!form.title.trim() || !form.body.trim()} onClick={onSave}>
            {saving ? "Guardando…" : editingId ? "Guardar" : "Publicar"}
          </Button>
        </>
      }
    >
      <div className="sp-field">
        <label htmlFor="an-title">Título</label>
        <div className="sp-field__control admin-field">
          <input id="an-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
      </div>
      <div className="sp-field">
        <label htmlFor="an-body">Contenido</label>
        <div className="sp-field__control admin-field">
          <textarea id="an-body" rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </div>
      </div>
      <div className="sp-field">
        <label>Público</label>
        <div className="sp-field__control">
          <SelectField value={form.audience} onChange={(v) => setForm({ ...form, audience: v as AnnouncementInput["audience"] })} options={AUDIENCE} />
        </div>
      </div>
      <div className="sp-field">
        <label>Ubicación</label>
        <div className="sp-field__control">
          <SelectField value={form.placement} onChange={(v) => setForm({ ...form, placement: v as AnnouncementInput["placement"] })} options={PLACEMENT} />
        </div>
      </div>
      <div className="sp-field">
        <label htmlFor="an-until">Hasta</label>
        <div className="sp-field__control admin-field">
          <input id="an-until" type="date" value={form.endsAt?.slice(0, 10) ?? ""} onChange={(e) => setForm({ ...form, endsAt: e.target.value || null })} />
          <span className="admin-field__hint">Opcional. Sin fecha, queda publicado hasta que lo retires.</span>
        </div>
      </div>
    </MiniModal>
  );

  return (
    <div className="admin__page">
      <div className="admin__head">
        <h1 className="admin__title">Contenido y anuncios</h1>
      </div>

      <div className="admin__content">
        <div className="board">
          <div className="board__kpis">
            <div className="kpi">
              <p className="kpi__label">
                <Megaphone size={14} />
                Publicados
              </p>
              <p className="kpi__value">{count("published")}</p>
              <p className="kpi__foot">Visibles ahora en la web</p>
            </div>
            <div className="kpi">
              <p className="kpi__label">
                <PencilEdit02 size={14} />
                Borradores
              </p>
              <p className="kpi__value">{count("draft")}</p>
              <p className="kpi__foot">Sin publicar todavía</p>
            </div>
            <div className="kpi">
              <p className="kpi__label">
                <CheckCheck size={14} />
                Finalizados
              </p>
              <p className="kpi__value">{count("finished")}</p>
              <p className="kpi__foot">Retirados o vencidos</p>
            </div>
          </div>
        </div>


        <div className="board">
          <div className="board__toolbar">
            <p className="board__title">
              Anuncios <span className="board__count">{rows.length}</span>
            </p>
            <div className="board__tools">
              <div className="mini-anchor">
                <Button size="sm" data-mini-trigger aria-expanded={showForm && !editingId} onClick={startNew}>
                  <PlusSign size={14} />
                  Nuevo anuncio
                </Button>
                {!editingId && formWindow}
              </div>
            </div>
          </div>

          {status === "loading" && <p className="board__empty">Cargando anuncios…</p>}
          {status === "error" && <p className="board__empty">No pudimos cargar los anuncios.</p>}
          {status === "ready" && rows.length === 0 && <p className="board__empty">Todavía no hay anuncios.</p>}

          {status === "ready" && rows.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Público</th>
                    <th>Ubicación</th>
                    <th>Vigencia</th>
                    <th>Estado</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td>{row.audience === "general" ? "General" : "Compradores"}</td>
                      <td>{row.placement === "landing_banner" ? "Landing" : "Biblioteca"}</td>
                      <td className="is-muted">{vigencia(row)}</td>
                      <td>
                        <span className="status-pill" data-status={STATUS_TONE[row.status]}>
                          {STATUS_LABEL[row.status]}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions row-actions--end">
                          <AnimateIcon animateOnHover asChild>
                            <button
                              type="button"
                              className="icon-btn"
                              data-mini-trigger
                              aria-label={`Editar «${row.title}»`}
                              title="Editar"
                              onClick={(e) => startEdit(row, e.currentTarget)}
                            >
                              <PencilEdit02 size={14} />
                            </button>
                          </AnimateIcon>
                          {row.status !== "published" ? (
                            <AnimateIcon animateOnHover asChild>
                              <button type="button" className="icon-btn" aria-label={`Publicar «${row.title}»`} title="Publicar" onClick={() => onSetStatus(row.id, "published")}>
                                <View size={14} />
                              </button>
                            </AnimateIcon>
                          ) : (
                            <AnimateIcon animateOnHover asChild>
                              <button type="button" className="icon-btn" aria-label={`Retirar «${row.title}»`} title="Retirar" onClick={() => onSetStatus(row.id, "finished")}>
                                <EyeOff size={14} />
                              </button>
                            </AnimateIcon>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {editingId && formWindow}
    </div>
  );
}
