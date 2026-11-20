import { useEffect, useRef, useState } from "react";
import { CreditCard } from "./animate-ui/icons/hugeicons/credit-card";

/* Un botón oficial de PayPal (SDK de JavaScript, cargado una sola vez para toda la página): `funding="paypal"`
   para pagar con la cuenta de PayPal, `funding="card"` para tarjeta de crédito o débito sin cuenta. El de tarjeta va
   dentro del modal del checkout: al tocarlo, PayPal despliega ahí su formulario. Mientras falten las casillas de
   términos y privacidad, el botón no abre nada (onClick → reject). El pedido lo crea y lo cobra el servidor. */

type PaypalActions = { restart: () => Promise<void> };
type PaypalClickActions = { resolve: () => Promise<void>; reject: () => Promise<void> };
type PaypalButtonsInstance = { isEligible: () => boolean; render: (el: HTMLElement) => Promise<void>; close: () => Promise<void> };
type PaypalSdk = {
  FUNDING: { PAYPAL: string; CARD: string };
  Buttons: (options: {
    fundingSource: string;
    style: Record<string, unknown>;
    onClick: (data: unknown, actions: PaypalClickActions) => Promise<void> | void;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }, actions: PaypalActions) => Promise<void>;
    onCancel?: () => void;
    onError: (err: unknown) => void;
  }) => PaypalButtonsInstance;
};

declare global {
  interface Window {
    paypal?: PaypalSdk;
  }
}

let loading: { src: string; promise: Promise<PaypalSdk> } | null = null;

// sin "locale": PayPal elige idioma y país según quien compra (el formulario de tarjeta propone su país)
function loadSdk(clientId: string): Promise<PaypalSdk> {
  const params = new URLSearchParams({ "client-id": clientId, currency: "USD", intent: "capture", components: "buttons" });
  const src = `https://www.paypal.com/sdk/js?${params}`;
  if (loading?.src === src) return loading.promise;
  document.querySelectorAll("script[data-paypal-sdk]").forEach((s) => s.remove());
  delete window.paypal;
  const promise = new Promise<PaypalSdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.paypalSdk = "";
    script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal SDK")));
    script.onerror = () => {
      loading = null;
      reject(new Error("PayPal SDK"));
    };
    document.head.appendChild(script);
  });
  loading = { src, promise };
  return promise;
}

type Props = {
  clientId: string;
  /** Qué botón dibujar: la cuenta de PayPal o la tarjeta. */
  funding: "paypal" | "card";
  /** Tema de la página: PayPal va en blanco sobre oscuro y en negro sobre claro. */
  theme: "light" | "dark";
  createOrder: () => Promise<string>;
  /** Cobra el pedido aprobado. Si lanza un error con code INSTRUMENT_DECLINED, PayPal deja elegir otra forma de pago. */
  onApprove: (orderId: string) => Promise<void>;
  /** null borra el error; "" es un error sin mensaje propio (se muestra el genérico). */
  onError: (message: string | null) => void;
  /** Texto si el SDK de PayPal no carga (bloqueador de anuncios, sin conexión). */
  loadError: string;
  /** false mientras falten las casillas obligatorias: el botón se ve apagado y no abre el pago. */
  canPay: boolean;
  /** Se llama al tocar el botón apagado (para mostrar qué falta). */
  onBlocked: () => void;
  /** Tarjeta: texto del botón propio que va encima del de PayPal, y del botón para cerrar el formulario. */
  cardLabel?: string;
  cancelLabel?: string;
  /** Cuando cambia (otra licencia u otro cupón), los botones se vuelven a dibujar y se cierra el formulario
   *  abierto: PayPal crea el pedido al tocar el botón, así el siguiente clic usa el monto nuevo. */
  resetKey?: string;
};

export function PaypalButtons(props: Props) {
  const slot = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [failed, setFailed] = useState(false);
  // tarjeta: encima del botón de PayPal va uno con el diseño de la web que deja pasar el clic (pointer-events: none),
  // así el clic lo recibe PayPal y abre su formulario. «opening» muestra el loader desde el clic hasta que el
  // formulario aparece (tarda unos segundos); «open» oculta el botón propio y deja solo el formulario de PayPal,
  // que trae su propia X para cerrarse (al cerrarlo, el alto baja y se vuelve a «idle»).
  const [phase, setPhase] = useState<"idle" | "opening" | "open">("idle");
  // PayPal primero muestra su propio spinner (unos 250 px) y luego los campos (más de 500 px): «Cancelar» espera a
  // que aparezcan los campos para no quedar flotando debajo del spinner
  const [formReady, setFormReady] = useState(false);
  // al cambiar, el botón se vuelve a dibujar cerrado (Cancelar)
  const [round, setRound] = useState(0);
  const closeCard = () => {
    setPhase("idle");
    setRound((n) => n + 1);
  };

  useEffect(() => {
    const el = slot.current;
    if (!el || props.funding !== "card" || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const height = el.getBoundingClientRect().height;
      const open = height > 90;
      setPhase((p) => (open ? "open" : p === "open" ? "idle" : p));
      setFormReady(height > 420);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [props.funding]);

  // si PayPal no llega a abrir el formulario (sin conexión, ventana bloqueada), el loader no se queda para siempre
  useEffect(() => {
    if (phase !== "opening") return;
    const t = window.setTimeout(() => setPhase((p) => (p === "opening" ? "idle" : p)), 15000);
    return () => window.clearTimeout(t);
  }, [phase]);

  // el clic dentro del marco de PayPal no llega a la página, pero la ventana pierde el foco y el marco queda activo:
  // así se sabe que tocaron el botón de tarjeta y se muestra el loader al instante
  useEffect(() => {
    if (props.funding !== "card") return;
    const onBlur = () =>
      window.setTimeout(() => {
        const active = document.activeElement;
        if (active && slot.current?.contains(active) && latest.current.canPay) setPhase((p) => (p === "idle" ? "opening" : p));
      }, 0);
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [props.funding]);

  useEffect(() => {
    let rendered: PaypalButtonsInstance | null = null;
    let cancelled = false;
    let lastError: string | null = null;
    // PayPal en su amarillo de siempre; el de tarjeta (tapado por el botón propio) en blanco u oscuro según el tema
    const cardColor = props.theme === "dark" ? "white" : "black";

    loadSdk(props.clientId)
      .then((paypal) => {
        if (cancelled || !slot.current) return;
        const card = props.funding === "card";
        const buttons = paypal.Buttons({
          fundingSource: card ? paypal.FUNDING.CARD : paypal.FUNDING.PAYPAL,
          style: card ? { shape: "rect", color: cardColor, height: 46 } : { shape: "rect", color: "gold", height: 46, label: "paypal" },
          onClick: (_data, actions) => {
            if (latest.current.canPay) {
              if (card) setPhase("opening");
              return actions.resolve();
            }
            latest.current.onBlocked();
            return actions.reject();
          },
          createOrder: async () => {
            lastError = null;
            latest.current.onError(null);
            try {
              return await latest.current.createOrder();
            } catch (err) {
              lastError = err instanceof Error ? err.message : null;
              throw err;
            }
          },
          onApprove: async (data, actions) => {
            try {
              await latest.current.onApprove(data.orderID);
            } catch (err) {
              if ((err as { code?: string }).code === "INSTRUMENT_DECLINED") return actions.restart();
              latest.current.onError(err instanceof Error ? err.message : "");
            }
          },
          onError: () => latest.current.onError(lastError ?? ""),
        });
        if (!buttons.isEligible()) return;
        rendered = buttons;
        buttons.render(slot.current).catch(() => undefined);
      })
      .catch(() => !cancelled && setFailed(true));

    const el = slot.current;
    return () => {
      cancelled = true;
      rendered?.close().catch(() => undefined);
      // el SDK deja su iframe al cerrar: se vacía el hueco para no duplicar botones al cambiar de tema
      el?.replaceChildren();
    };
  }, [props.clientId, props.theme, props.funding, props.resetKey, round]);

  if (failed) return <p className="co__error">{props.loadError}</p>;
  // sin la casilla marcada, una capa encima recibe el clic: así PayPal no llega a abrir su ventana
  const blocker = !props.canPay && phase !== "open" && (
    <span className="co__pp-block" aria-hidden="true" onClick={() => props.onBlocked()} />
  );
  if (props.funding !== "card")
    return (
      <div className="co__pp co__pp--paypal" data-locked={!props.canPay || undefined}>
        <div ref={slot} className="co__pp-clip" />
        {blocker}
      </div>
    );
  return (
    <div className={`co__pp co__pp--card is-${phase}`} data-locked={!props.canPay || undefined} aria-busy={phase === "opening"}>
      {/* arriba del formulario quedan el botón de PayPal y su X: abierto, se recortan y solo se ve el formulario */}
      <div className="co__pp-clip">
        <div ref={slot} className="co__pp-slot" />
      </div>
      {/* en lugar de la X de PayPal, «Cancelar» debajo de «Pagar», con el mismo aspecto del formulario */}
      {phase === "open" && formReady && (
        <button type="button" className="co__pp-cancel" onClick={closeCard}>
          {props.cancelLabel}
        </button>
      )}
      {/* botón propio encima del de PayPal: solo se ve, el clic pasa al de PayPal que está debajo */}
      {phase !== "open" && (
        <span className="co__pp-face" aria-hidden="true">
          {phase === "opening" ? (
            <span className="co__pp-spinner" />
          ) : (
            <>
              <CreditCard size={18} />
              {props.cardLabel}
            </>
          )}
        </span>
      )}
      {blocker}
    </div>
  );
}

/* Logos de lo que se acepta (logos de marca: fuera de la regla de iconos). */
export function PaymentMarks() {
  return (
    <div className="co__marks" role="img" aria-label="PayPal, Visa, Mastercard">
      <span className="co__mark co__mark--paypal" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="#003087" d="M7.1 21.4H3.6a.5.5 0 0 1-.5-.6L6 2.6a.7.7 0 0 1 .7-.6h7c3.3 0 5.4 1.6 4.9 4.9-.6 3.9-3.1 5.7-6.6 5.7H9.8a.7.7 0 0 0-.7.6Z" />
          <path fill="#009cde" d="M19.4 7.6c-.7 3.9-3.3 5.6-6.8 5.6h-1.7a.8.8 0 0 0-.8.7l-1 6.4-.3 1.7a.4.4 0 0 0 .4.5h3a.7.7 0 0 0 .7-.6l.6-3.8a.7.7 0 0 1 .7-.6h.5c2.9 0 5.1-1.2 5.8-4.6.3-1.6.1-2.9-.8-3.8Z" />
        </svg>
      </span>
      <span className="co__mark co__mark--visa" aria-hidden="true">
        VISA
      </span>
      <span className="co__mark" aria-hidden="true">
        <svg viewBox="0 0 24 16" width="22" height="14">
          <circle cx="9" cy="8" r="6" fill="#eb001b" />
          <circle cx="15" cy="8" r="6" fill="#f79e1b" />
          <path fill="#ff5f00" d="M12 3.2a6 6 0 0 1 0 9.6 6 6 0 0 1 0-9.6Z" />
        </svg>
      </span>
    </div>
  );
}
