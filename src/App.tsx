import { lazy, Suspense } from "react";
import { MotionConfig } from "motion/react";
import { Routes, Route } from "react-router-dom";
import { PrefsProvider } from "./lib/prefs";
import { Home } from "./pages/Home";

// Las páginas de cuenta cargan aparte para que la landing no arrastre supabase-js.
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("./pages/Register").then((m) => ({ default: m.Register })));
const RecoverPassword = lazy(() => import("./pages/RecoverPassword").then((m) => ({ default: m.RecoverPassword })));
const Account = lazy(() => import("./pages/Account").then((m) => ({ default: m.Account })));

export function App() {
  return (
    <PrefsProvider>
      <MotionConfig reducedMotion="user">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/recuperar-contrasena" element={<RecoverPassword />} />
            <Route path="/cuenta" element={<Account />} />
          </Routes>
        </Suspense>
      </MotionConfig>
    </PrefsProvider>
  );
}
