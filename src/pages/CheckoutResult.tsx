import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { Button } from "../components/Button";
import type { PaymentMessage } from "./Checkout";
import "../styles/checkout.css";

/* A esta dirección vuelve Wompi al terminar el pago (urlRedirect), con esAprobada en la URL.
   Dentro de la ventana del checkout solo avisa al checkout, que muestra el resultado y cierra la ventana.
   Si se abrió sola (por ejemplo, el banco sacó al cliente de la ventana), muestra el resultado aquí mismo.
   Es solo para mostrar: la compra se confirma por el webhook de Wompi, no por esta página. */
export function CheckoutResult() {
  const { c } = usePrefs();
  const t = c.checkout;
  const [params] = useSearchParams();
  const approved = params.get("esAprobada")?.toLowerCase() === "true";
  const embedded = window.parent !== window;

  useEffect(() => {
    if (!embedded) return;
    const message: PaymentMessage = { type: "hyro:payment", approved };
    window.parent.postMessage(message, window.location.origin);
  }, [embedded, approved]);

  if (embedded) return <p className="co__state">{t.finishing}</p>;

  return (
    <main className="wrap co__main co__main--solo">
      <div className="co__result" data-tone={approved ? "ok" : "bad"} role="status">
        <h1>{approved ? t.approvedTitle : t.rejectedTitle}</h1>
        <p>{approved ? t.approvedBody : t.rejectedBody}</p>
        <Button to={approved ? "/cuenta/biblioteca" : "/#licencias"} arrow>
          {approved ? t.goLibrary : t.tryAgain}
        </Button>
      </div>
    </main>
  );
}
