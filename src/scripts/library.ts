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
        ? 'Gracias por tu compra. Esperamos la confirmación de Payhip; esta página se actualizará automáticamente.'
        : 'Todavía no tienes compras confirmadas.');
      return false;
    }
    const { data: buildData } = await client.from('product_builds')
      .select('id,product_id,platform,file_name').eq('is_active', true);
    if (controller.signal.aborted) return false;
    const builds = (buildData ?? []) as Build[];
    say('Tus productos están disponibles en esta cuenta.');
    list?.replaceChildren();
    for (const license of licenses) {
      const card = document.createElement('article');
      card.className = 'library-product';
      const heading = document.createElement('h3');
      heading.textContent = license.products?.name ?? 'HYRO Visuals';
      const keyLabel = document.createElement('p');
      keyLabel.textContent = 'Clave de licencia: •••••';
      keyLabel.setAttribute('aria-live', 'polite');
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
      reveal.className = 'account-submit';
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
      copy.className = 'account-submit';
      copy.textContent = 'Copiar clave';
      copy.addEventListener('click', async () => {
        copy.disabled = true;
        try {
          await navigator.clipboard.writeText(await readKey());
          if (!controller.signal.aborted) say('Clave copiada al portapapeles.');
        } catch {
          if (!controller.signal.aborted) say('No pudimos copiar la clave. Inténtalo de nuevo.');
        } finally { copy.disabled = false; }
      }, { signal: controller.signal });
      actions.append(copy);
      const ownedBuilds = builds.filter((build) => build.product_id === license.product_id);
      for (const build of ownedBuilds) {
        const download = document.createElement('button');
        download.type = 'button';
        download.className = 'account-submit';
        download.textContent = `Descargar para ${build.platform === 'macos' ? 'Mac' : 'Windows'}`;
        download.addEventListener('click', async () => {
          download.disabled = true;
          say('Preparando tu descarga…');
          try {
            const { data: session } = await client.auth.getSession();
            const token = session.session?.access_token;
            if (!token) throw new Error('session_expired');
            const response = await fetch('/api/download', {
              method: 'POST',
              headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
              body: JSON.stringify({ build_id: build.id }),
              signal: controller.signal,
            });
            if (!response.ok) throw new Error('download_failed');
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = build.file_name;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
            say('Descarga iniciada.');
          } catch {
            if (!controller.signal.aborted) say('No pudimos iniciar la descarga. Inténtalo de nuevo.');
          } finally { download.disabled = false; }
        }, { signal: controller.signal });
        actions.append(download);
      }
      const note = document.createElement('p');
      note.className = 'account-panel-copy';
      note.textContent = ownedBuilds.length
        ? 'Versión de prueba. Podrás volver a descargarla desde tu biblioteca.'
        : 'El instalador estará disponible aquí cuando publiquemos una versión.';
      card.append(heading, keyLabel, actions, note);
      list?.append(card);
    }
    return true;
  };
  void (async () => {
    if (await load() || !new URLSearchParams(location.search).has('compra')) return;
    for (let attempt = 0; attempt < 20 && !controller.signal.aborted; attempt++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 6000));
      if (controller.signal.aborted || await load()) break;
    }
  })();
  return () => controller.abort();
}
