// Crea el enlace de pago de Wompi (solo tarjeta) para un pedido. La compra NO se guarda aquí: la crea wompi-webhook
// cuando el pago se aprueba, así no quedan compras «pendientes» por cada intento abandonado.
// Lo llama el checkout de la web, que muestra checkoutUrl dentro de una ventana sobre su propia página.
// Con { preview: true } solo calcula el total con el cupón, sin crear nada (para mostrarlo antes de pagar).

import { createClient } from "npm:@supabase/supabase-js@2";
import { firstKeyFrom, getWompiToken } from "../_shared/wompi.ts";

// A dónde puede volver Wompi al terminar: solo la web propia (y localhost para probar).
const RETURN_HOSTS = ["byhyro.com", "www.byhyro.com", "localhost", "127.0.0.1"];

function safeReturnUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!RETURN_HOSTS.includes(url.hostname) || (!local && url.protocol !== "https:")) return null;
    return url.href;
  } catch {
    return null;
  }
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const publishableKey = firstKeyFrom("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const secretKey = firstKeyFrom("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");

    // supabase-js (vía npm: en Deno) no resuelve bien auth.getUser() en este runtime:
    // la llamada a /auth/v1/user con fetch crudo sí funciona, así que se valida así.
    const authHeader = req.headers.get("authorization") ?? "";
    const userRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      headers: { authorization: authHeader, apikey: publishableKey },
    });
    if (!userRes.ok) return json({ error: "No autenticado" }, 401);
    const user = await userRes.json();
    if (!user?.id) return json({ error: "No autenticado" }, 401);

    const { planId, productSlug, couponCode, returnUrl, preview } = await req.json();
    if (!planId || !productSlug) return json({ error: "Falta planId o productSlug" }, 400);

    // Lecturas/escrituras de compras van con service role: el cliente nunca escribe purchases/licenses directo.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey);

    const { data: product } = await admin.from("products").select("*").eq("slug", productSlug).single();
    if (!product) return json({ error: "Producto inválido" }, 400);

    const { data: plan } = await admin.from("plans").select("*").eq("id", planId).eq("product_id", product.id).eq("active", true).single();
    if (!plan) return json({ error: "Plan inválido" }, 400);

    // El cupón se valida aquí (no se gasta todavía: uses_count solo sube al confirmarse el pago,
    // en wompi-webhook, para que un checkout abandonado no queme un uso real).
    let amount = Number(plan.price_usd);
    let couponId: string | null = null;
    let discountAmount: number | null = null;

    if (couponCode) {
      const { data: coupon } = await admin.from("coupons").select("*").eq("code", String(couponCode).trim().toUpperCase()).maybeSingle();
      if (!coupon) return json({ error: "Cupón inválido" }, 400);
      if (!coupon.active) return json({ error: "Cupón inactivo" }, 400);
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return json({ error: "Cupón vencido" }, 400);
      if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) return json({ error: "Cupón agotado" }, 400);
      if (coupon.product_id && coupon.product_id !== product.id) return json({ error: "Cupón no válido para este producto" }, 400);

      const rawDiscount = coupon.discount_type === "percent" ? (amount * Number(coupon.discount_value)) / 100 : Number(coupon.discount_value);
      discountAmount = Math.round(Math.min(rawDiscount, amount) * 100) / 100;
      amount = Math.round((amount - discountAmount) * 100) / 100;
      couponId = coupon.id;
    }

    if (preview) {
      return json({ amount, discount: discountAmount ?? 0, code: couponCode ? String(couponCode).trim().toUpperCase() : null });
    }

    const redirectUrl = safeReturnUrl(returnUrl) ?? Deno.env.get("WOMPI_REDIRECT_URL") ?? "https://byhyro.com/cuenta/compras";

    // Un cupón de 100% deja el monto en $0: Wompi no acepta enlaces de pago en $0, así que
    // la compra se registra ya pagada (sin pasar por la pasarela) y se genera la licencia ya.
    if (amount <= 0) {
      const { error: freeError } = await admin.from("purchases").insert({
        user_id: user.id,
        product_id: product.id,
        plan_id: plan.id,
        amount: 0,
        coupon_id: couponId,
        discount_amount: discountAmount,
        currency: "USD",
        status: "paid",
        fee_percent: 0,
        fee_amount: 0,
        net_amount: 0,
        paid_at: new Date().toISOString(),
      });
      if (freeError) return json({ error: "No se pudo registrar la compra" }, 500);
      if (couponId) {
        await admin.rpc("redeem_coupon", { p_code: String(couponCode).trim().toUpperCase(), p_product_id: product.id });
      }
      // free: el checkout muestra «Listo, ya es tuyo» sin abrir el formulario de pago
      return json({ checkoutUrl: redirectUrl, free: true });
    }

    // Ya no se guarda una compra «pendiente» por cada intento: los datos del pedido viajan en la referencia del
    // enlace y la compra se crea en wompi-webhook solo cuando Wompi confirma el pago (con su firma verificada).
    // Formato: v2|usuario|producto|plan|cupón|monto|descuento|aleatorio (el aleatorio hace única cada referencia).
    const reference = ["v2", user.id, product.id, plan.id, couponId ?? "", amount, discountAmount ?? "", crypto.randomUUID().slice(0, 8)].join("|");

    const token = await getWompiToken();
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/wompi-webhook`;

    const wompiRes = await fetch("https://api.wompi.sv/EnlacePago", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        identificadorEnlaceComercio: reference,
        monto: amount,
        nombreProducto: `${product.name} · ${plan.id}`,
        // solo tarjeta de crédito o débito: así la página de Wompi muestra directo el formulario de la tarjeta
        formaPago: {
          permitirTarjetaCreditoDebido: true,
          permitirPagoConPuntoAgricola: false,
          permitirPagoEnCuotasAgricola: false,
          permitirPagoEnBitcoin: false,
          permitePagoQuickPay: false,
          permitePagoNequi: false,
        },
        configuracion: {
          urlWebhook: webhookUrl,
          urlRedirect: redirectUrl,
          notificarTransaccionCliente: false,
        },
      }),
    });

    if (!wompiRes.ok) {
      return json({ error: "Wompi rechazó la solicitud", detail: await wompiRes.text() }, 502);
    }

    const link = await wompiRes.json();
    return json({ checkoutUrl: link.urlEnlace });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
