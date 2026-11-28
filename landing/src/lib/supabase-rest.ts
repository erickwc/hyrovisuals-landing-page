/* Datos públicos de la landing desde Supabase, sin cargar supabase-js: fetch directo a la API REST con la clave
   pública (los permisos los ponen las políticas RLS). Se usa en el build (HTML ya con precios y reseñas) y en el
   navegador (para refrescarlos sin volver a publicar). */

const SB_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SB_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const PRODUCT_SLUG = 'hyro-visuals';
/** Versión vigente de los documentos legales (la misma de la app). */
export const LEGAL_VERSION = '2026-11-23';

export type Plan = { id: string; price: number; keys: number };
export type Review = { name: string | null; avatarUrl: string | null; rating: number; text: string };

/** Respaldo mientras llegan los planes reales (mantenerlos iguales a Supabase). */
export const FALLBACK_PLANS: Plan[] = [
  { id: 'personal', price: 20, keys: 1 },
  { id: 'equipos', price: 50, keys: 3 },
];

async function rest<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  if (!SB_URL || !SB_KEY) throw new Error('Falta configurar Supabase (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY)');
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) },
  });
  if (!res.ok) throw new Error(`Supabase respondió ${res.status}`);
  const body = await res.text();
  return body ? (JSON.parse(body) as T) : null;
}

/** Planes activos del producto, del más barato al más caro (los mismos del panel admin y del checkout). */
export async function fetchPlans(): Promise<Plan[]> {
  const products = await rest<{ id: string }[]>(`products?select=id&slug=eq.${PRODUCT_SLUG}`);
  const product = products?.[0];
  if (!product) return [];
  const rows = await rest<{ id: string; price_usd: number | string; license_count: number }[]>(
    `plans?select=id,price_usd,license_count&active=eq.true&product_id=eq.${product.id}&order=price_usd.asc`,
  );
  return (rows ?? []).map((r) => ({ id: r.id, price: Number(r.price_usd), keys: Number(r.license_count) || 1 })).filter((p) => p.price > 0);
}

/** Reseñas publicadas por clientes con compra. */
export async function fetchReviews(): Promise<Review[]> {
  const rows = await rest<{ rating: number; comment: string | null; author: string | null; avatar_url: string | null }[]>('rpc/public_reviews', {
    method: 'POST',
    body: '{}',
  });
  return (rows ?? [])
    .filter((r) => r.comment?.trim())
    .map((r) => ({
      name: r.author,
      avatarUrl: r.avatar_url && /^https:\/\//.test(r.avatar_url) ? r.avatar_url : null,
      rating: Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5))),
      text: r.comment!.trim(),
    }));
}

/** Perfil del cliente con sesión (su foto) y si es administrador. Va con el token de su sesión: las políticas RLS
 *  solo le dejan leer lo suyo. Si el token venció, Supabase responde 401 y se queda lo guardado. */
export async function fetchAccount(userId: string, token: string) {
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const id = encodeURIComponent(userId);
  const [profiles, admins] = await Promise.all([
    rest<{ name: string | null; avatar_url: string | null }[]>(`profiles?select=name,avatar_url&id=eq.${id}`, auth),
    rest<{ user_id: string }[]>(`admin_users?select=user_id&user_id=eq.${id}`, auth).catch(() => null),
  ]);
  return {
    name: profiles?.[0]?.name ?? null,
    avatarUrl: profiles?.[0]?.avatar_url ?? null,
    isAdmin: admins ? admins.length > 0 : null,
  };
}

/** Newsletter: la función valida el correo, guarda la autorización y limita por IP. */
export async function subscribe(email: string, lang: string) {
  await rest('rpc/newsletter_subscribe', {
    method: 'POST',
    body: JSON.stringify({ p_email: email.trim().toLowerCase(), p_lang: lang === 'en' ? 'en' : 'es', p_source: 'landing', p_version: LEGAL_VERSION }),
  });
}
