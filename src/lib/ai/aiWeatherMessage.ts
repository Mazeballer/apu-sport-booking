// src/lib/aiWeatherMessage.ts

const MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
const API_KEY = process.env.GROQ_API_KEY;
const BASE_URL =
  process.env.OPENAI_BASE_URL ?? "https://api.groq.com/openai/v1";

export type WeatherMessage = {
  title: string;
  body: string;
};

type GenerateWeatherMessageArgs = {
  facilityName: string;
  bookingStart: Date;
  rainProbability: number; // 0 to 1
  rainDescription: string;
};

export async function generateWeatherMessage({
  facilityName,
  bookingStart,
  rainProbability,
  rainDescription,
}: GenerateWeatherMessageArgs): Promise<WeatherMessage> {
  const timeStr = bookingStart.toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const risk = Math.round(rainProbability * 100);

  const prompt = `
Write a short PWA notification about rain risk.

Two parts only:
1. Title (max 7 words)
2. Body (max 2 sentences)

Context:
Facility: ${facilityName}
Time: ${timeStr}
Rain probability: ${risk} percent
Forecast: ${rainDescription}

Suggest the user reschedule or consider another day.
No emojis.
Return JSON: {"title":"...", "body":"..."}
`;

  const raw = await callChatModel(prompt);

  try {
    const json = JSON.parse(raw) as Partial<WeatherMessage>;
    if (json.title && json.body) {
      return { title: json.title, body: json.body };
    }
  } catch (err) {
    console.error("Failed to parse AI message JSON", err);
  }

  // fallback if AI fails
  return {
    title: "Rain expected soon",
    body: `There is a high chance of rain around ${timeStr}. You may want to reschedule your booking for safety.`,
  };
}

// Internal function to talk to Groq LLM
async function callChatModel(prompt: string): Promise<string> {
  if (!API_KEY) {
    throw new Error("GROQ_API_KEY missing in environment variables");
  }

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
