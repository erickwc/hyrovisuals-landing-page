// Reseñas reales de la web: las que dejan los clientes desde su biblioteca (solo con compra pagada).
// Las ocultas por un admin no llegan. El nombre viene corto ("Erick C.") desde la función public_reviews.
// supabase-js se carga aparte, cuando la sección pide las reseñas, para no hacer más pesada la landing.

export type Review = {
  id: string;
  /** Primer nombre e inicial del apellido; null si el cliente no tiene nombre en su perfil. */
  name: string | null;
  avatarUrl: string | null;
  rating: number;
  text: string;
  date: string; // ISO
};

export async function fetchReviews(): Promise<Review[]> {
  const { supabase } = await import("./supabase");
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("public_reviews");
  if (error) throw error;
  return ((data ?? []) as { id: string; rating: number; comment: string; created_at: string; author: string | null; avatar_url: string | null }[]).map((row) => ({
    id: row.id,
    name: row.author,
    avatarUrl: row.avatar_url,
    rating: row.rating,
    text: row.comment,
    date: row.created_at,
  }));
}

export function summarize(list: Review[]) {
  const count = list.length;
  const dist = [5, 4, 3, 2, 1].map((s) => list.filter((r) => r.rating === s).length);
  const avg = count ? list.reduce((s, r) => s + r.rating, 0) / count : 0;
  return { count, avg, dist };
}
