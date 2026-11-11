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
  return result.purchaseId;
}
