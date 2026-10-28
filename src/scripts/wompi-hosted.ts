import { supabase } from '../lib/supabase';

const validId = (value: string | null): value is string => Boolean(value && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value));

export function initWompiHosted() {
  const root = document.querySelector<HTMLElement>('[data-wompi-hosted]');
  if (!root) return () => {};
  const button = root.querySelector<HTMLButtonElement>('[data-hosted-pay]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-hosted-retry]')!;
  const login = root.querySelector<HTMLAnchorElement>('[data-hosted-login]')!;
  const status = root.querySelector<HTMLElement>('[data-hosted-status]')!;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestId: string | null = null;
  let busy = false;
  const say = (message: string) => { status.textContent = message; };
  const api = async (body: object) => {
    if (!supabase) throw new Error('unavailable');
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error('unauthorized');
    const response = await fetch(`${import.meta.env.PUBLIC_SUPABASE_URL}/functions/v1/wompi-checkout`, {
      method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { authorization: `Bearer ${data.session.access_token}`,
        apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'unavailable');
    return result;
  };
  const fail = (error: unknown) => {
    if (controller.signal.aborted) return;
    const code = error instanceof Error ? error.message : '';
    if (code === 'unauthorized') {
      say('Inicia sesión para vincular la compra a tu cuenta.');
      login.hidden = false;
    } else if (code === 'checkout_pending') {
      say('Tu pago anterior sigue en proceso. Comprueba su estado antes de intentar otro.');
      retry.hidden = !requestId;
    } else say('No pudimos preparar el pago. Vuelve a intentarlo.');
  };
  const poll = async (remaining: number) => {
    if (!requestId || controller.signal.aborted || busy) return;
    try {
      const data = await api({ action: 'status', request_id: requestId });
      if (data.status === 'paid') { location.replace('/biblioteca/?compra=confirmada'); return; }
      if (data.status === 'unknown') { say('No encontramos una compra pendiente en esta cuenta.'); retry.hidden = true; return; }
      say('Wompi está confirmando tu compra. Tu licencia aparecerá en la biblioteca en cuanto se verifique el pago.');
      retry.hidden = false;
      if (remaining > 0) timer = setTimeout(() => void poll(remaining - 1), 2000);
    } catch (error) { fail(error); if (remaining > 0) timer = setTimeout(() => void poll(remaining - 1), 5000); }
  };
  button.addEventListener('click', async () => {
    if (busy || !supabase) return;
    busy = true; button.disabled = true;
    requestId = crypto.randomUUID();
    try { sessionStorage.setItem('hyro:wompi-request', requestId); } catch { /* The request remains in memory. */ }
    say('Creando un enlace de pago seguro…');
    try {
      const data = await api({ action: 'create', request_id: requestId });
      if (data.library_url) { location.assign('/biblioteca/'); return; }
      const url = new URL(data.payment_url);
      if (url.protocol !== 'https:' || url.hostname !== 'lk.wompi.sv') throw new Error('invalid_payment_url');
      location.assign(url.href);
    } catch (error) { fail(error); busy = false; button.disabled = false; }
  }, { signal: controller.signal });
  retry.addEventListener('click', () => { clearTimeout(timer); void poll(20); }, { signal: controller.signal });
  try { requestId = sessionStorage.getItem('hyro:wompi-request'); } catch { /* Optional storage. */ }
  if (!validId(requestId)) requestId = null;
  if (requestId && (new URL(location.href).searchParams.has('resultado') || document.referrer.startsWith('https://lk.wompi.sv/'))) {
    history.replaceState(null, '', '/checkout/');
    button.hidden = true;
    retry.hidden = false;
    void poll(30);
  } else {
    button.disabled = false;
    say('Serás llevado a la página segura de Wompi para completar el pago.');
  }
  return () => { controller.abort(); clearTimeout(timer); };
}
