// src/lib/faq.ts
export type FaqItem = {
  question: string;
  answer: string;
};

export const FACILITY_FAQ: FaqItem[] = [
  {
    question: "Who can use the facilities",
    answer:
      "All current APU students and staff can make bookings through the system. External guests cannot book directly but may join a session if allowed by university policy.",
  },
  {
    question: "How long is each booking slot",
    answer:
      "Each booking is typically 1 to 2 hours per slot. Some facilities may allow back to back slots if they are still available.",
  },
  {
    question: "How far in advance can I book",
    answer:
      "Bookings are allowed only within the window configured by the admin. If a date is not selectable in the calendar, it is outside the allowed booking range.",
  },
  {
    question: "How do cancellations or rescheduling work",
    answer:
      "You can cancel or reschedule your booking through the My Bookings page. When you cancel or reschedule, the original slot is released so other students can use it.",
  },
  {
    question: "Do I need to bring my own equipment",
    answer:
      "You should bring your own equipment whenever possible. Some facilities provide shared equipment on a first come first served basis and it is always subject to stock availability, so it is not guaranteed.",
  },
  {
    question: "What happens if I do not show up",
    answer:
      "Repeated no shows may lead to temporary booking restrictions to keep the system fair for everyone. Always cancel or reschedule if you know you cannot attend.",
  },
  {
    question: "Is there a dress code",
    answer:
      "Wear proper sports attire and non marking shoes for indoor courts. Avoid footwear or accessories that may damage the surface or cause injury to you or others.",
  },
  {
    question: "Is there a mobile app for this booking system",
    answer:
      "Yes. The system is a Progressive Web App (PWA), which means you can install it on your phone like a normal app. Once installed, it opens in its own window and can send you booking notifications.",
  },
  {
    question: "How do I install the PWA on Android",
    answer:
      "Open the booking website in Chrome, then look for the Install app or Add to Home screen option in the browser menu. Tap it, confirm the install, and the APU Sports Booking icon will appear on your home screen.",
  },
  {
    question: "How do I install the PWA on iOS",
    answer:
      "Open the booking website in Safari, tap the Share button, then choose Add to Home Screen. Confirm the name and tap Add. The app will appear on your home screen and open in its own window.",
  },
  {
    question: "Will I get notifications for my bookings",
    answer:
      "If you install the PWA and allow notifications when prompted, the app can send alerts for new bookings, changes, and reminders. You can always change notification permissions in your browser or system settings.",
  },
  {
    question: "Can I arrive early or stay after my booking time",
    answer:
      "You should only use the facility during your booked slot. Arrive a little early to warm up outside the court and be ready to leave once your time ends so the next group can start on time.",
  },
  {
    question: "Can I share my booking with friends",
    answer:
      "You can invite friends to play during your booking as long as you follow APU rules and the facility capacity limit. Make sure everyone respects the booking time and code of conduct.",
  },
];
