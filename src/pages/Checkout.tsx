import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { supabase } from "../lib/supabase";
import { fetchCheckoutPlan, previewCoupon, startPayment, type CheckoutPlan, type CouponPreview } from "../lib/checkout";
import { fetchPurchases, orderNumber } from "../lib/account-data";
import type { PlanId } from "../data/content";
import { Button } from "../components/Button";
import { AnimateIcon } from "../components/animate-ui/icons/icon";
import { ArrowLeft01 } from "../components/animate-ui/icons/hugeicons/arrow-left-01";
import { Check } from "../components/animate-ui/icons/hugeicons/check";
import { CreditCard } from "../components/animate-ui/icons/hugeicons/credit-card";
import { LockKeyhole } from "../components/animate-ui/icons/hugeicons/lock-keyhole";
import { CircleCheckBig } from "../components/animate-ui/icons/hugeicons/circle-check-big";
import { TriangleAlert } from "../components/animate-ui/icons/hugeicons/triangle-alert";
import { Cancel01 } from "../components/animate-ui/icons/hugeicons/cancel-01";
import "../styles/nav.css";
import "../styles/auth.css";
import "../styles/account.css";
import "../styles/checkout.css";

type Result = "approved" | "free" | "rejected" | null;

// Lo que se recorta de la página de Wompi (medido en su página de pago, con el recuadro de ~470px de ancho):
// arriba el azul (48) más su encabezado con «Atrás», el logo de Wompi y la línea de debajo (132); a los lados el azul,
// su barra de scroll (queda fuera, a la derecha) y abajo el azul más el pie con el logo de Banco Agrícola.
// Wompi hace su propio scroll y el recorte es fijo: todo su contenido pasa por la parte visible.
const CROP = { top: 48 + 132, side: 28, scrollbar: 18, bottom: 130 };

/** Mensaje que manda /checkout/resultado (cargado dentro de la ventana de pago) al terminar en Wompi. */
export type PaymentMessage = { type: "hyro:payment"; approved: boolean };

/* Checkout propio, sin barra de arriba y en el idioma que el cliente ya tenía: el pedido a la izquierda y las formas
   de pago a la derecha. La tarjeta se paga en la página de Wompi (solo tarjeta), que aparece en el lugar de los
   botones y los empuja hacia abajo: el cliente nunca sale de la web.
   Al terminar, Wompi vuelve a /checkout/resultado dentro de ese marco, y esa página avisa aquí. */
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

  const [starting, setStarting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  // la página de Wompi se muestra cuando ya pintó su formulario (antes solo se ve su fondo azul)
  const [frameReady, setFrameReady] = useState(false);
  // si el pago no se completó (rechazo, «Cancelar» o «Finalizar» en Wompi) se abre un formulario nuevo solo
  const [restart, setRestart] = useState(false);
  // Wompi cambia de pantalla (pasos, formulario) sin recargar; solo recarga al salir del formulario: al cancelar
  // («Tu pago no se completó»), al tocar «Finalizar» (una página que no se deja mostrar aquí) o al terminar.
  // Por eso cualquier carga después de la primera se tapa y se revisa si el pago entró.
  const frameLoads = useRef(0);
  const linkCreatedAt = useRef(0);
  const [checking, setChecking] = useState(false);
  // tope de formularios que se abren solos seguidos, por si algo falla en bucle (cada uno crea una compra pendiente)
  const autoRestarts = useRef(0);
  const [notCompleted, setNotCompleted] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [freeOrder, setFreeOrder] = useState<string | null>(null);

  // el checkout siempre es claro y blanco, para que la página de Wompi se vea integrada (no cambia la preferencia guardada)
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

  // aviso de /checkout/resultado desde dentro de la ventana de pago
  useEffect(() => {
    const onMessage = (e: MessageEvent<PaymentMessage>) => {
      if (e.origin !== window.location.origin || e.data?.type !== "hyro:payment") return;
      setPayUrl(null);
      setFinishing(false);
      if (e.data.approved) {
        setNotCompleted(false);
        setResult("approved");
      } else {
        setNotCompleted(true);
        setRestart(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // el enlace de Wompi abierto se creó con el total anterior: al cambiar el cupón se cierra (y con 100% ya no hace falta)
  useEffect(() => {
    setPayUrl(null);
    setFinishing(false);
  }, [coupon]);

  // cada enlace nuevo vuelve a esperar a que su formulario cargue
  useEffect(() => {
    setFrameReady(false);
    setChecking(false);
    frameLoads.current = 0;
  }, [payUrl]);

  // el cliente salió del formulario de Wompi: si en unos segundos aparece una compra pagada desde que se abrió este
  // enlace, el pago entró (lo confirma el webhook); si no, se abre un formulario nuevo con el aviso
  useEffect(() => {
    if (!checking) return;
    let active = true;
    (async () => {
      for (let i = 0; i < 6 && active; i++) {
        try {
          const paid = await fetchPurchases();
          if (paid.some((p) => new Date(p.date).getTime() >= linkCreatedAt.current - 5000)) {
            if (!active) return;
            setPayUrl(null);
            setNotCompleted(false);
            setResult("approved");
            return;
          }
        } catch {
          /* sin conexión: se vuelve a intentar */
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!active) return;
      setPayUrl(null);
      setNotCompleted(true);
      if (autoRestarts.current < 3) {
        autoRestarts.current += 1;
        setRestart(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [checking]);

  const applyCoupon = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || !plan) return;
    setCouponStatus("checking");
    setCouponError(null);
    try {
      setCoupon(await previewCoupon(plan.planId, trimmed));
    } catch (err) {
      setCoupon(null);
      setCouponError(err instanceof Error && err.message ? err.message : t.payError);
    } finally {
      setCouponStatus("idle");
    }
  };

  const onCoupon = (e: FormEvent) => {
    e.preventDefault();
    applyCoupon(couponInput);
  };

  const onPayCard = async () => {
    if (!plan || starting || payUrl) return;
    setStarting(true);
    setPayError(null);
    setResult(null);
    try {
      const returnUrl = new URL(`${import.meta.env.BASE_URL}checkout/resultado`, window.location.origin).href;
      const start = await startPayment(plan.planId, coupon?.code ?? null, returnUrl);
      if (start.kind === "free") {
        setResult("free");
        // la compra gratis queda registrada como cualquier otra: se muestra su número de pedido
        fetchPurchases()
          .then((list) => list[0] && setFreeOrder(orderNumber(list[0])))
          .catch(() => {});
      } else {
        linkCreatedAt.current = Date.now();
        setPayUrl(start.url);
      }
    } catch (err) {
      setPayError(err instanceof Error && err.message ? err.message : t.payError);
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!restart || payUrl || starting) return;
    setRestart(false);
    onPayCard();
    // onPayCard se lee con el estado actual al dispararse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restart, payUrl, starting]);

  const money = (n: number) => new Intl.NumberFormat(lang, { style: "currency", currency: "USD" }).format(n);
  const planText = plan ? (c.buy.plans[plan.planId as PlanId] ?? { name: plan.planId, ...c.buy.planFallback(plan.keys) }) : null;
  const total = coupon ? coupon.amount : (plan?.price ?? 0);

  return (
    <div className="co">
      <main className="wrap co__main">
        <AnimateIcon animateOnHover asChild>
          <Link className="co__back" to="/#licencias">
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
              {result ? (
                <div className="co__result" data-tone={result === "rejected" ? "bad" : "ok"} role="status">
                  {result === "rejected" ? <TriangleAlert size={28} /> : <CircleCheckBig size={28} />}
                  <h2>{result === "approved" ? t.approvedTitle : result === "free" ? t.freeTitle : t.rejectedTitle}</h2>
                  <p>{result === "approved" ? t.approvedBody : result === "free" ? t.freeBody : t.rejectedBody}</p>
                  {result === "free" && freeOrder && <p className="co__order-id">{t.orderLabel(freeOrder)}</p>}
                  {result === "rejected" ? (
                    <Button onClick={() => setResult(null)}>{t.tryAgain}</Button>
                  ) : (
                    <Button to="/cuenta/biblioteca" arrow>
                      {result === "free" ? t.download : t.goLibrary}
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="co__field">
                    <label htmlFor="co-email">{t.email}</label>
                    <input id="co-email" type="email" value={email ?? ""} readOnly />
                    <p>{t.emailHint}</p>
                  </div>

                  {total === 0 ? (
                    // cupón del 100%: sin formas de pago, solo confirmar el pedido (queda registrado con su número)
                    <div className="co__free">
                      <h2 className="co__subtitle" id="co-pay-title">
                        {t.freeReadyTitle}
                      </h2>
                      <p>{t.freeReadyBody}</p>
                      <Button className="co__method" onClick={onPayCard} loading={starting} arrow={!starting}>
                        {starting ? t.preparing : t.payFree}
                      </Button>
                    </div>
                  ) : (
                    <>
                      {!payUrl && (
                        <h2 className="co__subtitle" id="co-pay-title">
                          {t.payTitle}
                        </h2>
                      )}
                      {/* la página de Wompi (solo tarjeta) aparece en lugar de los botones, que bajan debajo de ella */}
                      {payUrl && (
                        <div className="co__wompi">
                          {notCompleted && (
                            <p className="co__error" role="status">
                              {t.notCompleted}
                            </p>
                          )}
                          <div className="co__wompi-head">
                            <p>{t.windowTitle}</p>
                            <AnimateIcon animateOnHover asChild>
                              <button type="button" className="co__wompi-close" onClick={() => (setPayUrl(null), setNotCompleted(false))} aria-label={t.close} title={t.close}>
                                <Cancel01 size={14} />
                              </button>
                            </AnimateIcon>
                          </div>
                          <p className="co__wompi-hint">{t.windowHint}</p>
                          <div className="co__wompi-view" aria-busy={finishing || checking || !frameReady} data-ready={frameReady && !checking}>
                              <iframe
                                // un marco nuevo por enlace: así una navegación que el anterior no terminó no cuenta como «salió del formulario»
                                key={payUrl}
                                src={payUrl}
                                title={t.windowTitle}
                                allow="payment"
                                style={{
                                  top: -CROP.top,
                                  left: -CROP.side,
                                  width: `calc(100% + ${CROP.side * 2 + CROP.scrollbar}px)`,
                                  height: `calc(100% + ${CROP.top + CROP.bottom}px)`,
                                }}
                                onLoad={(e) => {
                                  frameLoads.current += 1;
                                  // al volver a nuestra web (mismo origen) el pago ya terminó: se espera el aviso de /checkout/resultado
                                  try {
                                    const inner = e.currentTarget.contentWindow?.location;
                                    if (inner?.origin === window.location.origin && inner.pathname.endsWith("/checkout/resultado")) {
                                      setFinishing(true);
                                      return;
                                    }
                                  } catch {
                                    /* sigue en Wompi: no se puede leer, es lo esperado */
                                  }
                                  if (frameLoads.current === 1) {
                                    // Wompi pinta su formulario un instante después de cargar: se espera un poco antes de mostrarlo
                                    window.setTimeout(() => setFrameReady(true), 700);
                                  } else {
                                    // salió del formulario: se tapa (sin ver su pantalla azul) y se revisa el pago
                                    setChecking(true);
                                  }
                                }}
                              />
                            {(finishing || checking || !frameReady) && (
                              <p className="co__finishing">
                                <span className="btn__spinner" aria-hidden="true" />
                                {finishing ? t.finishing : checking ? t.checkingPayment : t.loadingForm}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="co__methods">
                        <Button className="co__method" onClick={onPayCard} loading={starting} disabled={Boolean(payUrl)}>
                          {!starting && <CreditCard size={18} />}
                          {starting ? t.preparing : t.payCard}
                        </Button>
                        <button type="button" className="co__paypal">
                          {t.payPaypal} <b>Pay</b>
                          <b>Pal</b>
                        </button>
                      </div>
                    </>
                  )}
                  {payError && (
                    <p className="co__error" role="alert">
                      {payError}
                    </p>
                  )}
                  {!payUrl && notCompleted && (
                    <p className="co__error" role="status">
                      {t.notCompleted}
                    </p>
                  )}

                  {total > 0 && (
                    <p className="co__secure">
                      <LockKeyhole size={14} />
                      {t.secure}
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
