import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { handle } from '../supabase/functions/wompi-checkout/handler.ts';

const checkoutId = '11111111-1111-4111-8111-111111111111';
const transactionId = '22222222-2222-4222-8222-222222222222';
const appId = '33333333-3333-4333-8333-333333333333';
const env = { WOMPI_ENABLED: 'true', WOMPI_MODE: 'test', WOMPI_APP_ID: appId,
  WOMPI_API_SECRET: 'test-secret', HYRO_SITE_URL: 'https://test.byhyro.com',
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public',
  SUPABASE_SERVICE_ROLE_KEY: 'server', LICENSE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') };
const event = { EnlacePago: { Id: 42, IdentificadorEnlaceComercio: checkoutId },
  IdTransaccion: transactionId, ResultadoTransaccion: 'ExitosaAprobada', Monto: 20, EsProductiva: false };
const signed = (value) => {
  const raw = JSON.stringify(value);
  return new Request('https://example.supabase.co/functions/v1/wompi-checkout?webhook=1', {
    method: 'POST', headers: { wompi_hash: createHmac('sha256', env.WOMPI_API_SECRET).update(raw).digest('hex') }, body: raw,
  });
};
const json = (data) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

test('rejects a webhook with an invalid signature before any network call', async () => {
  const request = signed(event);
  request.headers.set('wompi_hash', '0'.repeat(64));
  const response = await handle(request, env, () => { throw new Error('unexpected fetch'); });
  assert.equal(response.status, 401);
});

test('verifies a Wompi test transaction without issuing a real license', async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(String(url));
    const path = new URL(url).pathname;
    if (path === '/connect/token') return json({ access_token: 'provider-token' });
    if (path === '/rest/v1/wompi_checkouts') return json([{ id: checkoutId, link_id: 42, is_productive: false, status: 'pending' }]);
    if (path === '/EnlacePago/42') return json({ idEnlace: 42, idAplicativo: appId, estaProductivo: false,
      monto: 20, transaccionCompra: { idTransaccion: transactionId } });
    if (path === `/TransaccionCompra/${transactionId}`) return json({ idTransaccion: transactionId,
      esAprobada: true, resultadoTransaccion: 0, esReal: false, monto: 20, montoOriginal: 20 });
    throw new Error(`unexpected ${path}`);
  };
  const response = await handle(signed(event), env, fetcher);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).test, true);
  assert.ok(!calls.some(call => call.includes('/rpc/complete_wompi_purchase')));
});

test('rejects a signed event when the provider amount differs', async () => {
  const fetcher = async (url) => {
    const path = new URL(url).pathname;
    if (path === '/connect/token') return json({ access_token: 'provider-token' });
    if (path === '/rest/v1/wompi_checkouts') return json([{ id: checkoutId, link_id: 42, is_productive: false, status: 'pending' }]);
    if (path === '/EnlacePago/42') return json({ idEnlace: 42, idAplicativo: appId, estaProductivo: false,
      monto: 19, transaccionCompra: { idTransaccion: transactionId } });
    if (path === `/TransaccionCompra/${transactionId}`) return json({ idTransaccion: transactionId,
      esAprobada: true, resultadoTransaccion: 0, esReal: false, monto: 20, montoOriginal: 20 });
    throw new Error(`unexpected ${path}`);
  };
  const response = await handle(signed(event), env, fetcher);
  assert.equal(response.status, 409);
});

test('a real approved payment reaches atomic fulfillment only after provider checks', async () => {
  const liveEnv = { ...env, WOMPI_MODE: 'live' };
  const liveEvent = { ...event, EsProductiva: true };
  const raw = JSON.stringify(liveEvent);
  const request = new Request('https://example.supabase.co/functions/v1/wompi-checkout?webhook=1', {
    method: 'POST', headers: { wompi_hash: createHmac('sha256', liveEnv.WOMPI_API_SECRET).update(raw).digest('hex') }, body: raw,
  });
  const calls = [];
  const fetcher = async (url, options) => {
    const path = new URL(url).pathname;
    calls.push(path);
    if (path === '/connect/token') return json({ access_token: 'provider-token' });
    if (path === '/rest/v1/wompi_checkouts') return json([{ id: checkoutId, link_id: 42, is_productive: true, status: 'pending' }]);
    if (path === '/EnlacePago/42') return json({ idEnlace: 42, idAplicativo: appId, estaProductivo: true,
      monto: 20, transaccionCompra: { idTransaccion: transactionId } });
    if (path === `/TransaccionCompra/${transactionId}`) return json({ idTransaccion: transactionId,
      esAprobada: true, resultadoTransaccion: 0, esReal: true, monto: 20, montoOriginal: 20 });
    if (path === '/rest/v1/rpc/complete_wompi_purchase') {
      const payload = JSON.parse(options.body);
      assert.equal(payload.p_checkout_id, checkoutId);
      assert.equal(payload.p_transaction_id, transactionId);
      return json(checkoutId);
    }
    throw new Error(`unexpected ${path}`);
  };
  const response = await handle(request, liveEnv, fetcher);
  assert.equal(response.status, 200);
  assert.deepEqual(calls.slice(-3), ['/EnlacePago/42', `/TransaccionCompra/${transactionId}`,
    '/rest/v1/rpc/complete_wompi_purchase']);
});
