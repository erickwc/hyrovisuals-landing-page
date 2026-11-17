import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { supabase } from "../lib/supabase";
import {
  capturePaypalOrder,
  claimFreeOrder,
  createPaypalOrder,
  fetchCheckoutPlan,
  fetchCheckoutPlans,
  fetchPaypalConfig,
  previewCoupon,
  type CheckoutPlan,
  type CouponPreview,
  type PaypalConfig,
} from "../lib/checkout";
import { PaypalButtons } from "../components/PaypalButtons";
import { celebrate } from "../lib/celebrate";
import type { PlanId } from "../data/content";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { AnimateIcon } from "../components/animate-ui/icons/icon";
import { ArrowLeft01 } from "../components/animate-ui/icons/hugeicons/arrow-left-01";
import { Check } from "../components/animate-ui/icons/hugeicons/check";
import { ArrowDown01 } from "../components/animate-ui/icons/hugeicons/arrow-down-01";
import { Info } from "../components/animate-ui/icons/hugeicons/info";
import { CreditCard } from "../components/animate-ui/icons/hugeicons/credit-card";
import { CircleCheckBig } from "../components/animate-ui/icons/hugeicons/circle-check-big";
import "../styles/nav.css";
import "../styles/auth.css";
import "../styles/account.css";
import "../styles/checkout.css";

/* Checkout propio, sin barra de arriba y en el idioma que el cliente ya tenía: el pedido a la izquierda y el pago
   a la derecha. El total lo calcula la base (cupón incluido). Con un cupón del 100 % el pedido se confirma aquí
   mismo; si no, se paga con PayPal (cuenta o tarjeta) cuando está encendido en el panel admin. En los dos casos
   las claves aparecen en la biblioteca. */
export function Checkout() {
  const { c, theme, lang } = usePrefs();
  const t = c.checkout;
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  // el plan de la dirección solo se lee al entrar: cambiar de licencia aquí no vuelve a cargar la página
  const planId = useRef(params.get("plan") ?? "").current;
  const initialCoupon = (location.state as { coupon?: string } | null)?.coupon ?? "";

  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<CheckoutPlan | null>(null);
  const [plans, setPlans] = useState<CheckoutPlan[]>([]);
  // las licencias se eligen en una lista pequeña que abre el texto «Licencia … · … clave» del producto
  const [planOpen, setPlanOpen] = useState(false);
  const planMenu = useRef<HTMLSpanElement>(null);
  // avisos por correo de nuevas versiones (se suscribe al confirmarse la compra)
  const [wantsNews, setWantsNews] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const [couponInput, setCouponInput] = useState(initialCoupon);
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [couponStatus, setCouponStatus] = useState<"idle" | "checking">("idle");
  const [couponError, setCouponError] = useState<string | null>(null);

  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; paid: boolean } | null>(null);

  const [paypal, setPaypal] = useState<PaypalConfig | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

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
      // si PayPal está apagado o no responde, se ve el aviso de «muy pronto»
      fetchPaypalConfig()
        .then((config) => active && setPaypal(config))
        .catch(() => undefined);
      // las demás licencias, para poder cambiar sin salir del checkout
      fetchCheckoutPlans()
        .then((list) => active && setPlans(list))
        .catch(() => undefined);
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

  // compra lista (pagada o con cupón del 100 %): modal de felicitaciones y confeti, una sola vez.
  // Al cerrar el modal queda el mismo aviso en la columna de pago.
  const [doneModal, setDoneModal] = useState(false);
  useEffect(() => {
    if (!done) return;
    setDoneModal(true);
    celebrate().catch(() => undefined);
    // solo al confirmarse el pedido, no al cambiar de tema
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // el cupón que venía de la landing se aplica solo, una vez cargado el plan
  const firstPlan = useRef(true);
  useEffect(() => {
    if (!plan) return;
    if (firstPlan.current) {
      firstPlan.current = false;
      if (initialCoupon) applyCoupon(initialCoupon, plan.planId);
    } else if (coupon) {
      // al cambiar de licencia, el cupón aplicado se vuelve a calcular con el precio nuevo
      applyCoupon(coupon.code, plan.planId);
    }
    // solo cuando cambia el plan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.planId]);

  useEffect(() => {
    if (!planOpen) return;
    const onDown = (e: PointerEvent) => !planMenu.current?.contains(e.target as Node) && setPlanOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlanOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [planOpen]);

  // compra lista y el cliente pidió avisos: se anota en la lista de correos (si ya estaba, no pasa nada)
  useEffect(() => {
    if (!done || !wantsNews || !email || !supabase) return;
    supabase
      .from("newsletter_subscribers")
      .insert({ email: email.trim().toLowerCase(), lang, source: "checkout" })
      .then(() => undefined);
    // solo al confirmarse el pedido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const changePlan = (next: CheckoutPlan) => {
    setPlanOpen(false);
    if (next.planId === plan?.planId) return;
    setPlan(next);
    setPayError(null);
    setParams({ plan: next.planId }, { replace: true });
  };

  const applyCoupon = async (code: string, forPlan = plan?.planId) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || !forPlan) return;
    setCouponStatus("checking");
    setCouponError(null);
    try {
      setCoupon(await previewCoupon(forPlan, trimmed));
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
      setDone({ id: purchaseId.slice(0, 8).toUpperCase(), paid: false });
    } catch (err) {
      setClaimError(err instanceof Error && err.message ? err.message : t.claimError);
    } finally {
      setClaiming(false);
    }
  };

  const onPaypalApprove = async (orderId: string) => {
    setCapturing(true);
    try {
      const purchaseId = await capturePaypalOrder(orderId);
      setDone({ id: purchaseId.slice(0, 8).toUpperCase(), paid: true });
    } finally {
      setCapturing(false);
    }
  };

  // mismo formato que el ticket de la landing: $20.00
  const money = (n: number) => `$${n.toFixed(2)}`;
  const planText = plan ? (c.buy.plans[plan.planId as PlanId] ?? { name: plan.planId, ...c.buy.planFallback(plan.keys) }) : null;
  const total = coupon ? coupon.amount : (plan?.price ?? 0);

  // contacto: el correo de la cuenta (no se cambia aquí)
  const contact = (
    <section className="co__block" aria-labelledby="co-contact">
      <h2 className="co__h" id="co-contact">
        {t.contact}
      </h2>
      <div className="co__field">
        <label className="sr-only" htmlFor="co-email">
          {t.email}
        </label>
        <div className="co__email">
          <input id="co-email" type="email" value={email ?? ""} readOnly aria-describedby="co-email-tip" />
          <span className="co__tip">
            <button type="button" className="co__tip-btn" aria-label={t.emailHint} aria-describedby="co-email-tip">
              <Info size={16} />
            </button>
            <span className="co__tip-box" role="tooltip" id="co-email-tip">
              {t.emailHint}
            </span>
          </span>
        </div>
        <label className="co__check">
          <input type="checkbox" checked={wantsNews} onChange={(e) => setWantsNews(e.target.checked)} />
          <span className="co__check-box">
            <Check size={12} />
          </span>
          {t.newsOptIn}
        </label>
      </div>
    </section>
  );
  const payHead = (
    <div className="co__pay-head">
      <h2 className="co__h" id="co-pay-title">
        {t.payTitle}
      </h2>
      <p>{t.secure}</p>
    </div>
  );

  return (
    <div className="co">
      <header className="co__top">
        <div className="co__top-in">
          <a className="logo" href="/" aria-label={c.nav.home}>
            HYRO
          </a>
          {/* enlace normal (no de React Router): la landing es otra página y se carga completa */}
          <AnimateIcon animateOnHover asChild>
            <a className="co__back" href="/#comprar">
              <ArrowLeft01 size={16} />
              {t.back}
            </a>
          </AnimateIcon>
        </div>
      </header>

      {status === "loading" && <p className="co__state">{t.loading}</p>}
      {status === "error" && <p className="co__state">{t.loadError}</p>}

      {status === "ready" && plan && planText && (
        <div className="co__split">
          {/* pago (izquierda) */}
          <main className="co__left">
            <div className="co__col">
              {done ? (
                <div className="co__result" role="status">
                  <CircleCheckBig size={28} />
                  <h2>{done.paid ? t.paidTitle : t.freeTitle}</h2>
                  <p>{done.paid ? t.paidBody : t.freeBody}</p>
                  <p className="co__order-id">{t.orderLabel(done.id)}</p>
                  <Button to="/cuenta/biblioteca" arrow>
                    {t.download}
                  </Button>
                </div>
              ) : total === 0 && coupon ? (
                // cupón del 100 %: sin cobro, solo confirmar el pedido (queda registrado con su número)
                <>
                  {contact}
                  <section className="co__block">
                    <h2 className="co__h">{t.freeReadyTitle}</h2>
                    <p className="co__note">{t.freeReadyBody}</p>
                    <Button className="co__method" onClick={onClaimFree} loading={claiming} arrow={!claiming}>
                      {claiming ? t.preparing : t.payFree}
                    </Button>
                  </section>
                </>
              ) : paypal?.enabled && paypal.clientId ? (
                <div className="co__paypal-wrap" aria-busy={capturing}>
                  {paypal.env === "sandbox" && <p className="co__sandbox">{t.sandboxNote}</p>}
                  {/* el pedido se vuelve a crear con el cupón actual: los botones solo piden, el servidor pone el monto */}
                  <PaypalButtons
                    clientId={paypal.clientId}
                    theme={theme}
                    createOrder={() => createPaypalOrder(plan.planId, coupon?.code ?? null)}
                    onApprove={onPaypalApprove}
                    onError={(message) => setPayError(message === null ? null : message || t.payError)}
                    loadError={t.paypalLoadError}
                    expressLabel={t.express}
                    cardLabel={t.cardLabel}
                    between={
                      <>
                        <div className="co__or" role="separator">
                          <span>{t.or}</span>
                        </div>
                        {contact}
                        {payHead}
                      </>
                    }
                  />
                  {capturing && <p className="co__capturing">{t.capturing}</p>}
                </div>
              ) : (
                <>
                  {contact}
                  {payHead}
                  <Button className="co__method" disabled>
                    <CreditCard size={18} />
                    {t.payCard}
                  </Button>
                  <p className="co__note">{t.paySoon}</p>
                </>
              )}
              {!done && (
                <>
                  {(payError || claimError) && (
                    <p className="co__error" role="alert">
                      {payError ?? claimError}
                    </p>
                  )}
                  <p className="co__terms">{t.terms}</p>
                </>
              )}
            </div>
          </main>

          {/* resumen del pedido (derecha, en gris) */}
          <aside className="co__summary" aria-labelledby="co-title">
            <div className="co__col">
              <div className="co__item">
                <span className="co__thumb">
                  <img src="/landing/img/favicon.png?v=2" alt="" width="64" height="64" />
                </span>
                <span className="co__item-txt">
                  <span className="co__product" id="co-title">
                    {plan.productName}
                  </span>
                  {plans.length > 1 && !done ? (
                    // el texto de la licencia se vuelve blanco al pasar el cursor y abre la lista para cambiarla
                    <span className="co__lic" ref={planMenu}>
                      <button type="button" className="co__lic-btn" aria-haspopup="listbox" aria-expanded={planOpen} onClick={() => setPlanOpen((o) => !o)}>
                        {t.plan(planText.name)} · {c.buy.keys(plan.keys)}
                        <ArrowDown01 size={13} />
                      </button>
                      {planOpen && (
                        <span className="co__lic-menu" role="listbox" aria-label={t.choosePlan}>
                          {plans.map((p) => {
                            const text = c.buy.plans[p.planId as PlanId] ?? { name: p.planId, ...c.buy.planFallback(p.keys) };
                            const on = p.planId === plan.planId;
                            return (
                              <button key={p.planId} type="button" role="option" aria-selected={on} className="co__lic-opt" onClick={() => changePlan(p)}>
                                <span className="co__lic-tick">{on && <Check size={14} />}</span>
                                <span className="co__lic-name">{text.name}</span>
                                <small>{c.buy.keys(p.keys)}</small>
                                <span className="co__lic-price">{money(p.price)}</span>
                              </button>
                            );
                          })}
                        </span>
                      )}
                    </span>
                  ) : (
                    <small>
                      {t.plan(planText.name)} · {c.buy.keys(plan.keys)}
                    </small>
                  )}
                </span>
                <span className="co__item-price">{money(plan.price)}</span>
              </div>

              {coupon ? (
                <div className="co__applied">
                  <span>{t.discount(coupon.code)}</span>
                  <button
                    type="button"
                    className="co__chip"
                    onClick={() => {
                      setCoupon(null);
                      setCouponInput("");
                    }}
                  >
                    {t.couponRemove}
                  </button>
                </div>
              ) : (
                <form className="co__coupon" onSubmit={onCoupon} noValidate>
                  <div className="co__coupon-field" aria-invalid={Boolean(couponError)}>
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder={t.couponPlaceholder}
                      aria-label={t.couponPlaceholder}
                      aria-invalid={Boolean(couponError)}
                    />
                    <button type="submit" className="co__coupon-apply" disabled={!couponInput.trim() || couponStatus === "checking"}>
                      {couponStatus === "checking" ? t.couponApplying : t.couponApply}
                    </button>
                  </div>
                  {couponError && <p className="co__error">{couponError}</p>}
                </form>
              )}

              <div className="co__totals">
                {coupon && (
                  <div>
                    <span>{t.discount(coupon.code)}</span>
                    <span>−{money(coupon.discount)}</span>
                  </div>
                )}
                <div className="co__total">
                  <span>{t.total}</span>
                  <span>
                    <small>USD</small>
                    {money(total)}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {done && (
        <Modal
          open={doneModal}
          onClose={() => setDoneModal(false)}
          title={done.paid ? t.paidTitle : t.freeTitle}
          className="dlg--sm co__done"
        >
          <CircleCheckBig size={36} className="co__done-icon" />
          <p className="co__done-body">{done.paid ? t.paidBody : t.freeBody}</p>
          <p className="co__order-id">{t.orderLabel(done.id)}</p>
          <Button to="/cuenta/biblioteca" arrow data-autofocus>
            {t.download}
          </Button>
        </Modal>
      )}
    </div>
  );
}
