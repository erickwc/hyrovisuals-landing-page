import { supabase } from '../lib/supabase';

type CheckoutHandle = { create(type: 'checkout', options?: Record<string, unknown>): { mount(selector: string): void }; update(options: Record<string, unknown>): void; destroy(): void };
type WhopWindow = Window & { WhopElements?: () => { checkout: { create(options: Record<string, unknown>): CheckoutHandle } } };

export function initWhopCheckout() {
  const root = document.querySelector<HTMLElement>('[data-whop-checkout]');
  if (!root) return () => {};
  const status = root.querySelector<HTMLElement>('[data-whop-status]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-whop-retry]')!;
  let cancelled = false;
  let handle: CheckoutHandle | undefined;
  const narrow = matchMedia('(max-width: 1071px)');
  const appearance = () => {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    const background = token('--background'), surface = token('--surface'), color = token('--text'), border = token('--border');
    const field = { backgroundColor: surface, color, borderColor: border, borderRadius: '5px', boxShadow: 'none', minHeight: '40px', height: '40px', fontSize: '14px' };
    return {
      theme: { appearance: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', accentColor: 'gray', grayColor: 'gray' },
      variables: { '--radius': '5px', '--font-family': 'Inter, Arial, sans-serif' },
      classes: {
        'whop-Checkout': { backgroundColor: background, color, padding: '0px', fontFamily: 'Inter, Arial, sans-serif' },
        'whop-CheckoutLayout': { gap: narrow.matches ? '24px' : '56px', width: '100%', maxWidth: 'none', padding: '0px' },
        'whop-CheckoutCollection': { width: narrow.matches ? '100%' : '58%', minWidth: '0px', padding: '0px', backgroundColor: background },
        'whop-CheckoutDetails': { width: narrow.matches ? '100%' : '42%', height: 'fit-content', minHeight: '0px', minWidth: '0px', padding: narrow.matches ? '20px' : '28px', backgroundColor: surface, border: `1px solid ${border}`, borderRadius: '6px', boxShadow: 'none' },
        'whop-CheckoutItemHeadline': { color: token('--secondary'), fontSize: '14px', lineHeight: '1.7' },
        'whop-CheckoutItemDescription': { color: token('--secondary'), fontSize: '14px', lineHeight: '1.7' },
        'whop-CheckoutSummary': { color, backgroundColor: surface, textAlign: 'left' },
        'whop-CheckoutItem': { color, textAlign: 'left', fontSize: '20px', fontWeight: '600' },
        'whop-CheckoutPrice': { color, textAlign: 'left' },
        'whop-CheckoutTotal': { color, fontSize: '32px', fontWeight: '600' },
        'whop-CheckoutPriceContext': { color: token('--secondary') },
        'whop-CheckoutPayButton': { backgroundColor: token('--button-bg'), color: token('--button-text'), borderRadius: '5px', minHeight: '50px', fontSize: '15px', fontWeight: '600', boxShadow: 'none' },
        'whop-EmailInput': field,
        'whop-AddressFieldInput': field,
        'whop-AddressFieldSelect': field,
        'whop-CardFieldInput': field,
        'whop-CheckoutRequirementInput': field,
        'whop-AddressGroup': { borderColor: border, borderRadius: '5px', backgroundColor: surface },
        'whop-PaymentMethods': { borderColor: border, borderRadius: '5px', backgroundColor: background },
        'whop-PaymentMethodDetail': { backgroundColor: background, color },
        'whop-PaymentMethodRow': { backgroundColor: background, color },
        'whop-PaymentMethodRowSelected': { backgroundColor: background, color },
        'whop-EmailLabel': { color: token('--secondary'), fontSize: '13px' },
        'whop-CardLabel': { color: token('--secondary'), fontSize: '13px' },
        'whop-CheckoutTerms': { color: token('--secondary'), fontSize: '12px', lineHeight: '1.7' },
      },
    };
  };
  const restyle = () => handle?.update({ appearance: appearance(), locale: document.documentElement.lang === 'es' ? 'es' : 'en' });
  const observer = new MutationObserver(restyle);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'lang'] });
  narrow.addEventListener('change', restyle);
  const start = async () => {
    retry.hidden = true;
    try {
      if (!supabase) throw new Error('unavailable');
      const { data: auth, error } = await supabase.auth.getUser();
      if (error || !auth.user) { location.replace('/cuenta/?continuar=compra'); return; }
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
        plan: 'plan_Alosf0V6ZsprM', quantity: 1,
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
  return () => { cancelled = true; observer.disconnect(); narrow.removeEventListener('change', restyle); handle?.destroy(); retry.removeEventListener('click', start); };
}

