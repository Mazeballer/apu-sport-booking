import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const secret = req.headers.get("x-cron-secret");

    if (!secret || secret !== process.env.CRON_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const now = new Date();

    const minuteCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const dayCutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [minuteResult, dayResult] = await Promise.all([
      prisma.chatRateLimitMinute.deleteMany({
        where: { createdAt: { lt: minuteCutoff } },
      }),
      prisma.chatRateLimitDay.deleteMany({
        where: { createdAt: { lt: dayCutoff } },
      }),
    ]);

    return Response.json({
      ok: true,
      deletedMinuteRows: minuteResult.count,
      deletedDayRows: dayResult.count,
    });
  } catch (err) {
    console.error("Chat rate limit cleanup failed:", err);
    return new Response("Cleanup failed", { status: 500 });
  }
}
