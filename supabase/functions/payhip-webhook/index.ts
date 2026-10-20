// Payhip calls this endpoint without a Supabase JWT. It fails closed until both secrets are set.
export {};
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const newLicenseKey = () => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let characters = '';
  while (characters.length < 20) {
    const random = crypto.getRandomValues(new Uint8Array(32));
    for (const value of random) {
      // Discard the high tail so every character has the same probability.
      if (value < 248) characters += alphabet[value % alphabet.length];
      if (characters.length === 20) break;
    }
  }
  return characters.match(/.{5}/g)!.join('-');
};
const json = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const apiKey = Deno.env.get('PAYHIP_API_KEY');
  const encryptionSecret = Deno.env.get('LICENSE_ENCRYPTION_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !encryptionSecret || !supabaseUrl || !serviceKey) {
    return json(503, { error: 'server_not_configured' });
  }
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const expected = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(apiKey))));
  const supplied = typeof payload.signature === 'string' ? payload.signature.toLowerCase() : '';
  if (supplied.length !== expected.length) return json(401, { error: 'invalid_signature' });
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  if (difference !== 0) return json(401, { error: 'invalid_signature' });
  const id = payload.id;
  if (typeof id !== 'string' || !/^[\w-]{4,128}$/.test(id)) return json(400, { error: 'invalid_transaction' });

  const rpc = async (name: string, body: object) => {
    const result = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { 'apikey': serviceKey, 'authorization': `Bearer ${serviceKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return result;
  };

  if (payload.type === 'refunded') {
    if (payload.amount_refunded !== payload.price) return json(200, { ignored: 'partial_refund' });
    const response = await rpc('refund_payhip_purchase', { p_transaction_id: id });
    return response.ok ? json(200, { received: true }) : json(500, { error: 'refund_failed' });
  }
  if (payload.type !== 'paid') return json(200, { ignored: true });
  const items = payload.items;
  if (Array.isArray(items) && items.length > 0 &&
      items.every((item) => item?.product_key !== 'X6ucD')) {
    return json(200, { ignored: 'other_product' });
  }
  if (!Array.isArray(items) || items.length !== 1 || items[0]?.product_key !== 'X6ucD' ||
      Number(items[0]?.quantity) !== 1 || payload.currency !== 'USD' ||
      !Number.isInteger(payload.price) || Number(payload.price) < 0 ||
      typeof payload.email !== 'string' || payload.email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return json(422, { error: 'unexpected_product' });
  }
  const metadata = payload.metadata;
  const intent = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>).hyro_intent : null;
  if (typeof intent !== 'string' || !/^[0-9a-f-]{36}$/i.test(intent)) {
    return json(422, { error: 'missing_purchase_intent' });
  }
  const paidAt = Number(payload.date);
  if (Number.isFinite(paidAt) && paidAt > 0) {
    console.info(JSON.stringify({ event: 'payhip_paid_received', delivery_lag_seconds: Math.max(0, Math.round(Date.now() / 1000 - paidAt)) }));
  }
  let aesKey: CryptoKey;
  try {
    const keyBytes = Uint8Array.from(atob(encryptionSecret), (char) => char.charCodeAt(0));
    if (keyBytes.length !== 32) throw new Error('invalid key length');
    aesKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  } catch { return json(503, { error: 'server_not_configured' }); }
  const licenseKey = newLicenseKey();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, encoder.encode(licenseKey)));
  const keyHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(licenseKey)));
  const response = await rpc('complete_payhip_purchase', {
    p_intent_id: intent, p_transaction_id: id, p_product_slug: 'hyro-visuals',
    p_amount_cents: payload.price, p_currency: 'USD',
    p_key_hash: `\\x${hex(keyHash)}`, p_key_ciphertext: `\\x${hex(ciphertext)}`,
    p_key_nonce: `\\x${hex(nonce)}`,
    p_buyer_email: payload.email,
  });
  if (!response.ok) return json(500, { error: 'purchase_processing_failed' });
  return json(200, { received: true });
});
