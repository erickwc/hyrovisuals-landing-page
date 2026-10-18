import { supabase } from '../lib/supabase';

export function initPurchaseCheckout() {
  const button = document.querySelector<HTMLAnchorElement>('[data-payhip-checkout]');
  const status = document.querySelector<HTMLElement>('[data-payhip-status]');
  if (!button) return () => {};
  const controller = new AbortController();
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    if (button.dataset.busy === 'true') return;
    if (!supabase) {
      if (status) { status.hidden = false; status.textContent = 'No pudimos preparar el pago. Inténtalo de nuevo.'; }
      return;
    }
    button.dataset.busy = 'true';
    if (status) { status.hidden = false; status.textContent = 'Preparando el pago seguro…'; }
    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError || !userResult.user) { location.assign('/cuenta/?continuar=compra'); return; }
      const { data: product, error: productError } = await supabase.from('products')
        .select('id').eq('slug', 'hyro-visuals').eq('is_active', true).single();
      if (productError || !product) throw new Error('product_unavailable');
      const { data: existing } = await supabase.from('licenses')
        .select('id').eq('product_id', product.id).eq('status', 'active').maybeSingle();
      if (existing) { location.assign('/biblioteca/'); return; }
      const { data: intent, error: intentError } = await supabase.from('purchase_intents')
        .insert({ user_id: userResult.user.id, product_id: product.id }).select('id').single();
      if (intentError || !intent) throw new Error('intent_unavailable');
      const checkout = new URL(button.dataset.payhipUrl!);
      checkout.searchParams.set('metadata[hyro_intent]', intent.id);
      location.assign(checkout.href);
    } catch {
      if (status) status.textContent = 'No pudimos preparar el pago. Inténtalo de nuevo.';
      button.dataset.busy = 'false';
    }
  }, { signal: controller.signal });
  return () => controller.abort();
}
