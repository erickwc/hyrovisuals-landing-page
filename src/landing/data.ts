/* Datos reales de la landing desde Supabase, sin cargar supabase-js (fetch directo a la API REST con la clave
   pública; los permisos los ponen las políticas RLS):
   - Precios de Personal y Equipos: tabla plans del producto hyro-visuals (lo que cobra el checkout).
   - Reseñas publicadas: función public_reviews (nombre corto, foto, estrellas y comentario).
   - Newsletter: inserta en newsletter_subscribers (migración 0011; la API pública solo puede insertar).
   La landing (public/landing/js/app.js) recibe todo por window.HyroLanding. */

type PlanKey = "personal" | "teams";
type LandingReview = { name: string | null; avatarUrl: string | null; rating: number; text: string };
type LandingApi = {
  setPlans: (plans: Partial<Record<PlanKey, { price: number; keys: number }>>) => void;
  setReviews: (list: LandingReview[] | null) => void;
  subscribe: ((email: string, lang: string) => Promise<void>) | null;
};

declare global {
  interface Window {
    HyroLanding?: LandingApi;
  }
}

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PRODUCT_SLUG = "hyro-visuals";
// plan de la landing → id del plan en Supabase (el mismo que usa /checkout?plan=…)
const PLAN_IDS: Record<PlanKey, string> = { personal: "personal", teams: "equipos" };

class RestError extends Error {
  constructor(readonly status: number) {
    super(`Supabase respondió ${status}`);
  }
}

async function rest<T>(path: string, init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> } = {}): Promise<T | null> {
  if (!SB_URL || !SB_KEY) throw new Error("Falta configurar Supabase");
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new RestError(res.status);
  const body = await res.text();
  return body ? (JSON.parse(body) as T) : null;
}

async function loadPlans(api: LandingApi) {
  const products = await rest<{ id: string }[]>(`products?select=id&slug=eq.${PRODUCT_SLUG}`);
  const product = products?.[0];
  if (!product) return;
  const rows = await rest<{ id: string; price_usd: number | string; license_count: number }[]>(
    `plans?select=id,price_usd,license_count&active=eq.true&product_id=eq.${product.id}`,
  );
  const live: Partial<Record<PlanKey, { price: number; keys: number }>> = {};
  for (const key of Object.keys(PLAN_IDS) as PlanKey[]) {
    const row = rows?.find((r) => r.id === PLAN_IDS[key]);
    if (row) live[key] = { price: Number(row.price_usd), keys: Number(row.license_count) };
  }
  api.setPlans(live);
}

async function loadReviews(api: LandingApi) {
  try {
    const rows = await rest<{ rating: number; comment: string | null; author: string | null; avatar_url: string | null }[]>("rpc/public_reviews", {
      method: "POST",
      body: "{}",
    });
    api.setReviews(
      (rows ?? [])
        .filter((r) => r.comment?.trim())
        .map((r) => ({
          name: r.author,
          // solo fotos servidas por https (las de Supabase Storage)
          avatarUrl: r.avatar_url && /^https:\/\//.test(r.avatar_url) ? r.avatar_url : null,
          rating: Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5))),
          text: r.comment!.trim(),
        })),
    );
  } catch (err) {
    api.setReviews(null);
    throw err;
  }
}

async function subscribe(email: string, lang: string) {
  try {
    await rest("newsletter_subscribers", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), lang: lang === "en" ? "en" : "es", source: "landing" }),
    });
  } catch (err) {
    // 409: el correo ya estaba en la lista; para quien se suscribe es lo mismo que «listo»
    if (err instanceof RestError && err.status === 409) return;
    throw err;
  }
}

function connect(api: LandingApi) {
  api.subscribe = subscribe;
  loadPlans(api).catch((err) => console.warn("[Hyro] precios: se quedan los de respaldo", err));
  loadReviews(api).catch((err) => console.warn("[Hyro] reseñas", err));
}

// app.js corre antes que este módulo, pero por si acaso también se espera su aviso
if (window.HyroLanding) connect(window.HyroLanding);
else document.addEventListener("hyro:landing-ready", () => window.HyroLanding && connect(window.HyroLanding), { once: true });

export {};
