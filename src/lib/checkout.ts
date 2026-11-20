import { supabase } from "./supabase";

/* Datos del checkout: el plan elegido, la vista previa del cupón y los pedidos gratis (cupón del 100 %).
   El total siempre lo calcula la base (checkout_quote): el navegador nunca decide el monto.
   El cobro con tarjeta se conecta aquí cuando haya pasarela; su servidor registra el pago con confirm_purchase. */

export const PRODUCT_SLUG = "hyro-visuals";

export type CheckoutPlan = {
  productName: string;
  planId: string;
  price: number;
  keys: number;
};

export type CouponPreview = { code: string; discount: number; amount: number };

/** Idioma que tiene la página (lo pone prefs.tsx en <html lang>): el del correo de confirmación. */
const pageLang = (): "es" | "en" => (document.documentElement.lang === "en" ? "en" : "es");

function db() {
  if (!supabase) throw new Error("Falta configurar Supabase.");
  return supabase;
}

export async function fetchCheckoutPlan(planId: string): Promise<CheckoutPlan | null> {
  const sb = db();
  const { data: product } = await sb.from("products").select("id, name").eq("slug", PRODUCT_SLUG).maybeSingle();
  if (!product) return null;
  const { data: plan } = await sb
    .from("plans")
    .select("id, price_usd, license_count")
    .eq("product_id", product.id)
    .eq("id", planId)
    .eq("active", true)
    .maybeSingle();
  if (!plan) return null;
  return { productName: product.name, planId: plan.id, price: Number(plan.price_usd), keys: Number(plan.license_count) };
}

/** Todos los planes activos del producto (del más barato al más caro): para cambiar de licencia en el checkout. */
export async function fetchCheckoutPlans(): Promise<CheckoutPlan[]> {
  const sb = db();
  const { data: product } = await sb.from("products").select("id, name").eq("slug", PRODUCT_SLUG).maybeSingle();
  if (!product) return [];
  const { data } = await sb.from("plans").select("id, price_usd, license_count").eq("product_id", product.id).eq("active", true);
  return (data ?? [])
    .map((p) => ({ productName: product.name, planId: p.id, price: Number(p.price_usd), keys: Number(p.license_count) }))
    .sort((a, b) => a.price - b.price);
}

type Quote = { amount: number; discount: number; code: string | null; error?: string };

export async function previewCoupon(planId: string, code: string): Promise<CouponPreview> {
  const { data, error } = await db().rpc("checkout_quote", { p_product_slug: PRODUCT_SLUG, p_plan_id: planId, p_coupon: code });
  const quote = data as Quote | null;
  if (error || !quote) throw new Error("");
  if (quote.error || !quote.code) throw new Error(quote.error ?? "Cupón inválido");
  return { code: quote.code, discount: Number(quote.discount), amount: Number(quote.amount) };
}

/** Pedido de $0 con un cupón del 100 %: queda pagado y las claves aparecen en la biblioteca. */
export async function claimFreeOrder(planId: string, couponCode: string): Promise<string> {
  const { data, error } = await db().rpc("checkout_claim_free", { p_product_slug: PRODUCT_SLUG, p_plan_id: planId, p_coupon: couponCode });
  const result = data as { purchaseId?: string; error?: string } | null;
  if (error || !result?.purchaseId) throw new Error(result?.error && result.error !== "payment_required" ? result.error : "");
  // aviso por correo al equipo (si falla, el pedido ya quedó hecho)
  db()
    .functions.invoke("sale-notify", { body: { purchaseId: result.purchaseId, lang: pageLang() } })
    .catch(() => undefined);
  return result.purchaseId;
}

/* PayPal: el servidor (función paypal) crea el pedido con el total de checkout_quote y, al aprobarlo el cliente,
   lo cobra, comprueba el monto y lo registra; las claves salen del trigger de compras. */

export class PaymentError extends Error {
  code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.code = code;
  }
}

/** Llama a una Edge Function y devuelve su JSON; si responde con error, lanza su mensaje. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().functions.invoke<T & { error?: string; code?: string }>(name, { body });
  if (error) {
    let detail: { error?: string; code?: string } | null = null;
    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === "function") detail = await response.json().catch(() => null);
    throw new PaymentError(detail?.error ?? "", detail?.code ?? null);
  }
  if (!data || data.error) throw new PaymentError(data?.error ?? "", data?.code ?? null);
  return data;
}

export type PaypalConfig = { enabled: boolean; clientId: string | null; env: "live" | "sandbox" };

export function fetchPaypalConfig(): Promise<PaypalConfig> {
  return callFunction<PaypalConfig>("paypal", { action: "config" });
}

export async function createPaypalOrder(planId: string, coupon: string | null): Promise<string> {
  const { orderId } = await callFunction<{ orderId: string }>("paypal", { action: "create", productSlug: PRODUCT_SLUG, planId, coupon });
  return orderId;
}

export async function capturePaypalOrder(orderId: string): Promise<string> {
  // el idioma de la página: en ese idioma sale el correo de confirmación de la compra
  const { purchaseId } = await callFunction<{ purchaseId: string }>("paypal", { action: "capture", orderId, lang: pageLang() });
  return purchaseId;
}
