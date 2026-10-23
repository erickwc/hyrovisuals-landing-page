import { supabase } from '../lib/supabase';
import en from '../i18n/en.json';
import es from '../i18n/es.json';

export function initWompiCheckout() {
  const root = document.querySelector<HTMLElement>('[data-wompi-checkout]');
  if (!root) return () => {};
  const button = root.querySelector<HTMLButtonElement>('[data-wompi-pay]')!;
  const status = root.querySelector<HTMLElement>('[data-wompi-status]')!;
  const controller = new AbortController();
  const words = () => {
    try { return localStorage.getItem('hyro-language') === 'es' ? es : en; }
    catch { return en; }
  };
  const say = (key: 'wompiReady' | 'wompiWorking' | 'wompiPending' | 'wompiError' | 'wompiUnavailable') => {
    status.textContent = words()[key];
  };
  const enabled = import.meta.env.PUBLIC_WOMPI_CHECKOUT_ENABLED === 'true';
  if (!enabled) { button.disabled = true; say('wompiUnavailable'); }
  else say('wompiReady');
  const readRequest = () => {
    try { return sessionStorage.getItem('hyro:wompi-request'); } catch { return null; }
  };
  const call = async (action: 'create' | 'status', requestId: string) => {
    if (!supabase) throw new Error('unavailable');
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) { location.assign('/cuenta/?continuar=wompi'); return null; }
    const response = await fetch(`${import.meta.env.PUBLIC_SUPABASE_URL}/functions/v1/wompi-checkout`, {
      method: 'POST', headers: { authorization: `Bearer ${data.session.access_token}`,
        apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ action, request_id: requestId }), signal: controller.signal,
    });
    if (!response.ok) throw new Error('checkout_failed');
    return response.json();
  };
  if (new URL(location.href).searchParams.has('resultado')) {
    button.hidden = true;
    say('wompiPending');
    const requestId = readRequest();
    if (requestId && /^[0-9a-f-]{36}$/i.test(requestId)) {
      let checks = 0;
      const poll = async () => {
        if (controller.signal.aborted || checks++ >= 20) return;
        try {
          const result = await call('status', requestId);
          if (result?.status === 'paid') { location.replace(result.library_url); return; }
        } catch { /* Keep pending; the signed webhook may arrive later. */ }
        if (!controller.signal.aborted) setTimeout(poll, 3000);
      };
      void poll();
    }
  }
  button.addEventListener('click', async () => {
    if (!enabled || button.disabled) return;
    button.disabled = true; say('wompiWorking');
    let requestId = readRequest();
    if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) requestId = crypto.randomUUID();
    try {
      sessionStorage.setItem('hyro:wompi-request', requestId);
      const result = await call('create', requestId);
      if (!result) return;
      if (result.library_url) { location.assign(result.library_url); return; }
      const url = new URL(result.payment_url);
      if (url.protocol !== 'https:' || url.hostname !== 'lk.wompi.sv') throw new Error('invalid_link');
      location.assign(url.href);
    } catch { say('wompiError'); button.disabled = false; }
  }, { signal: controller.signal });
  return () => controller.abort();
}
