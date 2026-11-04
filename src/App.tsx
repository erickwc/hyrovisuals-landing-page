import { lazy, Suspense } from "react";
import { MotionConfig } from "motion/react";
import { Routes, Route, Navigate } from "react-router-dom";
import { PrefsProvider } from "./lib/prefs";
import { Home } from "./pages/Home";

// Las páginas de cuenta cargan aparte para que la landing no arrastre supabase-js.
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Register = lazy(() => import("./pages/Register").then((m) => ({ default: m.Register })));
const RecoverPassword = lazy(() => import("./pages/RecoverPassword").then((m) => ({ default: m.RecoverPassword })));
const AccountLayout = lazy(() => import("./pages/AccountLayout").then((m) => ({ default: m.AccountLayout })));
const AccountSettings = lazy(() => import("./pages/AccountSettings").then((m) => ({ default: m.AccountSettings })));
const Library = lazy(() => import("./pages/Library").then((m) => ({ default: m.Library })));
const Purchases = lazy(() => import("./pages/Purchases").then((m) => ({ default: m.Purchases })));
const Checkout = lazy(() => import("./pages/Checkout").then((m) => ({ default: m.Checkout })));
const CheckoutResult = lazy(() => import("./pages/CheckoutResult").then((m) => ({ default: m.CheckoutResult })));

// Panel administrativo: carpeta aparte, acceso restringido a socios.
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const Overview = lazy(() => import("./pages/admin/Overview").then((m) => ({ default: m.Overview })));
const Sales = lazy(() => import("./pages/admin/Sales").then((m) => ({ default: m.Sales })));
const Finances = lazy(() => import("./pages/admin/Finances").then((m) => ({ default: m.Finances })));
const Products = lazy(() => import("./pages/admin/Products").then((m) => ({ default: m.Products })));
const ProductPage = lazy(() => import("./pages/admin/ProductAdmin").then((m) => ({ default: m.ProductPage })));
const Clients = lazy(() => import("./pages/admin/Clients").then((m) => ({ default: m.Clients })));
const ClientDetail = lazy(() => import("./pages/admin/ClientDetail").then((m) => ({ default: m.ClientDetail })));
const Coupons = lazy(() => import("./pages/admin/Coupons").then((m) => ({ default: m.Coupons })));
const Reviews = lazy(() => import("./pages/admin/Reviews").then((m) => ({ default: m.Reviews })));
const Announcements = lazy(() => import("./pages/admin/Announcements").then((m) => ({ default: m.Announcements })));
const Settings = lazy(() => import("./pages/admin/Settings").then((m) => ({ default: m.Settings })));
const ActivityLog = lazy(() => import("./pages/admin/ActivityLog").then((m) => ({ default: m.ActivityLog })));
const ClientView = lazy(() => import("./pages/admin/ClientView").then((m) => ({ default: m.ClientView })));

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
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/resultado" element={<CheckoutResult />} />
            <Route path="/cuenta" element={<AccountLayout />}>
              <Route index element={<AccountSettings />} />
              <Route path="biblioteca" element={<Library />} />
              <Route path="biblioteca/:slug" element={<Navigate to="/cuenta/biblioteca" replace />} />
              <Route path="compras" element={<Purchases />} />
            </Route>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Overview />} />
              <Route path="ventas" element={<Sales />} />
              <Route path="finanzas" element={<Finances />} />
              <Route path="productos" element={<Products />} />
              <Route path="productos/:id" element={<ProductPage />} />
              <Route path="clientes" element={<Clients />} />
              <Route path="clientes/:id" element={<ClientDetail />} />
              {/* Las versiones ahora viven dentro de Productos; la dirección vieja sigue funcionando. */}
              <Route path="versiones" element={<Navigate to="/admin/productos" replace />} />
              <Route path="resenas" element={<Reviews />} />
              <Route path="anuncios" element={<Announcements />} />
              <Route path="cupones" element={<Coupons />} />
              <Route path="configuracion" element={<Settings />} />
              <Route path="actividad" element={<ActivityLog />} />
              <Route path="vista-cliente" element={<ClientView />} />
            </Route>
          </Routes>
        </Suspense>
      </MotionConfig>
    </PrefsProvider>
  );
}
