import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null until both environment variables are set (then the app uses the local sample data). */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
