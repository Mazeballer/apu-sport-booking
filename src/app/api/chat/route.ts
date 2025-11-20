// app/api/chat/route.ts
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
  validateUIMessages,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const runtime = "edge";
export const maxDuration = 30;

// Configure Groq as an OpenAI compatible provider
const groq = createOpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return new Response(
        "Missing GROQ_API_KEY. Add your Groq API key to .env.local",
        { status: 500 }
      );
    }

    const body = await req.json();

    const uiMessages = await validateUIMessages<UIMessage>({
      messages: body.messages,
    });

    const result = streamText({
      model: groq(process.env.GROQ_MODEL ?? "llama-3.1-8b-instant"),
      system:
        "You are the APU Sports Facility Booking assistant. " +
        "You answer FAQs about facilities, operating hours, equipment, and rules. " +
        "You help users find available time slots, suggest the nearest free slots if the requested time is full, " +
        "and guide users through booking or rescheduling. " +
        "Always respond in a clear, friendly, and concise way.",
      messages: convertToModelMessages(uiMessages),
      temperature: 0.3,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
