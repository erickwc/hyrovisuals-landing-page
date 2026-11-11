// Proyectos con el nuevo sistema de llaves (sb_publishable_/sb_secret_) exponen
// SUPABASE_PUBLISHABLE_KEYS/SUPABASE_SECRET_KEYS (JSON) además de las variables
// legacy, que pueden estar obsoletas. Se usa la primera llave disponible de cada JSON.
export function firstKeyFrom(jsonEnvVar: string, legacyEnvVar: string): string {
  const raw = Deno.env.get(jsonEnvVar);
  if (raw) {
    try {
      const first = Object.values(JSON.parse(raw))[0];
      if (typeof first === "string" && first.length > 0) return first;
    } catch {
      // no era JSON: seguir con el valor legacy
    }
  }
  return Deno.env.get(legacyEnvVar) ?? "";
}
