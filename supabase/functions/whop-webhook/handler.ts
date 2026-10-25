const encoder = new TextEncoder();
const COMPANY = 'biz_XOirHolBiKU66x';
const PLAN = 'plan_yKbcCAPF4EaHb';
const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const json = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
type Env = Record<string, string | undefined>;

export async function handle(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const secret = env.WHOP_WEBHOOK_SECRET;
  if (!secret || !env.WHOP_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.LICENSE_ENCRYPTION_KEY)
    return json(503, { error: 'server_not_configured' });
  const raw = await request.text();
  if (raw.length > 262144) return json(413, { error: 'payload_too_large' });
  const timestamp = request.headers.get('webhook-timestamp') ?? '';
  const id = request.headers.get('webhook-id');
  if (!id || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)
    return json(401, { error: 'invalid_signature' });
  try {
    // Whop's ws_ secret is the UTF-8 HMAC key (not base64-decoded).
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const content = encoder.encode(`${id}.${timestamp}.${raw}`);
    let verified = false;
    for (const part of (request.headers.get('webhook-signature') ?? '').split(' ')) {
      const [version, signature] = part.split(',');
      if (version !== 'v1' || !signature) continue;
      try { verified ||= await crypto.subtle.verify('HMAC', key, Uint8Array.from(atob(signature), c => c.charCodeAt(0)), content); } catch { /* Invalid signature candidate. */ }
    }
    if (!verified) return json(401, { error: 'invalid_signature' });
    const event = JSON.parse(raw);
    if (!['payment.succeeded', 'refund.created', 'refund.updated'].includes(event.type)) return json(200, { ignored: true });
    if ((event.account_id ?? event.company_id) !== COMPANY) return json(200, { ignored: 'other_company' });
    const paymentId = event.type === 'payment.succeeded' ? event.data?.id :
      (event.data?.payment?.id ?? event.data?.payment_id);
    if (typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) return json(422, { error: 'invalid_payment' });
    // Always reconcile the latest payment; delayed success events must not undo refunds.
    const result = await fetcher(`https://api.whop.com/api/v1/payments/${paymentId}`, {
      headers: { authorization: `Bearer ${env.WHOP_API_KEY}`, 'Api-Version-Date': '2026-10-24' },
      signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) {
      console.warn('Whop payment verification status', result.status);
      return json(502, { error: 'payment_verification_failed' });
    }
    const payment = await result.json();
    if (payment.id !== paymentId || payment.company?.id !== COMPANY || payment.plan?.id !== PLAN)
      return json(200, { ignored: 'other_product' });
    const rpc = (name: string, body: object) => fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    if (['refunded', 'auto_refunded'].includes(payment.substatus) ||
        (typeof payment.total === 'number' && payment.total > 0 && typeof payment.refunded_amount === 'number' && payment.refunded_amount >= payment.total)) {
      const response = await rpc('refund_whop_purchase', { p_transaction_id: paymentId });
      return response.ok ? json(200, { received: true }) : json(500, { error: 'refund_failed' });
    }
    if (event.type !== 'payment.succeeded') return json(200, { ignored: 'not_full_refund' });
    if (payment.status !== 'paid' || !['succeeded', 'partially_refunded'].includes(payment.substatus))
      return json(200, { ignored: 'not_paid' });
    const intent = payment.metadata?.hyro_intent;
    if (typeof intent !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(intent))
      return json(422, { error: 'missing_purchase_intent' });
    // Prices and promotions belong to the fixed Whop plan; local currencies are supported.
    if (typeof payment.total !== 'number' || !Number.isFinite(payment.total) || payment.total < 0 ||
        typeof payment.currency !== 'string' || !/^[a-z]{3}$/i.test(payment.currency))
      return json(422, { error: 'invalid_amount' });
    const bytes = Uint8Array.from(atob(env.LICENSE_ENCRYPTION_KEY), c => c.charCodeAt(0));
    if (bytes.length !== 32) return json(503, { error: 'server_not_configured' });
    const aes = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt']);
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let chars = '';
    while (chars.length < 20) for (const n of crypto.getRandomValues(new Uint8Array(32))) {
      if (n < Math.floor(256 / alphabet.length) * alphabet.length && chars.length < 20) chars += alphabet[n % alphabet.length];
    }
    const license = chars.match(/.{5}/g)!.join('-');
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, encoder.encode(license)));
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(license)));
    const response = await rpc('complete_whop_purchase', {
      p_intent_id: intent, p_transaction_id: paymentId, p_product_slug: 'hyro-visuals',
      p_amount_cents: Math.round(payment.total * 100), p_currency: payment.currency.toUpperCase(),
      p_key_hash: `\\x${hex(hash)}`, p_key_ciphertext: `\\x${hex(encrypted)}`, p_key_nonce: `\\x${hex(nonce)}`,
      p_buyer_email: typeof payment.user?.email === 'string' ? payment.user.email : null,
    });
    return response.ok ? json(200, { received: true }) : json(500, { error: 'fulfillment_failed' });
  } catch {
    return json(500, { error: 'processing_failed' });
  }
}
