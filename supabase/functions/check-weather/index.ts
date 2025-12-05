import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RAIN_THRESHOLD = 0.6; // 60 percent

serve(async () => {
  console.log("=== check-weather function started ===");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY");
  const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL");

  console.log("DEBUG siteUrl from env:", siteUrl);

  if (!supabaseUrl || !serviceKey || !siteUrl) {
    console.error("Missing Supabase or SITE_URL environment variables");
    return new Response("Missing environment variables", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Get bookings next 24 hours that have not been alerted yet
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  console.log(
    "Fetching bookings between:",
    now.toISOString(),
    "and",
    tomorrow.toISOString()
  );

  const { data: bookings, error: bookingsErr } = await supabase
    .from("Booking")
    .select(
      `
      id,
      userId,
      start,
      weatherAlertSentAt,
      Facility(name)
    `
    )
    .gte("start", now.toISOString())
    .lte("start", tomorrow.toISOString())
    .is("weatherAlertSentAt", null); // only ones that have not been alerted yet

  if (bookingsErr) {
    console.error("Error fetching bookings:", bookingsErr);
    return new Response("Error fetching bookings", { status: 500 });
  }

  console.log(`Found ${bookings?.length || 0} upcoming bookings`);

  if (!bookings || bookings.length === 0) {
    console.log("No bookings within next 24 hours");
    return new Response("No bookings found");
  }

  // 2. Fetch Open Meteo forecast for Bukit Jalil
  const weatherUrl =
    "https://api.open-meteo.com/v1/forecast?latitude=3.0556&longitude=101.7008&hourly=precipitation_probability";

  console.log("Fetching weather data from Open-Meteo...");

  let weather;
  try {
    const res = await fetch(weatherUrl);
    weather = await res.json();
  } catch (err) {
    console.error("Failed to fetch weather:", err);
    return new Response("Weather API error", { status: 500 });
  }

  const hourly: number[] | undefined =
    weather?.hourly?.precipitation_probability;
  if (!hourly) {
    console.error("Weather API returned invalid data");
    return new Response("Invalid weather API response", { status: 500 });
  }

  console.log("Weather data received successfully");

  // 3. For each booking, check weather for its hour
  for (const booking of bookings) {
    console.log(`Checking booking ${booking.id} for user ${booking.userId}`);

    const start = new Date(booking.start);
    const hourIndex = start.getHours();

    if (hourIndex < 0 || hourIndex >= hourly.length) {
      console.warn(
        `Hour index ${hourIndex} out of range for booking ${booking.id}`
      );
      continue;
    }

    const probability = hourly[hourIndex]; // this is in percent, for example 70

    console.log(
      `Booking at ${booking.start} has rain probability ${probability}%`
    );

    // Only send if rain probability is above threshold
    if (probability >= RAIN_THRESHOLD * 100) {
      console.log(
        `Rain probability high for booking ${booking.id}, sending push notification`
      );

      try {
        const pushRes = await fetch(`${siteUrl}/api/push/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: booking.userId,
            facilityName: booking.Facility.name,
            startISO: booking.start,
            rainProbability: probability / 100, // convert to 0–1 for your AI helper
            description: "High chance of rain expected",
          }),
        });

        if (!pushRes.ok) {
          const msg = await pushRes.text();
          console.error(
            `Push API responded with error. Status: ${pushRes.status}, StatusText: ${pushRes.statusText}, Body: ${msg}`
          );
        } else {
          console.log(`Push notification sent for booking ${booking.id}`);

          // Mark this booking so we do not alert again
          const { error: updateErr } = await supabase
            .from("Booking")
            .update({ weatherAlertSentAt: new Date().toISOString() })
            .eq("id", booking.id);

          if (updateErr) {
            console.error(
              "Failed to update weatherAlertSentAt for booking",
              booking.id,
              updateErr
            );
          }
        }
      } catch (err) {
        console.error("Failed to send push notification:", err);
      }
    } else {
      console.log(
        `Rain probability too low for booking ${booking.id}, skipping notification`
      );
    }
  }

  console.log("=== check-weather function completed ===");

  return new Response("Weather check completed");
});
