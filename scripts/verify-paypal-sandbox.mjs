import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const source = await fs.readFile(new URL('../server/paypal-sandbox.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { handleSandbox } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const user = '12345678-1234-4234-8234-123456789abc';
const id = '62X93840R6294013J';
const env = { PAYPAL_SANDBOX_ENABLED:'true', PAYPAL_SANDBOX_CLIENT_ID:'test-client', PAYPAL_SANDBOX_CLIENT_SECRET:'test-secret', PUBLIC_SUPABASE_URL:'https://test.supabase.co', PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test-key' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const order = (status = 'APPROVED') => ({
  id, status, intent:'CAPTURE', purchase_units:[
    ['HYRO-seller-1','8CFHEVR7JKBYN','53N65304P60793347'],
    ['HYRO-seller-2','JB93BNVTVJBTG','13582787V09737535'],
  ].map(([reference_id,merchant_id,captureId]) => ({
    reference_id, custom_id:`hyro-sandbox:${user}`, payee:{merchant_id}, amount:{currency_code:'USD',value:'10.00'},
    ...(status==='COMPLETED' ? { payments:{captures:[{id:captureId,status:'COMPLETED',amount:{currency_code:'USD',value:'10.00'},seller_receivable_breakdown:{paypal_fee:{value:'0.99'},net_amount:{value:'9.01'}}}]} } : {}),
  })),
});
const request = (body, token = true) => new Request('http://localhost:8788/api/paypal-sandbox', { method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:8788',...(token?{authorization:'Bearer test-jwt'}:{})},body:JSON.stringify(body) });
function mock(options = {}) {
  const calls=[];
  const fetcher = async (url, init = {}) => {
    calls.push({url,init});
    if(url.endsWith('/auth/v1/user')) return json({id:options.user ?? user},options.authStatus ?? 200);
    assert.ok(url.startsWith('https://api-m.sandbox.paypal.com/'), 'Only Sandbox calls allowed');
    if(url.endsWith('/v1/oauth2/token')) return json({access_token:'test-access-token'});
    if(url.endsWith('/capture')) return json(options.captured ?? order('COMPLETED'),options.captureStatus ?? 201);
    if(init.method==='POST') return json({id,links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token='+id}]});
    return json(options.current ?? order());
  };
  return {calls,fetcher};
}

test('rejects unauthenticated, disabled and cross-origin checkout without contacting PayPal', async () => {
  const m=mock();
  assert.equal((await handleSandbox(request({action:'create'},false),env,m.fetcher)).status,401);
  assert.equal((await handleSandbox(request({action:'create'}),{...env,PAYPAL_SANDBOX_ENABLED:'false'},m.fetcher)).status,503);
  const foreign=request({action:'create'}); foreign.headers.set('origin','https://other.example');
  assert.equal((await handleSandbox(foreign,env,m.fetcher)).status,403);
  assert.equal(m.calls.length,0);
});
test('validates the session on the server', async () => {
  const m=mock({authStatus:401});
  assert.equal((await handleSandbox(request({action:'capture',order_id:id}),env,m.fetcher)).status,401);
  assert.equal(m.calls.length,1);
});
test('ignores client prices and payees; fixes two $10 sellers and return URLs', async () => {
  const m=mock(); const body={action:'create',request_id:user,amount:'0.01',payee:'attacker',return_url:'https://evil.example'};
  assert.equal((await handleSandbox(request(body),env,m.fetcher)).status,200);
  const creation=m.calls.find(c=>c.url.endsWith('/v2/checkout/orders'));
  const sent=JSON.parse(creation.init.body);
  assert.deepEqual(sent.purchase_units.map(u=>[u.amount.value,u.payee.merchant_id]),[['10.00','8CFHEVR7JKBYN'],['10.00','JB93BNVTVJBTG']]);
  assert.equal(sent.payment_source.paypal.experience_context.return_url,'http://localhost:8788/compra/sandbox/');
  assert.ok(!JSON.stringify(await (await handleSandbox(request(body),env,m.fetcher)).json()).includes('test-secret'));
  const creates=m.calls.filter(c=>c.url.endsWith('/v2/checkout/orders'));
  assert.equal(creates[0].init.headers['PayPal-Request-Id'],creates[1].init.headers['PayPal-Request-Id']);
});
test('captures only owned orders with the correct amount and sellers', async () => {
  for (const mutate of [o=>o.purchase_units[0].custom_id='hyro-sandbox:other',o=>o.purchase_units[1].amount.value='1.00',o=>o.purchase_units[1].payee.merchant_id='OTHER',o=>o.purchase_units.pop()]) {
    const current=order();mutate(current);const m=mock({current});
    assert.ok((await handleSandbox(request({action:'capture',order_id:id}),env,m.fetcher)).status>=400);
    assert.ok(!m.calls.some(c=>c.url.endsWith('/capture')));
  }
});
test('returns both verified captures; refresh never captures a completed order again', async () => {
  const m=mock();const result=await (await handleSandbox(request({action:'capture',order_id:id}),env,m.fetcher)).json();
  assert.equal(result.status,'COMPLETED');assert.equal(result.payments.length,2);
  assert.deepEqual(result.payments.map(p=>[p.amount,p.net]),[['10.00','9.01'],['10.00','9.01']]);
  const replay=mock({current:order('COMPLETED')});
  assert.equal((await handleSandbox(request({action:'capture',order_id:id}),env,replay.fetcher)).status,200);
  assert.ok(!replay.calls.some(c=>c.url.endsWith('/capture')));
});
test('unapproved and partially captured orders cannot trigger another charge', async () => {
  for(const current of [order('CREATED'),order('PAYER_ACTION_REQUIRED'),order('COMPLETED')]) {
    if(current.status==='COMPLETED') { current.status='APPROVED';current.purchase_units[1].payments.captures=[]; }
    const m=mock({current});
    assert.equal((await handleSandbox(request({action:'capture',order_id:id}),env,m.fetcher)).status,409);
    assert.ok(!m.calls.some(c=>c.url.endsWith('/capture')));
  }
});
test('a pending capture, partial response or wrong captured amount never means success', async () => {
  for(const mutate of [o=>o.purchase_units[0].payments.captures[0].status='PENDING',o=>o.purchase_units[1].payments.captures=[],o=>o.purchase_units[0].payments.captures[0].amount.value='9.00']) {
    const captured=order('COMPLETED');mutate(captured);const m=mock({captured,captureStatus:207});
    assert.equal((await handleSandbox(request({action:'capture',order_id:id}),env,m.fetcher)).status,409);
  }
});
test('capture retries use a stable idempotency key', async () => {
  const m=mock();
  await handleSandbox(request({action:'capture',order_id:id}),env,m.fetcher);
  await handleSandbox(request({action:'capture',order_id:id}),env,m.fetcher);
  const calls=m.calls.filter(c=>c.url.endsWith('/capture'));
  assert.equal(calls[0].init.headers['PayPal-Request-Id'],calls[1].init.headers['PayPal-Request-Id']);
});
