import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRainRiskForBooking } from "@/lib/weather";
import { generateWeatherMessage } from "@/lib/ai/aiWeatherMessage";
import { sendPushToUser } from "@/lib/push";

const RAIN_THRESHOLD = 0;
const WINDOW_HOURS = 24;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.CRON_SECRET?.trim();
    const header = req.headers.get("x-cron-secret")?.trim();

    if (!secret || !header || header !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const limit = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["confirmed", "rescheduled"] },
      start: {
        gte: now,
        lte: limit,
      },
      weatherAlertSentAt: null,
      facility: {
        locationType: "Outdoor",
      },
    },
    include: {
      facility: true,
    },
  });

  let notified = 0;

  for (const booking of bookings) {
    const rain = await getRainRiskForBooking(booking.start);
    if (!rain) continue;
    if (rain.probability < RAIN_THRESHOLD) continue;

    const msg = await generateWeatherMessage({
      facilityName: booking.facility.name,
      bookingStart: booking.start,
      rainProbability: rain.probability,
      rainDescription: rain.description,
    });

    await sendPushToUser(booking.userId, {
      title: msg.title,
      body: msg.body,
      url: `/bookings/${booking.id}`,
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { weatherAlertSentAt: now },
    });

    notified += 1;
  }

  return NextResponse.json({
    ok: true,
    checked: bookings.length,
    notified,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
