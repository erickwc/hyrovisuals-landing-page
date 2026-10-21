// Sandbox only. No live API URL or license-writing credentials are accepted here.
export interface SandboxEnv {
  PAYPAL_SANDBOX_ENABLED?: string;
  PAYPAL_SANDBOX_CLIENT_ID?: string;
  PAYPAL_SANDBOX_CLIENT_SECRET?: string;
  PUBLIC_SUPABASE_URL: string;
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
}

const API = 'https://api-m.sandbox.paypal.com';
const BN_CODE = 'FLAVORsb-43cgpw53248569_MP';
export const SELLERS = [
  { reference: 'HYRO-seller-1', merchant: '8CFHEVR7JKBYN', email: 'sb-43s564753470315@business.example.com' },
  { reference: 'HYRO-seller-2', merchant: 'JB93BNVTVJBTG', email: 'sb-t25lh53470319@business.example.com' },
] as const;

interface Capture {
  id: string;
  status: string;
  amount: { currency_code: string; value: string };
  seller_receivable_breakdown?: { paypal_fee?: { value: string }; net_amount?: { value: string } };
}
export interface PayPalOrder {
  id: string;
  intent: string;
  status: string;
  purchase_units: Array<{
    reference_id: string;
    custom_id: string;
    amount: { currency_code: string; value: string };
    payee: { merchant_id?: string; email_address?: string };
    payments?: { captures?: Capture[] };
  }>;
  links?: Array<{ rel: string; href: string }>;
}

class CheckoutError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
const json = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function validateOrder(order: PayPalOrder, userId: string) {
  if (order.intent !== 'CAPTURE' || !Array.isArray(order.purchase_units) || order.purchase_units.length !== 2) {
    throw new CheckoutError(409, 'unexpected_order');
  }
  for (const seller of SELLERS) {
    const unit = order.purchase_units.find((item) => item.reference_id === seller.reference);
    if (!unit || unit.custom_id !== `hyro-sandbox:${userId}` ||
        unit.amount?.currency_code !== 'USD' || unit.amount.value !== '10.00' ||
        unit.payee?.merchant_id !== seller.merchant) {
      throw new CheckoutError(403, 'order_not_owned_or_invalid');
    }
  }
}

export function summarize(order: PayPalOrder) {
  const payments = SELLERS.map((seller) => {
    const unit = order.purchase_units.find((item) => item.reference_id === seller.reference)!;
    const captures = unit.payments?.captures;
    const capture = captures?.[0];
    if (captures?.length !== 1 || !capture?.id || capture.status !== 'COMPLETED' ||
        capture.amount?.value !== '10.00' || capture.amount.currency_code !== 'USD') {
      throw new CheckoutError(409, 'payment_not_completed');
    }
    return {
      seller: seller.reference, capture_id: capture.id, status: capture.status,
      amount: capture.amount.value, currency: 'USD',
      fee: capture.seller_receivable_breakdown?.paypal_fee?.value ?? null,
      net: capture.seller_receivable_breakdown?.net_amount?.value ?? null,
    };
  });
  if (order.status !== 'COMPLETED' || payments[0].capture_id === payments[1].capture_id) {
    throw new CheckoutError(409, 'payment_not_completed');
  }
  return { order_id: order.id, status: 'COMPLETED', environment: 'sandbox', payments };
}

export async function handleSandbox(request: Request, env: SandboxEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (env.PAYPAL_SANDBOX_ENABLED !== 'true' || !env.PAYPAL_SANDBOX_CLIENT_ID ||
      !env.PAYPAL_SANDBOX_CLIENT_SECRET || !env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return json(503, { error: 'sandbox_not_configured' });
  }
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') && request.headers.get('origin') !== origin) return json(403, { error: 'invalid_origin' });
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) return json(401, { error: 'unauthorized' });
  try {
    const auth = await fetcher(`${env.PUBLIC_SUPABASE_URL}/auth/v1/user`, {
      headers: { authorization: bearer, apikey: env.PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    if (!auth.ok) return json(auth.status >= 500 ? 503 : 401, { error: auth.status >= 500 ? 'auth_unavailable' : 'unauthorized' });
    const user = await auth.json() as { id?: string };
    if (!uuid(user.id)) return json(401, { error: 'unauthorized' });
    let body: { action?: unknown; request_id?: unknown; order_id?: unknown };
    try { body = await request.json(); } catch { return json(400, { error: 'invalid_json' }); }
    if (!body || (body.action !== 'create' && body.action !== 'capture')) return json(400, { error: 'invalid_action' });
    if (body.action === 'create' && !uuid(body.request_id)) return json(400, { error: 'invalid_request_id' });
    if (body.action === 'capture' && (typeof body.order_id !== 'string' || !/^[A-Z0-9]{17}$/.test(body.order_id))) {
      return json(400, { error: 'invalid_order_id' });
    }
    const oauth = await fetcher(`${API}/v1/oauth2/token`, {
      method: 'POST', headers: {
        authorization: `Basic ${btoa(`${env.PAYPAL_SANDBOX_CLIENT_ID}:${env.PAYPAL_SANDBOX_CLIENT_SECRET}`)}`,
        'content-type': 'application/x-www-form-urlencoded',
      }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(15_000),
    });
    if (!oauth.ok) throw new CheckoutError(502, 'paypal_unavailable');
    const { access_token } = await oauth.json() as { access_token?: string };
    if (!access_token) throw new CheckoutError(502, 'paypal_unavailable');
    const paypal = async (path: string, method = 'GET', data?: object, requestId?: string): Promise<PayPalOrder> => {
      const response = await fetcher(`${API}${path}`, {
        method, headers: {
          authorization: `Bearer ${access_token}`, 'content-type': 'application/json',
          'PayPal-Partner-Attribution-Id': BN_CODE, Prefer: 'return=representation',
          ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
        }, ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) {
        // Capture errors may be partial; never translate an API failure into purchase success.
        throw new CheckoutError(502, 'paypal_verification_required');
      }
      return await response.json() as PayPalOrder;
    };
    if (body.action === 'create') {
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(`${user.id}:${body.request_id}`)));
      const requestId = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 36);
      const order = await paypal('/v2/checkout/orders', 'POST', {
        intent: 'CAPTURE',
        purchase_units: SELLERS.map((seller) => ({
          reference_id: seller.reference, custom_id: `hyro-sandbox:${user.id}`,
          payee: { merchant_id: seller.merchant },
          amount: { currency_code: 'USD', value: '10.00' },
          description: 'HYRO Visuals — Sandbox', payment_instruction: { disbursement_mode: 'INSTANT' },
        })),
        payment_source: { paypal: { experience_context: {
          brand_name: 'HYRO', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW',
          return_url: `${origin}/compra/sandbox/`, cancel_url: `${origin}/compra/sandbox/?cancelado=1`,
        } } },
      }, requestId);
      const approve = order.links?.find((link) => link.rel === 'payer-action' || link.rel === 'approve');
      if (!approve || new URL(approve.href).origin !== 'https://www.sandbox.paypal.com') {
        throw new CheckoutError(502, 'invalid_approval_url');
      }
      return json(200, { order_id: order.id, approve_url: approve.href });
    }
    const path = `/v2/checkout/orders/${body.order_id}`;
    let order = await paypal(path);
    if (order.id !== body.order_id) throw new CheckoutError(409, 'unexpected_order');
    validateOrder(order, user.id);
    if (order.status !== 'COMPLETED') {
      // A partial capture needs reconciliation, never a second charge for the same unit.
      if (order.purchase_units.some((unit) => (unit.payments?.captures?.length ?? 0) > 0)) {
        throw new CheckoutError(409, 'payment_not_completed');
      }
      if (order.status !== 'APPROVED') throw new CheckoutError(409, 'approval_required');
      order = await paypal(`${path}/capture`, 'POST', {}, `hyro-sandbox-${body.order_id}`);
      if (order.id !== body.order_id) throw new CheckoutError(409, 'unexpected_order');
      validateOrder(order, user.id);
    }
    return json(200, summarize(order));
  } catch (error) {
    return error instanceof CheckoutError
      ? json(error.status, { error: error.code })
      : json(502, { error: 'checkout_unavailable' });
  }
}
