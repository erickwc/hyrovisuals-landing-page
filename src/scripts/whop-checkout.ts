import { supabase } from '../lib/supabase';

type CheckoutHandle = { create(type: 'checkout', options?: Record<string, unknown>): { mount(selector: string): void }; update(options: Record<string, unknown>): void; destroy(): void };
type WhopWindow = Window & { WhopElements?: () => { checkout: { create(options: Record<string, unknown>): CheckoutHandle } } };

export function initWhopCheckout() {
  const root = document.querySelector<HTMLElement>('[data-whop-checkout]');
  if (!root) return () => {};
  const status = root.querySelector<HTMLElement>('[data-whop-status]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-whop-retry]')!;
  const backButton = root.querySelector<HTMLButtonElement>('[data-checkout-back]');
  const priceAmount = root.querySelector<HTMLElement>('[data-price-amount]');
  const priceCurrency = root.querySelector<HTMLElement>('[data-price-currency]');
  const productDescription = root.querySelector<HTMLElement>('[data-product-description]');
  const productDescriptionHeading = root.querySelector<HTMLElement>('[data-product-description-heading]');
  const productFeatures = root.querySelector<HTMLUListElement>('[data-product-features]');
  let cancelled = false;
  let starting = false;
  let attempts = 0;
  let retryTimer = 0;
  let purchaseIntentId: string | undefined;
  let purchaseProductId: string | undefined;
  let handle: CheckoutHandle | undefined;
  let sdkLoad: Promise<void> | undefined;
  const appearance = () => {
    const background = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    return {
      theme: { appearance: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', accentColor: 'gray', grayColor: 'gray' },
      classes: {
        'whop-Checkout': { padding: '0px', backgroundColor: background },
        'whop-CheckoutLayout': { width: '100%', padding: '0px', gap: '0px' },
        'whop-CheckoutDetails': { display: 'none', width: '0px', height: '0px', minHeight: '0px', padding: '0px', opacity: '0', overflow: 'hidden', visibility: 'hidden' },
        'whop-CheckoutCollection': { width: '100%', minWidth: '0px', padding: '0px', backgroundColor: background },
        'whop-CheckoutExpressButtons': {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          gap: '8px',
        },
        'whop-EmailSignIn': { display: 'none' },
      },
    };
  };
  const restyle = () => handle?.update({ appearance: appearance(), locale: document.documentElement.lang === 'es' ? 'es' : 'en' });
  const loadWhopElements = (win: WhopWindow) => {
    if (win.WhopElements) return Promise.resolve();
    if (sdkLoad) return sdkLoad;
    sdkLoad = new Promise<void>((resolve, reject) => {
      let script = document.querySelector<HTMLScriptElement>('script[data-whop-elements]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://cdn.whop.com/elements/amber/elements.js';
        script.dataset.whopElements = '';
        document.head.append(script);
      }
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        script!.removeEventListener('load', onLoad);
        script!.removeEventListener('error', onError);
        if (error) reject(error);
        else resolve();
      };
      const onLoad = () => win.WhopElements ? finish() : finish(new Error('sdk_unavailable'));
      const onError = () => finish(new Error('sdk_load_failed'));
      const timeout = window.setTimeout(() => finish(new Error('sdk_timeout')), 45000);
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      if (win.WhopElements) finish();
    }).catch((error: unknown) => {
      sdkLoad = undefined;
      throw error;
    });
    return sdkLoad;
  };
  const retryOrShowError = (stage: string) => {
    if (cancelled) return;
    console.warn(`[checkout] Initialization failed at ${stage}; retry ${attempts + 1}`);
    attempts += 1;
    handle?.destroy();
    handle = undefined;
    if (attempts <= 3) {
      status.textContent = 'Conectando al pago seguro…';
      retry.hidden = true;
      retryTimer = window.setTimeout(() => void start(), Math.min(1000 * 2 ** (attempts - 1), 4000));
    } else {
      status.textContent = 'La conexión de pago está tardando más de lo normal. Inténtalo de nuevo en unos momentos.';
      retry.hidden = false;
    }
  };
  const goBack = () => {
    if (document.referrer.startsWith(location.origin) && history.length > 1) history.back();
    else location.assign('/');
  };
  const observer = new MutationObserver(restyle);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'lang'] });
  const start = async () => {
    if (starting || cancelled) return;
    starting = true;
    let stage = 'preparación';
    retry.hidden = true;
    try {
      status.textContent = 'Conectando al pago seguro…';
      if (!supabase) throw new Error('unavailable');
      stage = 'sesión';
      const { data: auth, error } = await supabase.auth.getUser();
      if (error || !auth.user) { location.replace('/cuenta/?continuar=compra'); return; }
      stage = 'precio';
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
      const deliveryNotice = 'Tu clave de activación y la descarga de Windows estarán en tu biblioteca cuando se confirme el pago.';
      const productCopy = planPrice.description.trim().startsWith(deliveryNotice)
        ? planPrice.description.trim().slice(deliveryNotice.length).trim()
        : planPrice.description.trim();
      const featureParts = productCopy.split(/\s*✓\s*/).map((part: string) => part.trim()).filter(Boolean);
      const descriptionTitle = featureParts.length > 1 ? featureParts.shift()! : 'HYRO Visuals';
      if (productDescriptionHeading) productDescriptionHeading.textContent = descriptionTitle;
      if (productFeatures) {
        productFeatures.replaceChildren(...featureParts.map((feature: string) => {
          const item = document.createElement('li');
          item.textContent = feature;
          return item;
        }));
      }
      if (productDescription) productDescription.hidden = false;
      stage = 'producto';
      if (!purchaseProductId) {
        const { data: product, error: productError } = await supabase.from('products').select('id').eq('slug', 'hyro-visuals').eq('is_active', true).single();
        if (productError || !product) throw new Error('unavailable');
        purchaseProductId = product.id;
      }
      const productId = purchaseProductId!;
      const { data: owned, error: ownedError } = await supabase.from('licenses').select('id').eq('product_id', productId).eq('status', 'active').maybeSingle();
      if (ownedError) throw new Error('unavailable');
      if (owned) { location.replace('/biblioteca/'); return; }
      stage = 'preparación del pedido';
      if (!purchaseIntentId) {
        const { data: intent, error: intentError } = await supabase.from('purchase_intents')
          .insert({ user_id: auth.user.id, product_id: productId }).select('id').single();
        if (intentError || !intent) throw new Error('unavailable');
        purchaseIntentId = intent.id;
        try {
          sessionStorage.setItem('hyro:checkout-intent-id', intent.id);
          sessionStorage.setItem('hyro:checkout-product-id', productId);
        } catch { /* The return URL also preserves the opaque intent. */ }
      }
      stage = 'formulario de Whop';
      const win = window as WhopWindow;
      await loadWhopElements(win);
      if (cancelled) return;
      if (!win.WhopElements) throw new Error('unavailable');
      handle?.destroy();
      handle = win.WhopElements().checkout.create({
        plan: 'plan_yKbcCAPF4EaHb', quantity: 1,
        appearance: appearance(), locale: document.documentElement.lang === 'es' ? 'es' : 'en',
        metadata: { hyro_intent: purchaseIntentId },
        returnUrl: `${location.origin}/compra/?intent=${encodeURIComponent(purchaseIntentId!)}`,
        onLoadingChange: (loading: boolean) => {
          if (cancelled) return;
          status.textContent = loading ? 'Preparando el formulario de pago…' : '';
          if (!loading) attempts = 0;
        },
      });
      handle.create('checkout', { buyerEmail: auth.user.email,
        onError: () => retryOrShowError('Whop'),
      }).mount('#hyro-whop-checkout');
    } catch {
      retryOrShowError(stage);
    } finally {
      starting = false;
    }
  };
  retry.addEventListener('click', start);
  backButton?.addEventListener('click', goBack);
  void start();
  return () => { cancelled = true; clearTimeout(retryTimer); observer.disconnect(); handle?.destroy(); retry.removeEventListener('click', start); backButton?.removeEventListener('click', goBack); };
}

