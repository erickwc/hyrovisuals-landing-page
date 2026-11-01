import type { PlanId } from "../data/content";

export type Platform = "windows" | "mac";

export type License = {
  id: string;
  planId: PlanId;
  key: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  version: string;
  /** Ruta relativa a /public, ej. "media/productos/hyro-visuals.jpg". */
  image: string;
  downloads: Partial<Record<Platform, string>>;
  licenses: License[];
};

export type PurchaseStatus = "paid" | "pending" | "refunded";

export type Purchase = {
  id: string;
  productSlug: string;
  productName: string;
  date: string;
  amount: number;
  currency: string;
  status: PurchaseStatus;
  invoiceUrl: string | null;
};

export type Review = {
  rating: number;
  comment: string;
  updatedAt: string;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Datos de ejemplo: a sustituir por consultas a Supabase (products/purchases/licenses)
// cuando esas tablas existan. Los instaladores reales viven en Cloudflare.
const mockProducts: Product[] = [
  {
    id: "hyro-visuals",
    slug: "hyro-visuals",
    name: "Hyro Visuals",
    version: "1.4.2",
    image: "media/productos/hyro-visuals.jpg",
    downloads: {
      windows: "https://cdn.byhyro.com/installers/hyro-visuals-win.exe",
      mac: "https://cdn.byhyro.com/installers/hyro-visuals-mac.dmg",
    },
    licenses: [
      { id: "lic-1", planId: "equipos", key: "HYRO-7F2K-9XQ1-3M4P" },
      { id: "lic-2", planId: "equipos", key: "HYRO-A1B2-C3D4-E5F6" },
      { id: "lic-3", planId: "equipos", key: "HYRO-Q9W8-E7R6-T5Y4" },
    ],
  },
];

const mockPurchases: Purchase[] = [
  {
    id: "purch-1",
    productSlug: "hyro-visuals",
    productName: "Hyro Visuals",
    date: "2026-09-12",
    amount: 50,
    currency: "USD",
    status: "paid",
    invoiceUrl: "#",
  },
];

const reviewStore = new Map<string, Review>();

export async function fetchLibrary(): Promise<Product[]> {
  await wait(650);
  return mockProducts;
}

export async function fetchProduct(slug: string): Promise<Product | null> {
  await wait(450);
  return mockProducts.find((p) => p.slug === slug) ?? null;
}

export async function fetchPurchases(): Promise<Purchase[]> {
  await wait(650);
  return mockPurchases;
}

export async function fetchReview(productId: string): Promise<Review | null> {
  await wait(300);
  return reviewStore.get(productId) ?? null;
}

export async function saveReview(productId: string, rating: number, comment: string): Promise<Review> {
  await wait(500);
  const review: Review = { rating, comment, updatedAt: new Date().toISOString() };
  reviewStore.set(productId, review);
  return review;
}
