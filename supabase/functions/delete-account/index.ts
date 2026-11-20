// Elimina la cuenta de quien la pide (botón «Eliminar mi cuenta» en /cuenta), con todo lo suyo:
//   cuenta y sesiones, perfil (nombre, foto), foto en Storage, reseñas, newsletter y lecturas de versiones.
// Se conserva, sin usarla para nada más, la prueba de cada compra durante 10 años (Ley de Protección al
// Consumidor, art. 21-B c): compras, licencias y pedidos de PayPal quedan sin usuario (migración 0018), con una
// copia del correo y el nombre del comprador. El registro de autorizaciones (legal_consents) también se conserva.
// Cuerpo: { confirm: "ELIMINAR" }. Los administradores no pueden borrarse desde aquí.
import { createClient } from "npm:@supabase/supabase-js@2";
import { firstKeyFrom } from "../_shared/keys.ts";

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

    // quién lo pide: solo se puede borrar la cuenta propia
    const authHeader = req.headers.get("authorization") ?? "";
    const userRes = await fetch(`${url}/auth/v1/user`, { headers: { authorization: authHeader, apikey: publishableKey } });
    if (!userRes.ok) return json({ error: "No autenticado" }, 401);
    const user = await userRes.json();
    if (!user?.id) return json({ error: "No autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    if (String(body.confirm ?? "").trim().toUpperCase() !== "ELIMINAR") return json({ error: "confirm_required" }, 400);

    const admin = createClient(url, secretKey);
    const uid: string = user.id;
    const email = String(user.email ?? "").toLowerCase();

    const { data: isAdmin } = await admin.from("admin_users").select("user_id").eq("user_id", uid).maybeSingle();
    if (isAdmin) return json({ error: "admin_account" }, 403);

    // 1. copia del comprador en sus compras (la prueba que la ley obliga a guardar)
    const { data: profile } = await admin.from("profiles").select("name").eq("id", uid).maybeSingle();
    const { error: snapshotError } = await admin
      .from("purchases")
      .update({ buyer_email: email || null, buyer_name: profile?.name ?? null, account_deleted_at: new Date().toISOString() })
      .eq("user_id", uid);
    if (snapshotError) throw snapshotError;

    // 2. lo que no cuelga del usuario: newsletter (por correo) y la foto en Storage
    if (email) await admin.from("newsletter_subscribers").delete().eq("email", email);
    const { data: files } = await admin.storage.from("avatars").list(uid);
    if (files?.length) await admin.storage.from("avatars").remove(files.map((f) => `${uid}/${f.name}`));

    // 3. el usuario: arrastra perfil, reseñas, sesiones y lecturas; compras y licencias quedan sin usuario
    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
    if (deleteError) throw deleteError;

    return json({ deleted: true });
  } catch (err) {
    console.error("delete-account", String(err));
    return json({ error: "No se pudo eliminar la cuenta. Intenta otra vez." }, 500);
  }
});
