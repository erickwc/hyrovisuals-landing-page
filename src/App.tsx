import { lazy, Suspense } from "react";
import { MotionConfig } from "motion/react";
import { Routes, Route } from "react-router-dom";
import { PrefsProvider } from "./lib/prefs";
import { Home } from "./pages/Home";

// Las páginas de cuenta cargan aparte para que la landing no arrastre supabase-js.
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("./pages/Register").then((m) => ({ default: m.Register })));
const RecoverPassword = lazy(() => import("./pages/RecoverPassword").then((m) => ({ default: m.RecoverPassword })));
const AccountLayout = lazy(() => import("./pages/AccountLayout").then((m) => ({ default: m.AccountLayout })));
const AccountSettings = lazy(() => import("./pages/AccountSettings").then((m) => ({ default: m.AccountSettings })));
const Library = lazy(() => import("./pages/Library").then((m) => ({ default: m.Library })));
const ProductDetail = lazy(() => import("./pages/ProductDetail").then((m) => ({ default: m.ProductDetail })));
const Purchases = lazy(() => import("./pages/Purchases").then((m) => ({ default: m.Purchases })));

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
            <Route path="/cuenta" element={<AccountLayout />}>
              <Route index element={<AccountSettings />} />
              <Route path="biblioteca" element={<Library />} />
              <Route path="biblioteca/:slug" element={<ProductDetail />} />
              <Route path="compras" element={<Purchases />} />
            </Route>
          </Routes>
        </Suspense>
      </MotionConfig>
    </PrefsProvider>
  );
}
