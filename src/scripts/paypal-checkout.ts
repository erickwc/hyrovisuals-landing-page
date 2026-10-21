import { supabase } from '../lib/supabase';
import en from '../i18n/en.json';
import es from '../i18n/es.json';

export function initPaypalCheckout() {
  const root = document.querySelector<HTMLElement>('[data-paypal-live]');
  if (!root) return () => {};
  const controller = new AbortController();
  const status = root.querySelector<HTMLElement>('[data-paypal-status]')!;
  const button = root.querySelector<HTMLButtonElement>('[data-paypal-pay]')!;
  const orderLabel = root.querySelector<HTMLElement>('[data-paypal-order]')!;
  const words = () => document.documentElement.lang === 'es' ? es : en;
  let message: 'paypalReady' | 'paypalWorking' | 'paypalError' | 'paypalReview' | 'paypalCancelled' | 'paypalUnavailable' = 'paypalReady';
  const params = new URLSearchParams(location.search);
  const cancelled = params.get('cancelado') === '1';
  let order = params.get('token');
  if (!order || !/^[A-Z0-9]{17}$/.test(order)) order = null;
  try {
    if (cancelled) { sessionStorage.removeItem('hyro:paypal-order'); sessionStorage.removeItem('hyro:paypal-request'); order = null; }
    else if (order) sessionStorage.setItem('hyro:paypal-order', order);
    else order = sessionStorage.getItem('hyro:paypal-order');
  } catch { /* The PayPal return URL still works without storage. */ }
  let busy = false;
  const render = () => {
    status.textContent = words()[message];
    button.textContent = order ? words().paypalVerify : words().paypalPay;
    orderLabel.textContent = order ? `${words().sandboxOrder}: ${order}` : '';
  };
  const run = async () => {
    if (busy) return;
    if (import.meta.env.PUBLIC_PAYPAL_LIVE_ENABLED !== 'true') { message = 'paypalUnavailable'; render(); return; }
    busy = true; button.disabled = true; message = 'paypalWorking'; render();
    try {
      if (!supabase) throw new Error('live_not_configured');
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) { location.assign('/cuenta/?continuar=paypal'); return; }
      let requestId: string = crypto.randomUUID();
      try { requestId = sessionStorage.getItem('hyro:paypal-request') || requestId; sessionStorage.setItem('hyro:paypal-request', requestId); } catch { /* Optional. */ }
      const response = await fetch(`${import.meta.env.PUBLIC_SUPABASE_URL}/functions/v1/paypal-checkout`, {
        method: 'POST', headers: { authorization: `Bearer ${data.session.access_token}`,
          apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
        body: JSON.stringify(order ? { action: 'capture', order_id: order } : { action: 'create', request_id: requestId }), signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'payment_pending');
      if (result.library_url === '/biblioteca/' || (result.status === 'COMPLETED' && result.library_url === '/biblioteca/?compra=confirmada')) {
        try { sessionStorage.removeItem('hyro:paypal-order'); sessionStorage.removeItem('hyro:paypal-request'); } catch { /* Optional. */ }
        location.replace(result.library_url); return;
      }
      const approve = new URL(result.approve_url);
      if (approve.origin !== 'https://www.paypal.com') throw new Error('invalid_approval');
      location.assign(approve.href);
    } catch (error) {
      if (controller.signal.aborted) return;
      message = error instanceof Error && error.message === 'live_not_configured' ? 'paypalUnavailable' : order ? 'paypalReview' : 'paypalError';
      render();
    } finally { busy = false; button.disabled = false; }
  };
  if (cancelled) message = 'paypalCancelled';
  if (import.meta.env.PUBLIC_PAYPAL_LIVE_ENABLED !== 'true') { message = 'paypalUnavailable'; button.disabled = true; }
  render();
  button.addEventListener('click', () => void run(), { signal: controller.signal });
  document.addEventListener('hyro:language', render, { signal: controller.signal });
  if (order && import.meta.env.PUBLIC_PAYPAL_LIVE_ENABLED === 'true') void run();
  return () => controller.abort();
}
