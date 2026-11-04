import { supabase } from "./supabase";

/* Datos del checkout: el plan elegido, la vista previa del cupón y el inicio del pago con Wompi.
   El precio final siempre lo calcula la función wompi-create-link (el cliente nunca decide el monto). */

export const PRODUCT_SLUG = "hyro-visuals";

export type CheckoutPlan = {
  productName: string;
  planId: string;
  price: number;
  keys: number;
};

export type CouponPreview = { code: string; discount: number; amount: number };

export type PaymentStart = { kind: "redirect"; url: string } | { kind: "free" };

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

// Mensaje de error que devuelve la función (cupón vencido, agotado…) o null si no trae uno.
async function functionError(error: unknown): Promise<string | null> {
  const context = (error as { context?: Response } | null)?.context;
  if (!context) return null;
  try {
    const body = await context.json();
    return typeof body?.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

export async function previewCoupon(planId: string, code: string): Promise<CouponPreview> {
  const { data, error } = await db().functions.invoke<{ amount: number; discount: number; code: string }>("wompi-create-link", {
    body: { preview: true, planId, productSlug: PRODUCT_SLUG, couponCode: code },
  });
  if (error || !data) throw new Error((await functionError(error)) ?? "Cupón inválido");
  return { code: data.code, discount: Number(data.discount), amount: Number(data.amount) };
}

/** Crea la compra y el enlace de Wompi (solo tarjeta). Al terminar, Wompi vuelve a `returnUrl`. */
export async function startPayment(planId: string, couponCode: string | null, returnUrl: string): Promise<PaymentStart> {
  const { data, error } = await db().functions.invoke<{ checkoutUrl?: string; free?: boolean }>("wompi-create-link", {
    body: { planId, productSlug: PRODUCT_SLUG, couponCode: couponCode ?? undefined, returnUrl },
  });
  if (error) throw new Error((await functionError(error)) ?? "");
  if (data?.free) return { kind: "free" };
  if (!data?.checkoutUrl) throw new Error("");
  return { kind: "redirect", url: data.checkoutUrl };
}
