import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";

export type SessionInfo = { email: string; createdAt: string };

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
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const session = data.session;
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }
      setInfo({ email: session.user.email ?? "", createdAt: session.user.created_at });
      setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return { info, checked };
}
