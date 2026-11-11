// Devuelve una URL presignada PUT para subir un instalador directo a R2.
// Solo administradores. El frontend ya creó la fila en product_installers (vía RLS)
// antes de llamar esto; esta función no toca la base de datos, solo firma la URL.
import { createClient } from "npm:@supabase/supabase-js@2";
import { firstKeyFrom } from "../_shared/keys.ts";
import { presignR2Url } from "../_shared/r2.ts";

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

    const authHeader = req.headers.get("authorization") ?? "";
    const userRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      headers: { authorization: authHeader, apikey: publishableKey },
    });
    if (!userRes.ok) return json({ error: "No autenticado" }, 401);
    const user = await userRes.json();
    if (!user?.id) return json({ error: "No autenticado" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey);
    const { data: adminRow } = await admin.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adminRow) return json({ error: "Solo administradores" }, 403);

    const { key } = await req.json();
    if (!key || typeof key !== "string") return json({ error: "Falta key" }, 400);

    const uploadUrl = await presignR2Url({ method: "PUT", key, expiresSeconds: 60 * 30 });
    return json({ uploadUrl });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
