import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

export const supabaseAdmin = createClient(
  supabaseUrl || "http://localhost:54321",
  supabaseSecretKey || "missing-secret-key",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
