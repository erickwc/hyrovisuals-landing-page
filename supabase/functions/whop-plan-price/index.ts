declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };

const corsOrigin = (origin: string | null) =>
  origin && (origin === 'https://byhyro.com' || origin === 'https://www.byhyro.com' || origin === 'http://localhost:4321')
    ? origin : 'https://byhyro.com';

const respond = (origin: string, status: number, body: object) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json',
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'GET, OPTIONS',
    'cache-control': 'no-store',
    'vary': 'Origin',
  },
});

Deno.serve(async (request: Request) => {
  const origin = corsOrigin(request.headers.get('origin'));
  if (request.method === 'OPTIONS') return respond(origin, 200, {});
  if (request.method !== 'GET') return respond(origin, 405, { error: 'method_not_allowed' });

  const apiKey = Deno.env.get('WHOP_API_KEY');
  if (!apiKey) return respond(origin, 503, { error: 'price_unavailable' });

  try {
    const upstream = await fetch('https://api.whop.com/api/v1/plans/plan_yKbcCAPF4EaHb', {
      headers: { authorization: `Bearer ${apiKey}`, 'Api-Version-Date': '2026-10-24' },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) return respond(origin, 503, { error: 'price_unavailable' });

    const plan = await upstream.json();
    if (plan.id !== 'plan_yKbcCAPF4EaHb' || plan.account?.id !== 'biz_XOirHolBiKU66x'
      || plan.plan_type !== 'one_time' || typeof plan.initial_price !== 'number'
      || !Number.isFinite(plan.initial_price) || plan.initial_price < 0
      || typeof plan.currency !== 'string' || !/^[A-Z]{3}$/i.test(plan.currency)) {
      return respond(origin, 503, { error: 'price_unavailable' });
    }

    return respond(origin, 200, {
      amount: plan.initial_price,
      currency: plan.currency.toUpperCase(),
      description: plan.description ?? '',
    });
  } catch {
    return respond(origin, 503, { error: 'price_unavailable' });
  }
});

