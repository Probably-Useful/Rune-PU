// Supabase Edge Function: self-destruct-cron
// Runs on a cron schedule to permanently delete expired runes.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase Client with service role key to bypass RLS for cleanup
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Fetch expired runes
    const now = new Date().toISOString();
    const { data: expiredRunes, error: selectError } = await supabaseClient
      .from("runes")
      .select("id, slug")
      .lte("self_destruct_at", now)
      .eq("is_destroyed", false);

    if (selectError) throw selectError;

    if (!expiredRunes || expiredRunes.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expired runes to self-destruct." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const idsToDestroy = expiredRunes.map((r) => r.id);
    const slugs = expiredRunes.map((r) => r.slug);

    // 2. Cascade delete will handle workspaces and tabs. We just delete from `runes`
    const { error: deleteError } = await supabaseClient
      .from("runes")
      .delete()
      .in("id", idsToDestroy);

    if (deleteError) throw deleteError;

    // 3. Log analytics events
    const logEntries = slugs.map((slug) => ({
      event_type: "rune_destroyed",
      metadata: { slug, reason: "expired" },
    }));

    await supabaseClient.from("analytics_events").insert(logEntries);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully self-destructed ${expiredRunes.length} runes.`,
        destroyedSlugs: slugs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
