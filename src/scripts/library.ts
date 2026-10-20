import { supabase } from '../lib/supabase';

type License = { id: string; product_id: string; products: { name: string } | null };
type Build = { id: string; product_id: string; platform: string; file_name: string };

export function initLibraryPage() {
  const root = document.querySelector<HTMLElement>('[data-library-root]');
  if (!root) return () => {};
  const controller = new AbortController();
  const status = root.querySelector<HTMLElement>('[data-library-status]');
  const list = root.querySelector<HTMLElement>('[data-library-products]');
  const say = (message: string) => { if (status) status.textContent = message; };

  const load = async (): Promise<boolean> => {
    if (!supabase) { say('La cuenta no está configurada.'); return false; }
    const client = supabase;
    const { data: auth } = await client.auth.getUser();
    if (controller.signal.aborted) return false;
    if (!auth.user) { location.assign('/cuenta/'); return false; }
    const { data, error } = await client.from('licenses')
      .select('id,product_id,products(name)').eq('status', 'active');
    if (controller.signal.aborted) return false;
    if (error) { say('No pudimos cargar tus productos.'); return false; }
    const licenses = (data ?? []) as unknown as License[];
    if (!licenses.length) {
      say(new URLSearchParams(location.search).has('compra')
        ? 'Preparando tu biblioteca…'
        : 'Todavía no tienes productos en tu biblioteca.');
      return false;
    }
    const { data: buildData, error: buildError } = await client.from('product_builds')
      .select('id,product_id,platform,file_name').eq('is_active', true);
    if (controller.signal.aborted) return false;
    const builds = (buildData ?? []) as Build[];
    say('Tus productos están disponibles en esta cuenta.');
    list?.replaceChildren();
    for (const license of licenses) {
      const card = document.createElement('article');
      card.className = 'library-product';
      const artwork = document.createElement('img');
      artwork.className = 'library-product-artwork';
      artwork.src = '/media/poster.jpg';
      artwork.alt = 'Vista previa de los visualizadores de HYRO Visuals';
      artwork.width = 112;
      artwork.height = 112;
      const details = document.createElement('div');
      details.className = 'library-product-details';
      const category = document.createElement('p');
      category.className = 'library-product-category';
      category.textContent = 'APP DE ESCRITORIO';
      const heading = document.createElement('h3');
      heading.textContent = license.products?.name ?? 'HYRO Visuals';
      const keyLabel = document.createElement('p');
      keyLabel.className = 'library-product-key';
      keyLabel.textContent = 'Clave de licencia: •••••';
      keyLabel.setAttribute('aria-live', 'polite');
      const keyRow = document.createElement('div');
      keyRow.className = 'library-product-key-row';
      const actions = document.createElement('div');
      actions.className = 'library-actions';
      const readKey = async () => {
        const { data: result, error: keyError } = await client.functions.invoke('license-key', {
          body: { license_id: license.id },
        });
        if (keyError || typeof result?.key !== 'string') throw new Error('license_unavailable');
        return result.key as string;
      };
      const reveal = document.createElement('button');
      reveal.type = 'button';
      reveal.className = 'library-pill';
      reveal.textContent = 'Mostrar clave';
      let visible = false;
      reveal.addEventListener('click', async () => {
        if (visible) {
          visible = false;
          keyLabel.textContent = 'Clave de licencia: •••••';
          reveal.textContent = 'Mostrar clave';
          return;
        }
        reveal.disabled = true;
        try {
          keyLabel.textContent = `Clave de licencia: ${await readKey()}`;
          visible = true;
          reveal.textContent = 'Ocultar clave';
        } catch { keyLabel.textContent = 'No pudimos mostrar la clave. Inténtalo de nuevo.'; }
        finally { reveal.disabled = false; }
      }, { signal: controller.signal });
      actions.append(reveal);
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'library-key-copy';
      copy.setAttribute('aria-label', 'Copiar clave de licencia');
      copy.title = 'Copiar clave';
      copy.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="7" width="12" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2"/></svg>';
      copy.addEventListener('click', async () => {
        copy.disabled = true;
        try {
          await navigator.clipboard.writeText(await readKey());
          if (!controller.signal.aborted) say('Clave copiada al portapapeles.');
        } catch {
          if (!controller.signal.aborted) say('No pudimos copiar la clave. Inténtalo de nuevo.');
        } finally { copy.disabled = false; }
      }, { signal: controller.signal });
      keyRow.append(keyLabel, copy);
      const ownedBuilds = builds.filter((build) => build.product_id === license.product_id);
      for (const build of ownedBuilds) {
        const download = document.createElement('button');
        download.type = 'button';
        download.className = 'library-pill library-pill-download';
        download.textContent = `Descargar para ${build.platform === 'macos' ? 'Mac' : 'Windows'}`;
        download.addEventListener('click', async () => {
          download.disabled = true;
          say('Preparando tu descarga…');
          try {
            const { data: session } = await client.auth.getSession();
            const token = session.session?.access_token;
            if (!token) throw new Error('session_expired');
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/api/download';
            form.hidden = true;
            for (const [name, value] of Object.entries({ build_id: build.id, access_token: token })) {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = name;
              input.value = value;
              form.append(input);
            }
            document.body.append(form);
            form.submit();
            form.remove();
            say('Descarga iniciada.');
          } catch {
            if (!controller.signal.aborted) say('No pudimos iniciar la descarga. Inténtalo de nuevo.');
          } finally { download.disabled = false; }
        }, { signal: controller.signal });
        actions.append(download);
      }
      if (!ownedBuilds.some((build) => build.platform === 'macos')) {
        const mac = document.createElement('button');
        mac.type = 'button';
        mac.className = 'library-pill library-pill-download';
        mac.textContent = 'Descargar para Mac';
        mac.addEventListener('click', () => {
          say('La versión para Mac estará disponible aquí cuando recibamos el instalador.');
        }, { signal: controller.signal });
        actions.append(mac);
      }
      const note = document.createElement('p');
      note.className = 'library-product-note';
      note.textContent = buildError
        ? 'No pudimos cargar las descargas. Actualiza esta página para intentarlo de nuevo.'
        : ownedBuilds.length
        ? 'Versión de prueba. Podrás volver a descargarla desde tu biblioteca.'
        : 'El instalador estará disponible aquí cuando publiquemos una versión.';
      details.append(category, heading, keyRow, actions, note);
      card.append(artwork, details);
      list?.append(card);
    }
    if (new URLSearchParams(location.search).has('compra')) history.replaceState(null, '', location.pathname);
    return true;
  };
  void (async () => {
    if (await load() || !new URLSearchParams(location.search).has('compra')) return;
    for (let attempt = 0; attempt < 20 && !controller.signal.aborted; attempt++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 6000));
      if (controller.signal.aborted || await load()) break;
    }
    if (!controller.signal.aborted && !list?.children.length) {
      say('Aún no vemos esta compra en tu biblioteca. Si acabas de pagar, vuelve a abrirla en unos minutos.');
    }
  })();
  return () => controller.abort();
}
