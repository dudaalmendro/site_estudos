import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    !supabaseUrl.includes("sua_url") &&
    supabaseUrl.startsWith("https://") &&
    supabaseUrl.endsWith(".supabase.co") &&
    supabasePublishableKey.length > 20
);

export const supabase = createClient(
  supabaseUrl || "http://localhost:54321",
  supabasePublishableKey || "missing-publishable-key"
);
