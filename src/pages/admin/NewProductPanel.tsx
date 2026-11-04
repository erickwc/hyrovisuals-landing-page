import { useState } from "react";
import {
  createPlan,
  createProduct,
  createVersionDraft,
  installerObjectKey,
  markInstallerUploaded,
  publishVersion,
  registerInstaller,
  requestUploadUrl,
  uploadFileToR2,
  type InstallerPlatform,
  type ProductOption,
  type ProductVersion,
} from "../../lib/admin-data";
import { formatMoney } from "./periods";
import { MiniModal } from "../../components/MiniModal";
import { PlanEditor, planId, type PlanValues } from "./PlanEditor";
import { AnimateIcon } from "../../components/animate-ui/icons/icon";
import { PlusSign } from "../../components/animate-ui/icons/hugeicons/plus-sign";
import { Delete02 } from "../../components/animate-ui/icons/hugeicons/delete-02";
import { PencilEdit02 } from "../../components/animate-ui/icons/hugeicons/pencil-edit-02";
import { Button } from "../../components/Button";
import { Upload01 } from "../../components/animate-ui/icons/hugeicons/upload-01";

const PLATFORMS: { platform: InstallerPlatform; label: string; accept: string }[] = [
  { platform: "windows", label: "Windows", accept: ".exe,.msi" },
  { platform: "macos", label: "macOS", accept: ".dmg,.pkg,.zip" },
];

// Todo el producto en un solo proceso: datos, planes e instaladores de la primera versión.
// Se guarda en orden (producto, planes, versión, archivos y publicación); si algo falla a medias,
// lo ya guardado se recuerda y al reintentar solo se hace lo que faltó.
// Se abre en una mini ventana debajo del botón «Nuevo producto» (va dentro de su .mini-anchor).
export function NewProductPanel({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (product: ProductOption) => void }) {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [plans, setPlans] = useState<PlanValues[]>([]);
  // target: "new" para agregar o el id del plan que se edita; open controla la animación de entrada y salida.
  const [editor, setEditor] = useState<{ open: boolean; target: string; anchor?: HTMLElement }>({ open: false, target: "new" });
  const [files, setFiles] = useState<Partial<Record<InstallerPlatform, File>>>({});
  const [changelog, setChangelog] = useState("");
  const [progress, setProgress] = useState<Partial<Record<InstallerPlatform, number>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [created, setCreated] = useState<ProductOption | null>(null);
  const [createdPlans, setCreatedPlans] = useState<string[]>([]);
  const [draft, setDraft] = useState<ProductVersion | null>(null);
  const [uploaded, setUploaded] = useState<InstallerPlatform[]>([]);

  const slug = planId(name);
  const hasFiles = PLATFORMS.some((p) => files[p.platform]);
  const editingPlan = editor.target !== "new" ? plans.find((p) => p.id === editor.target) : undefined;
  const openEditor = (target: string, anchor?: HTMLElement) => setEditor({ open: true, target, anchor });
  const closeEditor = () => setEditor((e) => ({ ...e, open: false }));

  const savePlan = (plan: PlanValues) => {
    setPlans((list) => (editingPlan ? list.map((p) => (p.id === editingPlan.id ? plan : p)) : [...list, plan]));
    closeEditor();
    setError(null);
  };

  const validate = (): string | null => {
    if (!name.trim() || !slug) return "Escribe el nombre del producto.";
    if (!version.trim()) return "Escribe la versión inicial, por ejemplo 1.0.0.";
    return null;
  };

  const onSubmit = async () => {
    const problem = validate();
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    let step = "el producto";
    let product = created;
    let versionRow = draft;
    const plansDone = [...createdPlans];
    const filesDone = [...uploaded];
    try {
      if (!product) {
        product = await createProduct({ slug, name, version });
        setCreated(product);
      }
      for (const p of plans) {
        if (plansDone.includes(p.id)) continue;
        step = `el plan "${p.name}"`;
        await createPlan({ productId: product.id, id: p.id, priceUsd: p.price, licenseCount: p.keys });
        plansDone.push(p.id);
        setCreatedPlans([...plansDone]);
      }
      // Con instaladores, la versión se publica sola: un producto nuevo no tiene otra versión que ofrecer.
      if (hasFiles) {
        if (!versionRow) {
          step = "la versión";
          versionRow = await createVersionDraft(product.id, version.trim(), changelog);
          setDraft(versionRow);
        }
        for (const { platform, label } of PLATFORMS) {
          const file = files[platform];
          if (!file || filesDone.includes(platform)) continue;
          step = `el instalador de ${label}`;
          const key = installerObjectKey(product.slug, versionRow.version, platform, file.name);
          await registerInstaller(versionRow.id, platform, key);
          const url = await requestUploadUrl(key);
          await uploadFileToR2(url, file, (pct) => setProgress((pr) => ({ ...pr, [platform]: pct })));
          await markInstallerUploaded(versionRow.id, platform, file.size);
          filesDone.push(platform);
          setUploaded([...filesDone]);
        }
        step = "la publicación de la versión";
        await publishVersion(versionRow.id);
      }
      onCreated(product);
    } catch (err) {
      const detail = (err as { message?: string } | null)?.message ?? "error desconocido";
      setError(
        product
          ? `Falló ${step} (${detail}). Lo anterior ya quedó guardado: corrige y presiona Reintentar, no se duplicará.`
          : `No se pudo crear el producto (${detail}).`,
      );
    } finally {
      setSaving(false);
    }
  };

  const locked = created !== null;

  return (
    <MiniModal
      open={open}
      title="Nuevo producto"
      onClose={onClose}
      locked={saving}
      className="mini-modal--xl"
      bodyClassName="np-body"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={onSubmit} loading={saving}>
            {saving ? "Guardando…" : locked ? "Reintentar" : "Crear producto"}
          </Button>
        </>
      }
    >
      <div className="sp-section">
        <p className="sp-section__title">Producto</p>
        <div className="sp-field">
          <label htmlFor="np-name">Nombre</label>
          <div className="sp-field__control admin-field">
            <input id="np-name" placeholder="Hyro Visuals Pro" value={name} disabled={locked} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <div className="sp-field">
          <label htmlFor="np-version">Versión inicial</label>
          <div className="sp-field__control admin-field">
            <input id="np-version" value={version} disabled={locked} onChange={(e) => setVersion(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="sp-section">
        <div className="sp-section__head">
          <p className="sp-section__title">Planes {plans.length > 0 && <span className="board__count">{plans.length}</span>}</p>
          <div className="mini-anchor">
            <AnimateIcon animateOnHover asChild>
              <button
                type="button"
                className="icon-btn"
                data-mini-trigger
                aria-label="Agregar plan"
                aria-expanded={editor.open && editor.target === "new"}
                disabled={saving}
                onClick={() => (editor.open && editor.target === "new" ? closeEditor() : openEditor("new"))}
              >
                <PlusSign size={14} />
              </button>
            </AnimateIcon>
            <PlanEditor
              key={editor.target}
              open={editor.open}
              anchor={editor.anchor}
              initial={editingPlan}
              takenIds={plans.map((p) => p.id)}
              onSave={savePlan}
              onClose={closeEditor}
            />
          </div>
        </div>
        {plans.length > 0 && (
          <div className="inner-table">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th className="is-num">Claves</th>
                  <th className="is-num">Precio</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const saved = createdPlans.includes(p.id);
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="is-num">{p.keys}</td>
                      <td className="is-num">{formatMoney(p.price)}</td>
                      <td>
                        <div className="row-actions row-actions--end">
                          <AnimateIcon animateOnHover asChild>
                            <button
                              type="button"
                              className="icon-btn"
                              data-mini-trigger
                              aria-label={`Editar el plan ${p.name}`}
                              disabled={saving || saved}
                              onClick={(e) => openEditor(p.id, e.currentTarget)}
                            >
                              <PencilEdit02 size={14} />
                            </button>
                          </AnimateIcon>
                          <AnimateIcon animateOnHover asChild>
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Quitar el plan ${p.name}`}
                              disabled={saving || saved}
                              onClick={() => setPlans((list) => list.filter((x) => x.id !== p.id))}
                            >
                              <Delete02 size={14} />
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
      </div>

      <div className="sp-section">
        <p className="sp-section__title">Instaladores</p>
        {PLATFORMS.map(({ platform, label, accept }) => (
          <div className="sp-field" key={platform}>
            <label>{label}</label>
            <div className="sp-field__control admin-field">
              <label className="file-pick" data-has-file={Boolean(files[platform])} aria-disabled={saving || uploaded.includes(platform) || undefined}>
                <Upload01 size={14} />
                <span>{files[platform]?.name ?? "Seleccionar archivo"}</span>
                <input
                  type="file"
                  accept={accept}
                  disabled={saving || uploaded.includes(platform)}
                  onChange={(e) => setFiles((f) => ({ ...f, [platform]: e.target.files?.[0] }))}
                />
              </label>
              {progress[platform] !== undefined && (
                <span className="admin-field__hint">{uploaded.includes(platform) ? "Subido" : `Subiendo ${progress[platform]}%`}</span>
              )}
            </div>
          </div>
        ))}
        <div className="sp-field">
          <label htmlFor="np-notes">Novedades</label>
          <div className="sp-field__control admin-field">
            <textarea
              id="np-notes"
              rows={4}
              placeholder="Primera versión"
              value={changelog}
              disabled={draft !== null}
              onChange={(e) => setChangelog(e.target.value)}
            />
          </div>
        </div>
      </div>
      {error && (
        <p className="mini-modal__error" role="alert">
          {error}
        </p>
      )}
    </MiniModal>
  );
}
