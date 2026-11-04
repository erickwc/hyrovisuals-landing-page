import { useEffect, useState } from "react";
import {
  createVersionDraft,
  installerObjectKey,
  markInstallerUploaded,
  registerInstaller,
  requestUploadUrl,
  uploadFileToR2,
  type InstallerPlatform,
} from "../../lib/admin-data";
import { MiniModal } from "../../components/MiniModal";
import { Button } from "../../components/Button";

const PLATFORMS: { platform: InstallerPlatform; label: string; accept: string }[] = [
  { platform: "windows", label: "Windows", accept: ".exe,.msi" },
  { platform: "macos", label: "macOS", accept: ".dmg,.pkg,.zip" },
];

// Mini ventana "Actualizar instaladores": versión, archivos y novedades. Guarda la versión como borrador
// y sube cada archivo a R2; mientras sube no se puede cerrar, para no dejar la versión a medias.
export function InstallerUploader({
  open,
  productId,
  productSlug,
  onClose,
  onUploaded,
}: {
  open: boolean;
  productId: string;
  productSlug: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [version, setVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [files, setFiles] = useState<Partial<Record<InstallerPlatform, File>>>({});
  const [progress, setProgress] = useState<Partial<Record<InstallerPlatform, number>>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada vez que se abre, el formulario empieza vacío.
  useEffect(() => {
    if (!open) return;
    setVersion("");
    setChangelog("");
    setFiles({});
    setProgress({});
    setError(null);
  }, [open]);

  const canUpload = version.trim().length > 0 && PLATFORMS.some((p) => files[p.platform]) && !uploading;

  const onUpload = async () => {
    if (!canUpload) return;
    setUploading(true);
    setError(null);
    try {
      const draft = await createVersionDraft(productId, version.trim(), changelog);
      for (const { platform } of PLATFORMS) {
        const file = files[platform];
        if (!file) continue;
        const key = installerObjectKey(productSlug, draft.version, platform, file.name);
        await registerInstaller(draft.id, platform, key);
        const uploadUrl = await requestUploadUrl(key);
        await uploadFileToR2(uploadUrl, file, (pct) => setProgress((p) => ({ ...p, [platform]: pct })));
        await markInstallerUploaded(draft.id, platform, file.size);
      }
      onClose();
      onUploaded();
    } catch (err) {
      setError((err as { message?: string } | null)?.message ?? "No se pudo completar la subida.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <MiniModal
      open={open}
      wide
      locked={uploading}
      title="Actualizar instaladores"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={uploading}>
            Cancelar
          </Button>
          <Button size="sm" loading={uploading} disabled={!canUpload} onClick={onUpload}>
            {uploading ? "Subiendo…" : "Subir instaladores"}
          </Button>
        </>
      }
    >
      <div className="sp-field">
        <label htmlFor="iu-version">Versión</label>
        <div className="sp-field__control admin-field">
          <input id="iu-version" placeholder="1.5.0" value={version} disabled={uploading} onChange={(e) => setVersion(e.target.value)} />
        </div>
      </div>
      {PLATFORMS.map(({ platform, label, accept }) => (
        <div className="sp-field" key={platform}>
          <label>{label}</label>
          <div className="sp-field__control admin-field">
            <input type="file" accept={accept} disabled={uploading} onChange={(e) => setFiles((f) => ({ ...f, [platform]: e.target.files?.[0] }))} />
            {progress[platform] !== undefined && <span className="admin-field__hint">Subiendo {progress[platform]}%</span>}
          </div>
        </div>
      ))}
      <div className="sp-field">
        <label htmlFor="iu-notes">Novedades</label>
        <div className="sp-field__control admin-field">
          <textarea
            id="iu-notes"
            rows={4}
            placeholder="Qué cambió en esta versión…"
            value={changelog}
            disabled={uploading}
            onChange={(e) => setChangelog(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
    </MiniModal>
  );
}
