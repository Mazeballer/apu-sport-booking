// src/lib/ai/chat/response-templates.ts
// Templated responses for critical booking paths to eliminate LLM hallucination risk

/**
 * Template for successful booking confirmation.
 * Returns plain text that can be sent directly to the user.
 */
export function templateBookingConfirmed(params: {
  facilityName: string;
  date: string; // DD-MM-YYYY format
  time: string; // HH:MM format
  courtName: string;
  duration: string; // "1 hour" or "2 hours"
  equipment: string; // comma-separated or "None"
}): string {
  const { facilityName, date, time, courtName, duration, equipment } = params;

  return `✅ **Booking Confirmed**

• **Facility:** ${facilityName}
• **Date:** ${date}
• **Time:** ${time}
• **Court:** ${courtName}
• **Duration:** ${duration}
• **Equipment:** ${equipment}

Please arrive on time and follow facility rules.`;
}

/**
 * Template for booking failure due to slot clash or other errors.
 */
export function templateBookingFailed(params: {
  reason: string;
  suggestion?: string;
}): string {
  const { reason, suggestion } = params;

  let response = `❌ **Booking Failed**

${reason}`;

  if (suggestion) {
    response += `\n\n${suggestion}`;
  }

  return response;
}

/**
 * Template for when a requested time slot is not available.
 * Clearly explains the slot is booked and shows alternatives.
 */
export function templateSlotUnavailable(params: {
  facilityName: string;
  requestedTime: string;
  date: string;
  availableTimes: string[]; // Array of "HH:MM" strings
  suggestedTime?: string; // Nearest alternative
  courtName?: string;
}): string {
  const { facilityName, requestedTime, date, availableTimes, suggestedTime, courtName } = params;

  const courtInfo = courtName ? ` (${courtName})` : "";
  
  let response = `⚠️ **Slot Already Booked**

The **${requestedTime}** slot for **${facilityName}**${courtInfo} on **${date}** is already taken.`;

  if (suggestedTime) {
    response += `\n\n**Nearest available:** ${suggestedTime}`;
  }

  if (availableTimes.length > 0) {
    const timesDisplay = availableTimes.slice(0, 8).map((t) => `• ${t}`).join("\n");
    response += `\n\n**Other available times:**\n${timesDisplay}`;
  } else {
    response += `\n\nNo other slots available on this date.`;
  }

  response += `\n\nReply with a different time, or choose another date.`;

  return response;
}

/**
 * Template for asking user to confirm before creating booking.
 */
export function templateConfirmBooking(params: {
  facilityName: string;
  date: string;
  time: string;
  courtName: string;
  duration: string;
  equipment: string;
}): string {
  const { facilityName, date, time, courtName, duration, equipment } = params;

  return `📋 **Ready to Book**

• **Facility:** ${facilityName}
• **Date:** ${date}
• **Time:** ${time}
• **Court:** ${courtName}
• **Duration:** ${duration}
• **Equipment:** ${equipment}

Type **confirm** to create this booking, or **cancel** to stop.`;
}

/**
 * Template for booking limit exceeded.
 */
export function templateBookingLimitExceeded(params: {
  limitMessage: string;
}): string {
  return `⚠️ **Booking Limit Reached**

${params.limitMessage}

Please cancel an existing booking or choose a different date/time.`;
}

/**
 * Template for cancellation acknowledgment.
 */
export function templateBookingCancelled(): string {
  return `✅ **Booking Cancelled**

No booking was created. Let me know if you'd like to start again.`;
}

/**
 * Template for asking duration when booking.
 */
export function templateAskDuration(params: {
  facilityName: string;
  date: string;
  time: string;
  courtName: string;
  equipmentOptions: string[]; // Empty if no equipment available
}): string {
  const { facilityName, date, time, courtName, equipmentOptions } = params;

  let response = `📋 **Booking Details**

• **Facility:** ${facilityName}
• **Date:** ${date}
• **Time:** ${time}
• **Court:** ${courtName}

**How long do you need?**
• 1 hour
• 2 hours`;

  if (equipmentOptions.length > 0) {
    response += `\n\n**Equipment options:**\n${equipmentOptions.map((e, i) => `${i + 1}. ${e}`).join("\n")}\n${equipmentOptions.length + 1}. No equipment`;
  } else {
    response += `\n\n**Equipment:** None available (bring your own if needed)`;
  }

  return response;
}

/**
 * Template for showing availability.
 */
export function templateAvailability(params: {
  facilityName: string;
  date: string;
  courts: Array<{
    name: string;
    times: string[];
  }>;
}): string {
  const { facilityName, date, courts } = params;

  if (courts.length === 0 || courts.every((c) => c.times.length === 0)) {
    return `📅 **${facilityName}** on ${date}

No available slots remaining for this date. Please try another date.`;
  }

  const courtLines = courts
    .filter((c) => c.times.length > 0)
    .map((c) => `**${c.name}:**\n${c.times.map((t) => `• ${t}`).join("\n")}`)
    .join("\n\n");

  return `📅 **${facilityName}** on ${date}

${courtLines}

Reply with a time, duration (1 or 2 hours), and equipment choice to book.`;
}
