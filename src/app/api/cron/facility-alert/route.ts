import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateFacilityMessage } from "@/lib/ai/facilityMessage";
import { sendPushToUser } from "@/lib/push";

const BUFFER_MINUTES = 10; // admin can make multiple edits
const SPAM_MINUTES = 30; // do not notify same facility twice

async function handleFacilityAlert() {
  const now = new Date();
  const bufferCutoff = new Date(now.getTime() - BUFFER_MINUTES * 60 * 1000);
  const spamCutoff = new Date(now.getTime() - SPAM_MINUTES * 60 * 1000);

  // Find pending logs older than buffer window
  const pending = await prisma.facilityNotificationLog.findMany({
    where: {
      createdAt: { lte: bufferCutoff },
      processed: false,
    },
    orderBy: { createdAt: "asc" },
  });

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, message: "No pending notifications" });
  }

  // Group by facilityId + kind
  const grouped = new Map<string, typeof pending>();

  for (const p of pending) {
    const key = `${p.facilityId}_${p.kind}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  let count = 0;

  for (const group of grouped.values()) {
    const latest = group[group.length - 1];

    // Check spam guard, did we notify recently
    const recent = await prisma.facilityNotificationLog.findFirst({
      where: {
        facilityId: latest.facilityId,
        kind: latest.kind,
        processed: true,
        createdAt: { gte: spamCutoff },
      },
    });

    if (recent) continue;

    // Fetch facility state
    const facility = await prisma.facility.findUnique({
      where: { id: latest.facilityId },
    });
    if (!facility) continue;

    // Create AI message
    const message = await generateFacilityMessage({
      kind: latest.kind as "closed" | "reopened" | "hours_changed",
      facilityName: facility.name,
    });

    // Get all subscribers
    const subs = await prisma.pushSubscription.findMany({
      include: { user: { select: { role: true } } },
    });

    const userIds = [
      ...new Set(
        subs
          .filter((s) => s.user.role === "student" || s.user.role === "staff")
          .map((s) => s.userId)
      ),
    ];

    if (userIds.length === 0) {
      // Still mark processed so we do not retry forever
      await prisma.facilityNotificationLog.updateMany({
        where: {
          facilityId: latest.facilityId,
          kind: latest.kind,
          processed: false,
        },
        data: { processed: true },
      });
      continue;
    }

    // Send in parallel
    await Promise.all(
      userIds.map((userId) =>
        sendPushToUser(userId, {
          title: message.title,
          body: message.body,
          url: "/bookings",
        })
      )
    );

    // Mark as processed
    await prisma.facilityNotificationLog.updateMany({
      where: {
        facilityId: latest.facilityId,
        kind: latest.kind,
        processed: false,
      },
      data: { processed: true },
    });

    count++;
  }

  return NextResponse.json({ ok: true, sent: count });
}

// Support both GET and POST so Supabase cron can use POST
export async function GET() {
  return handleFacilityAlert();
}

export async function POST() {
  return handleFacilityAlert();
}
