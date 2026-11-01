import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// null hasta que .env.local tenga las claves del proyecto hyro-enterprise; las páginas de auth revisan esto antes de llamar a Supabase.
export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url!, anonKey!) : null;
