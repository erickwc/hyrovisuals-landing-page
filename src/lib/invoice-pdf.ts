import type { jsPDF as JsPDF } from "jspdf";
import { asset } from "./asset";
import { orderNumber, type Purchase } from "./account-data";
import type { content } from "../data/content";

type Copy = (typeof content)["es"]["dashboard"]["purchases"];

export type InvoiceInput = {
  purchase: Purchase;
  customer: { name: string | null; email: string };
  planName: string;
  methodName: string;
  t: Copy;
  lang: string;
};

/* Factura con forma de ticket dibujada directamente en el PDF: el texto es texto de verdad (se puede
   seleccionar, copiar y buscar) y todo es vectorial, salvo la mascota. Medidas en puntos, una por cada px
   del diseño original: hoja de 520 con 40 de margen y el ticket de 440 al centro. */

const PAPER = "#ebebee";
const INK = "#141414";
const MUTED = "#555555";
const SOFT = "#6b6b75";
const PAGE_W = 520;
const MARGIN = 40;
const TICKET_W = PAGE_W - MARGIN * 2;
const PAD = 36;
const LEFT = MARGIN + PAD;
const RIGHT = PAGE_W - MARGIN - PAD;
const CENTER = PAGE_W / 2;
const FONT = "SpaceGrotesk";

// las fuentes y la mascota se descargan una sola vez, al pedir la primera factura
let assets: Promise<{ regular: string; bold: string; mascot: string | null }> | null = null;

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function loadFont(file: string) {
  const res = await fetch(asset(`fonts/${file}`));
  if (!res.ok) throw new Error(`No se pudo cargar ${file}`);
  return toBase64(await res.arrayBuffer());
}

// la mascota es webp: se pasa a PNG con un canvas porque jsPDF no lee webp
async function loadMascot() {
  try {
    const img = new Image();
    img.src = asset("media/brand/mascota.webp");
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 216;
    const ctx = canvas.getContext("2d")!;
    const scale = Math.min(216 / img.naturalWidth, 216 / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (216 - w) / 2, (216 - h) / 2, w, h);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function loadAssets() {
  assets ??= Promise.all([loadFont("SpaceGrotesk-Regular.ttf"), loadFont("SpaceGrotesk-Bold.ttf"), loadMascot()])
    .then(([regular, bold, mascot]) => ({ regular, bold, mascot }))
    .catch((err) => {
      assets = null;
      throw err;
    });
  return assets;
}

// barras del código 128 como una cadena de 1 y 0 (JsBarcode sabe codificar sin dibujar)
async function barcodeBits(text: string) {
  const { default: JsBarcode } = await import("jsbarcode");
  const out: { encodings?: { data: string }[] } = {};
  JsBarcode(out, text, { format: "CODE128" });
  return (out.encodings ?? []).map((e) => e.data).join("");
}

export async function downloadInvoicePdf({ purchase, customer, planName, methodName, t, lang }: InvoiceInput) {
  const [{ jsPDF }, files, bits] = await Promise.all([import("jspdf"), loadAssets(), barcodeBits(orderNumber(purchase))]);
  const number = orderNumber(purchase);

  const date = new Date(purchase.date);
  const dateTime = `${new Intl.DateTimeFormat(lang, { day: "2-digit", month: "short", year: "numeric" }).format(date)} | ${new Intl.DateTimeFormat(lang, { timeStyle: "short" }).format(date)}`;
  const money = (amount: number) => new Intl.NumberFormat(lang, { style: "currency", currency: purchase.currency }).format(amount);

  const fields: [label: string, value: string, sub?: string][][] = [
    [
      [t.order, `#${number}`],
      [t.invoiceAmount, money(purchase.amount)],
    ],
    [
      [t.invoiceDateTime, dateTime],
      [t.invoicePlan, `${purchase.productName} · ${planName}`],
    ],
    [
      [t.customer, customer.name || customer.email, customer.name ? customer.email : undefined],
      ...(purchase.discount > 0 ? [[t.invoiceCoupon, purchase.couponCode ?? t.discountLabel, `-${money(purchase.discount)}`] as [string, string, string]] : []),
    ],
  ];

  const setup = (doc: JsPDF) => {
    doc.addFileToVFS("SpaceGrotesk-Regular.ttf", files.regular);
    doc.addFont("SpaceGrotesk-Regular.ttf", FONT, "normal");
    doc.addFileToVFS("SpaceGrotesk-Bold.ttf", files.bold);
    doc.addFont("SpaceGrotesk-Bold.ttf", FONT, "bold");
  };

  /* Recorre el ticket de arriba abajo. Con `draw` en false solo mide, para saber el alto de la hoja. */
  const render = (doc: JsPDF, draw: boolean, size = { pageH: 0, ticketBottom: 0 }) => {
    const text = (value: string | string[], x: number, y: number, size: number, color: string, opts: { bold?: boolean; align?: "left" | "center" | "right"; charSpace?: number; centerY?: boolean } = {}) => {
      if (!draw) return;
      doc.setFont(FONT, opts.bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(color);
      // centerY: `y` es el centro visual de la línea; la base va media altura de mayúscula (≈0.7 em) más abajo
      doc.text(value, x, opts.centerY ? y + size * 0.35 : y, { baseline: opts.centerY ? "alphabetic" : "top", align: opts.align ?? "left", charSpace: opts.charSpace, lineHeightFactor: 1.45 });
    };
    const wrap = (value: string, size: number, width: number, bold = false) => {
      doc.setFont(FONT, bold ? "bold" : "normal");
      doc.setFontSize(size);
      return doc.splitTextToSize(value, width) as string[];
    };

    const top = MARGIN;
    if (draw) {
      doc.setFillColor(PAPER);
      doc.rect(0, 0, PAGE_W, size.pageH, "F");
      // el alto del ticket sale de la medición previa
      doc.setFillColor("#ffffff");
      doc.roundedRect(MARGIN, top, TICKET_W, size.ticketBottom - top, 12, 12, "F");
    }

    // cabecera: mascota, título y frase
    let y = top + 28;
    if (files.mascot && draw) doc.addImage(files.mascot, "PNG", CENTER - 36, y, 72, 72);
    y += 72 + 14;
    text(t.invoiceHeading, CENTER, y, 22, INK, { bold: true, align: "center" });
    y += 22 * 1.2 + 8;
    const lead = wrap(purchase.amount === 0 ? t.invoiceFree : t.invoicePaid, 13, 250);
    text(lead, CENTER, y, 13, MUTED, { align: "center" });
    y += lead.length * 13 * 1.45 + 26;

    // corte con dos muescas del color de la hoja
    if (draw) {
      doc.setDrawColor("#d4d4d8");
      doc.setLineWidth(2);
      doc.setLineDashPattern([6, 5], 0);
      doc.line(MARGIN + 64, y, PAGE_W - MARGIN - 64, y);
      doc.setLineDashPattern([], 0);
      doc.setFillColor(PAPER);
      doc.circle(MARGIN, y, 20, "F");
      doc.circle(PAGE_W - MARGIN, y, 20, "F");
    }
    y += 30;

    // datos en dos columnas: la de la derecha alineada a la derecha
    const colW = (RIGHT - LEFT - 16) / 2;
    for (const row of fields) {
      let rowH = 0;
      row.forEach(([label, value, sub], i) => {
        const x = i === 0 ? LEFT : RIGHT;
        const align = i === 0 ? "left" : "right";
        let h = 0;
        text(label.toUpperCase(), x, y, 11, MUTED, { align, charSpace: 0.2 });
        h += 11 * 1.45 + 4;
        const lines = wrap(value, 14, colW, true);
        text(lines, x, y + h, 14, INK, { bold: true, align });
        h += lines.length * 14 * 1.3;
        if (sub) {
          const subLines = wrap(sub, 12, colW);
          text(subLines, x, y + h + 2, 12, SOFT, { align });
          h += 2 + subLines.length * 12 * 1.45;
        }
        rowH = Math.max(rowH, h);
      });
      y += rowH + 20;
    }
    y += 2;

    // recuadro del pago con el icono de tarjeta (el de Hugeicons, a escala 20/24)
    const boxH = purchase.reference ? 16 + 14 * 1.3 + 2 + 12 * 1.45 + 16 : 16 + 20 + 16;
    if (draw) {
      doc.setFillColor("#eef2fd");
      doc.roundedRect(LEFT, y, RIGHT - LEFT, boxH, 12, 12, "F");
      const s = 20 / 24;
      const ix = LEFT + 18;
      const iy = y + boxH / 2 - 10;
      doc.setDrawColor("#1f6feb");
      doc.setLineWidth(2 * s);
      doc.setLineCap("round");
      doc.roundedRect(ix + 2 * s, iy + 4 * s, 20 * s, 16 * s, 3 * s, 3 * s, "S");
      doc.line(ix + 2 * s, iy + 9 * s, ix + 22 * s, iy + 9 * s);
      doc.line(ix + 10 * s, iy + 16 * s, ix + 11.5 * s, iy + 16 * s);
      doc.line(ix + 14.5 * s, iy + 16 * s, ix + 18 * s, iy + 16 * s);
      doc.setLineCap("butt");
    }
    // el texto se centra en el alto del recuadro, igual que el icono (con dos líneas, el bloque completo)
    const boxMid = y + boxH / 2;
    if (purchase.reference) {
      const blockTop = boxMid - (14 * 1.3 + 2 + 12 * 1.45) / 2;
      text(methodName, LEFT + 52, blockTop + (14 * 1.3) / 2, 14, INK, { bold: true, centerY: true });
      text(`${t.referenceLabel} ${purchase.reference}`, LEFT + 52, blockTop + 14 * 1.3 + 2 + (12 * 1.45) / 2, 12, SOFT, { centerY: true });
    } else {
      text(methodName, LEFT + 52, boxMid, 14, INK, { bold: true, centerY: true });
    }
    y += boxH + 26;

    // línea punteada de lado a lado
    if (draw) {
      doc.setDrawColor("#e4e4e7");
      doc.setLineWidth(2);
      doc.setLineDashPattern([6, 5], 0);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      doc.setLineDashPattern([], 0);
    }
    y += 28;

    // código de barras del número de pedido y el número debajo
    const module = 2;
    const barsW = bits.length * module;
    if (draw) {
      doc.setFillColor(INK);
      let x = CENTER - barsW / 2;
      for (let i = 0; i < bits.length; i++) {
        if (bits[i] === "1") {
          let run = 1;
          while (bits[i + run] === "1") run++;
          doc.rect(x + i * module, y, run * module, 54, "F");
          i += run - 1;
        }
      }
    }
    y += 54 + 6;
    text(number, CENTER, y, 11, INK, { align: "center", charSpace: 3.3 });
    y += 11 * 1.45 + 18 + 28;

    // borde de abajo festoneado: seis medias lunas del color de la hoja
    const ticketBottom = y;
    if (draw) {
      doc.setFillColor(PAPER);
      for (let i = 0; i < 6; i++) doc.circle(MARGIN + 48 + (i * (TICKET_W - 96)) / 5, ticketBottom, 20, "F");
    }
    text("byhyro.com", CENTER, ticketBottom + 18, 11, "#8a8a93", { align: "center" });
    return { pageH: Math.ceil(ticketBottom + 18 + 11 * 1.45 + MARGIN), ticketBottom };
  };

  const measure = new jsPDF({ unit: "pt", format: [PAGE_W, 2000] });
  setup(measure);
  const size = render(measure, false);

  const doc = new jsPDF({ unit: "pt", format: [PAGE_W, size.pageH], orientation: "portrait", compress: true });
  setup(doc);
  render(doc, true, size);
  doc.setProperties({ title: `${t.invoiceTitle} HYRO ${number}`, author: "HYRO", subject: `${t.order} #${number}` });
  doc.save(`${t.invoiceTitle}-HYRO-${number}.pdf`);
}
