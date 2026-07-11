const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const groqApiKey = Deno.env.get("GROQ_API_KEY");
  if (!groqApiKey) {
    return json({ error: "GROQ_API_KEY is not set" }, 500);
  }

  try {
    const form = await request.formData();
    const audio = form.get("audio");
    const language = String(form.get("language") || "ja");

    if (!(audio instanceof File)) {
      return json({ error: "audio file is required" }, 400);
    }

    const groqForm = new FormData();
    groqForm.append("file", audio, audio.name || "chunk.webm");
    groqForm.append("model", "whisper-large-v3-turbo");
    groqForm.append("language", language);
    groqForm.append("response_format", "json");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: groqForm,
    });

    const text = await response.text();
    if (!response.ok) {
      return json({ error: "Groq transcription failed", detail: text }, response.status);
    }

    const data = JSON.parse(text);
    return json({ text: String(data.text || "").trim() });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
