import { supabase } from "./supabase";
import { LEGAL_VERSION } from "../data/legal-version";

export type ConsentDoc = "terms" | "privacy" | "marketing";
export type ConsentSource = "register" | "checkout" | "newsletter" | "account";

/* Guarda en legal_consents (migración 0016) qué aceptó quien tiene la sesión, con la versión de los documentos.
   La IP, el navegador y la hora los pone el servidor. Si falla, se lanza el error: sin registro no se sigue. */
export async function recordConsent(documents: ConsentDoc[], source: ConsentSource) {
  if (!supabase) throw new Error("Supabase");
  const { error } = await supabase.rpc("record_consent", { p_documents: documents, p_version: LEGAL_VERSION, p_source: source });
  if (error) throw error;
}

/** ¿Quien tiene la sesión ya aceptó términos y privacidad en la versión vigente (al registrarse o en otra compra)?
 *  Ante cualquier duda (error, sin conexión) responde false para que se vuelvan a pedir las casillas. */
export async function hasCurrentConsent(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("legal_consents")
    .select("document")
    .eq("version", LEGAL_VERSION)
    .eq("accepted", true)
    .in("document", ["terms", "privacy"]);
  if (error || !data) return false;
  const docs = new Set(data.map((r) => r.document));
  return docs.has("terms") && docs.has("privacy");
}

/** Metadatos de signUp: el disparador de auth.users los pasa a legal_consents al crear la cuenta. */
export function signupConsent() {
  return { version: LEGAL_VERSION, terms: true, privacy: true, user_agent: navigator.userAgent.slice(0, 400) };
}
