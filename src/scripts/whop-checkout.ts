import { supabase } from '../lib/supabase';

type CheckoutHandle = { create(type: 'checkout', options?: Record<string, unknown>): { mount(selector: string): void }; update(options: Record<string, unknown>): void; destroy(): void };
type WhopWindow = Window & { WhopElements?: () => { checkout: { create(options: Record<string, unknown>): CheckoutHandle } } };

export function initWhopCheckout() {
  const root = document.querySelector<HTMLElement>('[data-whop-checkout]');
  if (!root) return () => {};
  const status = root.querySelector<HTMLElement>('[data-whop-status]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-whop-retry]')!;
  const priceAmount = root.querySelector<HTMLElement>('[data-price-amount]');
  const priceCurrency = root.querySelector<HTMLElement>('[data-price-currency]');
  const productDescription = root.querySelector<HTMLElement>('[data-product-description]');
  let cancelled = false;
  let handle: CheckoutHandle | undefined;
  const appearance = () => {
    const background = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    return {
      theme: { appearance: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', accentColor: 'gray', grayColor: 'gray' },
      classes: {
        'whop-Checkout': { padding: '0px', backgroundColor: background },
        'whop-CheckoutLayout': { width: '100%', padding: '0px', gap: '0px' },
        'whop-CheckoutDetails': { display: 'none', width: '0px', height: '0px', minHeight: '0px', padding: '0px', opacity: '0', overflow: 'hidden', visibility: 'hidden' },
        'whop-CheckoutCollection': { width: '100%', minWidth: '0px', padding: '0px', backgroundColor: background },
        'whop-EmailSignIn': { display: 'none' },
      },
    };
  };
  const restyle = () => handle?.update({ appearance: appearance(), locale: document.documentElement.lang === 'es' ? 'es' : 'en' });
  const observer = new MutationObserver(restyle);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'lang'] });
  const start = async () => {
    retry.hidden = true;
    try {
      if (!supabase) throw new Error('unavailable');
      const { data: auth, error } = await supabase.auth.getUser();
      if (error || !auth.user) { location.replace('/cuenta/?continuar=compra'); return; }
      const { data: planPrice, error: priceError } = await supabase.functions.invoke('whop-plan-price');
      if (priceError || typeof planPrice?.amount !== 'number' || typeof planPrice?.currency !== 'string'
        || typeof planPrice?.description !== 'string' || !planPrice.description.trim()) {
        throw new Error('price_unavailable');
      }
      const locale = document.documentElement.lang === 'es' ? 'es-ES' : 'en-US';
      if (priceAmount) priceAmount.textContent = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(planPrice.amount);
      if (priceCurrency) priceCurrency.textContent = planPrice.currency === 'USD' ? 'US$' : planPrice.currency;
      if (productDescription) productDescription.textContent = `HYRO Visuals · ${planPrice.description}`;
      const { data: product, error: productError } = await supabase.from('products').select('id').eq('slug', 'hyro-visuals').eq('is_active', true).single();
      if (productError || !product) throw new Error('unavailable');
      const { data: owned, error: ownedError } = await supabase.from('licenses').select('id').eq('product_id', product.id).eq('status', 'active').maybeSingle();
      if (ownedError) throw new Error('unavailable');
      if (owned) { location.replace('/biblioteca/'); return; }
      const { data: intent, error: intentError } = await supabase.from('purchase_intents')
        .insert({ user_id: auth.user.id, product_id: product.id }).select('id').single();
      if (intentError || !intent) throw new Error('unavailable');
      try {
        sessionStorage.setItem('hyro:checkout-intent-id', intent.id);
        sessionStorage.setItem('hyro:checkout-product-id', product.id);
      } catch { /* The return URL also preserves the opaque intent. */ }
      const win = window as WhopWindow;
      if (!win.WhopElements) await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.whop.com/elements/amber/elements.js';
        script.dataset.whopElements = '';
        const timeout = setTimeout(() => { script.remove(); reject(new Error('timeout')); }, 20000);
        script.onload = () => { clearTimeout(timeout); resolve(); };
        script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('load_failed')); };
        document.head.append(script);
      });
      if (cancelled) return;
      if (!win.WhopElements) throw new Error('unavailable');
      handle?.destroy();
      handle = win.WhopElements().checkout.create({
        plan: 'plan_yKbcCAPF4EaHb', quantity: 1,
        appearance: appearance(), locale: document.documentElement.lang === 'es' ? 'es' : 'en',
        metadata: { hyro_intent: intent.id },
        returnUrl: `${location.origin}/compra/?intent=${encodeURIComponent(intent.id)}`,
        onLoadingChange: (loading: boolean) => { if (!cancelled) status.textContent = loading ? 'Cargando el formulario de pago…' : ''; },
      });
      handle.create('checkout', { buyerEmail: auth.user.email,
        onError: () => { if (!cancelled) { status.textContent = 'No pudimos cargar el pago. Vuelve a intentarlo.'; retry.hidden = false; } },
      }).mount('#hyro-whop-checkout');
    } catch {
      if (!cancelled) { status.textContent = 'No pudimos cargar el pago. Vuelve a intentarlo.'; retry.hidden = false; }
    }
  };
  retry.addEventListener('click', start);
  void start();
  return () => { cancelled = true; observer.disconnect(); handle?.destroy(); retry.removeEventListener('click', start); };
}

