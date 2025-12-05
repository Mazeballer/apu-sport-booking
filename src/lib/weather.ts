// src/lib/weather.ts

// Bukit Jalil coordinates
const BJ_LAT = 3.054;
const BJ_LON = 101.69;

export async function getRainRiskForBooking(bookingStart: Date) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${BJ_LAT}&longitude=${BJ_LON}&hourly=precipitation_probability,precipitation&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error("OpenMeteo error", res.status);
    return null;
  }

  const data = await res.json();
  const hours = data.hourly;

  if (!hours || !hours.time) return null;

  // Find nearest forecast hour to booking time
  let bestIndex = 0;
  let bestDiff = Number.MAX_SAFE_INTEGER;

  for (let i = 0; i < hours.time.length; i++) {
    const forecastMs = new Date(hours.time[i]).getTime();
    const diff = Math.abs(forecastMs - bookingStart.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  const probability = hours.precipitation_probability[bestIndex] / 100;
  const rainMM = hours.precipitation[bestIndex];

  return {
    probability, // 0 to 1
    description: rainMM > 0 ? "rain" : "no rain",
  };
}
