import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { handle } from '../supabase/functions/whop-webhook/handler.ts';
const env = { WHOP_WEBHOOK_SECRET:'ws_test_secret', WHOP_API_KEY:'test', SUPABASE_URL:'https://db.example', SUPABASE_SERVICE_ROLE_KEY:'server', LICENSE_ENCRYPTION_KEY:Buffer.alloc(32,9).toString('base64') };
const payment = { id:'pay_example', company:{id:'biz_XOirHolBiKU66x'}, plan:{id:'plan_Alosf0V6ZsprM'}, status:'paid', substatus:'succeeded', total:20, currency:'usd', metadata:{hyro_intent:'11111111-1111-4111-8111-111111111111'}, user:{email:'buyer@example.com'} };
function signed(event, time = Math.floor(Date.now()/1000)) {
  const body=JSON.stringify(event); const id='msg_example';
  return new Request('https://db.example/webhook',{method:'POST',body,headers:{'webhook-id':id,'webhook-timestamp':String(time),'webhook-signature':'v1,'+createHmac('sha256',env.WHOP_WEBHOOK_SECRET).update(`${id}.${time}.${body}`).digest('base64')}});
}
const event={type:'payment.succeeded',account_id:'biz_XOirHolBiKU66x',data:{id:'pay_example'}};
const response = data => new Response(JSON.stringify(data));
test('rejects altered payloads and old signatures without network access',async()=>{
  const req=signed(event); req.headers.set('webhook-signature','v1,invalid');
  const never=()=>{throw Error('network must not run');};
  assert.equal((await handle(req,env,never)).status,401);
  assert.equal((await handle(signed(event,1),env,never)).status,401);
});
test('delivers only after authoritative payment verification; encrypted key decrypts',async()=>{
  let issued;
  const r=await handle(signed(event),env,async(url,options)=>{
    if(String(url).includes('/payments/')) return response(payment);
    issued=JSON.parse(options.body); return response('order');
  });
  assert.equal(r.status,200); assert.equal(issued.p_intent_id,payment.metadata.hyro_intent);
  const key=await crypto.subtle.importKey('raw',Buffer.from(env.LICENSE_ENCRYPTION_KEY,'base64'),'AES-GCM',false,['decrypt']);
  const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(issued.p_key_nonce.slice(2),'hex')},key,Buffer.from(issued.p_key_ciphertext.slice(2),'hex'));
  assert.match(new TextDecoder().decode(decoded),/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
});
test('wrong plan and unpaid payments never grant access',async()=>{
  for(const update of [{plan:{id:'other'}},{status:'open'},{substatus:'failed'}]){
    let calls=0;
    const r=await handle(signed(event),env,async()=>{calls++;return response({...payment,...update});});
    assert.equal(r.status,200);assert.equal(calls,1);
  }
});
test('refund wins over a delayed success and calls only revocation',async()=>{
  const urls=[];
  const r=await handle(signed(event),env,async(url)=>{urls.push(String(url)); return response(urls.length===1?{...payment,substatus:'refunded',refunded_amount:20}:true);});
  assert.equal(r.status,200);assert.ok(urls[1].endsWith('/refund_whop_purchase'));
});
test('transient provider failure returns retryable status',async()=>{
  assert.equal((await handle(signed(event),env,async()=>new Response('',{status:503}))).status,502);
});
test('missing intent fails closed and local currency remains supported',async()=>{
  assert.equal((await handle(signed(event),env,async()=>response({...payment,metadata:{}}))).status,422);
  let issued;
  await handle(signed(event),env,async(url,options)=>{if(String(url).includes('/payments/'))return response({...payment,total:18000,currency:'clp'});issued=JSON.parse(options.body);return response('order');});
  assert.equal(issued.p_currency,'CLP');assert.equal(issued.p_amount_cents,1800000);
});
