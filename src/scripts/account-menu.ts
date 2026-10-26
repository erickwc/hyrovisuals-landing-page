import { supabase } from '../lib/supabase';
import en from '../i18n/en.json';
import es from '../i18n/es.json';

type Dictionary = typeof en;

export function initAccountMenu() {
  const root = document.querySelector<HTMLElement>('[data-account-menu]');
  if (!root) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  const login = root.querySelector<HTMLAnchorElement>('[data-account-login]');
  const trigger = root.querySelector<HTMLButtonElement>(
    '[data-account-trigger]',
  );
  const name = root.querySelector<HTMLElement>('[data-account-name]');
  const email = root.querySelector<HTMLElement>('[data-account-email]');
  const initial = root.querySelector<HTMLElement>('[data-account-initial]');
  const dropdown = root.querySelector<HTMLElement>('[data-account-dropdown]');
  const signOut = root.querySelector<HTMLButtonElement>(
    '[data-account-signout]',
  );
  let status: HTMLElement | null = null;
  let closeTimer: number | undefined;

  const dictionary = (): Dictionary =>
    document.documentElement.lang === 'es' ? es : en;
  const close = (restoreFocus = false) => {
    trigger?.setAttribute('aria-expanded', 'false');
    if (dropdown && !dropdown.hidden) {
      dropdown.classList.add('dropdown-closing');
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        if (dropdown.classList.contains('dropdown-closing')) {
          dropdown.setAttribute('hidden', '');
          dropdown.classList.remove('dropdown-closing');
        }
      }, 150);
    }
    if (restoreFocus) trigger?.focus();
  };
  const setUser = (
    user: { email?: string; user_metadata?: Record<string, unknown> } | null,
  ) => {
    const signedIn = Boolean(user);
    if (login) login.hidden = signedIn;
    if (trigger) trigger.hidden = !signedIn;
    if (name && user) {
      const metadataName =
        user.user_metadata?.full_name ?? user.user_metadata?.name;
      name.textContent =
        typeof metadataName === 'string' && metadataName.trim()
          ? metadataName.trim()
          : (user.email?.split('@')[0] ?? dictionary().accountNav);
      if (initial) {
        const parts = name.textContent.trim().split(/\s+/).filter(Boolean);
        initial.textContent = parts.length > 1
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase()
          : parts[0]?.slice(0, 2).toLocaleUpperCase() ?? '';
      }
    }
    if (email) email.textContent = user?.email ?? '';
    close();
    if (!signedIn && status) status.hidden = true;
  };

  const updateHeaderDivider = () => {
    document
      .querySelector<HTMLElement>('.site-header')
      ?.toggleAttribute('data-scrolled', window.scrollY > 2);
  };
  updateHeaderDivider();
  window.addEventListener('scroll', updateHeaderDivider, { passive: true, signal });

  trigger?.addEventListener(
    'click',
    () => {
      const open = trigger.getAttribute('aria-expanded') !== 'true';
      trigger.setAttribute('aria-expanded', String(open));
      if (open) {
        window.clearTimeout(closeTimer);
        dropdown?.classList.remove('dropdown-closing');
        dropdown?.removeAttribute('hidden');
      }
      else close();
    },
    { signal },
  );

  root.addEventListener(
    'click',
    async (event) => {
      const target = event.target as HTMLElement;
      const action = target.closest('[data-account-signout]');
      if (!action || !supabase || !signOut) return;
      event.preventDefault();
      signOut.disabled = true;
      status ??= document.createElement('p');
      status.className = 'account-menu-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      if (!root.querySelector('.account-menu-status')) root.append(status);
      status.hidden = true;
      const { error } = await supabase.auth.signOut();
      signOut.disabled = false;
      if (error) {
        status.textContent = dictionary().accountMenuSignOutError;
        status.hidden = false;
        return;
      }
      location.assign('/cuenta/');
    },
    { signal },
  );

  document.addEventListener(
    'click',
    (event) => {
      if (!root.contains(event.target as Node)) close();
    },
    { signal },
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key === 'Escape' &&
        trigger?.getAttribute('aria-expanded') === 'true'
      )
        close(true);
    },
    { signal },
  );

  const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
  });
  if (supabase)
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!signal.aborted && !error) setUser(data.user);
    });
  else setUser(null);

  return () => {
    controller.abort();
    subscription?.data.subscription.unsubscribe();
  };
}
