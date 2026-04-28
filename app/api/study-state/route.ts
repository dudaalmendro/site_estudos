import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stateKey = "shared-study-state";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const configured = Boolean(
    url?.startsWith("https://") &&
      url.endsWith(".supabase.co") &&
      key &&
      key.length > 20 &&
      !key.includes("missing")
  );

  return { url, key, configured };
}

function getSupabaseClient() {
  const { url, key, configured } = getSupabaseConfig();

  if (!configured || !url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json({
      ok: false,
      state: null,
      sync: "local",
      reason: "Supabase nao configurado no ambiente.",
    });
  }

  const { data, error } = await supabase
    .from("studyagent_app_state")
    .select("data")
    .eq("key", stateKey)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message, sync: "local" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, state: data?.data || null, sync: "remote" });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json({
      ok: false,
      saved: false,
      sync: "local",
      reason: "Supabase nao configurado no ambiente.",
    });
  }

  const body = (await req.json()) as { state?: unknown };

  if (!body.state || typeof body.state !== "object") {
    return NextResponse.json({ error: "Estado invalido." }, { status: 400 });
  }

  const { error } = await supabase.from("studyagent_app_state").upsert({
    key: stateKey,
    data: body.state,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json(
      { error: error.message, sync: "local" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, saved: true, sync: "remote" });
}
