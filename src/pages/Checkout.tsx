import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
import { LegalConsent } from "../components/LegalConsent";
import { recordConsent } from "../lib/legal";
import { LEGAL_VERSION } from "../data/legal-version";
import { celebrate } from "../lib/celebrate";
import type { PlanId } from "../data/content";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { ThemeButton } from "../components/Nav";
import { LanguagePicker } from "../components/Language";
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

/* Checkout propio, sin barra de arriba y en el idioma que el cliente ya tenía: contacto y pago a la izquierda, el
   pedido a la derecha. El total lo calcula la base (cupón incluido). Con un cupón del 100 % el pedido se confirma aquí
   mismo; si no, se paga con PayPal (cuenta o tarjeta, los dos botones juntos) cuando está encendido en el panel admin.
   Antes de pagar hay que marcar términos y privacidad (dos casillas aparte); la aceptación se guarda en
   legal_consents con la versión de los documentos antes de crear el pedido. Las claves aparecen en la biblioteca. */
export function Checkout() {
  const { c, theme, lang } = usePrefs();
  const t = c.checkout;
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  // el plan de la dirección solo se lee al entrar: cambiar de licencia aquí no vuelve a cargar la página
  const planId = useRef(params.get("plan") ?? "").current;
  const initialCoupon =
    (location.state as { coupon?: string } | null)?.coupon ?? "";

  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<CheckoutPlan | null>(null);
  const [plans, setPlans] = useState<CheckoutPlan[]>([]);
  // las licencias se eligen en una lista pequeña que abre el texto «Licencia … · … clave» del producto
  const [planOpen, setPlanOpen] = useState(false);
  const planMenu = useRef<HTMLSpanElement>(null);
  // avisos por correo de nuevas versiones (se suscribe al confirmarse la compra)
  const [wantsNews, setWantsNews] = useState(false);
  // términos y aviso de privacidad: una sola casilla sin marcar; la aceptación se guarda al pagar, con la compra
  const [accepted, setAccepted] = useState(false);
  const [consentErrors, setConsentErrors] = useState(false);
  const consentSaved = useRef(false);
  const canPay = accepted;
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  const [couponInput, setCouponInput] = useState(initialCoupon);
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [couponStatus, setCouponStatus] = useState<"idle" | "checking">("idle");
  const [couponError, setCouponError] = useState<string | null>(null);

  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; paid: boolean } | null>(null);

  const [paypal, setPaypal] = useState<PaypalConfig | null>(null);
  // la muesca del ticket va a la altura del corte
  const ticketRef = useRef<HTMLDivElement>(null);
  const perfRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const ticket = ticketRef.current;
    const perf = perfRef.current;
    if (!ticket || !perf) return;
    const place = () =>
      ticket.style.setProperty("--notch-y", `${perf.offsetTop + 0.5}px`);
    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(ticket);
    return () => observer.disconnect();
  }, [status]);
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
        navigate("/login", {
          replace: true,
          state: { returnTo: `/checkout?plan=${encodeURIComponent(planId)}` },
        });
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
    const onDown = (e: PointerEvent) =>
      !planMenu.current?.contains(e.target as Node) && setPlanOpen(false);
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setPlanOpen(false);
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
    // suscripción y autorización de marketing en una sola llamada (migración 0019)
    supabase
      .rpc("newsletter_subscribe", { p_email: email, p_lang: lang, p_source: "checkout", p_version: LEGAL_VERSION })
      .then(undefined, () => undefined);
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
      setCouponError(
        err instanceof Error && err.message ? err.message : t.couponError,
      );
    } finally {
      setCouponStatus("idle");
    }
  };

  const onCoupon = (e: FormEvent) => {
    e.preventDefault();
    applyCoupon(couponInput);
  };

  // guarda la aceptación de términos y privacidad (una vez por visita); sin registro no se cobra
  const saveConsent = async () => {
    if (consentSaved.current) return;
    try {
      await recordConsent(["terms", "privacy"], "checkout");
      consentSaved.current = true;
    } catch {
      throw new Error(c.legal.consentError);
    }
  };

  const onConsent = (v: boolean) => {
    setAccepted(v);
    if (v) setConsentErrors(false);
  };

  const onClaimFree = async () => {
    if (!plan || !coupon || claiming) return;
    if (!canPay) return setConsentErrors(true);
    setClaiming(true);
    setClaimError(null);
    try {
      await saveConsent();
      const purchaseId = await claimFreeOrder(plan.planId, coupon.code);
      setDone({ id: purchaseId.slice(0, 8).toUpperCase(), paid: false });
    } catch (err) {
      setClaimError(
        err instanceof Error && err.message ? err.message : t.claimError,
      );
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
  const planText = plan
    ? (c.buy.plans[plan.planId as PlanId] ?? {
        name: plan.planId,
        ...c.buy.planFallback(plan.keys),
      })
    : null;
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
          <input
            id="co-email"
            type="email"
            value={email ?? ""}
            readOnly
            aria-describedby="co-email-tip"
          />
          <span className="co__tip">
            <button
              type="button"
              className="co__tip-btn"
              aria-label={t.emailHint}
              aria-describedby="co-email-tip"
            >
              <Info size={16} />
            </button>
            <span className="co__tip-box" role="tooltip" id="co-email-tip">
              {t.emailHint}
            </span>
          </span>
        </div>
        <label className="co__check">
          <input
            type="checkbox"
            checked={wantsNews}
            onChange={(e) => setWantsNews(e.target.checked)}
          />
          <span className="co__check-box">
            <Check size={12} />
          </span>
          {t.newsOptIn}
        </label>
      </div>
    </section>
  );
  // cupón: debajo de Contacto, con su título
  const couponBox = (
    <div className="co__coupon">
      <label className="co__coupon-label" htmlFor="co-coupon">
        {t.couponToggle}
      </label>
      {coupon ? (
        <div className="co__coupon-field co__coupon-field--on">
          <span>
            <Check size={14} />
            {coupon.code}
          </span>
          <button
            type="button"
            className="co__coupon-btn"
            onClick={() => {
              setCoupon(null);
              setCouponInput("");
            }}
          >
            {t.couponRemove}
          </button>
        </div>
      ) : (
        <form
          className="co__coupon-field"
          onSubmit={onCoupon}
          noValidate
          data-invalid={Boolean(couponError) || undefined}
        >
          <input
            id="co-coupon"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            placeholder={t.couponPlaceholder}
            aria-invalid={Boolean(couponError)}
          />
          <button
            type="submit"
            className="co__coupon-btn"
            disabled={!couponInput.trim() || couponStatus === "checking"}
          >
            {couponStatus === "checking" ? t.couponApplying : t.couponApply}
          </button>
        </form>
      )}
      {couponError && <p className="co__error">{couponError}</p>}
    </div>
  );

  // título de pago
  const payHead = (
    <h2 className="co__h" id="co-pay-title">
      {t.payTitle}
    </h2>
  );
  const legalChecks = (
    <LegalConsent
      checked={accepted}
      onChange={onConsent}
      showErrors={consentErrors}
    />
  );

  // lo mismo para el botón de PayPal y el de tarjeta (dentro del modal)
  const paypalProps =
    paypal?.enabled && paypal.clientId && plan
      ? {
          clientId: paypal.clientId,
          theme,
          canPay,
          onBlocked: () => setConsentErrors(true),
          createOrder: async () => {
            await saveConsent();
            return createPaypalOrder(plan.planId, coupon?.code ?? null);
          },
          onApprove: onPaypalApprove,
          onError: (message: string | null) =>
            setPayError(message === null ? null : message || t.payError),
          loadError: t.paypalLoadError,
          resetKey: `${plan.planId}:${coupon?.code ?? ""}`,
        }
      : null;

  // ticket igual al de la landing: número, fecha y código de barras salen del plan
  const year = new Date().getFullYear();
  const code = plan ? plan.planId.slice(0, 3).toUpperCase() : "";
  const ticketNo = plan
    ? `HV-${String(year).slice(2)}-${code}-0${plan.keys}`
    : "";
  const ticketDate = new Intl.DateTimeFormat(lang, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date())
    .replace(/\./g, "")
    .toUpperCase();
  const [int, dec] = total.toFixed(2).split(".");

  return (
    <div className="co">
      <header className="co__top">
        <div className="co__wrap co__top-in">
          {/* el logo vuelve a la compra de la landing; al pasar el cursor aparece «Volver» a su lado.
              Enlace normal (no de React Router): la landing es otra página y se carga completa */}
          <AnimateIcon animateOnHover asChild>
            <a
              className="co__home"
              href="/#comprar"
              aria-label={`${t.back} · HYRO`}
            >
              <span className="logo">HYRO</span>
              <span className="co__home-back" aria-hidden="true">
                <ArrowLeft01 size={14} />
                {t.back}
              </span>
            </a>
          </AnimateIcon>
          {/* modo claro/oscuro e idioma, como en la landing */}
          <div className="authtop__icons">
            <ThemeButton />
            <LanguagePicker />
          </div>
        </div>
      </header>

      {status === "loading" && <p className="co__state">{t.loading}</p>}
      {status === "error" && <p className="co__state">{t.loadError}</p>}

      {status === "ready" && plan && planText && (
        <div className="co__wrap co__grid">
          {/* pago (izquierda) */}
          <main className="co__main" aria-busy={capturing}>
            {paypal?.env === "sandbox" && !done && (
              <p className="co__sandbox">{t.sandboxNote}</p>
            )}
            {done ? (
              <div className="co__result" role="status">
                <CircleCheckBig size={28} />
                <h2 className="co__h">
                  {done.paid ? t.paidTitle : t.freeTitle}
                </h2>
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
                {couponBox}
                <section className="co__block">
                  <h2 className="co__h">{t.freeReadyTitle}</h2>
                  <p className="co__note">{t.freeReadyBody}</p>
                  <Button
                    className="co__method"
                    onClick={onClaimFree}
                    loading={claiming}
                    arrow={!claiming}
                  >
                    {claiming ? t.preparing : t.payFree}
                  </Button>
                  {legalChecks}
                </section>
              </>
            ) : paypalProps ? (
              <>
                {contact}
                {couponBox}
                <section className="co__block" aria-labelledby="co-pay-title">
                  {payHead}
                  {/* el pedido se vuelve a crear con el cupón actual: los botones solo piden, el servidor pone el monto */}
                  <PaypalButtons funding="paypal" {...paypalProps} />
                  {/* tarjeta: PayPal despliega su formulario aquí mismo, debajo del botón */}
                  <PaypalButtons
                    funding="card"
                    {...paypalProps}
                    cardLabel={t.cardLabel}
                    cancelLabel={t.cardCancel}
                  />
                  <div className="co__consent co__consent--main">
                    {legalChecks}
                  </div>
                </section>
                {capturing && <p className="co__capturing">{t.capturing}</p>}
              </>
            ) : (
              <>
                {contact}
                {couponBox}
                <section className="co__block">
                  {payHead}
                  <button type="button" className="co__card-btn" disabled>
                    <CreditCard size={18} />
                    {t.payCard}
                  </button>
                  <p className="co__note">{t.paySoon}</p>
                </section>
              </>
            )}
            {!done && (
              <>
                {(payError || claimError) && (
                  <p className="co__error" role="alert">
                    {payError ?? claimError}
                  </p>
                )}
              </>
            )}
          </main>

          {/* resumen del pedido: el ticket de la landing */}
          <aside className="co__aside" aria-labelledby="co-title">
            <div className="tk" ref={ticketRef}>
              <div className="tk__row">
                <span>{t.ticket.software}</span>
                <b>
                  {t.ticket.no} {ticketNo}
                </b>
              </div>
              <p className="tk__title" id="co-title">
                {plan.productName.split(" ").map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </p>

              <ul className="tk__feats">
                {t.ticket.feats.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>

              <div className="tk__perf" ref={perfRef} />

              <dl className="tk__grid">
                <div className="tk__lic">
                  <dt>{t.ticket.license}</dt>
                  <dd>
                    {plans.length > 1 && !done ? (
                      // el nombre de la licencia abre la lista para cambiarla
                      <span className="co__lic" ref={planMenu}>
                        <button
                          type="button"
                          className="co__lic-btn"
                          aria-haspopup="listbox"
                          aria-expanded={planOpen}
                          onClick={() => setPlanOpen((o) => !o)}
                        >
                          {planText.name}
                          <ArrowDown01 size={18} />
                        </button>
                        {planOpen && (
                          <span
                            className="co__lic-menu"
                            role="listbox"
                            aria-label={t.choosePlan}
                          >
                            {plans.map((p) => {
                              const text = c.buy.plans[p.planId as PlanId] ?? {
                                name: p.planId,
                                ...c.buy.planFallback(p.keys),
                              };
                              const on = p.planId === plan.planId;
                              return (
                                <button
                                  key={p.planId}
                                  type="button"
                                  role="option"
                                  aria-selected={on}
                                  className="co__lic-opt"
                                  onClick={() => changePlan(p)}
                                >
                                  <span className="co__lic-tick">
                                    {on && <Check size={14} />}
                                  </span>
                                  <span className="co__lic-name">
                                    {text.name}
                                  </span>
                                  <small>{c.buy.keys(p.keys)}</small>
                                  <span className="co__lic-price">
                                    {money(p.price)}
                                  </span>
                                </button>
                              );
                            })}
                          </span>
                        )}
                      </span>
                    ) : (
                      planText.name
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t.ticket.date}</dt>
                  <dd>{ticketDate}</dd>
                </div>
                <div>
                  <dt>{t.ticket.keys}</dt>
                  <dd>{String(plan.keys).padStart(2, "0")}</dd>
                </div>
                <div>
                  <dt>{t.ticket.system}</dt>
                  <dd>Win · Mac</dd>
                </div>
              </dl>

              {/* con cupón, el ticket muestra el precio y el descuento antes del total */}
              {coupon && (
                <dl className="tk__lines">
                  <div>
                    <dt>{t.subtotal}</dt>
                    <dd>{money(plan.price)}</dd>
                  </div>
                  <div>
                    <dt>{t.discount(coupon.code)}</dt>
                    <dd>−{money(coupon.discount)}</dd>
                  </div>
                </dl>
              )}

              <div className="tk__total">
                <div>
                  <span className="tk__label">{t.ticket.total}</span>
                  <p className="tk__meta">
                    <span>USD</span>
                    <i />
                    <em>{t.ticket.once}</em>
                  </p>
                </div>
                <p className="tk__price" aria-label={`USD ${money(total)}`}>
                  <span className="tk__cur">$</span>
                  <span className="tk__int">{int}</span>
                  <span className="tk__dec">.{dec}</span>
                </p>
              </div>

              <div className="tk__foot">
                <Barcode seed={code + plan.keys} />
                <span>{`HV-${code}-${plan.keys}K-${year}`}</span>
              </div>
            </div>

            {/* la casilla de términos y aviso de privacidad va debajo del ticket (en móvil, debajo de los botones) */}
            {paypalProps && !done && !(total === 0 && coupon) && (
              <div className="co__consent co__consent--aside">
                {legalChecks}
              </div>
            )}
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

/* Código de barras decorativo del ticket (el mismo dibujo que en la landing): barras al azar con semilla fija. */
function Barcode({ seed }: { seed: string }) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  while (x < 296) {
    const w = 1 + Math.floor(rnd() * 3);
    bars.push({ x, w });
    x += w + 1 + Math.floor(rnd() * 2.4);
  }
  return (
    <svg
      className="tk__barcode"
      viewBox={`0 0 ${x} 40`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {bars.map((b) => (
        <rect
          key={b.x}
          x={b.x}
          y={0}
          width={b.w}
          height={40}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
