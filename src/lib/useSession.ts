import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import { rememberProfile } from "./landingSession";

export type SessionInfo = { userId: string; email: string; createdAt: string; name: string | null; avatarUrl: string | null; isAdmin: boolean };
/* Lo que el panel de cliente pasa a sus páginas: la sesión y cómo avisar que cambió el perfil. */
export type AccountContext = SessionInfo & { updateProfile: (patch: Partial<Pick<SessionInfo, "name" | "avatarUrl">>) => void };

export function useRequireSession() {
  const navigate = useNavigate();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!supabase) {
      navigate("/login", { replace: true });
      return;
    }
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const session = data.session;
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }
      const [{ data: profile }, { data: adminRow }] = await Promise.all([
        supabase!.from("profiles").select("name, avatar_url").eq("id", session.user.id).maybeSingle(),
        supabase!.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle(),
      ]);
      if (!active) return;
      rememberProfile(session.user.id, { name: profile?.name ?? null, avatarUrl: profile?.avatar_url ?? null });
      setInfo({
        userId: session.user.id,
        email: session.user.email ?? "",
        createdAt: session.user.created_at,
        name: profile?.name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        isAdmin: Boolean(adminRow),
      });
      setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return { info, checked };
}

export type AdminSessionInfo = { email: string; createdAt: string; name: string | null; avatarUrl: string | null };

export function useRequireAdmin() {
  const navigate = useNavigate();
  const [info, setInfo] = useState<AdminSessionInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!supabase) {
      navigate("/login", { replace: true });
      return;
    }
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const session = data.session;
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }
      const [{ data: adminRow }, { data: profile }] = await Promise.all([
        supabase!.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle(),
        supabase!.from("profiles").select("name, avatar_url").eq("id", session.user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (!adminRow) {
        navigate("/", { replace: true });
        return;
      }
      setInfo({
        email: session.user.email ?? "",
        createdAt: session.user.created_at,
        name: profile?.name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      });
      setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return { info, checked };
}
