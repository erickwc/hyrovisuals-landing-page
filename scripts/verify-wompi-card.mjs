import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHmac, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { handle, validatePayment, challengeUrl } from '../supabase/functions/wompi-card/handler.ts';

const user = '11111111-1111-4111-8111-111111111111';
const product = '22222222-2222-4222-8222-222222222222';
const env = { WOMPI_CARD_ENABLED: 'true', WOMPI_MODE: 'test', WOMPI_CARD_PRICE_CENTS: '2000', WOMPI_APP_ID: 'mock-app', WOMPI_API_SECRET: 'mock-secret',
  HYRO_SITE_URL: 'https://test.byhyro.com', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public',
  SUPABASE_SERVICE_ROLE_KEY: 'service', LICENSE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') };
// Synthetic values used only by the mocked transport. Never sent to a payment service.
const payment = () => ({ action: 'create', request_id: randomUUID(), expected_amount_cents: 2000, card: { number: '4111111111111111', cvv: '123', month: 12, year: 2030 },
  billing: { nombre: 'Test', apellido: 'Buyer', email: 'test@example.com', ciudad: 'San Salvador', direccion: 'Test address',
    idPais: 'SV', idRegion: 'SV-SS', codigoPostal: '1101', telefono: '50370000000' } });
const request = body => new Request('https://example.supabase.co/functions/v1/wompi-card', { method: 'POST',
  headers: { origin: env.HYRO_SITE_URL, authorization: 'Bearer test-jwt' }, body: JSON.stringify(body) });
const webhook = id => {
  const body = JSON.stringify({ IdTransaccion: id });
  return new Request('https://example.supabase.co/functions/v1/wompi-card?webhook=1', { method: 'POST', body,
    headers: { wompi_hash: createHmac('sha256', env.WOMPI_API_SECRET).update(body).digest('hex') } });
};
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
async function fixture(real = false) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table profiles(id uuid primary key);
    create table products(id uuid primary key,slug text,price_cents integer,currency text,is_active boolean);
    create table orders(id uuid primary key default gen_random_uuid(),user_id uuid references profiles(id),status text,total_cents integer,currency text,
      paypal_capture_id text unique,payhip_transaction_id text unique,wompi_transaction_id uuid unique,buyer_email text,paid_at timestamptz,
      constraint paid_has_gateway_transaction check(status<>'paid' or (paid_at is not null and num_nonnulls(paypal_capture_id,payhip_transaction_id,wompi_transaction_id)=1)));
    create table order_items(id uuid primary key default gen_random_uuid(),order_id uuid references orders(id),product_id uuid references products(id),unit_price_cents integer,currency text,quantity integer);
    create table licenses(id uuid primary key default gen_random_uuid(),user_id uuid references profiles(id),product_id uuid references products(id),order_id uuid references orders(id),order_item_id uuid references order_items(id),
      key_hash bytea,key_ciphertext bytea,key_nonce bytea,key_version integer,status text default 'active',issued_at timestamptz default now(),revoked_at timestamptz,activation_epoch integer default 0,unique(user_id,product_id));
    create table license_activations(id uuid primary key default gen_random_uuid(),license_id uuid references licenses(id),deactivated_at timestamptz);
    insert into profiles values('${user}'); insert into products values('${product}','hyro-visuals',2000,'USD',true);`);
  for (const name of ['20261028174009_wompi_card_3ds.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  }
  await db.exec('alter table public.wompi_card_checkouts add column amount_cents integer not null default 2000');
  const state = { posts: 0, failCreate: false, transactions: new Map(), writes: [], lastPayload: null, calls: [] };
  const fetcher = async (input, init = {}) => {
    const url = new URL(input);
    state.calls.push(url.pathname);
    if (url.pathname === '/auth/v1/user') return json({ id: user, email: 'account@example.com', email_confirmed_at: '2026-01-01' });
    if (url.pathname === '/connect/token') return json({ access_token: 'provider-token' });
    if (url.origin === 'https://api.wompi.sv') {
      if (url.pathname === '/Aplicativo') return json({ clientIdApi: 'mock-app', estaProductivo: real, clientSecret: 'NEVER-RETURN-THIS' });
      if (url.pathname === '/api/Regiones') return json([{ id: 'SV', nombre: 'El Salvador', territorios: [{ id: 'SV-SS', nombre: 'San Salvador' }] }]);
      if (url.pathname === '/TransaccionCompra/3Ds') {
        state.posts++;
        const body = JSON.parse(init.body);
        state.lastPayload = body;
        assert.equal(init.redirect, 'error');
        if (state.failCreate) throw new Error('Sensitive upstream request: 4111111111111111');
        const id = randomUUID();
        state.transactions.set(id, { idTransaccion: id, idExterno: body.idExterno, esReal: real, monto: 20,
          montoOriginal: 20, esAprobada: false, resultadoTransaccion: null });
        return json({ idTransaccion: id, esReal: real, monto: 20, urlCompletarPago3Ds: `https://mock.wompi.sv/challenge/${id}` });
      }
      if (url.pathname.startsWith('/TransaccionCompra/')) return json(state.transactions.get(url.pathname.split('/').at(-1)));
      throw new Error('Unexpected provider path');
    }
    assert.equal(url.origin, env.SUPABASE_URL);
    assert.equal(init.headers.authorization, 'Bearer service');
    const path = url.pathname.replace('/rest/v1/', '');
    const body = init.body ? JSON.parse(init.body) : null;
    if (body) state.writes.push(body);
    await db.exec('set role service_role');
    try {
      if (path === 'rpc/reserve_wompi_card_checkout') {
        const result = await db.query('select reserve_wompi_card_checkout($1,$2,$3,$4) as result', [body.p_user_id,body.p_request_id,body.p_is_productive,body.p_buyer_email]);
        return json(result.rows[0].result);
      }
      if (path === 'rpc/bind_wompi_card_transaction') {
        await db.query('select bind_wompi_card_transaction($1,$2)', [body.p_checkout_id,body.p_transaction_id]); return json(null);
      }
      if (path === 'rpc/complete_wompi_card_purchase') {
        const keys = ['p_key_hash','p_key_ciphertext','p_key_nonce'].map(k => Buffer.from(body[k].slice(2), 'hex'));
        const result = await db.query('select complete_wompi_card_purchase($1,$2,$3,$4,$5) as id', [body.p_checkout_id,body.p_transaction_id,...keys]);
        return json(result.rows[0].id);
      }
      assert.equal(path, 'wompi_card_checkouts');
      const id = url.searchParams.get('id')?.slice(3);
      if (init.method === 'PATCH') {
        const row = (await db.query('select * from wompi_card_checkouts where id=$1', [id])).rows[0];
        const filter = url.searchParams.get('status');
        const allowed = filter?.startsWith('in.(') ? filter.slice(4, -1).split(',').includes(row.status) :
          filter?.startsWith('neq.') ? row.status !== filter.slice(4) : !filter || row.status === filter.slice(3);
        if (allowed) for (const [key, value] of Object.entries(body)) {
          assert.ok(['status', 'challenge_url'].includes(key));
          await db.query(`update wompi_card_checkouts set ${key}=$1 where id=$2`, [value,id]);
        }
        return new Response(null, { status: 204 });
      }
      return json(id ? (await db.query('select * from wompi_card_checkouts where id=$1', [id])).rows :
        (await db.query('select * from wompi_card_checkouts where user_id=$1 and request_id=$2',
          [url.searchParams.get('user_id').slice(3),url.searchParams.get('request_id').slice(3)])).rows);
    } finally { await db.exec('reset role'); }
  };
  return { db, state, fetcher, config: { ...env, WOMPI_MODE: real ? 'live' : 'test', WOMPI_CARD_LIVE_ENABLED: real ? 'true' : 'false' } };
}

test('card validation and redirect boundaries', () => {
  assert.throws(() => validatePayment({ ...payment(), card: { number: '4111111111111112', cvv: '123', month: 12, year: 2030 } }));
  assert.throws(() => validatePayment({ ...payment(), card: { number: '4111111111111111', cvv: '123', month: 1, year: 2020 } }));
  assert.throws(() => challengeUrl('https://wompi.sv.evil.example/'));
  assert.throws(() => challengeUrl('http://mock.wompi.sv/'));
  assert.throws(() => challengeUrl('https://user:password@wompi.sv/'));
});
test('disabled live capture and invalid webhook fail before network', async () => {
  const noNetwork = () => { throw new Error('Unexpected network call'); };
  assert.equal((await handle(request(payment()), { ...env, WOMPI_MODE: 'live' }, noNetwork)).status, 503);
  const event = webhook(randomUUID()); event.headers.set('wompi_hash', '0'.repeat(64));
  assert.equal((await handle(event, env, noNetwork)).status, 401);
});
test('test checkout uses real SQL reservation, avoids duplicate provider calls and never grants a license', async () => {
  const f = await fixture();
  try {
    const configResponse = await handle(request({ action: 'config' }), f.config, f.fetcher);
    assert.ok(!(await configResponse.text()).includes('NEVER-RETURN-THIS'));
    const body = payment();
    const created = await handle(request(body), f.config, f.fetcher);
    assert.equal(created.status, 200);
    assert.equal((await created.json()).status, 'awaiting_3ds');
    await handle(request(body), f.config, f.fetcher);
    await handle(request(payment()), f.config, f.fetcher);
    assert.equal(f.state.posts, 1);
    assert.equal(f.state.lastPayload.monto, 20);
    const serialized = JSON.stringify(f.state.writes);
    assert.ok(!serialized.includes(body.card.number));
    assert.ok(!serialized.includes('"cvv"'));
    const transaction = [...f.state.transactions.values()][0];
    const pending = await handle(request({ action: 'status', request_id: body.request_id }), f.config, f.fetcher);
    assert.equal((await pending.json()).status, 'awaiting_3ds');
    Object.assign(transaction, { esAprobada: true, resultadoTransaccion: 0 });
    const confirmed = await handle(webhook(transaction.idTransaccion), f.config, f.fetcher);
    assert.equal((await confirmed.json()).status, 'test_paid');
    assert.equal((await f.db.query('select count(*)::int as n from licenses')).rows[0].n, 0);
    const row = (await f.db.query('select * from wompi_card_checkouts')).rows[0];
    await assert.rejects(f.db.query('select complete_wompi_card_purchase($1,$2,$3,$4,$5)',
      [row.id,row.transaction_id,Buffer.alloc(32),Buffer.alloc(40),Buffer.alloc(12)]), /unverified checkout/);
    await f.db.exec('set role authenticated');
    await assert.rejects(f.db.query('select * from wompi_card_checkouts'), /permission denied/);
    await assert.rejects(f.db.query('select bind_wompi_card_transaction($1,$2)', [row.id,row.transaction_id]), /permission denied/);
    await f.db.exec('reset role');
  } finally { await f.db.close(); }
});
test('real payment needs matching provider reference and amount; duplicate confirmation is atomic', async () => {
  const f = await fixture(true);
  try {
    const body = payment();
    await handle(request(body), f.config, f.fetcher);
    const transaction = [...f.state.transactions.values()][0];
    Object.assign(transaction, { esAprobada: true, resultadoTransaccion: 0, monto: 19 });
    assert.equal((await handle(webhook(transaction.idTransaccion), f.config, f.fetcher)).status, 409);
    const original = transaction.idExterno;
    transaction.monto = 20; transaction.idExterno = randomUUID();
    assert.equal((await handle(request({ action: 'status', request_id: body.request_id }), f.config, f.fetcher)).status, 409);
    transaction.idExterno = original;
    for (let i = 0; i < 2; i++) assert.equal((await handle(webhook(transaction.idTransaccion), f.config, f.fetcher)).status, 200);
    assert.equal((await f.db.query('select count(*)::int as n from orders')).rows[0].n, 1);
    assert.equal((await f.db.query('select count(*)::int as n from licenses')).rows[0].n, 1);
    assert.equal((await f.db.query('select status from wompi_card_checkouts')).rows[0].status, 'paid');
  } finally { await f.db.close(); }
});
test('timeout remains under review and cannot create another charge with a new request ID', async () => {
  const f = await fixture();
  try {
    f.state.failCreate = true;
    const response = await handle(request(payment()), f.config, f.fetcher);
    const text = await response.text();
    assert.ok(text.includes('review'));
    assert.ok(!text.includes('4111111111111111'));
    await handle(request(payment()), f.config, f.fetcher);
    assert.equal(f.state.posts, 1);
    assert.equal((await f.db.query('select status from wompi_card_checkouts')).rows[0].status, 'review');
  } finally { await f.db.close(); }
});
