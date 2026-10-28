import { supabase } from '../lib/supabase';
import en from '../i18n/en.json';
import es from '../i18n/es.json';
type Region = { id: string; nombre: string; territorios: Array<{ id: string; nombre: string }> };
type Message = keyof typeof en;
const validId = (id: string | null): id is string => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export function initWompiCheckout() {
  const root = document.querySelector<HTMLElement>('[data-wompi-card]');
  if (!root) return () => {};
  const form = root.querySelector<HTMLFormElement>('[data-card-form]')!;
  const button = root.querySelector<HTMLButtonElement>('[data-wompi-pay]')!;
  const result = root.querySelector<HTMLElement>('[data-card-result]')!;
  const status = root.querySelector<HTMLElement>('[data-card-status]')!;
  const resultCopy = root.querySelector<HTMLElement>('[data-card-result-copy]')!;
  const login = root.querySelector<HTMLAnchorElement>('[data-card-login]')!;
  const resume = root.querySelector<HTMLAnchorElement>('[data-card-resume]')!;
  const check = root.querySelector<HTMLButtonElement>('[data-card-check]')!;
  const restart = root.querySelector<HTMLButtonElement>('[data-card-restart]')!;
  const country = form.querySelector<HTMLSelectElement>('[data-billing="idPais"]')!;
  const region = form.querySelector<HTMLSelectElement>('[data-billing="idRegion"]')!;
  const controller = new AbortController();
  const signal = controller.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ready = false;
  let busy = false;
  let message: Message = 'cardPreview';
  let mode: 'test' | 'live' | 'preview' = 'preview';
  let amountCents = 0;
  let regions: Region[] = [];
  let currentId: string | null = null;
  let returning = false;
  const words = () => document.documentElement.lang === 'es' ? es : en;
  const wipeCard = () => {
    for (const input of form.querySelectorAll<HTMLInputElement>('[data-card-number],[data-card-expiry],[data-card-cvv]')) input.value = '';
  };
  const render = () => {
    status.textContent = words()[message];
    resultCopy.textContent = words()[message];
    root.querySelector<HTMLElement>('[data-card-mode]')!.textContent = words()[mode === 'test' ? 'cardTestMode' : mode === 'live' ? 'cardLiveMode' : 'cardPreviewMode'];
    if (amountCents) {
      const price = new Intl.NumberFormat(document.documentElement.lang === 'es' ? 'es-SV' : 'en-US',
        { style: 'currency', currency: 'USD' }).format(amountCents / 100);
      root.querySelector<HTMLElement>('[data-card-price]')!.textContent = price;
      button.textContent = `${document.documentElement.lang === 'es' ? 'Pagar ahora' : 'Pay now'} · ${price}`;
    }
    button.disabled = !ready || busy;
    button.hidden = returning || !login.hidden;
    form.querySelectorAll<HTMLFieldSetElement>('fieldset').forEach(f => f.disabled = !ready || busy);
  };
  const say = (key: Message) => { message = key; render(); };
  const remember = (id: string) => {
    currentId = id;
    try { sessionStorage.setItem('hyro:card-request', id); } catch { /* The return URL also carries the opaque ID. */ }
  };
  const api = async (body: object) => {
    if (!supabase) throw new Error('not_configured');
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error('unauthorized');
    const response = await fetch(`${import.meta.env.PUBLIC_SUPABASE_URL}/functions/v1/wompi-card`, {
      method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { authorization: `Bearer ${data.session.access_token}`,
        apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'verification_pending');
    return result;
  };
  const failure = (error: unknown) => {
    const code = error instanceof Error ? error.message : '';
    if (code === 'unauthorized') { ready = false; login.hidden = false; wipeCard(); say('cardSignIn'); }
    else say(code === 'invalid_card' ? 'cardInvalid' : code === 'invalid_billing' ? 'cardBillingInvalid' :
      code === 'rate_limited' ? 'cardRateLimited' : ['not_configured', 'mode_mismatch'].includes(code) ? 'wompiUnavailable' : 'cardPending');
  };
  const url = (value: string) => {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port ||
      !(parsed.hostname === 'wompi.sv' || parsed.hostname.endsWith('.wompi.sv'))) throw new Error('invalid_url');
    return parsed.href;
  };
  const showResult = (data: { status: string; request_id?: string; challenge_url?: string }) => {
    root.classList.remove('card-return-checking');
    returning = true; form.hidden = true; result.hidden = false;
    if (data.request_id && validId(data.request_id)) remember(data.request_id);
    resume.hidden = true;
    if (data.challenge_url && data.status === 'awaiting_3ds') { resume.href = url(data.challenge_url); resume.hidden = false; }
    restart.hidden = !['declined', 'test_paid'].includes(data.status);
    check.hidden = !restart.hidden;
    say(data.status === 'test_paid' ? 'cardTestSuccess' : data.status === 'declined' ? 'cardDeclined' : 'cardPending');
  };
  const poll = async (remaining = 0, attempt = 0) => {
    if (!currentId || signal.aborted || busy) return;
    check.disabled = true;
    let retry = false;
    try {
      const data = await api({ action: 'status', request_id: currentId });
      if (signal.aborted) return;
      if (data.status === 'paid') {
        root.classList.remove('card-return-checking');
        location.replace('/biblioteca/?compra=confirmada');
        return;
      }
      if (data.status === 'unknown') {
        currentId = null;
        try { sessionStorage.removeItem('hyro:card-request'); } catch { /* Optional. */ }
        root.classList.remove('card-return-checking');
        returning = false; result.hidden = true; form.hidden = false;
        if (ready) say('wompiReady');
        return;
      }
      retry = remaining > 0 && !['test_paid', 'declined'].includes(data.status);
      if (returning && retry && attempt < 3 && !data.challenge_url) {
        // Keep the successful return lightweight while the webhook catches up.
        say('cardChecking');
      } else showResult(data);
    } catch (error) {
      if (!signal.aborted) {
        const code = error instanceof Error ? error.message : '';
        retry = remaining > 0 && !['unauthorized', 'not_configured', 'mode_mismatch', 'rate_limited'].includes(code);
        if (returning && retry && attempt < 3) say('cardChecking');
        else {
          root.classList.remove('card-return-checking');
          failure(error);
        }
      }
    } finally {
      check.disabled = false;
      if (!retry && returning && root.classList.contains('card-return-checking')) {
        showResult({ status: 'review' });
      }
      if (retry && !signal.aborted) {
        const delay = attempt < 3 ? 1500 : attempt < 8 ? 3000 : 5000;
        timer = setTimeout(() => void poll(remaining - 1, attempt + 1), delay);
      }
    }
  };
  country.addEventListener('change', () => {
    region.replaceChildren(new Option(words().cardSelect, ''));
    for (const item of regions.find(r => r.id === country.value)?.territorios ?? []) region.add(new Option(item.nombre, item.id));
  }, { signal });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || busy || !form.reportValidity()) return;
    const expiry = form.querySelector<HTMLInputElement>('[data-card-expiry]')!.value.replace(/\D/g, '');
    if (expiry.length !== 4) { say('cardInvalid'); return; }
    const billing: Record<string, string> = {};
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-billing]').forEach(input => { billing[input.dataset.billing!] = input.value.trim(); });
    billing.telefono = billing.telefono.replace(/[+ ()-]/g, '');
    const payment = { action: 'create', request_id: currentId ?? crypto.randomUUID(), expected_amount_cents: amountCents,
      card: { number: form.querySelector<HTMLInputElement>('[data-card-number]')!.value.replace(/ /g, ''),
        cvv: form.querySelector<HTMLInputElement>('[data-card-cvv]')!.value,
        month: Number(expiry.slice(0, 2)), year: 2000 + Number(expiry.slice(2)) }, billing };
    remember(payment.request_id);
    busy = true; say('wompiWorking');
    try {
      const data = await api(payment);
      if (signal.aborted) return;
      if (data.library_url) { location.assign('/biblioteca/'); return; }
      showResult(data);
      if (data.challenge_url && data.status === 'awaiting_3ds') location.assign(url(data.challenge_url));
      else if (!['test_paid', 'declined'].includes(data.status)) {
        root.classList.add('card-return-checking');
        say('cardChecking');
        timer = setTimeout(() => void poll(20), 0);
      }
    } catch (error) {
      if (!signal.aborted) {
        const code = error instanceof Error ? error.message : '';
        if (!['unauthorized', 'invalid_card', 'invalid_billing', 'rate_limited', 'not_configured', 'mode_mismatch'].includes(code)) showResult({ status: 'review' });
        failure(error);
      }
    } finally { payment.card.number = ''; payment.card.cvv = ''; wipeCard(); busy = false; render(); }
  }, { signal });
  check.addEventListener('click', () => { clearTimeout(timer); void poll(20); }, { signal });
  restart.addEventListener('click', () => {
    clearTimeout(timer); remember(crypto.randomUUID()); returning = false; result.hidden = true; form.hidden = false; say('wompiReady');
  }, { signal });
  document.addEventListener('hyro:language', render, { signal });
  window.addEventListener('pagehide', wipeCard, { signal });
  window.addEventListener('pageshow', wipeCard, { signal });
  const query = new URL(location.href).searchParams;
  if (query.get('card') === 'return') {
    returning = true;
    if (validId(query.get('request'))) remember(query.get('request')!);
    history.replaceState(null, '', '/checkout/');
  }
  try { currentId ||= sessionStorage.getItem('hyro:card-request'); } catch { /* Optional. */ }
  if (!validId(currentId)) currentId = null;
  if (!currentId) returning = false;
  render();
  // On Wompi's return URL, check the transaction immediately. The payment-status
  // endpoint does not depend on the checkout configuration, so don't make the
  // buyer wait for unrelated merchant/region lookups before verifying the charge.
  if (returning && currentId) {
    form.hidden = true;
    result.hidden = false;
    root.classList.add('card-return-checking');
    say('cardChecking');
    void poll(20);
  }
  void (async () => {
    try {
      const config = await api({ action: 'config' });
      if (signal.aborted) return;
      if (!Array.isArray(config.regions) || !['test', 'live'].includes(config.mode) ||
        !Number.isSafeInteger(config.amount_cents) || config.amount_cents < 1) throw new Error('not_configured');
      regions = config.regions; mode = config.mode; amountCents = config.amount_cents; ready = true;
      for (const item of regions) country.add(new Option(item.nombre, item.id));
      if (!returning && result.hidden) say('wompiReady');
      if (currentId && !returning) void poll();
    } catch (error) {
      // The immediate status check handles return-page errors independently.
      if (!signal.aborted && !returning) failure(error);
    }
  })();
  return () => { controller.abort(); clearTimeout(timer); wipeCard(); };
}
