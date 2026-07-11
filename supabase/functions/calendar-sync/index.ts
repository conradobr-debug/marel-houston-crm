import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function googleAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({
    client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "",
    client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "",
    refresh_token: Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN") || "",
    grant_type: "refresh_token"
  }) });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error("Google Calendar authorization is not configured.");
  return payload.access_token as string;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication is required." }, 401);
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || "", { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) return json({ error: "Authentication is required." }, 401);
    const admin = createClient(url, serviceKey);
    const { task_id, operation = "sync" } = await request.json();
    if (!task_id || !["sync", "delete"].includes(operation)) return json({ error: "A valid task and operation are required." }, 400);
    // Resolve the caller's access in the authenticated context. This keeps the
    // authorization decision aligned with the CRM's RLS policies before using
    // the server-side client for the approved calendar write.
    const { data: profile, error: profileError } = await userClient.from("profiles").select("workspace_id,role,is_active").eq("id", user.id).maybeSingle();
    const { data: task, error: taskError } = await userClient.from("tasks").select("*").eq("id", task_id).maybeSingle();
    if (profileError || taskError) throw new Error("Calendar authorization lookup failed.");
    if (!profile?.is_active || !task || task.workspace_id !== profile.workspace_id) return json({ error: "Calendar access is not authorized." }, 403);
    const canSync = ["admin", "sales_manager"].includes(profile.role) ||
      (profile.role === "sales_user" && (task.created_by === user.id || task.assigned_to === user.id)) ||
      (profile.role === "project_manager" && Boolean(task.project_id));
    if (!canSync) return json({ error: "Calendar access is not authorized." }, 403);
    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");
    if (!calendarId) throw new Error("Google Calendar is not configured.");
    if (operation === "delete") {
      if (task.external_calendar_event_id) {
        const accessToken = await googleAccessToken();
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(task.external_calendar_event_id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
        if (!response.ok && response.status !== 404) throw new Error("Google Calendar could not remove the event.");
      }
      await admin.from("tasks").update({ external_calendar_event_id: null, calendar_sync_status: "not_synced", calendar_synced_at: null, calendar_sync_error: null }).eq("id", task.id);
      return json({ status: "not_synced" });
    }
    if (!task.due_at) return json({ error: "An appointment date and time are required." }, 400);
    await admin.from("tasks").update({ calendar_sync_status: "pending", calendar_sync_error: null }).eq("id", task.id);
    const [leadResult, partnerResult, projectResult, ownerResult] = await Promise.all([
      task.lead_id ? admin.from("leads").select("first_name,last_name").eq("id", task.lead_id).maybeSingle() : Promise.resolve({ data: null }),
      task.partner_id ? admin.from("partners").select("first_name,last_name,company_name").eq("id", task.partner_id).maybeSingle() : Promise.resolve({ data: null }),
      task.project_id ? admin.from("projects").select("name").eq("id", task.project_id).maybeSingle() : Promise.resolve({ data: null }),
      task.assigned_to ? admin.from("profiles").select("display_name").eq("id", task.assigned_to).maybeSingle() : Promise.resolve({ data: null })
    ]);
    const subject = leadResult.data ? `${leadResult.data.first_name} ${leadResult.data.last_name}` : partnerResult.data ? (partnerResult.data.company_name || `${partnerResult.data.first_name} ${partnerResult.data.last_name}`) : projectResult.data?.name || "Marel CRM";
    const end = new Date(new Date(task.due_at).getTime() + (task.appointment_duration_minutes || 30) * 60000).toISOString();
    const event = { summary: `${task.title} — ${subject}`, description: `Marel CRM reference: ${task.id}\nResponsible owner: ${ownerResult.data?.display_name || "Unassigned"}${task.details ? `\nDetails: ${task.details.slice(0, 500)}` : ""}`, location: task.appointment_location || undefined, start: { dateTime: task.due_at, timeZone: "America/Chicago" }, end: { dateTime: end, timeZone: "America/Chicago" } };
    const accessToken = await googleAccessToken();
    const method = task.external_calendar_event_id ? "PUT" : "POST";
    const endpoint = task.external_calendar_event_id ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(task.external_calendar_event_id)}` : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const response = await fetch(endpoint, { method, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(event) });
    const result = await response.json();
    if (!response.ok || !result.id) throw new Error("Google Calendar could not save the event.");
    await admin.from("tasks").update({ external_calendar_event_id: result.id, calendar_sync_status: "synced", calendar_synced_at: new Date().toISOString(), calendar_sync_error: null }).eq("id", task.id);
    return json({ status: "synced", event_id: result.id });
  } catch (error) {
    console.error("[calendar-sync]", error instanceof Error ? error.message : "Calendar synchronization failed");
    return json({ error: "Calendar synchronization failed. Check the CRM sync status." }, 500);
  }
});
