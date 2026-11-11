// Devuelve una URL de descarga presignada (de corta duración) para el instalador
// de la versión publicada de un producto, solo si el usuario tiene una licencia de ese producto.
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

    const { productId, platform } = await req.json();
    if (!productId || (platform !== "windows" && platform !== "macos")) return json({ error: "Falta productId o platform inválida" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey);

    // Un plan puede traer varias claves (varias filas en licenses para el mismo producto),
    // así que no se puede usar maybeSingle() aquí: fallaría al encontrar más de una fila.
    const { data: licenses } = await admin.from("licenses").select("id").eq("user_id", user.id).eq("product_id", productId).eq("status", "active").limit(1);
    if (!licenses || licenses.length === 0) return json({ error: "No tienes una licencia de este producto" }, 403);

    const { data: version } = await admin.from("product_versions").select("id").eq("product_id", productId).eq("status", "published").maybeSingle();
    if (!version) return json({ error: "Este producto no tiene una versión publicada" }, 404);

    const { data: installer } = await admin
      .from("product_installers")
      .select("object_key")
      .eq("version_id", version.id)
      .eq("platform", platform)
      .eq("status", "uploaded")
      .maybeSingle();
    if (!installer) return json({ error: "No hay instalador para esa plataforma en esta versión" }, 404);

    const downloadUrl = await presignR2Url({ method: "GET", key: installer.object_key, expiresSeconds: 5 * 60 });
    return json({ downloadUrl });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
