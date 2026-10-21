import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const source=await fs.readFile(new URL('../supabase/functions/paypal-checkout/handler.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {handle,verifyOrder,recipients}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const env={PAYPAL_LIVE_ENABLED:'true',PAYPAL_LIVE_CLIENT_ID:'client',PAYPAL_LIVE_CLIENT_SECRET:'secret',PAYPAL_LIVE_BN_CODE:'live-bn',PAYPAL_LIVE_WEBHOOK_ID:'webhook',HYRO_SITE_URL:'https://byhyro.com',SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',LICENSE_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
const user='11111111-1111-4111-8111-111111111111';
const product='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333';
const paypalOrder='39Y34524KY3960236';
const captureIds=['7HN41519CA055632X','54A103886X5533306'];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
const request=body=>new Request('https://project.supabase.co/functions/v1/paypal-checkout',{method:'POST',headers:{origin:'https://byhyro.com',authorization:'Bearer user-jwt','content-type':'application/json'},body:JSON.stringify(body)});
const webhook=(type='PAYMENT.CAPTURE.COMPLETED')=>new Request('https://project.supabase.co/functions/v1/paypal-checkout?webhook=1',{method:'POST',headers:Object.fromEntries(['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'].map(k=>[k,'test'])),body:JSON.stringify({event_type:type,resource:{id:type==='CHECKOUT.ORDER.APPROVED'?paypalOrder:captureIds[0],supplementary_data:{related_ids:{order_id:paypalOrder}}}})});

test('Live payment and delivery: real SQL transaction, mocked PayPal transport',async t=>{
  const db=new PGlite();
  try {
    // Baseline fields/constraints used by existing Payhip migrations. Production schema is not modified.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to public;
      create table profiles(id uuid primary key);
      create table products(id uuid primary key,slug text,name text,price_cents integer,currency text,is_active boolean);
      create table orders(id uuid primary key default gen_random_uuid(),user_id uuid references profiles(id),status text,total_cents integer,currency text,paypal_order_id text,paypal_capture_id text unique,payhip_transaction_id text unique,buyer_email text,paid_at timestamptz,updated_at timestamptz,
        constraint paid_has_gateway_transaction check(status<>'paid' or (paid_at is not null and ((paypal_capture_id is not null and payhip_transaction_id is null) or (paypal_capture_id is null and payhip_transaction_id is not null)))));
      create table order_items(id uuid primary key default gen_random_uuid(),order_id uuid references orders(id),product_id uuid references products(id),unit_price_cents integer,currency text,quantity integer);
      create table licenses(id uuid primary key default gen_random_uuid(),user_id uuid references profiles(id),product_id uuid references products(id),order_id uuid references orders(id),order_item_id uuid references order_items(id),key_hash bytea,key_ciphertext bytea,key_nonce bytea,key_version integer,status text default 'active',issued_at timestamptz default now(),revoked_at timestamptz,activation_epoch integer default 0,unique(user_id,product_id));
      create table license_activations(id uuid primary key default gen_random_uuid(),license_id uuid references licenses(id),deactivated_at timestamptz);
      insert into profiles values('${user}'); insert into products values('${product}','hyro-visuals','HYRO Visuals',2000,'USD',true);`);
    const migration=await fs.readFile(new URL('../supabase/migrations/20261021190157_paypal_live_delivery.sql',import.meta.url),'utf8');
    await db.exec(migration);
    let currentOrder;
    let approved=false;
    let signature='SUCCESS';
    let captureCount=0;
    let createdPayload;
    const rpcParams=[];
    const fetcher=async(input,init={})=>{
      const url=new URL(input);const body=init.body?JSON.parse(init.body.startsWith('{')?init.body:'{}'):null;
      if(url.pathname==='/auth/v1/user') return json({id:user});
      if(url.origin==='https://api-m.paypal.com') {
        if(url.pathname==='/v1/oauth2/token') return json({access_token:'paypal-token'});
        if(url.pathname==='/v1/notifications/verify-webhook-signature') return json({verification_status:signature});
        if(url.pathname==='/v2/checkout/orders'&&init.method==='POST') {
          createdPayload=body; currentOrder={id:paypalOrder,intent:'CAPTURE',status:'CREATED',purchase_units:body.purchase_units,payer:{email_address:'buyer@example.com'},links:[{rel:'payer-action',href:`https://www.paypal.com/checkoutnow?token=${paypalOrder}`}]};
          return json(structuredClone(currentOrder));
        }
        if(url.pathname.endsWith('/capture')) {
          assert.equal(approved,true);captureCount++;currentOrder.status='COMPLETED';
          currentOrder.purchase_units.forEach((u,i)=>u.payments={captures:[{id:captureIds[i],status:'COMPLETED',amount:{value:'10.00',currency_code:'USD'}}]});
          return json(structuredClone(currentOrder),201);
        }
        if(url.pathname===`/v2/checkout/orders/${paypalOrder}`) return json(structuredClone(currentOrder));
        throw Error('Unexpected PayPal request: '+url.pathname);
      }
      assert.equal(url.origin,'https://project.supabase.co');
      assert.equal(init.headers.authorization,'Bearer service');
      const table=url.pathname.replace('/rest/v1/','');
      if(table.startsWith('rpc/')) {
        rpcParams.push({table,body});
        if(table==='rpc/complete_paypal_purchase') {
          const values=['p_checkout_id','p_paypal_order_id','p_capture_1','p_capture_2','p_buyer_email','p_key_hash','p_key_ciphertext','p_key_nonce'].map((k,i)=>i<5?body[k]:Buffer.from(body[k].slice(2),'hex'));
          await db.exec('set role service_role');
          try { const result=await db.query('select complete_paypal_purchase($1,$2,$3,$4,$5,$6,$7,$8) as id',values);return json(result.rows[0].id); }
          finally { await db.exec('reset role'); }
        }
        await db.query('select refund_paypal_purchase($1)',[body.p_checkout_id]);return json(null);
      }
      if(table==='products') return json((await db.query('select * from products')).rows);
      if(table==='licenses') return json((await db.query("select id from licenses where user_id=$1 and status='active'",[user])).rows);
      assert.equal(table,'paypal_checkouts');
      if(init.method==='POST') {await db.query('insert into paypal_checkouts(user_id,product_id,request_id) values($1,$2,$3) on conflict(user_id,request_id) do nothing',[body.user_id,body.product_id,body.request_id]);return json([]);}
      if(init.method==='PATCH') {await db.query('update paypal_checkouts set paypal_order_id=$1 where id=$2 and paypal_order_id is null',[body.paypal_order_id,url.searchParams.get('id').slice(3)]);return new Response(null,{status:204});}
      const column=url.searchParams.has('paypal_order_id')?'paypal_order_id':'request_id';
      return json((await db.query(`select * from paypal_checkouts where ${column}=$1`,[url.searchParams.get(column).slice(3)])).rows);
    };
    await t.test('Live stays disabled without explicit configuration',async()=>{
      const response=await handle(request({action:'create',request_id:requestId}),{...env,PAYPAL_LIVE_ENABLED:'false'},()=>{throw Error('network must not run');});
      assert.equal(response.status,503);
    });
    await t.test('creates fixed $10 + $10 recipients and binds checkout to the HYRO account',async()=>{
      const response=await handle(request({action:'create',request_id:requestId,amount:'0.01',payee:'attacker'}),env,fetcher);
      assert.equal(response.status,200);assert.equal((await response.json()).order_id,paypalOrder);
      assert.deepEqual(createdPayload.purchase_units.map(u=>[u.payee.email_address,u.amount.value]),[
        ['erickcaceres1717@gmail.com','10.00'],['djgioes@gmail.com','10.00'],
      ]);
      assert.equal((await db.query('select count(*)::int as n from licenses')).rows[0].n,0);
      assert.equal(createdPayload.purchase_units[0].custom_id,createdPayload.purchase_units[1].custom_id);
    });
    await t.test('unapproved or altered orders never deliver',async()=>{
      assert.equal((await handle(request({action:'capture',order_id:paypalOrder}),env,fetcher)).status,409);
      const check=(await db.query('select * from paypal_checkouts')).rows[0];
      for(const mutate of [o=>o.purchase_units[0].payee.email_address='wrong@example.com',o=>o.purchase_units[0].amount.value='9.00',o=>o.purchase_units[0].custom_id=crypto.randomUUID()]) {
        const o=structuredClone(currentOrder);mutate(o);assert.throws(()=>verifyOrder(o,check,false));
      }
      assert.equal(captureCount,0);
    });
    await t.test('approval webhook delivers even if the browser closes; the key is decryptable',async()=>{
      currentOrder.status='APPROVED';approved=true;
      const response=await handle(webhook('CHECKOUT.ORDER.APPROVED'),env,fetcher);
      assert.equal(response.status,200);assert.equal((await response.json()).library_url,'/biblioteca/?compra=confirmada');
      assert.equal(captureCount,1);
      const [license]=(await db.query('select * from licenses')).rows;
      assert.equal(license.user_id,user);assert.equal(license.status,'active');
      const aes=await crypto.subtle.importKey('raw',Buffer.alloc(32,7),'AES-GCM',false,['decrypt']);
      const key=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:license.key_nonce},aes,license.key_ciphertext));
      assert.match(key,/^[A-Z0-9]{5}(-[A-Z0-9]{5}){3}$/);
      assert.deepEqual(Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),Buffer.from(license.key_hash));
    });
    await t.test('refresh and duplicate webhook preserve the key and ledger',async()=>{
      const before=(await db.query('select key_hash from licenses')).rows[0].key_hash;
      assert.equal((await handle(request({action:'capture',order_id:paypalOrder}),env,fetcher)).status,200);
      assert.equal((await handle(webhook(),env,fetcher)).status,200);
      assert.equal((await db.query('select count(*)::int as n from orders')).rows[0].n,1);
      assert.equal((await db.query('select count(*)::int as n from licenses')).rows[0].n,1);
      assert.deepEqual((await db.query('select key_hash from licenses')).rows[0].key_hash,before);assert.equal(captureCount,1);
    });
    await t.test('forged webhook and partial capture cannot deliver',async()=>{
      signature='FAILURE';assert.equal((await handle(webhook(),env,fetcher)).status,401);signature='SUCCESS';
      const check=(await db.query('select * from paypal_checkouts')).rows[0];
      const o=structuredClone(currentOrder);o.purchase_units[1].payments.captures[0].status='PENDING';assert.throws(()=>verifyOrder(o,check,true));
    });
    await t.test('authenticated customers cannot issue licenses or modify payment rows',async()=>{
      assert.equal((await db.query("select has_function_privilege('authenticated','public.complete_paypal_purchase(uuid,text,text,text,text,bytea,bytea,bytea)','execute') as allowed")).rows[0].allowed,false);
      assert.equal((await db.query("select has_table_privilege('authenticated','public.paypal_checkouts','insert') as allowed")).rows[0].allowed,false);
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);`);
      assert.equal((await db.query('select * from paypal_checkouts')).rows.length,0);await db.exec('reset role');
    });
    await t.test('refund revokes access and an old success notification cannot restore it',async()=>{
      currentOrder.purchase_units[0].payments.captures[0].status='REFUNDED';
      assert.equal((await handle(webhook('PAYMENT.CAPTURE.REFUNDED'),env,fetcher)).status,200);
      assert.equal((await db.query('select status from licenses')).rows[0].status,'revoked');
      const paid=rpcParams.find(p=>p.table==='rpc/complete_paypal_purchase').body;
      const values=['p_checkout_id','p_paypal_order_id','p_capture_1','p_capture_2','p_buyer_email','p_key_hash','p_key_ciphertext','p_key_nonce'].map((k,i)=>i<5?paid[k]:Buffer.from(paid[k].slice(2),'hex'));
      await assert.rejects(db.query('select complete_paypal_purchase($1,$2,$3,$4,$5,$6,$7,$8)',values),/invalid checkout/);
      assert.equal((await handle(webhook(),env,fetcher)).status,200);
    });
  } finally {await db.close();}
});
