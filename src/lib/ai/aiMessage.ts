// src/lib/aiMessage.ts

const MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
const API_KEY = process.env.GROQ_API_KEY;
const BASE_URL =
  process.env.OPENAI_BASE_URL ?? "https://api.groq.com/openai/v1";

export type AiNotification = {
  title: string;
  body: string;
};

type AiNotificationArgs = {
  purpose: string;
  style: string;
  context: string;
};

export async function generateAiNotification({
  purpose,
  style,
  context,
}: AiNotificationArgs): Promise<AiNotification> {
  const prompt = `
You are generating an upbeat, friendly PWA push notification.
No emojis.

Output must be JSON:
{"title":"...", "body":"..."}

Rules:
- Title max 6 words.
- Body max 2 sentences.
- Tone must be: ${style}
- Notification must achieve: ${purpose}

Context:
${context}
`;

  const raw = await callChatModel(prompt);

  try {
    const json = JSON.parse(raw) as Partial<AiNotification>;
    if (json.title && json.body) return json as AiNotification;
  } catch (err) {
    console.error("Failed to parse AI JSON", err);
  }

  return {
    title: "Notification",
    body: "You have a new update.",
  };
}

async function callChatModel(prompt: string): Promise<string> {
  if (!API_KEY) throw new Error("Missing GROQ_API_KEY");

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Groq API error:", text);
    throw new Error("Groq API request failed");
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "{}";
}
