// supabase-js se carga aparte: el aviso de la landing no debe frenar su primera pintura
export type PublicAnnouncement = {
  id: string;
  title: string;
  body: string;
};

export async function fetchActiveAnnouncements(placement: "landing_banner" | "library"): Promise<PublicAnnouncement[]> {
  const { supabase } = await import("./supabase");
  if (!supabase) return [];
  // Filtramos status y vigencia aquí también (no solo confiar en RLS): una cuenta admin
  // tiene permiso de lectura total por su propia policy, así que sin este filtro vería
  // sus propios anuncios en borrador/finalizados como si estuvieran activos.
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, starts_at, ends_at")
    .eq("placement", placement)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? [])
    .filter((a) => (!a.starts_at || a.starts_at <= nowIso) && (!a.ends_at || a.ends_at >= nowIso))
    .map(({ id, title, body }) => ({ id, title, body }));
}
