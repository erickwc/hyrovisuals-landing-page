/* Sesión del cliente vista desde la landing (index.html, sin React), sin cargar supabase-js de entrada (la landing
   debe ser liviana). Supabase guarda la sesión en localStorage y la mantiene hasta que el cliente cierra sesión: si
   está ahí, la barra muestra su foto al instante con lo último guardado; luego se confirma con Supabase (cargado
   aparte) y se actualizan el nombre y la foto. */

export type LandingProfile = { name: string | null; avatarUrl: string | null };
export type LandingUser = LandingProfile & { isAdmin: boolean };

const PROFILE_KEY = "hyro.profile";
// id del usuario si es administrador: la foto de la landing lo lleva al panel sin esperar la consulta
const ADMIN_KEY = "hyro.admin";

function sessionKey() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return null;
  try {
    return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

function storedSession(): { userId: string } | null {
  const key = sessionKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { refresh_token?: string; user?: { id?: string } };
    return parsed.refresh_token && parsed.user?.id ? { userId: parsed.user.id } : null;
  } catch {
    return null;
  }
}

function cachedAdmin(userId: string) {
  try {
    return localStorage.getItem(ADMIN_KEY) === userId;
  } catch {
    return false;
  }
}

function rememberAdmin(userId: string, isAdmin: boolean) {
  try {
    if (isAdmin) localStorage.setItem(ADMIN_KEY, userId);
    else localStorage.removeItem(ADMIN_KEY);
  } catch {
    /* sin almacenamiento: se confirma con Supabase en cada visita */
  }
}

function cachedProfile(userId: string): LandingUser {
  const isAdmin = cachedAdmin(userId);
  try {
    const cached = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null") as ({ id: string } & LandingProfile) | null;
    if (cached?.id === userId) return { name: cached.name, avatarUrl: cached.avatarUrl, isAdmin };
  } catch {
    /* sin caché: se muestra el icono genérico */
  }
  return { name: null, avatarUrl: null, isAdmin };
}

/** Lo llaman las páginas de cuenta al leer o cambiar el perfil, para que la landing lo muestre sin consultar. */
export function rememberProfile(id: string, profile: LandingProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ id, ...profile }));
  } catch {
    /* sin almacenamiento: la landing consultará a Supabase */
  }
}

export function forgetProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(ADMIN_KEY);
  } catch {
    /* nada que borrar */
  }
}

/** Avisa a `onChange` con el cliente de la sesión (o null): primero con lo guardado y luego con lo que confirme
 *  Supabase. Devuelve la función para dejar de escuchar. */
export function watchLandingSession(onChange: (user: LandingUser | null) => void): () => void {
  let active = true;
  let user: LandingUser | null = null;
  const set = (next: LandingUser | null) => {
    user = next;
    onChange(next);
  };

  const initial = storedSession();
  set(initial ? cachedProfile(initial.userId) : null);

  const check = async () => {
    if (!storedSession()) {
      set(null);
      return;
    }
    try {
      const { supabase } = await import("./supabase");
      if (!supabase) return;
      // getSession renueva el token si venció; si ya no es válido, la sesión desaparece
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!active) return;
      if (!session) {
        set(null);
        return;
      }
      const [{ data: profile, error }, { data: adminRow, error: adminError }] = await Promise.all([
        supabase.from("profiles").select("name, avatar_url").eq("id", session.user.id).maybeSingle(),
        supabase.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle(),
      ]);
      if (!active) return;
      // si la consulta falla, no se le quita el acceso al panel a quien ya se sabía que es admin
      const isAdmin = adminError ? cachedAdmin(session.user.id) : Boolean(adminRow);
      if (!adminError) rememberAdmin(session.user.id, isAdmin);
      // si el perfil no se pudo leer, la sesión sigue siendo válida: se queda la foto guardada
      if (error) {
        set({ ...(user ?? cachedProfile(session.user.id)), isAdmin });
        return;
      }
      const next = { name: profile?.name ?? null, avatarUrl: profile?.avatar_url ?? null };
      rememberProfile(session.user.id, next);
      set({ ...next, isAdmin });
    } catch {
      /* sin conexión: se queda lo guardado */
    }
  };
  check();

  // cerrar sesión en otra pestaña también la quita aquí
  const onStorage = (e: StorageEvent) => {
    if (e.key === sessionKey()) check();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    active = false;
    window.removeEventListener("storage", onStorage);
  };
}
