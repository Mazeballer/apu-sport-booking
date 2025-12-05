import { NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/push";
import { generateWeatherMessage } from "@/lib/ai/aiWeatherMessage";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, facilityName, startISO, rainProbability, description } =
      body;

    const message = await generateWeatherMessage({
      facilityName,
      bookingStart: new Date(startISO),
      rainProbability,
      rainDescription: description,
    });

    await sendPushToUser(userId, {
      title: message.title,
      body: message.body,
      url: "/bookings",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Push failed" }, { status: 500 });
  }
}
