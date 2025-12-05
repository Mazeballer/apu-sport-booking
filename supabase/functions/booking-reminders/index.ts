// supabase/functions/booking-reminders/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type BookingRow = {
  id: string;
  start: string;
  end: string;
  status: string;
  reminderEmailSentAt: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  facility: {
    id: string;
    name: string;
    location: string;
  } | null;
};

function formatDateTimeRange(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);

  const commonOpts = {
    timeZone: "Asia/Kuala_Lumpur" as const,
  };

  const dateStr = start.toLocaleDateString("en-MY", {
    ...commonOpts,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const startTimeStr = start.toLocaleTimeString("en-MY", {
    ...commonOpts,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const endTimeStr = end.toLocaleTimeString("en-MY", {
    ...commonOpts,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return { dateStr, startTimeStr, endTimeStr };
}

serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("REMINDER_FROM_EMAIL") ??
      "APU Sports Booking <no-reply@darrylcloud.uk>";

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing env vars",
          hasUrl: Boolean(supabaseUrl),
          hasKey: Boolean(serviceRoleKey),
          hasResend: Boolean(resendApiKey),
        }),
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const now = new Date();

    // Window: bookings starting between now + 2h and now + 2h + 10 min
    const DRIFT_MINUTES = 10;
    const targetStartMin = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const targetStartMax = new Date(
      targetStartMin.getTime() + DRIFT_MINUTES * 60 * 1000
    );

    // const targetStartMin = now;
    // const targetStartMax = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("Booking")
      .select(
        `
        id,
        start,
        end,
        status,
        reminderEmailSentAt,
        user:User (
          id,
          email,
          name
        ),
        facility:Facility (
          id,
          name,
          location
        )
      `
      )
      .eq("status", "confirmed")
      .is("reminderEmailSentAt", null)
      .gte("start", targetStartMin.toISOString())
      .lt("start", targetStartMax.toISOString());

    if (error) {
      console.error("Supabase query error", error);
      return new Response(
        JSON.stringify({ error: "Query failed", details: error }),
        { status: 500 }
      );
    }

    const bookings = (data ?? []) as BookingRow[];

    if (bookings.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    let sent = 0;
    const failedIds: string[] = [];

    for (const booking of bookings) {
      try {
        if (!booking.user?.email || !booking.facility) {
          continue;
        }

        const { dateStr, startTimeStr, endTimeStr } = formatDateTimeRange(
          booking.start,
          booking.end
        );

        const subject = `Reminder: ${booking.facility.name} booking in 2 hours`;

        const textLines = [
          `Hi ${booking.user.name || "there"},`,
          "",
          "This is a friendly reminder that your sports facility booking will start in about 2 hours.",
          "",
          `Facility: ${booking.facility.name}`,
          `Location: ${booking.facility.location}`,
          `Date: ${dateStr}`,
          `Time: ${startTimeStr} - ${endTimeStr}`,
          "",
          "Please arrive a bit early and follow the facility rules.",
          "",
          "Thank you,",
          "APU Sports Booking System",
        ];

        const text = textLines.join("\n");

        const html = `
          <p>Hi ${booking.user.name || "there"},</p>
          <p>This is a friendly reminder that your sports facility booking will start in about <strong>2 hours</strong>.</p>
          <ul>
            <li><strong>Facility:</strong> ${booking.facility.name}</li>
            <li><strong>Location:</strong> ${booking.facility.location}</li>
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${startTimeStr} - ${endTimeStr}</li>
          </ul>
          <p>Please arrive a bit early and follow the facility rules.</p>
          <p>Thank you,<br/>APU Sports Booking System</p>
        `;

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [booking.user.email],
            subject,
            text,
            html,
          }),
        });

        if (!emailRes.ok) {
          const bodyText = await emailRes.text();

          // Temporary debug response so we can see exactly why Resend failed
          return new Response(
            JSON.stringify(
              {
                error: "Resend failed",
                status: emailRes.status,
                body: bodyText,
                bookingId: booking.id,
                to: booking.user.email,
                from: fromEmail,
              },
              null,
              2
            ),
            { status: 500 }
          );
        }

        const { error: updateError } = await supabase
          .from("Booking")
          .update({ reminderEmailSentAt: new Date().toISOString() })
          .eq("id", booking.id);

        if (updateError) {
          console.error("Failed to update reminderEmailSentAt", updateError);
          failedIds.push(booking.id);
          continue;
        }

        sent += 1;
      } catch (err) {
        console.error("Error sending reminder", booking.id, err);
        failedIds.push(booking.id);
      }
    }

    return new Response(
      JSON.stringify({
        sent,
        failed: failedIds.length,
        failedIds,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Unexpected error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
    });
  }
});
