// OAuth2 client_credentials contra Wompi El Salvador (docs.wompi.sv).
// App ID -> client_id, API Secret -> client_secret, audience fija "wompi_api".
const TOKEN_URL = "https://id.wompi.sv/connect/token";

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getWompiToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5_000) {
    return cachedToken.value;
  }

  const appId = Deno.env.get("WOMPI_APP_ID");
  const apiSecret = Deno.env.get("WOMPI_API_SECRET");
  if (!appId || !apiSecret) throw new Error("Faltan los secrets WOMPI_APP_ID / WOMPI_API_SECRET");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: appId,
    client_secret: apiSecret,
    audience: "wompi_api",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Wompi auth falló: ${res.status} ${await res.text()}`);

  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

// Proyectos con el nuevo sistema de llaves (sb_publishable_/sb_secret_) exponen
// SUPABASE_PUBLISHABLE_KEYS/SUPABASE_SECRET_KEYS (JSON) además de las variables
// legacy, que pueden estar obsoletas. Se usa la primera llave disponible de cada JSON.
export function firstKeyFrom(jsonEnvVar: string, legacyEnvVar: string): string {
  const raw = Deno.env.get(jsonEnvVar);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const first = Object.values(parsed)[0];
      if (typeof first === "string" && first.length > 0) return first;
    } catch {
      // no era JSON: seguir con el valor legacy
    }
  }
  return Deno.env.get(legacyEnvVar) ?? "";
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
