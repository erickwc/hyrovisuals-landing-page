// Aviso por correo de una venta que no pasó por PayPal (pedido gratis con cupón del 100 %) y confirmación de esa
// compra al cliente, y el correo de prueba del panel admin.
//   { purchaseId }  el dueño de la compra (o un admin) pide el aviso; sale una sola vez por compra
//   { test: true }  solo admins: envía un correo de prueba a los destinatarios configurados
import { createClient } from "npm:@supabase/supabase-js@2";
import { firstKeyFrom } from "../_shared/keys.ts";
import { notifySale, sendTestEmail } from "../_shared/sale-email.ts";
import { sendPurchaseReceipt } from "../_shared/receipt-email.ts";

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
    const url = Deno.env.get("SUPABASE_URL")!;
    const publishableKey = firstKeyFrom("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const secretKey = firstKeyFrom("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");

    const authHeader = req.headers.get("authorization") ?? "";
    const userRes = await fetch(`${url}/auth/v1/user`, { headers: { authorization: authHeader, apikey: publishableKey } });
    if (!userRes.ok) return json({ error: "No autenticado" }, 401);
    const user = await userRes.json();
    if (!user?.id) return json({ error: "No autenticado" }, 401);

    const asUser = createClient(url, publishableKey, { global: { headers: { authorization: authHeader } } });
    const admin = createClient(url, secretKey);
    const body = await req.json().catch(() => ({}));

    if (body.test) {
      const { data: isAdmin } = await asUser.rpc("is_admin");
      if (!isAdmin) return json({ error: "Solo administradores" }, 403);
      try {
        return json({ sentTo: await sendTestEmail(admin) });
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : String(err) }, 400);
      }
    }

    const purchaseId = String(body.purchaseId ?? "");
    // RLS: el cliente solo ve sus propias compras (y un admin, todas)
    const { data: visible } = await asUser.from("purchases").select("id").eq("id", purchaseId).maybeSingle();
    if (!visible) return json({ error: "Compra no encontrada" }, 404);

    const result = await notifySale(admin, purchaseId).catch((err) => {
      console.error("aviso de venta", String(err));
      return "error";
    });
    // confirmación de la compra al cliente, en su idioma (una sola vez por compra)
    const receipt = await sendPurchaseReceipt(admin, purchaseId, body.lang === "en" ? "en" : "es").catch((err) => {
      console.error("correo de compra", String(err));
      return "error";
    });
    return json({ result, receipt });
  } catch (err) {
    console.error("sale-notify", String(err));
    return json({ error: "No se pudo enviar el aviso" }, 500);
  }
});
