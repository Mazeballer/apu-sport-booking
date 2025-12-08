// src/lib/aiWeatherMessage.ts

import { generateAiNotification } from "./aiMessage";

type WeatherMessageArgs = {
  facilityName: string;
  bookingStart: Date;
  rainProbability: number;
  rainDescription: string;
};

export async function generateWeatherMessage({
  facilityName,
  bookingStart,
  rainProbability,
  rainDescription,
}: WeatherMessageArgs) {
  // fixed time to always follow Malaysia timezone
  const timeStr = bookingStart.toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kuala_Lumpur",
  });

  const risk = Math.round(rainProbability * 100);

  return await generateAiNotification({
    purpose: "Notify user about rain risk near their facility booking",
    style: "friendly, upbeat, helpful, positive tone",
    context: `
Facility: ${facilityName}
Booking time: ${timeStr}
Rain probability: ${risk} percent
Forecast: ${rainDescription}

The message should gently alert the user and recommend planning safely or considering a different timeslot.
    `,
  });
}
