/* Documentos legales de byhyro.com (términos, privacidad, cookies y reembolsos), escritos para El Salvador:
   - Ley de Protección al Consumidor (LPC): retracto (art. 13-A), reversión de pagos (art. 13-D) y obligaciones del
     comercio electrónico (arts. 21-A y 21-B).
   - Ley para la Protección de Datos Personales (Decreto 144, 2024): consentimiento (arts. 26-28), aviso de
     privacidad (art. 24), derechos ARCO-POL (arts. 6-14 y 20), delegado (art. 15), transferencias (arts. 40-45).
   Van solo en español (idioma del contrato); en inglés se muestra un aviso.

   AL CAMBIAR UN DOCUMENTO:
   1. Cambia LEGAL_VERSION (fecha AAAA-MM-DD). Cada aceptación se guarda con esa versión en legal_consents,
      así se sabe qué texto aceptó cada persona.
   2. No borres las versiones viejas: quedan en el historial de git y son la prueba de lo que se aceptó.

   COMPANY: datos del proveedor. La LPC (art. 21-A c) exige mostrarlos en un lugar visible del sitio. Los marcados con
   «PENDIENTE» los tiene que completar el dueño antes de publicar. */

export { LEGAL_VERSION } from "./legal-version";

export const COMPANY = {
  // nombre comercial (la marca) y razón social (persona natural o sociedad que vende)
  brand: "HYRO",
  product: "Hyro Visuals",
  legalName: "PENDIENTE: razón social o nombre completo del titular",
  taxId: "PENDIENTE: NIT",
  address: "PENDIENTE: dirección de notificación",
  country: "El Salvador",
  phone: "PENDIENTE: teléfono",
  // correo que de verdad se lee: reclamos, datos personales, retracto y derechos de autor
  email: "PENDIENTE@byhyro.com",
  // delegado de protección de datos (Decreto 144, art. 15): una persona con nombre
  dpo: "PENDIENTE: nombre del delegado de protección de datos",
  site: "byhyro.com",
};

export type LegalDocId = "terminos" | "privacidad" | "cookies" | "reembolsos";

/** Un párrafo: texto suelto, una lista, o un párrafo que empieza con una frase en negrita (lead). */
export type LegalBlock = string | string[] | { lead: string; text: string };
export type LegalSection = { id?: string; title: string; body: LegalBlock[] };
export type LegalDoc = { id: LegalDocId; title: string; summary: string; sections: LegalSection[] };

const C = COMPANY;
const contact = C.email;

// identificación del proveedor (LPC art. 21-A c): se repite al inicio de los términos y en la privacidad
const identity = [
  `Nombre comercial: ${C.brand}`,
  `Razón social: ${C.legalName}`,
  `NIT: ${C.taxId}`,
  `Dirección de notificación: ${C.address}, ${C.country}`,
  `Teléfono: ${C.phone}`,
  `Correo: ${C.email}`,
];

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  terminos: {
    id: "terminos",
    title: "Términos y condiciones",
    summary: `Al comprar en ${C.site} aceptas estos términos. Son cortos: léelos antes de completar tu pedido.`,
    sections: [
      {
        id: "proveedor",
        title: "Quién vende",
        body: [
          `${C.site} y ${C.product} son de:`,
          identity,
          "Este sitio no cuenta con certificación de una entidad certificadora. La conexión va cifrada (HTTPS) con un certificado SSL.",
        ],
      },
      {
        id: "producto",
        title: "Qué compras",
        body: [
          { lead: "Una licencia, no el programa.", text: `${C.product} es un programa para Windows y macOS que convierte el audio de tu equipo en visuales en tiempo real. Al comprar recibes una licencia para usarlo.` },
          { lead: "Pago único.", text: "No es una suscripción: no se renueva sola y no hay cobros recurrentes." },
          { lead: "Una clave, un equipo.", text: "Cada clave funciona en un equipo a la vez. Personal incluye 1 clave y Equipos 3. Puedes desvincular un equipo desde tu cuenta para activar otro." },
          { lead: "Actualizaciones.", text: "Incluye las actualizaciones de Hyro Visuals que publiquemos mientras el producto siga en desarrollo. Una versión mayor que se venda como producto aparte no está incluida, salvo que lo anunciemos." },
          { lead: "Requisitos.", text: "Windows 10 u 11 de 64 bits, o macOS Sonoma 14.2 o posterior. Revísalos antes de comprar." },
        ],
      },
      {
        id: "entrega",
        title: "Entrega inmediata",
        body: [
          { lead: "Al instante.", text: "Cuando se confirma el pago, tus claves y los instaladores aparecen en tu biblioteca y te llega un correo con la confirmación del pedido. No hay envío físico." },
          { lead: "Antes de comprar.", text: "En la web puedes ver el programa en acción para asegurarte de que es lo que buscas." },
        ],
      },
      {
        id: "reembolsos",
        title: "Ventas finales y reembolsos",
        body: [
          { lead: "Ventas finales una vez activada la clave.", text: "Una licencia activada ya se usó y no se puede devolver, así que desde ese momento no hay reembolso por cambio de opinión." },
          { lead: "Antes de activar: 8 días.", text: "Si todavía no activaste ninguna clave de la compra, puedes retractarte dentro de los 8 días siguientes, sin dar motivos (art. 13-A de la Ley de Protección al Consumidor). Descargar el instalador no cuenta como activar." },
          { lead: "Problemas técnicos.", text: "Si el programa no funciona como se describe en un equipo que cumple los requisitos, o no recibiste lo que compraste, escríbenos: primero lo arreglamos o te reenviamos la licencia y, si no se puede, te devolvemos el dinero." },
          { lead: "Cobros duplicados o no autorizados.", text: "Escríbenos y revertimos el pago que corresponda (art. 13-D de la misma ley)." },
          "El detalle de plazos y pasos está en la Política de reembolsos.",
        ],
      },
      {
        id: "licencia",
        title: "Licencia de uso",
        body: [
          { lead: "Puedes:", text: "instalarlo en tantos equipos como claves tengas y usarlo para lo que quieras, personal o profesional, incluido proyectar o grabar los visuales en shows, transmisiones y videos comerciales. Lo que crees con él es tuyo." },
          { lead: "No puedes:", text: "revender, alquilar o compartir tus claves fuera de tu equipo de trabajo, distribuir el instalador, ni descompilar o saltarte la activación. Si pasa, podemos desactivar las claves afectadas después de avisarte y escucharte." },
        ],
      },
      {
        id: "cuenta-y-pagos",
        title: "Cuenta y pagos",
        body: [
          { lead: "Tu cuenta.", text: "Para comprar necesitas una cuenta con tu nombre, tu correo y una contraseña que solo tú conozcas. Debes ser mayor de 18 años o comprar con tu padre, madre o representante legal." },
          { lead: "Precios.", text: "Están en dólares (USD) e incluyen todo lo que te cobramos: sin cargos ocultos. Antes de pagar ves el total, con el cupón si usas uno. Tu banco o PayPal puede cobrar su propia comisión por compras internacionales." },
          { lead: "Medios de pago.", text: "PayPal, con tu cuenta o con tarjeta de crédito o débito (Visa o Mastercard). HYRO no ve ni guarda los datos de tu tarjeta. El pago solo debe hacerlo el titular de la tarjeta o de la cuenta de PayPal." },
          { lead: "Comprobantes.", text: "Guardamos la prueba de cada compra durante 10 años, como pide la ley. Tus compras están siempre en «Mis compras»." },
        ],
      },
      {
        id: "propiedad",
        title: "Propiedad intelectual",
        body: [
          `El programa, la marca HYRO, el logo, la mascota, los textos y el diseño de ${C.site} son de HYRO o se usan con licencia.`,
          { lead: "Derechos de autor.", text: `Si crees que algo publicado aquí viola tus derechos, escríbenos a ${contact} con la obra, dónde está la copia, tus datos y una declaración de que eres el titular. Revisamos cada aviso.` },
        ],
      },
      {
        id: "responsabilidad",
        title: "Responsabilidad",
        body: [
          { lead: "Disponibilidad.", text: "La activación necesita internet de vez en cuando. El servidor de licencias puede tener cortes breves por mantenimiento: no prometemos que nunca falle, pero lo arreglamos lo antes posible." },
          { lead: "Tus derechos primero.", text: "HYRO responde por los daños que cause por su culpa según la ley salvadoreña. Nada de estos términos te quita los derechos que te da la Ley de Protección al Consumidor." },
        ],
      },
      {
        id: "datos",
        title: "Datos personales",
        body: ["Tratamos tus datos según el Aviso de privacidad, que aceptas junto con estos términos al crear tu cuenta y al pagar."],
      },
      {
        id: "cambios",
        title: "Cambios",
        body: ["Si cambiamos estos términos publicaremos la versión nueva con su fecha. Cada compra se rige por la versión que aceptaste al pagar."],
      },
      {
        id: "contacto",
        title: "Contacto y reclamos",
        body: [
          `Para cualquier problema con un pedido escríbenos a ${contact} o llama al ${C.phone}. Respondemos en máximo 10 días hábiles.`,
          "También puedes acudir a la Defensoría del Consumidor (www.defensoria.gob.sv). Estos términos se rigen por las leyes de El Salvador.",
        ],
      },
    ],
  },

  privacidad: {
    id: "privacidad",
    title: "Aviso y política de privacidad",
    summary:
      "Qué datos tuyos guardamos, para qué, con qué fundamento, con quién los compartimos, cuánto tiempo y cómo ejercer tus derechos ARCO-POL (Ley para la Protección de Datos Personales, Decreto 144).",
    sections: [
      {
        title: "1. Responsable",
        body: [identity, `Delegado de protección de datos: ${C.dpo}. Para todo lo relacionado con tus datos escribe a ${contact}.`],
      },
      {
        title: "2. Qué datos tratamos, para qué y con qué fundamento",
        body: [
          "No pedimos datos sensibles. Solo lo necesario para venderte la licencia y darte acceso a ella:",
          [
            "Cuenta: nombre, correo y contraseña (la contraseña se guarda cifrada; nadie de HYRO puede verla). Para entrar a tu cuenta, mostrarte tus compras y enviarte los códigos de verificación. Fundamento: la relación contractual contigo (art. 28 f) y tu consentimiento.",
            "Foto de perfil, si decides subirla. Es opcional. Fundamento: tu consentimiento.",
            "Compras: plan, monto, fecha, cupón y número de la transacción en PayPal. Para entregarte las claves, la contabilidad y atender reclamos. No recibimos ni guardamos los datos de tu tarjeta: los maneja PayPal. Fundamento: la relación contractual y la obligación de conservar la prueba de la compra (art. 21-B de la Ley de Protección al Consumidor).",
            "Licencias: el identificador del equipo donde activas la clave, su nombre, sistema operativo, versión de la app y la IP de la activación. Para que cada clave funcione en un solo equipo a la vez y para frenar abusos. Fundamento: la relación contractual.",
            "Reseñas: la calificación y el comentario que escribas. En la web se publica con tu primer nombre, la inicial del apellido y tu foto, si tienes. Fundamento: tu consentimiento al publicarla.",
            "Newsletter: tu correo e idioma, solo si marcas la casilla. Para avisarte de nuevas versiones y novedades. Fundamento: tu consentimiento, que es aparte y opcional.",
            "Registro de autorizaciones: qué documento aceptaste, su versión, la fecha y hora, el formulario, la IP y el navegador. Para poder demostrar tu consentimiento (art. 54).",
          ],
          "Hyro Visuals (la app) procesa el audio en tu equipo: no sube tu audio, tus archivos ni tu pantalla, y no tiene analítica.",
          "No vendemos tus datos, no los usamos para publicidad de terceros, no los usamos para otros fines distintos a los de arriba y no los usamos para entrenar modelos de inteligencia artificial.",
        ],
      },
      {
        title: "3. Correos de marketing",
        body: [
          "Solo te enviamos novedades si marcaste la casilla de la newsletter (es aparte y viene sin marcar). Cada correo trae un enlace para darte de baja con un clic, y también puedes hacerlo desde tu cuenta.",
          "Los correos de la compra, la verificación de la cuenta y el cambio de contraseña no son publicidad: se envían porque son necesarios para el servicio.",
        ],
      },
      {
        title: "4. Encargados y transferencias fuera de El Salvador",
        body: [
          "Usamos estos proveedores, que tratan los datos solo para prestarnos su servicio, bajo contratos con obligaciones de protección de datos. Todos están fuera de El Salvador:",
          [
            "Supabase Inc. (base de datos, cuentas y archivos) — Estados Unidos. supabase.com",
            "Cloudflare Inc. (alojamiento de la web, seguridad y descargas de los instaladores) — Estados Unidos, red global. cloudflare.com",
            "PayPal (pagos con cuenta o tarjeta) — Estados Unidos. paypal.com. PayPal es además responsable de los datos de pago que tú le das.",
            "Resend (envío de correos) — Estados Unidos. resend.com",
            "Google Fonts (tipografía de la web): tu navegador le pide la fuente a Google, que recibe tu IP. No usa cookies.",
          ],
          "Al aceptar este aviso (al crear tu cuenta y al marcar la casilla antes de pagar) autorizas que tus datos se transfieran a esos proveedores y países para los fines descritos (arts. 40 y 44 del Decreto 144).",
        ],
      },
      {
        title: "5. Cuánto tiempo guardamos tus datos",
        body: [
          [
            "Cuenta, foto y reseñas: mientras tengas la cuenta. Si la eliminas desde «Mi cuenta», se borran al instante.",
            "Compras, licencias y registro de autorizaciones: 10 años desde la compra, porque la Ley de Protección al Consumidor (art. 21-B c) obliga a conservar la prueba de la relación comercial. Si borras tu cuenta, los guardamos sin usarlos para nada más.",
            "Intentos de activación (IP y equipo): 12 meses.",
            "Newsletter: hasta que te des de baja.",
          ],
        ],
      },
      {
        title: "6. Tus derechos ARCO-POL",
        body: [
          "Puedes: acceder a tus datos, rectificarlos, cancelarlos (suprimirlos), oponerte a su tratamiento, pedir su portabilidad, limitar su tratamiento y saber quién los tiene y para qué. También puedes revocar tu consentimiento en cualquier momento, sin efecto retroactivo. Es gratis.",
          "Desde tu cuenta, en «Mi cuenta», puedes descargar todos tus datos en un archivo (portabilidad), cambiar tu nombre y tu foto, darte de baja de la newsletter y eliminar tu cuenta tú mismo, al instante.",
          `Para cualquier otra solicitud escribe a ${contact}, dirigida al delegado de protección de datos. Respondemos en máximo 20 días hábiles (art. 20) y aplicamos una revocación del consentimiento en máximo 5 días hábiles (art. 30).`,
          "Si no respondemos o no estás de acuerdo, puedes acudir a la Agencia de Ciberseguridad del Estado (ACE), que supervisa esta ley.",
        ],
      },
      {
        title: "7. Menores de edad",
        body: [
          "La web no está dirigida a menores de 18 años. Si eres menor, necesitas que tu padre, madre o representante legal cree la cuenta y haga la compra. Si nos enteramos de que tenemos datos de un menor sin esa autorización, los borramos.",
        ],
      },
      {
        title: "8. Seguridad e incidentes",
        body: [
          "Usamos conexiones cifradas (HTTPS), contraseñas cifradas, permisos por usuario en la base de datos y acceso restringido para el equipo de HYRO. Si ocurre un incidente que afecte tus datos, lo notificaremos a la Agencia de Ciberseguridad del Estado, a la Fiscalía General de la República y a ti en un máximo de 72 horas (art. 25).",
        ],
      },
      {
        title: "9. Cookies",
        body: ["Solo usamos almacenamiento necesario para que la web funcione. El detalle está en la Política de cookies."],
      },
      {
        title: "10. Cambios a este aviso",
        body: [
          "Si hacemos cambios importantes te avisaremos por correo y en la web antes de aplicarlos, y te pediremos de nuevo el consentimiento si cambian los fines.",
        ],
      },
    ],
  },

  cookies: {
    id: "cookies",
    title: "Política de cookies",
    summary: `Qué guarda ${C.site} en tu navegador: solo lo necesario para que la web funcione. No usamos analítica, publicidad ni rastreo.`,
    sections: [
      {
        title: "1. Qué usamos",
        body: [
          "La web solo guarda en tu navegador lo que hace falta para funcionar. No hay cookies de analítica, de publicidad ni de redes sociales, y no rastreamos lo que haces en otras páginas.",
          [
            "Sesión (almacenamiento local, clave «sb-…»): mantiene tu sesión iniciada. Dura hasta que cierres sesión.",
            "Preferencias (almacenamiento local, «hyro.theme» y «hyro.lang»): recuerda el tema claro u oscuro y el idioma. No caduca.",
            "Seguridad de Cloudflare (cookies «__cf_bm» y similares): distingue personas de bots y frena ataques. Dura minutos.",
            "PayPal (solo en el checkout, cuando se cargan los botones de pago): cookies de PayPal para procesar el pago y prevenir fraude. Las controla PayPal según su propia política.",
          ],
        ],
      },
      {
        title: "2. ¿Por qué no hay un aviso para aceptar cookies?",
        body: [
          "Porque todo lo de arriba es necesario para el servicio que pides (iniciar sesión, recordar tu idioma, pagar). Si algún día agregamos analítica o publicidad, no se cargará hasta que la aceptes en un aviso con la opción de rechazarla igual de fácil.",
        ],
      },
      {
        title: "3. Cómo borrarlas",
        body: [
          "Puedes borrar las cookies y el almacenamiento local desde la configuración de tu navegador. Si lo haces, se cerrará tu sesión y se olvidarán tus preferencias.",
        ],
      },
    ],
  },

  reembolsos: {
    id: "reembolsos",
    title: "Política de reembolsos",
    summary: "Las ventas son finales una vez que activas tu clave. Antes de eso tienes 8 días para retractarte, y si algo falla de nuestro lado te devolvemos el dinero.",
    sections: [
      {
        id: "ventas-finales",
        title: "Ventas finales",
        body: [
          { lead: "Una vez activada, no hay devolución.", text: "Al activar una clave de la compra en un equipo, la licencia ya se usó y no se puede devolver. Desde ese momento no hay reembolso por cambio de opinión." },
          { lead: "Descargar no es activar.", text: "Puedes descargar el instalador e instalarlo sin perder el derecho de retracto mientras no actives ninguna clave." },
        ],
      },
      {
        id: "retracto",
        title: "Retracto: 8 días antes de activar",
        body: [
          { lead: "Sin dar motivos.", text: "Si no activaste ninguna clave, puedes retractarte dentro de los 8 días siguientes a la compra, sin penalidad (art. 13-A de la Ley de Protección al Consumidor)." },
          { lead: "Cómo pedirlo.", text: `Escribe a ${contact} desde el correo de tu cuenta con tu número de pedido (lo ves en «Mis compras» y en el correo de confirmación). Basta con eso.` },
          { lead: "Devolución.", text: "Te devolvemos el total al mismo medio de pago en máximo 15 días desde tu solicitud, y desactivamos las claves de esa compra." },
        ],
      },
      {
        id: "problemas-tecnicos",
        title: "Problemas técnicos",
        body: [
          { lead: "Si algo falla de nuestro lado.", text: "Si el programa no funciona como se describe en un equipo que cumple los requisitos, no puedes descargarlo o no recibiste lo que compraste, escríbenos. Primero lo arreglamos o te reenviamos la licencia; si no se puede, te devolvemos el dinero, aunque ya hayas activado." },
        ],
      },
      {
        id: "cobros",
        title: "Cobros duplicados o no autorizados",
        body: [
          { lead: "Revertimos el pago.", text: "Si te cobramos dos veces, hubo un error del sistema de pago o ejerciste el retracto, revertimos el cobro en máximo 15 días desde tu reclamo (art. 13-D de la Ley de Protección al Consumidor)." },
          { lead: "Fraude.", text: "Si es un cargo que no autorizaste en tu tarjeta, avisa también a tu banco: se tramita según la Ley del Sistema de Tarjetas de Crédito." },
        ],
      },
      {
        id: "cupones",
        title: "Compras con cupón del 100 %",
        body: ["Si no pagaste nada no hay dinero que devolver, pero puedes pedir que borremos la licencia."],
      },
      {
        id: "contacto",
        title: "Contacto",
        body: [`Para cualquier problema con un pedido escribe a ${contact}. Si no te respondemos, puedes acudir a la Defensoría del Consumidor (www.defensoria.gob.sv).`],
      },
    ],
  },
};
