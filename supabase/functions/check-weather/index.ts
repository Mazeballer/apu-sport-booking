import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Get all future bookings within next 24 hours
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: bookings } = await supabase
    .from("Booking")
    .select(
      `
      id,
      userId,
      start,
      Facility(name)
    `
    )
    .gte("start", now.toISOString())
    .lte("start", tomorrow.toISOString());

  if (!bookings) return new Response("No bookings found");

  for (const booking of bookings) {
    const start = new Date(booking.start);

    // 2. Open Meteo for Bukit Jalil
    const weatherUrl =
      "https://api.open-meteo.com/v1/forecast?latitude=3.0556&longitude=101.7008&hourly=precipitation_probability";

    const weather = await fetch(weatherUrl).then((r) => r.json());

    const hourIndex = start.getHours();
    const probability = weather.hourly.precipitation_probability[hourIndex];

    // 3. Rain rule: notify only above 50 percent
    if (probability >= 50) {
      await fetch(`${Deno.env.get("NEXT_PUBLIC_SITE_URL")}/api/push/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: booking.userId,
          facilityName: booking.Facility.name,
          startISO: booking.start,
          rainProbability: probability / 100,
          description: "High chance of rain expected",
        }),
      });
    }
  }

  return new Response("Weather check completed");
});
