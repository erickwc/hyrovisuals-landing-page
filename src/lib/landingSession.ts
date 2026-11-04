import { useEffect, useState } from "react";

/* Sesión del cliente vista desde la landing, sin cargar supabase-js de entrada (la landing debe ser liviana).
   Supabase guarda la sesión en localStorage y la mantiene hasta que el cliente cierra sesión: si está ahí, la barra
   muestra su foto al instante con lo último guardado; luego se confirma con Supabase (cargado aparte) y se
   actualizan el nombre y la foto. */

export type LandingUser = { name: string | null; avatarUrl: string | null };

const PROFILE_KEY = "hyro.profile";

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

function cachedProfile(userId: string): LandingUser {
  try {
    const cached = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null") as ({ id: string } & LandingUser) | null;
    if (cached?.id === userId) return { name: cached.name, avatarUrl: cached.avatarUrl };
  } catch {
    /* sin caché: se muestra el icono genérico */
  }
  return { name: null, avatarUrl: null };
}

/** Lo llaman las páginas de cuenta al leer o cambiar el perfil, para que la landing lo muestre sin consultar. */
export function rememberProfile(id: string, profile: LandingUser) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ id, ...profile }));
  } catch {
    /* sin almacenamiento: la landing consultará a Supabase */
  }
}

export function forgetProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* nada que borrar */
  }
}

export function useLandingSession(): LandingUser | null {
  const [user, setUser] = useState<LandingUser | null>(() => {
    const session = storedSession();
    return session ? cachedProfile(session.userId) : null;
  });

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!storedSession()) {
        setUser(null);
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
          setUser(null);
          return;
        }
        const { data: profile, error } = await supabase.from("profiles").select("name, avatar_url").eq("id", session.user.id).maybeSingle();
        if (!active) return;
        // si el perfil no se pudo leer, la sesión sigue siendo válida: se queda la foto guardada
        if (error) {
          setUser((cur) => cur ?? cachedProfile(session.user.id));
          return;
        }
        const next = { name: profile?.name ?? null, avatarUrl: profile?.avatar_url ?? null };
        rememberProfile(session.user.id, next);
        setUser(next);
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
  }, []);

  return user;
}
