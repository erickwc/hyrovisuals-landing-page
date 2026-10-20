// Payhip has no role here: the license belongs to a paid HYRO order.
export {};
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const json = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const requestUrl = new URL(request.url);
  const routeAction = requestUrl.pathname.split('/').pop();
  const action = ['activate', 'status', 'deactivate'].includes(routeAction ?? '')
    ? routeAction : requestUrl.searchParams.get('action');
  if (!['activate', 'status', 'deactivate'].includes(action ?? '')) {
    return json(404, { error: 'not_found' });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const encryptionSecret = Deno.env.get('LICENSE_ENCRYPTION_KEY');
  const signingSecret = Deno.env.get('LICENSE_SIGNING_PRIVATE_PKCS8');
  if (!supabaseUrl || !serviceKey || !encryptionSecret || !signingSecret) {
    return json(503, { error: 'server_not_configured' });
  }
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json(400, { error: 'invalid_request' }); }
  const compactKey = typeof body.license_key === 'string'
    ? body.license_key.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  const key = compactKey.length === 20 ? compactKey.match(/.{5}/g)!.join('-') : '';
  // Earlier HYRO purchases used five blocks of four. The desktop app displays
  // four blocks of five, so both spellings must resolve to the same license.
  const legacyKey = compactKey.length === 20 ? compactKey.match(/.{4}/g)!.join('-') : '';
  const device = typeof body.device_id === 'string' ? body.device_id.toLowerCase() : '';
  const token = typeof body.device_token === 'string' ? body.device_token : '';
  const validKey = /^(?:[A-HJKMNP-Z2-9]{5}-){3}[A-HJKMNP-Z2-9]{5}$/.test(key) ||
    /^(?:[A-Z0-9]{5}-){3}[A-Z0-9]{5}$/.test(key);
  if (!validKey || !/^[0-9a-f]{64}$/.test(device) || !/^[0-9a-f]{64}$/.test(token)) {
    return json(400, { error: 'invalid_request' });
  }

  let signingKey: CryptoKey;
  let hmacKey: CryptoKey;
  try {
    signingKey = await crypto.subtle.importKey('pkcs8',
      Uint8Array.from(atob(signingSecret), (char) => char.charCodeAt(0)),
      'Ed25519', false, ['sign']);
    const raw = Uint8Array.from(atob(encryptionSecret), (char) => char.charCodeAt(0));
    const master = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
    hmacKey = await crypto.subtle.deriveKey({
      name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('HYRO activation v1'),
      info: encoder.encode('device and rate limit identifiers'),
    }, master, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
  } catch { return json(503, { error: 'server_not_configured' }); }
  const digest = async (value: string) => hex(new Uint8Array(
    await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(value))));
  const keyHash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(key))));
  const legacyHash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(legacyKey))));
  const deviceHash = await digest(`device:${device}`);
  const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json' };

  if (action === 'deactivate') {
    let released = false;
    for (const hash of [keyHash, legacyHash]) {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/release_hyro_activation`, {
        method: 'POST', headers,
        body: JSON.stringify({ p_key_hash: `\\x${hash}`, p_device_hash: `\\x${deviceHash}` }),
      });
      if (!response.ok) return json(503, { error: 'server_unavailable' });
      if ((await response.json()) === true) { released = true; break; }
    }
    return released
      ? json(200, { mode: 'hyro', active: false })
      : json(403, { error: 'device_not_authorized' });
  }

  // The gateway supplies the address; missing addresses share one conservative bucket.
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown';
  let activation: { outcome: string } | undefined;
  for (const hash of [keyHash, legacyHash]) {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_hyro_activation`, {
      method: 'POST', headers,
      body: JSON.stringify({ p_key_hash: `\\x${hash}`,
        p_device_hash: `\\x${deviceHash}`, p_ip_hash: `\\x${await digest(`ip:${ip}`)}` }),
    });
    if (!response.ok) return json(503, { error: 'server_unavailable' });
    [activation] = await response.json() as Array<{ outcome: string }>;
    if (activation?.outcome !== 'invalid') break;
  }
  if (!activation || activation.outcome === 'invalid') return json(403, { error: 'invalid_license' });
  if (activation.outcome === 'rate_limited') return json(429, { error: 'rate_limited' });
  if (activation.outcome === 'device_limit') return json(409, { error: 'already_bound' });
  if (activation.outcome !== 'active') return json(503, { error: 'server_unavailable' });

  const issuedAt = Date.now();
  const claims = encoder.encode(JSON.stringify({
    version: 1, product: 'hyro-visuals', device,
    binding: hex(new Uint8Array(await crypto.subtle.digest('SHA-256',
      encoder.encode(JSON.stringify([key, token]))))),
    issuedAt, expiresAt: issuedAt + 7 * 24 * 60 * 60 * 1000,
  }));
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', signingKey, claims));
  return json(200, { mode: 'hyro', active: true,
    offline_receipt: { payload: base64(claims), signature: base64(signature) } });
});
