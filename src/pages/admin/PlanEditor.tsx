import { useEffect, useState, type KeyboardEvent } from "react";
import { Button } from "../../components/Button";
import { SelectField } from "./SelectField";
import { MiniModal } from "../../components/MiniModal";

export type PlanValues = { id: string; name: string; price: number; keys: number; active?: boolean };

// "Dúos" -> "duos": el id del plan sale de su nombre, sin acentos ni espacios.
export function planId(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Mini ventana para agregar o editar un plan: nombre, precio, claves y, si ya existe, su estado.
export function PlanEditor({
  open,
  initial,
  stored = false,
  takenIds,
  anchor,
  onSave,
  onClose,
}: {
  open: boolean;
  initial?: PlanValues;
  // Plan ya guardado en la base: su nombre (id) queda fijo porque compras y licencias lo usan, y se puede ocultar.
  stored?: boolean;
  takenIds: string[];
  // Elemento junto al que se abre (el lápiz de la fila); sin él, queda debajo del botón que la abre.
  anchor?: HTMLElement | null;
  onSave: (plan: PlanValues) => void | Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [keys, setKeys] = useState("1");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cada vez que se abre, el formulario parte de los datos del plan (o vacío si es nuevo).
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setPrice(initial ? String(initial.price) : "");
    setKeys(initial ? String(initial.keys) : "1");
    setActive(initial?.active ?? true);
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    const id = stored && initial ? initial.id : planId(name);
    const value = Number(price);
    const count = Number(keys);
    if (!id) return setError("Escribe el nombre del plan.");
    if (takenIds.includes(id) && id !== initial?.id) return setError("Ya hay un plan con ese nombre.");
    if (!(value > 0)) return setError("El precio debe ser mayor a 0.");
    if (!(count >= 1)) return setError("Necesita al menos 1 clave.");
    setSaving(true);
    try {
      await onSave({ id, name: name.trim(), price: value, keys: count, active });
    } catch (err) {
      setError((err as { message?: string } | null)?.message ?? "No se pudo guardar el plan.");
      setSaving(false);
    }
  };

  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <MiniModal
      open={open}
      anchor={anchor}
      title={initial ? "Editar plan" : "Nuevo plan"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={submit} loading={saving}>
            {saving ? "Guardando…" : initial ? "Guardar" : "Agregar"}
          </Button>
        </>
      }
    >
      <div className="sp-field">
        <label htmlFor="pe-name">Nombre</label>
        <div className="sp-field__control admin-field">
          <input id="pe-name" placeholder="Personal" value={name} disabled={stored} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} />
        </div>
      </div>
      <div className="sp-field">
        <label htmlFor="pe-price">Precio (USD)</label>
        <div className="sp-field__control admin-field">
          <input id="pe-price" type="number" min={0} placeholder="20" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={onEnter} />
        </div>
      </div>
      <div className="sp-field">
        <label htmlFor="pe-keys">Claves</label>
        <div className="sp-field__control admin-field">
          <input id="pe-keys" type="number" min={1} value={keys} onChange={(e) => setKeys(e.target.value)} onKeyDown={onEnter} />
        </div>
      </div>
      {stored && (
        <div className="sp-field">
          <label>Estado</label>
          <div className="sp-field__control admin-field">
            <SelectField
              value={active ? "on" : "off"}
              onChange={(v) => setActive(v === "on")}
              options={[
                { value: "on", label: "Publicado" },
                { value: "off", label: "Oculto" },
              ]}
            />
          </div>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </MiniModal>
  );
}
