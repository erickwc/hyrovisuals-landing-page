import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { supabase } from "../lib/supabase";
import { claimFreeOrder, fetchCheckoutPlan, previewCoupon, type CheckoutPlan, type CouponPreview } from "../lib/checkout";
import type { PlanId } from "../data/content";
import { Button } from "../components/Button";
import { AnimateIcon } from "../components/animate-ui/icons/icon";
import { ArrowLeft01 } from "../components/animate-ui/icons/hugeicons/arrow-left-01";
import { Check } from "../components/animate-ui/icons/hugeicons/check";
import { CreditCard } from "../components/animate-ui/icons/hugeicons/credit-card";
import { CircleCheckBig } from "../components/animate-ui/icons/hugeicons/circle-check-big";
import "../styles/nav.css";
import "../styles/auth.css";
import "../styles/account.css";
import "../styles/checkout.css";

/* Checkout propio, sin barra de arriba y en el idioma que el cliente ya tenía: el pedido a la izquierda y el pago
   a la derecha. El total lo calcula la base (cupón incluido). Con un cupón del 100 % el pedido se confirma aquí
   mismo y las claves aparecen en la biblioteca; el cobro con tarjeta se activa cuando se conecte la pasarela. */
export function Checkout() {
  const { c, lang, theme } = usePrefs();
  const t = c.checkout;
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const planId = params.get("plan") ?? "";
  const initialCoupon = (location.state as { coupon?: string } | null)?.coupon ?? "";

  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<CheckoutPlan | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const [showCoupon, setShowCoupon] = useState(Boolean(initialCoupon));
  const [couponInput, setCouponInput] = useState(initialCoupon);
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [couponStatus, setCouponStatus] = useState<"idle" | "checking">("idle");
  const [couponError, setCouponError] = useState<string | null>(null);

  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [freeOrder, setFreeOrder] = useState<string | null>(null);

  // el checkout siempre se ve claro y limpio (no cambia la preferencia guardada)
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
    return () => {
      document.documentElement.dataset.theme = theme;
    };
  }, [theme]);

  // sesión obligatoria: sin ella se inicia sesión y se vuelve aquí con el mismo plan
  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return setStatus("error");
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        navigate("/login", { replace: true, state: { returnTo: `/checkout?plan=${encodeURIComponent(planId)}` } });
        return;
      }
      setEmail(data.session.user.email ?? "");
      try {
        const found = await fetchCheckoutPlan(planId);
        if (!active) return;
        setPlan(found);
        setStatus(found ? "ready" : "error");
      } catch {
        if (active) setStatus("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [planId, navigate]);

  // el cupón que venía de la landing se aplica solo, una vez cargado el plan
  useEffect(() => {
    if (plan && initialCoupon) applyCoupon(initialCoupon);
    // solo al cargar el plan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const applyCoupon = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || !plan) return;
    setCouponStatus("checking");
    setCouponError(null);
    try {
      setCoupon(await previewCoupon(plan.planId, trimmed));
    } catch (err) {
      setCoupon(null);
      setCouponError(err instanceof Error && err.message ? err.message : t.couponError);
    } finally {
      setCouponStatus("idle");
    }
  };

  const onCoupon = (e: FormEvent) => {
    e.preventDefault();
    applyCoupon(couponInput);
  };

  const onClaimFree = async () => {
    if (!plan || !coupon || claiming) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const purchaseId = await claimFreeOrder(plan.planId, coupon.code);
      setFreeOrder(purchaseId.slice(0, 8).toUpperCase());
    } catch (err) {
      setClaimError(err instanceof Error && err.message ? err.message : t.claimError);
    } finally {
      setClaiming(false);
    }
  };

  const money = (n: number) => new Intl.NumberFormat(lang, { style: "currency", currency: "USD" }).format(n);
  const planText = plan ? (c.buy.plans[plan.planId as PlanId] ?? { name: plan.planId, ...c.buy.planFallback(plan.keys) }) : null;
  const total = coupon ? coupon.amount : (plan?.price ?? 0);

  return (
    <div className="co">
      <main className="wrap co__main">
        <AnimateIcon animateOnHover asChild>
          <Link className="co__back" to="/#comprar">
            <ArrowLeft01 size={16} />
            {t.back}
          </Link>
        </AnimateIcon>

        {status === "loading" && <p className="co__state">{t.loading}</p>}
        {status === "error" && <p className="co__state">{t.loadError}</p>}

        {status === "ready" && plan && planText && (
          <div className="co__grid">
            {/* pedido */}
            <section className="co__order" aria-labelledby="co-title">
              <p className="up co__eyebrow">{t.order}</p>
              <h1 className="co__product" id="co-title">
                {plan.productName}
              </h1>
              <p className="co__plan">
                {t.plan(planText.name)} · {c.buy.keys(plan.keys)}
              </p>
              <p className="co__price">
                {money(total)}
                <span>{t.once}</span>
              </p>

              <h2 className="co__subtitle">{t.includes}</h2>
              <ul className="co__perks">
                {planText.perks.map((perk) => (
                  <li key={perk}>
                    <Check size={14} />
                    {perk}
                  </li>
                ))}
              </ul>

              <div className="co__totals">
                <div>
                  <span>{t.subtotal}</span>
                  <span>{money(plan.price)}</span>
                </div>
                {coupon && (
                  <div>
                    <span>
                      {t.discount(coupon.code)}{" "}
                      <button
                        type="button"
                        className="co__link"
                        onClick={() => {
                          setCoupon(null);
                          setCouponInput("");
                        }}
                      >
                        {t.couponRemove}
                      </button>
                    </span>
                    <span>−{money(coupon.discount)}</span>
                  </div>
                )}
                <div className="co__total">
                  <span>{t.total}</span>
                  <span>{money(total)}</span>
                </div>
              </div>

              {!coupon &&
                (showCoupon ? (
                  <form className="co__coupon" onSubmit={onCoupon} noValidate>
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder={t.couponPlaceholder}
                      aria-label={t.couponPlaceholder}
                      aria-invalid={Boolean(couponError)}
                    />
                    <Button type="submit" variant="ghost" size="sm" disabled={!couponInput.trim()} loading={couponStatus === "checking"}>
                      {couponStatus === "checking" ? t.couponApplying : t.couponApply}
                    </Button>
                    {couponError && <p className="co__error">{couponError}</p>}
                  </form>
                ) : (
                  <button type="button" className="co__link" onClick={() => setShowCoupon(true)}>
                    {t.couponToggle}
                  </button>
                ))}
            </section>

            {/* pago */}
            <section className="co__pay" aria-labelledby="co-pay-title">
              {freeOrder ? (
                <div className="co__result" role="status">
                  <CircleCheckBig size={28} />
                  <h2>{t.freeTitle}</h2>
                  <p>{t.freeBody}</p>
                  <p className="co__order-id">{t.orderLabel(freeOrder)}</p>
                  <Button to="/cuenta/biblioteca" arrow>
                    {t.download}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="co__field">
                    <label htmlFor="co-email">{t.email}</label>
                    <input id="co-email" type="email" value={email ?? ""} readOnly />
                    <p>{t.emailHint}</p>
                  </div>

                  {total === 0 && coupon ? (
                    // cupón del 100 %: sin cobro, solo confirmar el pedido (queda registrado con su número)
                    <div className="co__free">
                      <h2 className="co__subtitle" id="co-pay-title">
                        {t.freeReadyTitle}
                      </h2>
                      <p>{t.freeReadyBody}</p>
                      <Button className="co__method" onClick={onClaimFree} loading={claiming} arrow={!claiming}>
                        {claiming ? t.preparing : t.payFree}
                      </Button>
                    </div>
                  ) : (
                    <div className="co__free">
                      <h2 className="co__subtitle" id="co-pay-title">
                        {t.payTitle}
                      </h2>
                      <Button className="co__method" disabled>
                        <CreditCard size={18} />
                        {t.payCard}
                      </Button>
                      <p>{t.paySoon}</p>
                    </div>
                  )}
                  {claimError && (
                    <p className="co__error" role="alert">
                      {claimError}
                    </p>
                  )}
                  <p className="co__terms">{t.terms}</p>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
