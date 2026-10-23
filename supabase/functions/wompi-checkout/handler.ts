export interface Env {
  WOMPI_ENABLED?: string;
  WOMPI_MODE?: string; // test or live; the Wompi business must match.
  WOMPI_APP_ID?: string;
  WOMPI_API_SECRET?: string;
  HYRO_SITE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  LICENSE_ENCRYPTION_KEY?: string;
}
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && Math.round(value * 100) === 2000;
const hex = (bytes: ArrayBuffer | Uint8Array) => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
class Failure extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}

async function license(secret: string) {
  const bytes = Uint8Array.from(atob(secret), char => char.charCodeAt(0));
  if (bytes.length !== 32) throw new Failure(503, 'server_not_configured');
  const key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt']);
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let value = '';
  while (value.length < 20) for (const n of crypto.getRandomValues(new Uint8Array(32))) {
    if (n < 248 && value.length < 20) value += alphabet[n % alphabet.length];
  }
  const plain = new TextEncoder().encode(value.match(/.{5}/g)!.join('-'));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  return { p_key_hash: `\\x${hex(await crypto.subtle.digest('SHA-256', plain))}`,
    p_key_ciphertext: `\\x${hex(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain))}`,
    p_key_nonce: `\\x${hex(nonce)}` };
}

export async function handle(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const origin = env.HYRO_SITE_URL ? new URL(env.HYRO_SITE_URL).origin : '';
  const reply = (status: number, data: object) => new Response(JSON.stringify(data), { status, headers: {
    'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS', vary: 'Origin',
  } });
  if (request.method === 'OPTIONS') return reply(200, {});
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (env.WOMPI_ENABLED !== 'true' || !['test', 'live'].includes(env.WOMPI_MODE ?? '') ||
    !env.WOMPI_APP_ID || !env.WOMPI_API_SECRET || !origin.startsWith('https://') ||
    !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY ||
    !env.LICENSE_ENCRYPTION_KEY) return reply(503, { error: 'checkout_not_configured' });
  try {
    // Check delivery prerequisites before creating any payable link.
    await license(env.LICENSE_ENCRYPTION_KEY);
    const webhook = new URL(request.url).searchParams.get('webhook') === '1';
    if (!webhook && request.headers.get('origin') !== origin) throw new Failure(403, 'invalid_origin');
    const raw = await request.text();
    if (raw.length > 32_768) throw new Failure(413, 'payload_too_large');
    if (webhook) {
      const supplied = request.headers.get('wompi_hash')?.toLowerCase() ?? '';
      if (!/^[0-9a-f]{64}$/.test(supplied)) throw new Failure(401, 'invalid_webhook');
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.WOMPI_API_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
      let difference = 0;
      for (let i = 0; i < 64; i++) difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
      if (difference) throw new Failure(401, 'invalid_webhook');
    }
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { throw new Failure(400, 'invalid_json'); }
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Failure(400, 'invalid_json');
    const db = async (path: string, method = 'GET', value?: object, prefer?: string): Promise<any> => {
      const response = await fetcher(`${env.SUPABASE_URL}/rest/v1/${path}`, { method, headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json', ...(prefer ? { Prefer: prefer } : {}),
      }, ...(value ? { body: JSON.stringify(value) } : {}), signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Failure(503, 'delivery_pending');
      return response.status === 204 ? null : response.json();
    };
    let userId: string | undefined;
    if (!webhook) {
      const bearer = request.headers.get('authorization');
      if (!bearer?.startsWith('Bearer ')) throw new Failure(401, 'unauthorized');
      const auth = await fetcher(`${env.SUPABASE_URL}/auth/v1/user`, { headers: {
        authorization: bearer, apikey: env.SUPABASE_PUBLISHABLE_KEY,
      }, signal: AbortSignal.timeout(15_000) });
      if (!auth.ok) throw new Failure(401, 'unauthorized');
      userId = (await auth.json()).id;
      if (!uuid(userId) || !uuid(body.request_id) || !['create', 'status'].includes(String(body.action)))
        throw new Failure(400, 'invalid_request');
      if (body.action === 'status') {
        const [checkout] = await db(`wompi_checkouts?user_id=eq.${userId}&request_id=eq.${body.request_id}&select=id,status`);
        return reply(200, { status: checkout?.status ?? 'unknown',
          ...(checkout?.status === 'paid' ? { library_url: '/biblioteca/?compra=confirmada' } : {}) });
      }
    }
    const tokenResponse = await fetcher('https://id.wompi.sv/connect/token', { method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', audience: 'wompi_api',
        client_id: env.WOMPI_APP_ID, client_secret: env.WOMPI_API_SECRET }), signal: AbortSignal.timeout(15_000) });
    if (!tokenResponse.ok) throw new Failure(502, 'wompi_unavailable');
    const token = (await tokenResponse.json()).access_token;
    if (typeof token !== 'string' || !token) throw new Failure(502, 'wompi_unavailable');
    const wompi = async (path: string, method = 'GET', value?: object): Promise<any> => {
      const response = await fetcher(`https://api.wompi.sv${path}`, { method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        ...(value ? { body: JSON.stringify(value) } : {}), signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Failure(502, 'wompi_verification_pending');
      return response.json();
    };
    if (webhook) {
      const event = body as any;
      const id = event.EnlacePago?.IdentificadorEnlaceComercio;
      const linkId = event.EnlacePago?.Id;
      const transactionId = event.IdTransaccion;
      if (!uuid(id) || !Number.isSafeInteger(linkId) || linkId <= 0 || !uuid(transactionId) ||
        event.ResultadoTransaccion !== 'ExitosaAprobada' || !money(event.Monto))
        return reply(200, { ignored: true });
      const [checkout] = await db(`wompi_checkouts?id=eq.${id}&select=*`);
      if (!checkout) return reply(200, { ignored: true });
      if (checkout.link_id !== null && checkout.link_id !== linkId) throw new Failure(409, 'payment_mismatch');
      if (checkout.status === 'paid') return reply(200, { received: true });
      const expectedReal = env.WOMPI_MODE === 'live';
      if (event.EsProductiva !== expectedReal ||
        (checkout.is_productive !== null && checkout.is_productive !== expectedReal))
        throw new Failure(409, 'mode_mismatch');
      // A signed notification is still not enough: bind the provider's link, transaction and amount.
      const link = await wompi(`/EnlacePago/${linkId}`);
      const transaction = await wompi(`/TransaccionCompra/${transactionId}`);
      if (link.idEnlace !== linkId || link.idAplicativo?.toLowerCase() !== env.WOMPI_APP_ID.toLowerCase() ||
        link.estaProductivo !== expectedReal || !money(link.monto) ||
        link.transaccionCompra?.idTransaccion?.toLowerCase() !== transactionId.toLowerCase() ||
        transaction.idTransaccion?.toLowerCase() !== transactionId.toLowerCase() ||
        transaction.esAprobada !== true || transaction.resultadoTransaccion !== 0 ||
        transaction.esReal !== expectedReal || !money(transaction.monto) || !money(transaction.montoOriginal))
        throw new Failure(409, 'payment_mismatch');
      if (checkout.link_id === null) {
        const url = new URL(link.urlEnlace);
        if (url.protocol !== 'https:' || url.hostname !== 'lk.wompi.sv') throw new Failure(409, 'payment_mismatch');
        await db(`wompi_checkouts?id=eq.${id}&link_id=is.null`, 'PATCH', {
          link_id: linkId, link_url: url.href, is_productive: expectedReal,
        });
      }
      if (!expectedReal) return reply(200, { received: true, test: true });
      const buyerEmail = typeof event.cliente?.Email === 'string' ? event.cliente.Email : null;
      await db('rpc/complete_wompi_purchase', 'POST', { p_checkout_id: id, p_link_id: linkId,
        p_transaction_id: transactionId, p_buyer_email: buyerEmail,
        ...await license(env.LICENSE_ENCRYPTION_KEY) });
      return reply(200, { received: true });
    }
    const [product] = await db('products?slug=eq.hyro-visuals&is_active=eq.true&select=id,price_cents,currency');
    if (!product || product.price_cents !== 2000 || product.currency !== 'USD') throw new Failure(503, 'product_unavailable');
    const existingLicense = await db(`licenses?user_id=eq.${userId}&product_id=eq.${product.id}&status=eq.active&select=id&limit=1`);
    if (existingLicense.length) return reply(200, { library_url: '/biblioteca/' });
    const created = await db('wompi_checkouts?on_conflict=user_id,request_id', 'POST', {
      user_id: userId, product_id: product.id, request_id: body.request_id,
    }, 'resolution=ignore-duplicates,return=representation');
    const [checkout] = await db(`wompi_checkouts?user_id=eq.${userId}&request_id=eq.${body.request_id}&select=*`);
    if (!checkout) throw new Failure(503, 'checkout_unavailable');
    if (checkout.link_url) return reply(200, { checkout_id: checkout.id, payment_url: checkout.link_url });
    if (created.length !== 1) throw new Failure(409, 'checkout_pending');
    const result = await wompi('/EnlacePago', 'POST', {
      identificadorEnlaceComercio: checkout.id, monto: 20, nombreProducto: 'HYRO Visuals',
      configuracion: { urlRedirect: `${origin}/checkout/?resultado=pendiente`,
        urlRetorno: `${origin}/checkout/`, urlWebhook: `${env.SUPABASE_URL}/functions/v1/wompi-checkout?webhook=1`,
        esMontoEditable: false, esCantidadEditable: false, cantidadPorDefecto: 1,
        notificarTransaccionCliente: true },
      limitesDeUso: { cantidadMaximaPagosExitosos: 1 },
    });
    const paymentUrl = new URL(result.urlEnlace);
    if (paymentUrl.protocol !== 'https:' || paymentUrl.hostname !== 'lk.wompi.sv' ||
      !Number.isSafeInteger(result.idEnlace) || result.idEnlace <= 0 ||
      result.estaProductivo !== (env.WOMPI_MODE === 'live')) throw new Failure(502, 'invalid_payment_link');
    await db(`wompi_checkouts?id=eq.${checkout.id}&link_id=is.null`, 'PATCH', {
      link_id: result.idEnlace, link_url: paymentUrl.href, is_productive: result.estaProductivo,
    });
    return reply(200, { checkout_id: checkout.id, payment_url: paymentUrl.href });
  } catch (error) {
    return error instanceof Failure ? reply(error.status, { error: error.code }) : reply(503, { error: 'delivery_pending' });
  }
}
