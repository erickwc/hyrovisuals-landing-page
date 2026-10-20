import { supabase } from '../lib/supabase';

export function initPurchaseProcessing() {
  const root = document.querySelector<HTMLElement>('[data-purchase-processing]');
  if (!root) return () => {};
  const controller = new AbortController();
  const status = root.querySelector<HTMLElement>('[data-processing-status]');
  const back = root.querySelector<HTMLElement>('[data-processing-back]');
  const say = (message: string) => { if (status) status.textContent = message; };
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  void (async () => {
    if (!supabase) { say('No pudimos consultar tu compra. Vuelve a intentarlo más tarde.'); return; }
    const client = supabase;
    const { data: auth, error: authError } = await client.auth.getUser();
    if (controller.signal.aborted) return;
    if (authError || !auth.user) {
      location.replace('/cuenta/?continuar=compra-pendiente');
      return;
    }
    let productId: string | null = null;
    try {
      const cached = sessionStorage.getItem('hyro:checkout-product-id');
      if (cached && /^[0-9a-f-]{36}$/i.test(cached)) productId = cached;
    } catch { /* Storage is optional. */ }
    if (!productId) {
      const { data: product, error: productError } = await client.from('products')
        .select('id').eq('slug', 'hyro-visuals').eq('is_active', true).single();
      if (productError || !product) {
        say('No pudimos consultar HYRO Visuals. Actualiza esta página para intentarlo de nuevo.');
        return;
      }
      productId = product.id;
    }
    if (controller.signal.aborted) return;

    const started = Date.now();
    let delayedNoticeShown = false;
    while (!controller.signal.aborted) {
      const { data: license, error } = await client.from('licenses')
        .select('id').eq('product_id', productId).eq('status', 'active').limit(1).maybeSingle();
      if (controller.signal.aborted) return;
      if (license) {
        try { sessionStorage.removeItem('hyro:checkout-product-id'); } catch { /* Storage is optional. */ }
        location.replace('/biblioteca/?compra=confirmada');
        return;
      }
      if (error) say('Estamos intentando consultar tu compra. Esta página seguirá comprobándola.');
      const elapsed = Date.now() - started;
      if (!error && elapsed < 90_000) say('Terminando de preparar tu producto…');
      if (!delayedNoticeShown && elapsed >= 90_000) {
        delayedNoticeShown = true;
        say('Está tardando más de lo habitual. Si recibiste el comprobante, conserva el número de pedido y no repitas el pago. Seguimos comprobándolo.');
        if (back) back.hidden = false;
      }
      const delay = elapsed < 12_000 ? 750 : elapsed < 30_000 ? 1500 : elapsed < 90_000 ? 4000 : 10_000;
      await wait(delay);
    }
  })();
  return () => controller.abort();
}
