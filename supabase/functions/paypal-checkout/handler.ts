export interface Env {
  PAYPAL_LIVE_ENABLED?: string;
  PAYPAL_LIVE_CLIENT_ID?: string;
  PAYPAL_LIVE_CLIENT_SECRET?: string;
  PAYPAL_LIVE_BN_CODE?: string;
  PAYPAL_LIVE_WEBHOOK_ID?: string;
  HYRO_SITE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  LICENSE_ENCRYPTION_KEY?: string;
}
// Confirmed recipients. Sandbox credentials and endpoints never enter this flow.
export const recipients = ['erickcaceres1717@gmail.com', 'gioesbeats@gmail.com'] as const;
const api = 'https://api-m.paypal.com';
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const paypalId = (value: unknown): value is string => typeof value === 'string' && /^[A-Z0-9]{17}$/.test(value);
class Failure extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
interface Capture { id: string; status: string; amount: { value: string; currency_code: string } }
export interface Order {
  id: string; intent: string; status: string;
  purchase_units: Array<{ reference_id: string; custom_id: string; amount: { value: string; currency_code: string }; payee: { email_address: string }; payments?: { captures?: Capture[] } }>;
  links?: Array<{ rel: string; href: string }>;
  payer?: { email_address?: string };
}
interface Checkout { id: string; user_id: string; paypal_order_id: string | null; status: string; order_id: string | null }

export function verifyOrder(order: Order, checkout: Checkout, completed: boolean): string[] {
  if (order.id !== checkout.paypal_order_id || order.intent !== 'CAPTURE' || order.purchase_units?.length !== 2) throw new Failure(409, 'invalid_order');
  const captures: string[] = [];
  recipients.forEach((email, i) => {
    const unit = order.purchase_units.find(u => u.reference_id === `HYRO-${i + 1}`);
    if (!unit || unit.custom_id !== checkout.id || unit.payee?.email_address?.toLowerCase() !== email ||
      unit.amount?.value !== '10.00' || unit.amount.currency_code !== 'USD') throw new Failure(409, 'invalid_order');
    if (completed) {
      const paid = unit.payments?.captures;
      if (paid?.length !== 1 || paid[0].status !== 'COMPLETED' || !paypalId(paid[0].id) ||
        paid[0].amount.value !== '10.00' || paid[0].amount.currency_code !== 'USD') throw new Failure(409, 'payment_incomplete');
      captures.push(paid[0].id);
    }
  });
  if (completed && (order.status !== 'COMPLETED' || new Set(captures).size !== 2)) throw new Failure(409, 'payment_incomplete');
  return captures;
}

async function encryptLicense(secret: string) {
  const bytes = Uint8Array.from(atob(secret), c => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Failure(503, 'server_not_configured');
  const aes = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt']);
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let text = '';
  while (text.length < 20) for (const value of crypto.getRandomValues(new Uint8Array(32))) {
    if (value < 248 && text.length < 20) text += alphabet[value % alphabet.length];
  }
  const plain = new TextEncoder().encode(text.match(/.{5}/g)!.join('-'));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const hex = (value: ArrayBuffer | Uint8Array) => '\\x' + [...new Uint8Array(value)].map(b => b.toString(16).padStart(2, '0')).join('');
  return { p_key_hash: hex(await crypto.subtle.digest('SHA-256', plain)),
    p_key_ciphertext: hex(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain)), p_key_nonce: hex(nonce) };
}

export async function handle(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const origin = env.HYRO_SITE_URL ? new URL(env.HYRO_SITE_URL).origin : '';
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: {
    'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS', vary: 'Origin',
  } });
  if (request.method === 'OPTIONS') return reply(200, {});
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (env.PAYPAL_LIVE_ENABLED !== 'true' || !env.PAYPAL_LIVE_CLIENT_ID || !env.PAYPAL_LIVE_CLIENT_SECRET ||
    !env.PAYPAL_LIVE_WEBHOOK_ID || !env.PAYPAL_LIVE_BN_CODE || !origin.startsWith('https://') || !env.SUPABASE_URL ||
    !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY || !env.LICENSE_ENCRYPTION_KEY) return reply(503, { error: 'live_not_configured' });
  try {
    // Check the existing encryption key before allowing any order or capture.
    const keyBytes = Uint8Array.from(atob(env.LICENSE_ENCRYPTION_KEY), c => c.charCodeAt(0));
    if (keyBytes.length !== 32) throw new Failure(503, 'server_not_configured');
    const isWebhook = new URL(request.url).searchParams.get('webhook') === '1';
    if (!isWebhook && request.headers.get('origin') !== origin) throw new Failure(403, 'invalid_origin');
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { throw new Failure(400, 'invalid_json'); }
    if (!body || Array.isArray(body)) throw new Failure(400, 'invalid_json');
    const db = async (path: string, method = 'GET', value?: object, prefer?: string) => {
      const response = await fetcher(`${env.SUPABASE_URL}/rest/v1/${path}`, { method, headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json', ...(prefer ? { Prefer: prefer } : {}),
      }, ...(value ? { body: JSON.stringify(value) } : {}), signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Failure(503, 'delivery_pending');
      return response.status === 204 ? null : await response.json();
    };
    let userId: string | undefined;
    if (!isWebhook) {
      const bearer = request.headers.get('authorization');
      if (!bearer?.startsWith('Bearer ')) throw new Failure(401, 'unauthorized');
      const auth = await fetcher(`${env.SUPABASE_URL}/auth/v1/user`, { headers: {
        authorization: bearer, apikey: env.SUPABASE_ANON_KEY,
      }, signal: AbortSignal.timeout(15_000) });
      if (!auth.ok) throw new Failure(401, 'unauthorized');
      userId = (await auth.json()).id;
      if (!uuid(userId)) throw new Failure(401, 'unauthorized');
      if (body.action !== 'create' && body.action !== 'capture') throw new Failure(400, 'invalid_action');
      if (body.action === 'create' && !uuid(body.request_id)) throw new Failure(400, 'invalid_request');
      if (body.action === 'capture' && !paypalId(body.order_id)) throw new Failure(400, 'invalid_order');
    }
    const oauth = await fetcher(`${api}/v1/oauth2/token`, { method: 'POST', headers: {
      authorization: `Basic ${btoa(`${env.PAYPAL_LIVE_CLIENT_ID}:${env.PAYPAL_LIVE_CLIENT_SECRET}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(15_000) });
    if (!oauth.ok) throw new Failure(502, 'paypal_unavailable');
    const token = (await oauth.json()).access_token;
    if (typeof token !== 'string') throw new Failure(502, 'paypal_unavailable');
    const paypal = async (path: string, method = 'GET', data?: object, key?: string): Promise<any> => {
      const response = await fetcher(`${api}${path}`, { method, headers: {
        authorization: `Bearer ${token}`, 'content-type': 'application/json', Prefer: 'return=representation',
        'PayPal-Partner-Attribution-Id': env.PAYPAL_LIVE_BN_CODE!, ...(key ? { 'PayPal-Request-Id': key } : {}),
      }, ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(25_000) });
      if (!response.ok) throw new Failure(502, 'paypal_verification_pending');
      return response.json();
    };
    let checkout: Checkout;
    let eventType = '';
    if (isWebhook) {
      const fields = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time'];
      if (fields.some(field => !request.headers.get(field))) throw new Failure(401, 'invalid_webhook');
      const verified = await paypal('/v1/notifications/verify-webhook-signature', 'POST', {
        auth_algo: request.headers.get(fields[0]), cert_url: request.headers.get(fields[1]),
        transmission_id: request.headers.get(fields[2]), transmission_sig: request.headers.get(fields[3]),
        transmission_time: request.headers.get(fields[4]), webhook_id: env.PAYPAL_LIVE_WEBHOOK_ID, webhook_event: body,
      });
      if (verified.verification_status !== 'SUCCESS') throw new Failure(401, 'invalid_webhook');
      eventType = String(body.event_type);
      if (!['CHECKOUT.ORDER.APPROVED', 'PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED'].includes(eventType)) return reply(200, { ignored: true });
      const resource = body.resource as any;
      let orderId = eventType === 'CHECKOUT.ORDER.APPROVED' ? resource?.id : resource?.supplementary_data?.related_ids?.order_id;
      if (!orderId) {
        let captureId = resource?.supplementary_data?.related_ids?.capture_id;
        if (eventType === 'PAYMENT.CAPTURE.REVERSED' || eventType === 'PAYMENT.CAPTURE.COMPLETED') captureId ||= resource?.id;
        const up = resource?.links?.find((link: any) => link.rel === 'up')?.href;
        if (!captureId && typeof up === 'string') {
          const url = new URL(up);
          if (url.origin === api || url.origin === 'https://api.paypal.com') captureId = url.pathname.match(/^\/v2\/payments\/captures\/([A-Z0-9]{17})$/)?.[1];
        }
        if (paypalId(captureId)) orderId = (await paypal(`/v2/payments/captures/${captureId}`)).supplementary_data?.related_ids?.order_id;
      }
      if (!paypalId(orderId)) throw new Failure(503, 'event_lookup_pending');
      [checkout] = await db(`paypal_checkouts?paypal_order_id=eq.${orderId}&select=*`);
      if (!checkout) return reply(200, { ignored: true });
    } else if (body.action === 'create') {
      const [product] = await db('products?slug=eq.hyro-visuals&is_active=eq.true&select=id,price_cents,currency');
      if (!product || product.price_cents !== 2000 || product.currency !== 'USD') throw new Failure(503, 'product_unavailable');
      const licenses = await db(`licenses?user_id=eq.${userId}&product_id=eq.${product.id}&status=eq.active&select=id&limit=1`);
      if (licenses.length) return reply(200, { library_url: '/biblioteca/' });
      await db('paypal_checkouts?on_conflict=user_id,request_id', 'POST', {
        user_id: userId, product_id: product.id, request_id: body.request_id,
      }, 'resolution=ignore-duplicates,return=representation');
      [checkout] = await db(`paypal_checkouts?user_id=eq.${userId}&request_id=eq.${body.request_id}&select=*`);
      if (!checkout) throw new Failure(503, 'checkout_unavailable');
      if (!checkout.paypal_order_id) {
        const order: Order = await paypal('/v2/checkout/orders', 'POST', {
          intent: 'CAPTURE', purchase_units: recipients.map((email, i) => ({
            reference_id: `HYRO-${i + 1}`, custom_id: checkout.id, payee: { email_address: email },
            amount: { value: '10.00', currency_code: 'USD' }, description: 'HYRO Visuals',
            payment_instruction: { disbursement_mode: 'INSTANT' },
          })), payment_source: { paypal: { experience_context: {
            brand_name: 'HYRO', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW',
            return_url: `${origin}/compra/paypal/`, cancel_url: `${origin}/compra/paypal/?cancelado=1`,
          } } },
        }, checkout.id);
        if (!paypalId(order.id)) throw new Failure(502, 'invalid_order');
        await db(`paypal_checkouts?id=eq.${checkout.id}&paypal_order_id=is.null`, 'PATCH', { paypal_order_id: order.id });
        checkout.paypal_order_id = order.id;
      }
    } else {
      [checkout] = await db(`paypal_checkouts?paypal_order_id=eq.${body.order_id}&user_id=eq.${userId}&select=*`);
      if (!checkout) throw new Failure(404, 'order_not_owned');
    }
    if (checkout.status === 'refunded') return isWebhook ? reply(200, { received: true }) : reply(409, { error: 'payment_refunded' });
    let order: Order = await paypal(`/v2/checkout/orders/${checkout.paypal_order_id}`);
    verifyOrder(order, checkout, false);
    // Verify the provider state on every delivery/retry; an old browser URL is never proof of payment.
    if (order.purchase_units.some(unit => unit.payments?.captures?.some(c => ['REFUNDED', 'REVERSED'].includes(c.status)))) {
      await db('rpc/refund_paypal_purchase', 'POST', { p_checkout_id: checkout.id });
      return isWebhook ? reply(200, { received: true }) : reply(409, { error: 'payment_refunded' });
    }
    if (eventType === 'PAYMENT.CAPTURE.REFUNDED' && order.purchase_units.some(unit =>
      unit.payments?.captures?.some(c => c.status === 'PARTIALLY_REFUNDED'))) return reply(200, { received: true });
    if (eventType === 'PAYMENT.CAPTURE.REFUNDED' || eventType === 'PAYMENT.CAPTURE.REVERSED') throw new Failure(503, 'refund_verification_pending');
    if (order.status === 'APPROVED' && !order.purchase_units.some(u => (u.payments?.captures?.length ?? 0) > 0)) {
      order = await paypal(`/v2/checkout/orders/${order.id}/capture`, 'POST', {}, `hyro-${order.id}`);
    } else if (!isWebhook && body.action === 'create' && order.status !== 'COMPLETED') {
      const link = order.links?.find(l => l.rel === 'payer-action' || l.rel === 'approve');
      if (!link || new URL(link.href).origin !== 'https://www.paypal.com') throw new Failure(409, 'approval_unavailable');
      return reply(200, { order_id: order.id, approve_url: link.href });
    }
    const captures = verifyOrder(order, checkout, true);
    const license = await encryptLicense(env.LICENSE_ENCRYPTION_KEY);
    await db('rpc/complete_paypal_purchase', 'POST', { p_checkout_id: checkout.id, p_paypal_order_id: order.id,
      p_capture_1: captures[0], p_capture_2: captures[1], p_buyer_email: order.payer?.email_address ?? null, ...license });
    return reply(200, { status: 'COMPLETED', order_id: order.id, library_url: '/biblioteca/?compra=confirmada' });
  } catch (error) {
    return error instanceof Failure ? reply(error.status, { error: error.code }) : reply(503, { error: 'delivery_pending' });
  }
}
