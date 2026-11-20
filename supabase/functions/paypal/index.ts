// Cobro con PayPal (botones del SDK de PayPal en el checkout).
//
//   config   ¿está PayPal encendido? y el client-id público del modo elegido para cargar los botones
//   status   (solo admins) si las credenciales de cada modo están cargadas y PayPal las acepta, y si el correo está listo
//   create   crea el pedido en PayPal con el total que calcula la base (checkout_quote: precio del plan y cupón)
//   capture  cobra el pedido aprobado, comprueba el monto y lo registra con confirm_purchase
//            (el trigger de compras genera las claves), y avisa de la venta por correo
//
// El modo (real o pruebas) lo elige el panel admin en payment_methods.mode. Cada pedido guarda su modo, y las compras
// de prueba quedan con provider = 'paypal_sandbox' para no mezclarse con las ventas reales.
// El navegador nunca decide el monto: solo dice qué plan y qué cupón.
import { createClient } from "npm:@supabase/supabase-js@2";
import { firstKeyFrom } from "../_shared/keys.ts";
import { accessToken, asMode, paypalClientId, paypalConfigured, paypalIssue, paypalRequest, type PaypalMode } from "../_shared/paypal.ts";
import { emailConfigured, emailFrom, notifySale } from "../_shared/sale-email.ts";
import { sendPurchaseReceipt } from "../_shared/receipt-email.ts";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "content-type": "application/json" } });
}

const DEFAULT_PRODUCT = "hyro-visuals";

async function checkCredentials(mode: PaypalMode): Promise<{ configured: boolean; credentialsOk: boolean | null }> {
  if (!paypalConfigured(mode)) return { configured: false, credentialsOk: null };
  try {
    await accessToken(mode);
    return { configured: true, credentialsOk: true };
  } catch (err) {
    console.error(`paypal credenciales ${mode}`, String(err));
    return { configured: true, credentialsOk: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const publishableKey = firstKeyFrom("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const secretKey = firstKeyFrom("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");

    const authHeader = req.headers.get("authorization") ?? "";
    const userRes = await fetch(`${url}/auth/v1/user`, { headers: { authorization: authHeader, apikey: publishableKey } });
    if (!userRes.ok) return json({ error: "No autenticado" }, 401);
    const user = await userRes.json();
    if (!user?.id) return json({ error: "No autenticado" }, 401);

    // como el usuario (para checkout_quote e is_admin) y con la llave de servicio (pedidos y compras)
    const asUser = createClient(url, publishableKey, { global: { headers: { authorization: authHeader } } });
    const admin = createClient(url, secretKey);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    const { data: method } = await admin.from("payment_methods").select("enabled, mode").eq("provider", "paypal").maybeSingle();
    const mode = asMode(method?.mode);
    const enabled = Boolean(method?.enabled) && paypalConfigured(mode);

    if (action === "config") {
      return json({ enabled, clientId: enabled ? paypalClientId(mode) : null, env: mode });
    }

    if (action === "status") {
      const { data: isAdmin } = await asUser.rpc("is_admin");
      if (!isAdmin) return json({ error: "Solo administradores" }, 403);
      const [live, sandbox] = await Promise.all([checkCredentials("live"), checkCredentials("sandbox")]);
      const current = mode === "sandbox" ? sandbox : live;
      return json({ ...current, env: mode, live, sandbox, emailConfigured: emailConfigured(), emailFrom: emailFrom() });
    }

    if (action === "create") {
      if (!enabled) return json({ error: "PayPal no está disponible en este momento." }, 409);
      const productSlug = String(body.productSlug ?? DEFAULT_PRODUCT);
      const planId = String(body.planId ?? "");
      const coupon = body.coupon ? String(body.coupon) : null;

      const { data: quote, error: quoteError } = await asUser.rpc("checkout_quote", {
        p_product_slug: productSlug,
        p_plan_id: planId,
        p_coupon: coupon,
      });
      if (quoteError || !quote) return json({ error: "No pudimos calcular el total." }, 400);
      if (quote.error) return json({ error: quote.error }, 400);
      const amount = Number(quote.amount);
      if (!(amount > 0)) return json({ error: "Este pedido no necesita pago." }, 400);

      const { data: product } = await admin.from("products").select("name").eq("id", quote.productId).maybeSingle();
      const productName = product?.name ?? "Hyro";

      const created = await paypalRequest(mode, "/v2/checkout/orders", {
        method: "POST",
        body: {
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: `${productSlug}:${planId}`.slice(0, 256),
              description: `${productName} — licencia ${planId}`.slice(0, 127),
              custom_id: user.id,
              amount: { currency_code: "USD", value: amount.toFixed(2) },
            },
          ],
          application_context: { brand_name: "Hyro Visuals", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
        },
      });
      if (!created.ok || !created.data?.id) {
        console.error("paypal create", mode, created.status, JSON.stringify(created.data));
        return json({ error: "PayPal no pudo crear el pedido. Intenta otra vez." }, 502);
      }

      const { error: insertError } = await admin.from("paypal_orders").insert({
        id: created.data.id,
        user_id: user.id,
        product_id: quote.productId,
        plan_id: quote.planId,
        amount,
        discount: Number(quote.discount ?? 0),
        coupon_id: quote.couponId ?? null,
        mode,
      });
      if (insertError) throw insertError;
      return json({ orderId: created.data.id });
    }

    if (action === "capture") {
      const orderId = String(body.orderId ?? "");
      const { data: order } = await admin.from("paypal_orders").select("*").eq("id", orderId).eq("user_id", user.id).maybeSingle();
      if (!order) return json({ error: "Pedido no encontrado." }, 404);
      if (order.status === "completed" && order.purchase_id) return json({ purchaseId: order.purchase_id });
      // el pedido se cobra en el modo en que se creó, aunque el panel lo haya cambiado mientras tanto
      const orderMode = asMode(order.mode);

      let result = await paypalRequest(orderMode, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: "POST",
        requestId: `capture-${orderId}`,
      });
      if (!result.ok) {
        const issue = paypalIssue(result.data);
        if (issue === "ORDER_ALREADY_CAPTURED") {
          result = await paypalRequest(orderMode, `/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
        } else {
          console.error("paypal capture", orderMode, result.status, JSON.stringify(result.data));
          // tarjeta rechazada: el botón de PayPal deja elegir otra forma de pago
          if (issue === "INSTRUMENT_DECLINED") return json({ error: "PayPal rechazó esa forma de pago. Elige otra.", code: issue }, 402);
          return json({ error: "PayPal no pudo completar el cobro.", code: issue }, 502);
        }
      }

      const capture = result.data?.purchase_units?.[0]?.payments?.captures?.[0];
      if (result.data?.status !== "COMPLETED" || capture?.status !== "COMPLETED") {
        console.error("paypal capture not completed", JSON.stringify(result.data));
        if (capture?.status === "PENDING") {
          return json({ error: "PayPal está revisando este pago. Te avisaremos por correo cuando se confirme.", code: "PENDING" }, 202);
        }
        return json({ error: "El pago no se completó." }, 402);
      }

      const paid = Number(capture.amount?.value);
      if (capture.amount?.currency_code !== "USD" || Math.abs(paid - Number(order.amount)) > 0.001) {
        // nunca debería pasar: el monto lo fija el servidor al crear el pedido
        console.error("paypal amount mismatch", order.id, capture.amount);
        await admin.from("paypal_orders").update({ status: "failed" }).eq("id", order.id);
        return json({ error: "El monto cobrado no coincide con el pedido. Escríbenos para revisarlo." }, 409);
      }

      const { data: purchaseId, error: confirmError } = await admin.rpc("confirm_purchase", {
        p_user_id: order.user_id,
        p_product_id: order.product_id,
        p_plan_id: order.plan_id,
        p_amount: paid,
        p_provider: orderMode === "sandbox" ? "paypal_sandbox" : "paypal",
        p_provider_ref: capture.id,
        p_discount: Number(order.discount) || null,
        p_coupon_id: order.coupon_id,
        p_currency: "USD",
      });
      if (confirmError || !purchaseId) throw confirmError ?? new Error("confirm_purchase sin resultado");

      // la comisión real que cobró PayPal en esta venta
      const fee = Number(capture.seller_receivable_breakdown?.paypal_fee?.value);
      if (fee > 0) {
        await admin
          .from("purchases")
          .update({
            fee_amount: fee,
            net_amount: Math.round((paid - fee) * 100) / 100,
            fee_percent: Math.round((fee / paid) * 10000) / 100,
          })
          .eq("id", purchaseId);
      }

      await admin.from("paypal_orders").update({ status: "completed", purchase_id: purchaseId, completed_at: new Date().toISOString() }).eq("id", order.id);

      try {
        await notifySale(admin, purchaseId);
      } catch (err) {
        console.error("aviso de venta", String(err));
      }
      // confirmación de la compra al cliente, en su idioma
      try {
        await sendPurchaseReceipt(admin, purchaseId, body.lang === "en" ? "en" : "es");
      } catch (err) {
        console.error("correo de compra", String(err));
      }
      return json({ purchaseId });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (err) {
    console.error("paypal", String(err));
    return json({ error: "Error del servidor. Intenta otra vez." }, 500);
  }
});
