import { useEffect, useRef, useState } from "react";

/* Botones oficiales de PayPal (SDK de JavaScript, cargado una sola vez): uno para pagar con la cuenta de PayPal y
   otro aparte para tarjeta de crédito o débito sin cuenta. Van separados para que, al abrir el formulario de tarjeta,
   el de PayPal siga a la vista. El pedido lo crea y lo cobra el servidor: aquí solo se pide. */

type PaypalActions = { restart: () => Promise<void> };
type PaypalButtonsInstance = { isEligible: () => boolean; render: (el: HTMLElement) => Promise<void>; close: () => Promise<void> };
type PaypalSdk = {
  FUNDING: { PAYPAL: string; CARD: string };
  Buttons: (options: {
    fundingSource: string;
    style: Record<string, unknown>;
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
  /** Tema de la página: los botones van en negro sobre claro y en blanco sobre oscuro. */
  theme: "light" | "dark";
  createOrder: () => Promise<string>;
  /** Cobra el pedido aprobado. Si lanza un error con code INSTRUMENT_DECLINED, PayPal deja elegir otra forma de pago. */
  onApprove: (orderId: string) => Promise<void>;
  /** null borra el error; "" es un error sin mensaje propio (se muestra el genérico). */
  onError: (message: string | null) => void;
  /** Texto si el SDK de PayPal no carga (bloqueador de anuncios, sin conexión). */
  loadError: string;
  /** «+más» al final de los logos de tarjetas. */
  moreLabel: string;
};

export function PaypalButtons(props: Props) {
  const paypalSlot = useRef<HTMLDivElement>(null);
  const cardSlot = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [failed, setFailed] = useState(false);
  // el formulario de tarjeta viene con textos oscuros: abierto, se le pone un panel blanco (se nota en tema oscuro)
  const [cardOpen, setCardOpen] = useState(false);

  useEffect(() => {
    const slot = cardSlot.current;
    if (!slot || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setCardOpen(slot.getBoundingClientRect().height > 90));
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const rendered: PaypalButtonsInstance[] = [];
    let cancelled = false;
    let lastError: string | null = null;
    // PayPal en su amarillo de siempre; tarjeta en negro (claro) o blanco (oscuro), que son los colores que admite
    const cardColor = props.theme === "dark" ? "white" : "black";

    loadSdk(props.clientId)
      .then((paypal) => {
        if (cancelled) return;
        const slots: [string, HTMLDivElement | null][] = [
          [paypal.FUNDING.PAYPAL, paypalSlot.current],
          [paypal.FUNDING.CARD, cardSlot.current],
        ];
        for (const [fundingSource, slot] of slots) {
          if (!slot) continue;
          const buttons = paypal.Buttons({
            fundingSource,
            style:
              fundingSource === paypal.FUNDING.PAYPAL
                ? { shape: "rect", color: "gold", height: 46, label: "paypal" }
                : { shape: "rect", color: cardColor, height: 46 },
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
          if (!buttons.isEligible()) continue;
          rendered.push(buttons);
          buttons.render(slot).catch(() => undefined);
        }
      })
      .catch(() => !cancelled && setFailed(true));

    return () => {
      cancelled = true;
      rendered.forEach((b) => b.close().catch(() => undefined));
      // el SDK deja su iframe al cerrar: se vacían los huecos para no duplicar botones al cambiar de tema
      paypalSlot.current?.replaceChildren();
      cardSlot.current?.replaceChildren();
    };
  }, [props.clientId, props.theme]);

  if (failed) return <p className="co__error">{props.loadError}</p>;
  return (
    <div className="co__paypal">
      <div ref={paypalSlot} />
      <div ref={cardSlot} className={cardOpen ? "co__paypal-card is-open" : "co__paypal-card"} />
      <PaymentMarks more={props.moreLabel} />
    </div>
  );
}

/* Logos de lo que se acepta (logos de marca: fuera de la regla de iconos). */
function PaymentMarks({ more }: { more: string }) {
  return (
    <div className="co__marks" aria-label="PayPal, Visa, Mastercard">
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
      <span className="co__marks-more">{more}</span>
    </div>
  );
}
