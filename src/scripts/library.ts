import { supabase } from '../lib/supabase';

type OwnedLicense = { id: string; status: string; product_id: string; products: { name: string } | null };

export function initLibraryPage() {
  const root = document.querySelector<HTMLElement>('[data-library-root]');
  if (!root) return () => {};
  const controller = new AbortController();
  const status = root.querySelector<HTMLElement>('[data-library-status]');
  const list = root.querySelector<HTMLElement>('[data-library-products]');
  const say = (message: string) => { if (status) status.textContent = message; };
  void (async () => {
    const client = supabase;
    if (!client) { say('La cuenta no está configurada.'); return; }
    const { data: auth } = await client.auth.getUser();
    if (controller.signal.aborted) return;
    if (!auth.user) { location.assign('/cuenta/'); return; }
    const { data, error } = await client.from('licenses')
      .select('id,status,product_id,products(name)').eq('status', 'active');
    if (controller.signal.aborted) return;
    if (error) { say('No pudimos cargar tus productos.'); return; }
    const licenses = (data ?? []) as unknown as OwnedLicense[];
    if (!licenses.length) {
      say(new URLSearchParams(location.search).has('compra')
        ? 'Gracias por tu compra. Estamos esperando la confirmación de Payhip. Actualiza esta página en unos momentos.'
        : 'Todavía no tienes compras confirmadas.');
      return;
    }
    say('Tus productos están disponibles en esta cuenta.');
    for (const license of licenses) {
      const card = document.createElement('article');
      card.className = 'library-product';
      const heading = document.createElement('h3');
      heading.textContent = license.products?.name ?? 'HYRO Visuals';
      const keyLabel = document.createElement('p');
      keyLabel.textContent = 'Clave de licencia: •••••';
      const reveal = document.createElement('button');
      reveal.type = 'button';
      reveal.className = 'account-submit';
      reveal.textContent = 'Mostrar clave';
      reveal.addEventListener('click', async () => {
        reveal.disabled = true;
        const { data: result, error: keyError } = await client.functions.invoke('license-key', {
          body: { license_id: license.id },
        });
        if (!controller.signal.aborted) {
          keyLabel.textContent = !keyError && typeof result?.key === 'string'
            ? `Clave de licencia: ${result.key}` : 'No pudimos mostrar la clave. Inténtalo de nuevo.';
          reveal.disabled = false;
        }
      }, { signal: controller.signal });
      const demo = document.createElement('button');
      demo.type = 'button';
      demo.className = 'account-submit';
      demo.textContent = 'Descargar para Windows';
      demo.addEventListener('click', () => say('Vista previa: el instalador final de Windows se añadirá aquí.'), { signal: controller.signal });
      const note = document.createElement('p');
      note.className = 'account-panel-copy';
      note.textContent = 'La descarga es una demostración; aún no se entrega un instalador final.';
      card.append(heading, keyLabel, reveal, demo, note);
      list?.append(card);
    }
  })();
  return () => controller.abort();
}
