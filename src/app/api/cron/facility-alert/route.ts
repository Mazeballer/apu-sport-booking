// src/app/api/cron/facility-alert/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateFacilityMessage } from "@/lib/ai/facilityMessage";
import { sendPushToUser } from "@/lib/push";
import type { FacilityChangeKind } from "@/lib/notify/facilityNotify";

const BUFFER_MINUTES = 10; // admin can make multiple edits
const SPAM_MINUTES = 30; // do not notify same facility twice

export async function GET() {
  const now = new Date();
  const bufferCutoff = new Date(now.getTime() - BUFFER_MINUTES * 60 * 1000);
  const spamCutoff = new Date(now.getTime() - SPAM_MINUTES * 60 * 1000);

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

  const grouped = new Map<string, typeof pending>();

  for (const p of pending) {
    const key = `${p.facilityId}_${p.kind}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  let count = 0;

  for (const group of grouped.values()) {
    const latest = group[group.length - 1];

    // Narrow kind to the union type
    const kind = latest.kind as FacilityChangeKind;
    if (kind !== "closed" && kind !== "reopened" && kind !== "hours_changed") {
      // unknown kind, skip
      continue;
    }

    const recent = await prisma.facilityNotificationLog.findFirst({
      where: {
        facilityId: latest.facilityId,
        kind,
        processed: true,
        createdAt: { gte: spamCutoff },
      },
    });

    if (recent) continue;

    const facility = await prisma.facility.findUnique({
      where: { id: latest.facilityId },
    });
    if (!facility) continue;

    const message = await generateFacilityMessage({
      kind,
      facilityName: facility.name,
      oldOpenTime: undefined,
      oldCloseTime: undefined,
      newOpenTime: facility.openTime ?? undefined,
      newCloseTime: facility.closeTime ?? undefined,
    });

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

    await Promise.all(
      userIds.map((userId) =>
        sendPushToUser(userId, {
          title: message.title,
          body: message.body,
          url: "/bookings",
        })
      )
    );

    await prisma.facilityNotificationLog.updateMany({
      where: {
        facilityId: latest.facilityId,
        kind,
        processed: false,
      },
      data: { processed: true },
    });

    count++;
  }

  return NextResponse.json({ ok: true, sent: count });
}
