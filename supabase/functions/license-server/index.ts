// Servidor de licencias de la app de escritorio Hyro Visuals.
//
//   POST /license-server/v1/activate    vincula la clave a este equipo
//   POST /license-server/v1/status      ¿sigue activa en este equipo? (la app pregunta cada 30 s)
//   POST /license-server/v1/deactivate  libera el equipo
//
// Cuerpo: { license_key, device_id, device_token, device_name?, platform?, app_version? }
// La lógica (una clave = un equipo, reembolsos, revocación, límite de intentos) vive en las funciones
// license_* de Postgres (migración 0012), que solo puede ejecutar la llave de servicio.
//
// Cada respuesta activa lleva `offline_receipt`: un comprobante firmado con Ed25519 que ata la clave,
// el token y el equipo. La app NO abre sin un comprobante válido, así que un servidor falso o una
// respuesta alterada no sirven de nada sin la llave privada (secret LICENSE_OFFLINE_PRIVATE_KEY o,
// si no está, el secreto `license_offline_private_key` de Supabase Vault).
import { createClient } from "npm:@supabase/supabase-js@2";
import { firstKeyFrom } from "../_shared/keys.ts";

const PRODUCT = "hyro-visuals";
const OFFLINE_MS = 7 * 24 * 60 * 60 * 1000;
const MODE = "hyro";

const db = createClient(Deno.env.get("SUPABASE_URL")!, firstKeyFrom("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const STATUS: Record<string, number> = {
  invalid_request: 400,
  invalid_license: 403,
  device_not_authorized: 403,
  already_bound: 409,
  device_occupied: 409,
  rate_limited: 429,
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
const fail = (code: string) => reply(STATUS[code] ?? 400, { error: code });

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

let signingKey: Promise<CryptoKey> | null = null;
function getSigningKey(): Promise<CryptoKey> {
  signingKey ??= (async () => {
    let der = Deno.env.get("LICENSE_OFFLINE_PRIVATE_KEY")?.trim();
    if (!der) {
      const { data, error } = await db.rpc("license_signing_key");
      if (error) throw new Error("license_signing_key: " + error.message);
      der = typeof data === "string" ? data.trim() : "";
    }
    if (!der) throw new Error("Falta la llave privada de licencias");
    return crypto.subtle.importKey("pkcs8", unb64(der), { name: "Ed25519" }, false, ["sign"]);
  })().catch((error) => {
    signingKey = null; // reintentar en la próxima petición
    throw error;
  });
  return signingKey;
}

async function receipt(licenseKey: string, deviceId: string, deviceToken: string) {
  const issuedAt = Date.now();
  const claims = {
    version: 1,
    product: PRODUCT,
    device: deviceId,
    // Debe coincidir con la app: sha256(JSON.stringify([license_key, device_token])) con la clave tal como la envió.
    binding: await sha256Hex(JSON.stringify([licenseKey, deviceToken])),
    issuedAt,
    expiresAt: issuedAt + OFFLINE_MS,
  };
  const payload = new TextEncoder().encode(JSON.stringify(claims));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, await getSigningKey(), payload));
  return { payload: b64(payload), signature: b64(signature) };
}

const clip = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const action = new URL(req.url).pathname.match(/\/v1\/(activate|status|deactivate)\/?$/)?.[1];
  if (!action) return reply(404, { error: "not_found" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request");
  }
  const key = body.license_key, device = body.device_id, token = body.device_token;
  if (typeof key !== "string" || !key.trim() || key.length > 100) return fail("invalid_request");
  if (typeof device !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(device)) return fail("invalid_request");
  if (typeof token !== "string" || !/^[a-f0-9]{32,128}$/i.test(token)) return fail("invalid_request");

  const tokenHash = await sha256Hex(token);
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  try {
    // Sin llave de firma no se activa nada: mejor fallar antes de tocar la base.
    if (action !== "deactivate") await getSigningKey();

    let result: { active?: boolean; error?: string } | null = null;
    let rpcError: { message: string } | null = null;
    if (action === "activate") {
      ({ data: result, error: rpcError } = await db.rpc("license_activate", {
        p_key: key,
        p_device: device,
        p_token_hash: tokenHash,
        p_product: PRODUCT,
        p_device_name: clip(body.device_name, 80),
        p_platform: clip(body.platform, 20),
        p_version: clip(body.app_version, 40),
        p_ip: ip,
      }));
    } else if (action === "status") {
      ({ data: result, error: rpcError } = await db.rpc("license_status", {
        p_key: key,
        p_device: device,
        p_token_hash: tokenHash,
        p_product: PRODUCT,
        p_version: clip(body.app_version, 40),
      }));
    } else {
      ({ data: result, error: rpcError } = await db.rpc("license_deactivate", {
        p_key: key,
        p_device: device,
        p_token_hash: tokenHash,
        p_product: PRODUCT,
      }));
    }
    if (rpcError || !result) throw new Error(rpcError?.message ?? "respuesta vacía");
    if (result.error) return fail(result.error);

    if (action === "deactivate") return reply(200, { mode: MODE, active: false });
    return reply(200, { mode: MODE, active: true, offline_receipt: await receipt(key, device, token) });
  } catch (error) {
    console.error("license-server", action, error instanceof Error ? error.message : error);
    return reply(503, { error: "server_unavailable" });
  }
});
