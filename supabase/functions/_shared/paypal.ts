// Cliente mínimo de la API REST de PayPal (Orders v2), sin SDK.
// Dos juegos de credenciales (secretos de Edge Functions), y el panel admin elige cuál se usa (payment_methods.mode):
//   live     PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET                  cobros reales
//   sandbox  PAYPAL_SANDBOX_CLIENT_ID / PAYPAL_SANDBOX_CLIENT_SECRET  pruebas, sin dinero de verdad

export type PaypalMode = "live" | "sandbox";

export function asMode(value: unknown): PaypalMode {
  return value === "sandbox" ? "sandbox" : "live";
}

function creds(mode: PaypalMode) {
  return mode === "sandbox"
    ? { id: Deno.env.get("PAYPAL_SANDBOX_CLIENT_ID") ?? "", secret: Deno.env.get("PAYPAL_SANDBOX_CLIENT_SECRET") ?? "" }
    : { id: Deno.env.get("PAYPAL_CLIENT_ID") ?? "", secret: Deno.env.get("PAYPAL_CLIENT_SECRET") ?? "" };
}

export function paypalClientId(mode: PaypalMode): string {
  return creds(mode).id;
}

export function paypalConfigured(mode: PaypalMode): boolean {
  const c = creds(mode);
  return Boolean(c.id && c.secret);
}

function baseUrl(mode: PaypalMode) {
  return mode === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

const cachedTokens: Partial<Record<PaypalMode, { value: string; expiresAt: number }>> = {};

export async function accessToken(mode: PaypalMode): Promise<string> {
  const cached = cachedTokens[mode];
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  const c = creds(mode);
  const res = await fetch(`${baseUrl(mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: { authorization: `Basic ${btoa(`${c.id}:${c.secret}`)}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal rechazó las credenciales (${res.status})`);
  const data = await res.json();
  cachedTokens[mode] = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in ?? 0) * 1000 };
  return data.access_token;
}

export type PaypalResponse = { ok: boolean; status: number; data: any };

export async function paypalRequest(
  mode: PaypalMode,
  path: string,
  init: { method: string; body?: unknown; requestId?: string },
): Promise<PaypalResponse> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${await accessToken(mode)}`,
    "content-type": "application/json",
    prefer: "return=representation",
  };
  if (init.requestId) headers["paypal-request-id"] = init.requestId;
  const res = await fetch(`${baseUrl(mode)}${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

/** Código del primer problema que informa PayPal (p. ej. INSTRUMENT_DECLINED, ORDER_ALREADY_CAPTURED). */
export function paypalIssue(data: any): string | null {
  return data?.details?.[0]?.issue ?? data?.name ?? null;
}
