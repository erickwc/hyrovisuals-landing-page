import { supabase } from '../lib/supabase';
import en from '../i18n/en.json';
import es from '../i18n/es.json';

type StatusKey = 'sandboxReady' | 'sandboxWorking' | 'sandboxCancelled' | 'sandboxSuccess' | 'sandboxError' | 'sandboxReview' | 'sandboxConfig' | 'sandboxLogin';
interface Receipt {
  order_id: string;
  status: string;
  payments: Array<{ seller: string; capture_id: string; amount: string; currency: string; status: string; fee: string | null; net: string | null }>;
}

export function initPaypalSandbox() {
  const root = document.querySelector<HTMLElement>('[data-paypal-sandbox]');
  if (!root) return () => {};
  const controller = new AbortController();
  const { signal } = controller;
  const button = root.querySelector<HTMLButtonElement>('[data-sandbox-pay]')!;
  const status = root.querySelector<HTMLElement>('[data-sandbox-status]')!;
  const receipts = root.querySelector<HTMLElement>('[data-sandbox-receipts]')!;
  let key: StatusKey = 'sandboxReady';
  let receipt: Receipt | null = null;
  let pending = false;
  const words = () => document.documentElement.lang === 'es' ? es : en;
  const render = () => {
    status.textContent = words()[key];
    button.textContent = orderId ? words().sandboxVerify : words().sandboxPay;
    receipts.replaceChildren();
    if (!receipt) {
      if (orderId) {
        const pendingOrder = document.createElement('li');
        pendingOrder.textContent = `${words().sandboxOrder}: ${orderId}`;
        receipts.append(pendingOrder);
        receipts.hidden = false;
      }
      return;
    }
    const order = document.createElement('li');
    order.textContent = `${words().sandboxOrder}: ${receipt.order_id}`;
    receipts.append(order);
    for (const [i, payment] of receipt.payments.entries()) {
      const item = document.createElement('li');
      item.textContent = `${words().sandboxSeller} ${i + 1}: $${payment.amount} USD · ${payment.status} · ${payment.capture_id}` +
        (payment.net ? ` · ${words().sandboxNet}: $${payment.net} USD` : '');
      receipts.append(item);
    }
    receipts.hidden = false;
  };
  const say = (next: StatusKey) => { key = next; render(); };
  const url = new URL(location.href);
  const returnedToken = url.searchParams.get('token');
  if (returnedToken && /^[A-Z0-9]{17}$/.test(returnedToken)) {
    try { sessionStorage.setItem('hyro:sandbox-pending', returnedToken); } catch { /* The URL still carries the token. */ }
  }
  let orderId = returnedToken;
  try { orderId ||= sessionStorage.getItem('hyro:sandbox-pending'); } catch { /* Storage optional on return. */ }
  if (url.searchParams.get('cancelado') === '1') {
    orderId = null;
    try { sessionStorage.removeItem('hyro:sandbox-pending'); sessionStorage.removeItem('hyro:sandbox-request'); } catch { /* Optional. */ }
    say('sandboxCancelled');
  } else render();

  const invoke = async (body: object): Promise<Receipt & { approve_url: string }> => {
    if (!supabase) throw new Error('sandbox_not_configured');
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      say('sandboxLogin');
      location.assign('/cuenta/?continuar=paypal-sandbox');
      throw new Error('unauthorized');
    }
    const response = await fetch('/api/paypal-sandbox', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify(body), signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'checkout_unavailable');
    return result;
  };
  const run = async (capture: boolean) => {
    if (pending) return;
    pending = true;
    button.disabled = true;
    say('sandboxWorking');
    try {
      if (capture) {
        receipt = await invoke({ action: 'capture', order_id: orderId });
        if (signal.aborted) return;
        if (receipt.status !== 'COMPLETED' || receipt.payments?.length !== 2 ||
            receipt.payments.some((payment) => payment.status !== 'COMPLETED' || payment.amount !== '10.00' || payment.currency !== 'USD')) {
          receipt = null;
          throw new Error('payment_not_completed');
        }
        say('sandboxSuccess');
        button.hidden = true;
        try { sessionStorage.removeItem('hyro:sandbox-pending'); sessionStorage.removeItem('hyro:sandbox-request'); } catch { /* Optional. */ }
      } else {
        let requestId: string | null = null;
        try { requestId = sessionStorage.getItem('hyro:sandbox-request'); } catch { /* Optional. */ }
        requestId ||= crypto.randomUUID();
        try { sessionStorage.setItem('hyro:sandbox-request', requestId); } catch { /* Optional. */ }
        const result = await invoke({ action: 'create', request_id: requestId });
        if (signal.aborted) return;
        const approve = new URL(result.approve_url);
        if (approve.origin !== 'https://www.sandbox.paypal.com') throw new Error('invalid_approval_url');
        location.assign(approve.href);
      }
    } catch (error) {
      if (signal.aborted) return;
      const code = error instanceof Error ? error.message : '';
      if (code !== 'unauthorized') say(code === 'sandbox_not_configured' ? 'sandboxConfig' : capture ? 'sandboxReview' : 'sandboxError');
    } finally {
      pending = false;
      button.disabled = false;
    }
  };
  button.addEventListener('click', () => void run(Boolean(orderId)), { signal });
  document.addEventListener('hyro:language', render, { signal });
  if (orderId) void run(true);
  return () => controller.abort();
}
