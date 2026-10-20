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
    const { data: product, error: productError } = await client.from('products')
      .select('id').eq('slug', 'hyro-visuals').eq('is_active', true).single();
    if (controller.signal.aborted) return;
    if (productError || !product) {
      say('No pudimos consultar HYRO Visuals. Actualiza esta página para intentarlo de nuevo.');
      return;
    }

    let attempts = 0;
    while (!controller.signal.aborted) {
      const { data: license, error } = await client.from('licenses')
        .select('id').eq('product_id', product.id).eq('status', 'active').limit(1).maybeSingle();
      if (controller.signal.aborted) return;
      if (license) {
        location.replace('/biblioteca/?compra=confirmada');
        return;
      }
      if (error) say('Estamos intentando consultar tu compra. Esta página seguirá comprobándola.');
      else if (attempts === 0) say('Esperando la confirmación de Payhip…');
      if (attempts === 33) {
        say('La confirmación está tardando más de lo habitual. Si recibiste un recibo de Payhip, conserva el número de pedido y no repitas el pago. Seguimos comprobándolo.');
        if (back) back.hidden = false;
      }
      const delay = attempts < 15 ? 2000 : attempts < 23 ? 4000 : attempts < 33 ? 6000 : 10000;
      attempts++;
      await wait(delay);
    }
  })();
  return () => controller.abort();
}
