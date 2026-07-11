const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-battery-alert-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase environment is not configured" }, 500);
  }

  if (request.method === "POST") {
    const expectedKey = Deno.env.get("BATTERY_ALERT_KEY");
    if (!expectedKey || request.headers.get("x-battery-alert-key") !== expectedKey) {
      return json({ error: "Unauthorized" }, 401);
    }

    const response = await databaseRequest("POST", "/rest/v1/battery_alert_state?on_conflict=id", {
      id: true,
      active: true,
      updated_at: new Date().toISOString(),
    }, "resolution=merge-duplicates,return=minimal");

    return response.ok
      ? json({ accepted: true })
      : json({ error: "Could not store battery alert" }, response.status);
  }

  if (request.method === "GET") {
    const stateResponse = await databaseRequest("GET", "/rest/v1/battery_alert_state?id=eq.true&select=active");
    if (!stateResponse.ok) {
      return json({ error: "Could not read battery alert" }, stateResponse.status);
    }

    const rows = await stateResponse.json();
    const active = Boolean(rows?.[0]?.active);

    if (active) {
      const clearResponse = await databaseRequest("PATCH", "/rest/v1/battery_alert_state?id=eq.true", {
        active: false,
        updated_at: new Date().toISOString(),
      }, "return=minimal");

      if (!clearResponse.ok) {
        return json({ error: "Could not clear battery alert" }, clearResponse.status);
      }
    }

    return json({ active });
  }

  return json({ error: "Method not allowed" }, 405);
});

function databaseRequest(method: string, path: string, body?: unknown, prefer?: string) {
  return fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey!}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
