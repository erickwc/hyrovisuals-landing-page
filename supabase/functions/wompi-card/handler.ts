// Card payloads are transient: never log, persist, cache or return provider errors/bodies.
export interface Env {
  WOMPI_CARD_ENABLED?: string;
  WOMPI_CARD_LIVE_ENABLED?: string;
  WOMPI_MODE?: string;
  WOMPI_CARD_PRICE_CENTS?: string;
  WOMPI_APP_ID?: string;
  WOMPI_API_SECRET?: string;
  HYRO_SITE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  HYRO_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  LICENSE_ENCRYPTION_KEY?: string;
}
type Obj = Record<string, any>;
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const encoder = new TextEncoder();
const hex = (v: ArrayBuffer | Uint8Array) => [...new Uint8Array(v)].map(b => b.toString(16).padStart(2, '0')).join('');
class Failure extends Error {
  status: number; code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}
export function challengeUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Failure(502, 'verification_pending');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
    !(url.hostname === 'wompi.sv' || url.hostname.endsWith('.wompi.sv')))
    throw new Failure(502, 'verification_pending');
  return url.href;
}
export function validatePayment(body: Obj, now = new Date()): {
  tarjetaCreditoDebido: { numeroTarjeta: string; cvv: string; mesVencimiento: number; anioVencimiento: number };
  [key: string]: unknown;
} {
  const card = body.card;
  const billing = body.billing;
  if (!card || !billing) throw new Failure(422, 'invalid_details');
  const number = typeof card.number === 'string' ? card.number.replace(/ /g, '') : '';
  let sum = 0;
  for (let i = number.length - 1, double = false; i >= 0; i--, double = !double) {
    let digit = Number(number[i]);
    if (double) digit *= 2;
    sum += digit > 9 ? digit - 9 : digit;
  }
  if (!/^[124-9][0-9]{12,18}$/.test(number) || sum % 10 !== 0 || typeof card.cvv !== 'string' || !/^[0-9]{3}$/.test(card.cvv) ||
    !Number.isInteger(card.month) || card.month < 1 || card.month > 12 ||
    !Number.isInteger(card.year) || card.year > now.getUTCFullYear() + 20 ||
    card.year * 12 + card.month < now.getUTCFullYear() * 12 + now.getUTCMonth() + 1)
    throw new Failure(422, 'invalid_card');
  const clean: Record<string, string> = {};
  for (const [key, max] of Object.entries({ nombre: 50, apellido: 50, email: 200,
    ciudad: 50, direccion: 50, idPais: 2, idRegion: 10, codigoPostal: 50, telefono: 20 })) {
    const value = billing[key];
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value))
      throw new Failure(422, 'invalid_billing');
    clean[key] = value.trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email) || !/^[0-9]{6,20}$/.test(clean.telefono) ||
    !/^[A-Z]{2}$/.test(clean.idPais) || !clean.idRegion.startsWith(`${clean.idPais}-`))
    throw new Failure(422, 'invalid_billing');
  return { tarjetaCreditoDebido: { numeroTarjeta: number, cvv: card.cvv,
    mesVencimiento: card.month, anioVencimiento: card.year }, ...clean };
}
async function readBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new Failure(400, 'invalid_request');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16_384) { await reader.cancel(); throw new Failure(413, 'request_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
async function encryptedLicense(secret: string) {
  const bytes = Uint8Array.from(atob(secret), c => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Failure(503, 'not_configured');
  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt']);
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let value = '';
  while (value.length < 20) for (const n of crypto.getRandomValues(new Uint8Array(32))) {
    if (n < 248 && value.length < 20) value += alphabet[n % alphabet.length];
  }
  const plain = encoder.encode(value.match(/.{5}/g)!.join('-'));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  return { p_key_hash: `\\x${hex(await crypto.subtle.digest('SHA-256', plain))}`,
    p_key_ciphertext: `\\x${hex(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain))}`,
    p_key_nonce: `\\x${hex(nonce)}` };
}
export async function handle(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  let origin = '';
  try { origin = new URL(env.HYRO_SITE_URL ?? '').origin; } catch { /* Fail closed below. */ }
  const reply = (status: number, data: object) => new Response(JSON.stringify(data), { status, headers: {
    'content-type': 'application/json', 'cache-control': 'no-store', 'pragma': 'no-cache',
    'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization,apikey,content-type',
    'access-control-allow-methods': 'POST, OPTIONS', vary: 'Origin', 'x-content-type-options': 'nosniff',
  } });
  if (request.method === 'OPTIONS') return reply(200, {});
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  const real = env.WOMPI_MODE === 'live';
  const priceCents = Number(env.WOMPI_CARD_PRICE_CENTS);
  const publicKey = env.HYRO_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (env.WOMPI_CARD_ENABLED !== 'true' || !['test', 'live'].includes(env.WOMPI_MODE ?? '') ||
    (real && env.WOMPI_CARD_LIVE_ENABLED !== 'true') || !origin.startsWith('https://') ||
    !env.WOMPI_APP_ID || !env.WOMPI_API_SECRET || !env.SUPABASE_URL || !publicKey ||
    !env.SUPABASE_SERVICE_ROLE_KEY || !env.LICENSE_ENCRYPTION_KEY ||
    !Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 10000000)
    return reply(503, { error: 'not_configured' });
  try {
    const webhook = new URL(request.url).searchParams.get('webhook') === '1';
    if (!webhook && request.headers.get('origin') !== origin) throw new Failure(403, 'invalid_origin');
    const db = async (path: string, method = 'GET', value?: Obj): Promise<any> => {
      const response = await fetcher(`${env.SUPABASE_URL}/rest/v1/${path}`, { method, redirect: 'error',
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'content-type': 'application/json' }, ...(value ? { body: JSON.stringify(value) } : {}),
        signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Failure(503, 'verification_pending');
      return response.status === 204 ? null : response.json();
    };
    let user: Obj = {};
    if (!webhook) {
      const bearer = request.headers.get('authorization');
      if (!bearer?.startsWith('Bearer ')) throw new Failure(401, 'unauthorized');
      const response = await fetcher(`${env.SUPABASE_URL}/auth/v1/user`, { redirect: 'error',
        headers: { authorization: bearer, apikey: publicKey }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Failure(401, 'unauthorized');
      user = await response.json();
      if (!uuid(user.id) || !user.email_confirmed_at) throw new Failure(401, 'unauthorized');
    }
    let raw = await readBody(request);
    if (webhook) {
      const hash = request.headers.get('wompi_hash') ?? '';
      if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Failure(401, 'invalid_signature');
      const key = await crypto.subtle.importKey('raw', encoder.encode(env.WOMPI_API_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const signature = Uint8Array.from(hash.match(/../g)!, x => parseInt(x, 16));
      if (!await crypto.subtle.verify('HMAC', key, signature, encoder.encode(raw))) throw new Failure(401, 'invalid_signature');
    }
    let body: Obj;
    try { body = JSON.parse(raw); } catch { throw new Failure(400, 'invalid_request'); }
    raw = '';
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Failure(400, 'invalid_request');
    if (!webhook && (!['config', 'create', 'status'].includes(body.action) ||
      (body.action !== 'config' && !uuid(body.request_id)))) throw new Failure(400, 'invalid_request');
    // Never forward client-supplied prices, redirects, metadata or extra fields.
    let checkout: Obj | undefined;
    if (!webhook && body.action === 'status') {
      [checkout] = await db(`wompi_card_checkouts?user_id=eq.${user.id}&request_id=eq.${body.request_id}&select=*`);
      if (!checkout) return reply(200, { status: 'unknown' });
      if (['paid', 'test_paid', 'declined'].includes(checkout.status)) return reply(200, {
        status: checkout.status, ...(checkout.status === 'paid' ? { library_url: '/biblioteca/?compra=confirmada' } : {}),
      });
      if (!checkout.transaction_id) return reply(200, { status: 'review' });
    }
    const oauth = await fetcher('https://id.wompi.sv/connect/token', { method: 'POST', redirect: 'error',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', audience: 'wompi_api',
        client_id: env.WOMPI_APP_ID, client_secret: env.WOMPI_API_SECRET }), signal: AbortSignal.timeout(15_000) });
    if (!oauth.ok) throw new Failure(502, 'provider_unavailable');
    const token = (await oauth.json()).access_token;
    if (typeof token !== 'string' || !token) throw new Failure(502, 'provider_unavailable');
    const api = async (path: string, value?: Obj): Promise<Obj | Obj[]> => {
      const response = await fetcher(`https://api.wompi.sv${path}`, { method: value ? 'POST' : 'GET', redirect: 'error',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        ...(value ? { body: JSON.stringify(value) } : {}), signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Failure(502, 'provider_unavailable');
      return response.json();
    };
    const merchant = await api('/Aplicativo') as Obj;
    if (merchant.clientIdApi !== env.WOMPI_APP_ID || merchant.estaProductivo !== real) throw new Failure(409, 'mode_mismatch');
    if (!webhook && body.action === 'config') {
      const regions = await api('/api/Regiones');
      if (!Array.isArray(regions)) throw new Failure(502, 'provider_unavailable');
      return reply(200, { mode: env.WOMPI_MODE, amount_cents: priceCents, regions: regions.map(r => ({ id: r.id, nombre: r.nombre,
        territorios: Array.isArray(r.territorios) ? r.territorios.map((t: Obj) => ({ id: t.id, nombre: t.nombre })) : [] })) });
    }
    if (webhook || body.action === 'status') {
      const transactionId = webhook ? body.IdTransaccion : checkout!.transaction_id;
      if (!uuid(transactionId)) throw new Failure(400, 'invalid_transaction');
      const transaction = await api(`/TransaccionCompra/${transactionId}`) as Obj;
      if (!uuid(transaction.idExterno) || transaction.idTransaccion !== transactionId || transaction.esReal !== real)
        throw new Failure(409, 'payment_mismatch');
      if (webhook) [checkout] = await db(`wompi_card_checkouts?id=eq.${transaction.idExterno}&select=*`);
      if (!checkout) return reply(200, { ignored: true });
      if (checkout.id !== transaction.idExterno || checkout.is_productive !== real ||
        (checkout.transaction_id && checkout.transaction_id !== transactionId)) throw new Failure(409, 'payment_mismatch');
      // Bind even a transaction whose create response was lost. The idExterno came from our server.
      await db('rpc/bind_wompi_card_transaction', 'POST', { p_checkout_id: checkout.id, p_transaction_id: transactionId });
      if (transaction.esAprobada === true && transaction.resultadoTransaccion === 0) {
        const amount = checkout.amount_cents / 100;
        if (transaction.monto !== amount || (transaction.montoOriginal != null && transaction.montoOriginal !== amount))
          throw new Failure(409, 'payment_mismatch');
        if (real) await db('rpc/complete_wompi_card_purchase', 'POST', { p_checkout_id: checkout.id,
          p_transaction_id: transactionId, ...await encryptedLicense(env.LICENSE_ENCRYPTION_KEY) });
        else await db(`wompi_card_checkouts?id=eq.${checkout.id}&status=neq.paid`, 'PATCH', { status: 'test_paid' });
        return reply(200, { status: real ? 'paid' : 'test_paid', ...(real ? { library_url: '/biblioteca/?compra=confirmada' } : {}) });
      }
      if (transaction.esAprobada === false && [1, 2].includes(transaction.resultadoTransaccion)) {
        await db(`wompi_card_checkouts?id=eq.${checkout.id}&status=in.(creating,awaiting_3ds,review)`, 'PATCH', { status: 'declined' });
        return reply(200, { status: 'declined' });
      }
      return reply(200, { status: 'awaiting_3ds',
        ...(!webhook && checkout.challenge_url ? { challenge_url: challengeUrl(checkout.challenge_url) } : {}) });
    }
    if (body.expected_amount_cents !== priceCents) throw new Failure(409, 'price_changed');
    const payment = validatePayment(body);
    // Clear references on parsed input; the whitelisted payload survives only until the provider call.
    delete body.card; delete body.billing;
    const regions = await api('/api/Regiones');
    if (!Array.isArray(regions) || !regions.some(r => r.id === payment.idPais &&
      Array.isArray(r.territorios) && r.territorios.some((t: Obj) => t.id === payment.idRegion)))
      throw new Failure(422, 'invalid_billing');
    await encryptedLicense(env.LICENSE_ENCRYPTION_KEY); // Fail before starting a payment if delivery is misconfigured.
    const reservation = await db('rpc/reserve_wompi_card_checkout', 'POST', {
      p_user_id: user.id, p_request_id: body.request_id, p_is_productive: real, p_buyer_email: user.email,
      p_amount_cents: priceCents,
    });
    if (reservation.library_url) return reply(200, { library_url: '/biblioteca/' });
    if (reservation.limited) throw new Failure(429, 'rate_limited');
    checkout = reservation.checkout;
    if (!checkout || !uuid(checkout.id)) throw new Failure(503, 'verification_pending');
    if (checkout.is_productive !== real) throw new Failure(409, 'mode_mismatch');
    if (checkout.amount_cents !== priceCents) throw new Failure(409, 'price_changed');
    if (!reservation.claimed) return reply(200, { status: checkout.status, request_id: checkout.request_id,
      ...(checkout.challenge_url && checkout.status === 'awaiting_3ds' ? { challenge_url: challengeUrl(checkout.challenge_url) } : {}) });
    try {
      const result = await api('/TransaccionCompra/3Ds', { ...payment, monto: checkout.amount_cents / 100, idExterno: checkout.id,
        urlRedirect: `${origin}/checkout/?card=return&request=${checkout.request_id}`,
        configuracion: { urlWebhook: `${env.SUPABASE_URL}/functions/v1/wompi-card?webhook=1`, notificarTransaccionCliente: true },
        datosAdicionales: { hyro_checkout: checkout.id },
      }) as Obj;
      if (!uuid(result.idTransaccion) || result.esReal !== real || result.monto !== checkout.amount_cents / 100)
        throw new Failure(502, 'verification_pending');
      const url = challengeUrl(result.urlCompletarPago3Ds);
      await db('rpc/bind_wompi_card_transaction', 'POST', { p_checkout_id: checkout.id, p_transaction_id: result.idTransaccion });
      await db(`wompi_card_checkouts?id=eq.${checkout.id}&status=in.(creating,awaiting_3ds,review)`, 'PATCH',
        { status: 'awaiting_3ds', challenge_url: url });
      return reply(200, { status: 'awaiting_3ds', request_id: checkout.request_id, challenge_url: url });
    } catch {
      // No automatic retry: the provider may have created the transaction despite a timeout.
      await db(`wompi_card_checkouts?id=eq.${checkout.id}&status=eq.creating`, 'PATCH', { status: 'review' });
      return reply(200, { status: 'review', request_id: checkout.request_id });
    } finally {
      payment.tarjetaCreditoDebido.numeroTarjeta = ''; payment.tarjetaCreditoDebido.cvv = '';
    }
  } catch (error) {
    // Do not print error objects: upstream exceptions could include request data.
    return error instanceof Failure ? reply(error.status, { error: error.code }) : reply(503, { error: 'verification_pending' });
  }
}
