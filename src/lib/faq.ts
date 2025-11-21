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
    question: "What are the operating hours",
    answer:
      "Each facility has its own opening and closing time configured by the admin. Always follow the hours shown in the booking calendar because those reflect the real configuration inside the system.",
  },
  {
    question: "How long is each booking slot",
    answer:
      "1 hour to 2 hour per slot structure. Some slots may allow back to back booking depending on availability and system limits.",
  },
  {
    question: "How far in advance can I book",
    answer:
      "Bookings are allowed only within the window configured by the admin. If a date is not selectable in the calendar, it is outside the allowed booking range.",
  },
  {
    question: "How do cancellations or rescheduling work",
    answer:
      "You can cancel or reschedule your booking through the My Bookings page. Rescheduling frees the previous slot so others may use it.",
  },
  {
    question: "Do I need to bring my own equipment",
    answer:
      "Users should bring their own equipment whenever possible. Shared equipment availability depends on the admin configuration and stock.",
  },
  {
    question: "What happens if I do not show up",
    answer:
      "Repeated no shows may lead to temporary booking restrictions to keep the system fair for others.",
  },
  {
    question: "Is there a dress code",
    answer:
      "Wear proper sports attire and non marking shoes for indoor courts. Avoid footwear or accessories that may damage surfaces or cause injury.",
  },
  {
    question: "What should I do if I find damage or a safety issue",
    answer:
      "Stop using the facility and inform staff or security immediately. If the app includes a reporting feature, submit a report so admins can investigate.",
  },
];
