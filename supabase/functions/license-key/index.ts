export {};
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const corsOrigin = (origin: string | null) =>
  origin && (origin === 'https://byhyro.com' || origin === 'https://www.byhyro.com' || origin === 'http://localhost:4321')
    ? origin : 'https://byhyro.com';
const response = (origin: string, status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS', 'vary': 'Origin',
    'cache-control': 'no-store' },
});

Deno.serve(async (request: Request) => {
  const origin = corsOrigin(request.headers.get('origin'));
  if (request.method === 'OPTIONS') return response(origin, 200, {});
  if (request.method !== 'POST') return response(origin, 405, { error: 'method_not_allowed' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secret = Deno.env.get('LICENSE_ENCRYPTION_KEY');
  const bearer = request.headers.get('authorization');
  if (!supabaseUrl || !anonKey || !serviceKey || !secret) return response(origin, 503, { error: 'server_not_configured' });
  if (!bearer?.startsWith('Bearer ')) return response(origin, 401, { error: 'unauthorized' });
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization: bearer },
  });
  if (!userResponse.ok) return response(origin, 401, { error: 'unauthorized' });
  const user = await userResponse.json();
  let licenseId: string;
  try { licenseId = (await request.json()).license_id; } catch { return response(origin, 400, { error: 'invalid_json' }); }
  if (typeof licenseId !== 'string' || !/^[0-9a-f-]{36}$/i.test(licenseId)) return response(origin, 400, { error: 'invalid_license' });
  const params = new URLSearchParams({ id: `eq.${licenseId}`, user_id: `eq.${user.id}`, status: 'eq.active', select: 'key_ciphertext,key_nonce,key_version' });
  const licenseResponse = await fetch(`${supabaseUrl}/rest/v1/licenses?${params}`, {
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
  });
  if (!licenseResponse.ok) return response(origin, 500, { error: 'lookup_failed' });
  const [license] = await licenseResponse.json();
  if (!license || license.key_version !== 1 || !license.key_ciphertext || !license.key_nonce) {
    return response(origin, 404, { error: 'license_unavailable' });
  }
  try {
    const keyBytes = Uint8Array.from(atob(secret), (char) => char.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const fromHex = (value: string) => Uint8Array.from((value.startsWith('\\x') ? value.slice(2) : value).match(/.{2}/g)!, (pair) => parseInt(pair, 16));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromHex(license.key_nonce) }, key, fromHex(license.key_ciphertext));
    return response(origin, 200, { key: new TextDecoder().decode(plain) });
  } catch { return response(origin, 500, { error: 'license_unavailable' }); }
});
