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
    const dogName = String(form.get("dog_name") || "ポチ").trim().slice(0, 48) || "ポチ";

    if (!(audio instanceof File)) {
      return json({ error: "audio file is required" }, 400);
    }

    const groqForm = new FormData();
    groqForm.append("file", audio, audio.name || "chunk.webm");
    groqForm.append("model", "whisper-large-v3-turbo");
    groqForm.append("language", language);
    groqForm.append("prompt", `犬型ロボットへの短い日本語の呼びかけです。犬の名前は「${dogName}」。主な命令は「${dogName} おいで」「${dogName} おて」「${dogName} おすわり」「${dogName} まて」です。聞こえた日本語をそのまま句読点なしで文字起こししてください。`);
    groqForm.append("response_format", "verbose_json");
    groqForm.append("temperature", "0");

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
    const segments = Array.isArray(data.segments) ? data.segments : [];
    const hasLikelySpeech = !segments.length || segments.some((segment) => {
      const noSpeech = Number(segment.no_speech_prob ?? 0);
      const logProbability = Number(segment.avg_logprob ?? 0);
      return noSpeech < 0.65 && logProbability > -1.25;
    });

    return json({
      text: hasLikelySpeech ? String(data.text || "").trim() : "",
      ignored: !hasLikelySpeech,
    });
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
