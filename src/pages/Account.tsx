import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { AuthLayout } from "./AuthLayout";

export function Account() {
  const { c } = usePrefs();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!supabase) {
      navigate("/login", { replace: true });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/login", { replace: true });
        return;
      }
      setEmail(data.session.user.email ?? null);
      setChecked(true);
    });
  }, [navigate]);

  if (!checked) return null;

  const onLogout = async () => {
    await supabase?.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <AuthLayout eyebrow={c.auth.login.eyebrow} title={c.auth.account.title} subtitle={email ?? ""}>
      <Button className="auth__submit" onClick={onLogout}>
        {c.auth.account.logout}
      </Button>
    </AuthLayout>
  );
}
