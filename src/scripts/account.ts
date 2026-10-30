import en from '../i18n/en.json';
import es from '../i18n/es.json';
import { supabase } from '../lib/supabase';
import { gsap } from 'gsap';

type Mode = 'register' | 'login' | 'recover' | 'reset';
type StatusKey =
  | 'accountPasswordMismatch'
  | 'accountPasswordShort'
  | 'accountPasswordRequirements'
  | 'accountWorking'
  | 'accountCheckEmail'
  | 'accountLoginError'
  | 'accountRegisterError'
  | 'accountEmailRateLimit'
  | 'accountSignOutError'
  | 'accountConfigError'
  | 'accountRecoverSent'
  | 'accountRecoverError'
  | 'accountResetSuccess'
  | 'accountResetError';

export function initAccountPage() {
  const root = document.querySelector<HTMLElement>('[data-auth-root]');
  if (!root) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const pointerQuery = matchMedia('(hover:hover) and (pointer:fine) and (min-width:768px)');
  const magneticButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-auth-action="login"], [data-auth-action="register"]'));
  const motionTokens = getComputedStyle(document.documentElement);
  const motionDuration = parseFloat(motionTokens.getPropertyValue('--duration-base')) || .65;
  const motionEase = motionTokens.getPropertyValue('--ease-gsap').trim() || 'power3.out';
  const magnetStrength = parseFloat(motionTokens.getPropertyValue('--magnet-strength')) || .12;
  const resetMagnet = () => magneticButtons.forEach((button) => gsap.to(button, { x: 0, y: 0, duration: motionQuery.matches ? 0 : motionDuration, ease: motionEase, overwrite: 'auto' }));
  magneticButtons.forEach((button) => {
    button.addEventListener('pointermove', (event) => {
      if (motionQuery.matches || !pointerQuery.matches || button.disabled) return;
      const bounds = button.getBoundingClientRect();
      gsap.to(button, { x: (event.clientX - bounds.left - bounds.width / 2) * magnetStrength, y: (event.clientY - bounds.top - bounds.height / 2) * magnetStrength, duration: motionDuration, ease: motionEase, overwrite: 'auto' });
    }, { signal });
    button.addEventListener('pointerleave', resetMagnet, { signal });
  });
  motionQuery.addEventListener('change', resetMagnet, { signal });
  const panels = Array.from(
    root.querySelectorAll<HTMLElement>('[data-auth-panel]'),
  );
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
  const recoverForm = root.querySelector<HTMLFormElement>('[data-auth-form="recover"]');
  const resetForm = root.querySelector<HTMLFormElement>('[data-auth-form="reset"]');
  let statusKey: StatusKey | null = null;
  let busy = false;
  let mode: Mode = 'login';
  let recoverySession = false;

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
    panels.forEach((panel) => {
      panel.hidden = active || panel.dataset.authPanel !== mode;
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

  const show = (nextMode: Mode) => {
    mode = nextMode;
    setStatus(null);
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.authPanel !== nextMode;
    });
    root.querySelector<HTMLInputElement>(`[data-auth-panel="${nextMode}"] input`)?.focus();
  };

  root.querySelectorAll<HTMLButtonElement>('[data-auth-switch]').forEach((button) => {
    button.addEventListener('click', () => show(button.dataset.authSwitch as Mode), { signal });
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
      button.setAttribute('aria-pressed', String(input?.type === 'text'));
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
        if (continueTo === 'compra' || continueTo === 'wompi') location.assign('/checkout/');
        else if (continueTo === 'compra-pendiente') location.assign('/compra/');
        else if (continueTo === 'biblioteca-pendiente') location.assign('/biblioteca/?compra=procesando');
      }
      else setStatus('accountCheckEmail');
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      setStatus(code === 'over_email_send_rate_limit' ? 'accountEmailRateLimit' : 'accountRegisterError');
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
      if (continueTo === 'compra' || continueTo === 'wompi') location.assign('/checkout/');
      else if (continueTo === 'compra-pendiente') location.assign('/compra/');
      else if (continueTo === 'biblioteca-pendiente') location.assign('/biblioteca/?compra=procesando');
    } catch {
      setStatus('accountLoginError');
    } finally {
      setBusy(false);
    }
  }, { signal });

  recoverForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!supabase) return setStatus('accountConfigError');
    setBusy(true);
    setStatus('accountWorking');
    const email = String(new FormData(recoverForm).get('email') ?? '').trim();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL('/cuenta/', location.origin).href,
      });
      setStatus(error ? 'accountRecoverError' : 'accountRecoverSent');
    } catch {
      setStatus('accountRecoverError');
    } finally {
      setBusy(false);
    }
  }, { signal });

  resetForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!supabase) return setStatus('accountConfigError');
    const data = new FormData(resetForm);
    const password = String(data.get('password') ?? '');
    if (password.length < 8) return setStatus('accountPasswordShort');
    if (password !== String(data.get('confirmPassword') ?? '')) return setStatus('accountPasswordMismatch');
    setBusy(true);
    setStatus('accountWorking');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return setStatus('accountResetError');
      resetForm.reset();
      await supabase.auth.signOut();
      recoverySession = false;
      show('login');
      setStatus('accountResetSuccess');
    } catch {
      setStatus('accountResetError');
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
    if (event === 'PASSWORD_RECOVERY') {
      recoverySession = true;
      show('reset');
      return;
    }
    if (event === 'INITIAL_SESSION' || recoverySession) return;
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
      if (!signal.aborted && !error && data.user && !recoverySession) {
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
    magneticButtons.forEach((button) => gsap.killTweensOf(button));
    subscription?.data.subscription.unsubscribe();
  };
}
