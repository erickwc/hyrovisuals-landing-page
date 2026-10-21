import en from '../i18n/en.json';
import es from '../i18n/es.json';
import { supabase } from '../lib/supabase';

type Mode = 'register' | 'login';
type StatusKey =
  | 'accountPasswordMismatch'
  | 'accountPasswordShort'
  | 'accountWorking'
  | 'accountCheckEmail'
  | 'accountLoginError'
  | 'accountRegisterError'
  | 'accountSignOutError'
  | 'accountConfigError';

export function initAccountPage() {
  const root = document.querySelector<HTMLElement>('[data-auth-root]');
  if (!root) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  const tabs = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-auth-tab]'),
  );
  const panels = Array.from(
    root.querySelectorAll<HTMLElement>('[data-auth-panel]'),
  );
  const tabList = root.querySelector<HTMLElement>('.account-tabs');
  const signedIn = root.querySelector<HTMLElement>('[data-auth-signed-in]');
  const emailDisplay = root.querySelector<HTMLElement>('[data-auth-email]');
  const adminLink = root.querySelector<HTMLAnchorElement>('[data-auth-admin-link]');
  const status = root.querySelector<HTMLElement>('[data-auth-status]');
  const registerForm = root.querySelector<HTMLFormElement>(
    '[data-auth-form="register"]',
  );
  const loginForm = root.querySelector<HTMLFormElement>(
    '[data-auth-form="login"]',
  );
  let statusKey: StatusKey | null = null;
  let busy = false;

  const dictionary = () => (document.documentElement.lang === 'es' ? es : en);
  const setStatus = (key: StatusKey | null) => {
    statusKey = key;
    if (!status) return;
    status.hidden = !key;
    status.textContent = key ? dictionary()[key] : '';
  };
  const setBusy = (value: boolean) => {
    busy = value;
    root.querySelectorAll<HTMLButtonElement>('[data-auth-action]').forEach((button) => {
      button.disabled = value;
    });
  };
  const showUser = (email: string | null) => {
    const active = Boolean(email);
    if (tabList) tabList.hidden = active;
    panels.forEach((panel) => {
      panel.hidden = active || panel.dataset.authPanel !== 'register';
    });
    if (signedIn) signedIn.hidden = !active;
    if (emailDisplay) emailDisplay.textContent = email ?? '';
    if (adminLink) adminLink.hidden = true;
    if (active) setStatus(null);
  };
  const showAdminLink = async (userId: string) => {
    const { data, error } = await supabase!.from('profiles').select('role').eq('id', userId).single();
    if (!signal.aborted && !error && adminLink) adminLink.hidden = data?.role !== 'admin';
  };

  const show = (mode: Mode, focus = false) => {
    setStatus(null);
    tabs.forEach((tab) => {
      const selected = tab.dataset.authTab === mode;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.authPanel !== mode;
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => show(tab.dataset.authTab as Mode), {
      signal,
    });
    tab.addEventListener(
      'keydown',
      (event) => {
        let next: number;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft')
          next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        show(tabs[next].dataset.authTab as Mode, true);
      },
      { signal },
    );
  });

  const passwordButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-password-toggle]'),
  );
  const updatePasswordLabels = () => {
    const words = dictionary();
    passwordButtons.forEach((button) => {
      const input =
        button.parentElement?.querySelector<HTMLInputElement>('input');
      button.setAttribute(
        'aria-label',
        input?.type === 'text'
          ? words.accountHidePassword
          : words.accountShowPassword,
      );
    });
  };
  passwordButtons.forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        const input =
          button.parentElement?.querySelector<HTMLInputElement>('input');
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        updatePasswordLabels();
      },
      { signal },
    );
  });
  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!supabase) return setStatus('accountConfigError');
    const data = new FormData(registerForm);
    const fullName = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const confirmation = String(data.get('confirmPassword') ?? '');
    if (password.length < 8) return setStatus('accountPasswordShort');
    if (password !== confirmation) return setStatus('accountPasswordMismatch');
    setBusy(true);
    setStatus('accountWorking');
    try {
      const { data: result, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: new URL('/cuenta/', window.location.origin).href,
        },
      });
      if (error) throw error;
      registerForm.reset();
      if (result.session && result.user) {
        showUser(result.user.email ?? email);
        void showAdminLink(result.user.id);
        const continueTo = new URLSearchParams(location.search).get('continuar');
        if (continueTo === 'compra') location.assign('/#compra');
        else if (continueTo === 'compra-pendiente') location.assign('/compra/');
        else if (continueTo === 'paypal-sandbox') location.assign('/compra/sandbox/');
        else if (continueTo === 'paypal') location.assign('/compra/paypal/');
      }
      else setStatus('accountCheckEmail');
    } catch {
      setStatus('accountRegisterError');
    } finally {
      setBusy(false);
    }
  }, { signal });

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!supabase) return setStatus('accountConfigError');
    const data = new FormData(loginForm);
    setBusy(true);
    setStatus('accountWorking');
    try {
      const { data: result, error } = await supabase.auth.signInWithPassword({
        email: String(data.get('email') ?? '').trim(),
        password: String(data.get('password') ?? ''),
      });
      if (error) throw error;
      loginForm.reset();
      showUser(result.user.email ?? null);
      void showAdminLink(result.user.id);
      const continueTo = new URLSearchParams(location.search).get('continuar');
      if (continueTo === 'compra') location.assign('/#compra');
      else if (continueTo === 'compra-pendiente') location.assign('/compra/');
      else if (continueTo === 'paypal-sandbox') location.assign('/compra/sandbox/');
      else if (continueTo === 'paypal') location.assign('/compra/paypal/');
    } catch {
      setStatus('accountLoginError');
    } finally {
      setBusy(false);
    }
  }, { signal });

  root.querySelector<HTMLButtonElement>('[data-auth-signout]')?.addEventListener(
    'click',
    async () => {
      if (!supabase || busy) return;
      setBusy(true);
      const { error } = await supabase.auth.signOut();
      setBusy(false);
      if (error) return setStatus('accountSignOutError');
      showUser(null);
      show('login');
    },
    { signal },
  );

  const subscription = supabase?.auth.onAuthStateChange((event, session) => {
    if (signal.aborted) return;
    if (event === 'INITIAL_SESSION') return;
    if (session?.user) {
      showUser(session.user.email ?? null);
      void showAdminLink(session.user.id);
    }
    else if (signedIn && !signedIn.hidden) {
      showUser(null);
      show('login');
    }
  });
  if (supabase) {
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!signal.aborted && !error && data.user) {
        showUser(data.user.email ?? null);
        void showAdminLink(data.user.id);
      }
    });
  } else {
    setStatus('accountConfigError');
  }
  document.addEventListener('hyro:language', () => {
    updatePasswordLabels();
    if (statusKey) setStatus(statusKey);
  }, { signal });
  updatePasswordLabels();

  return () => {
    controller.abort();
    subscription?.data.subscription.unsubscribe();
  };
}
