// src/lib/faq.ts

export type FaqItem = {
  question: string;
  answer: string;
};

export const FACILITY_FAQ: FaqItem[] = [
  {
    question: "What sports facilities are available at APU",
    answer:
      "Students can book facilities such as the futsal court, basketball court, badminton courts, tennis court, and the multipurpose sports hall. The exact list may vary by semester, so always check the facilities page for the latest options.",
  },
  {
    question: "What are the usual operating hours for the sports facilities",
    answer:
      "Most facilities are open from 8.00 am to 10.00 pm on weekdays, and 9.00 am to 9.00 pm on weekends and public holidays, subject to university events and maintenance.",
  },
  {
    question: "Do I need to bring my own equipment",
    answer:
      "Students are encouraged to bring their own equipment when possible. Limited equipment such as balls or rackets may be available for loan, but this depends on stock and staff approval.",
  },
  {
    question: "How long is each booking slot",
    answer:
      "Standard bookings are usually 1 hour per slot. Some facilities may allow longer sessions if there is no overlapping booking.",
  },
  {
    question: "What happens if I do not show up for my booking",
    answer:
      "No shows may be recorded, and repeated missed bookings can lead to temporary suspension from using the facility booking system. Always cancel or reschedule in advance when you cannot attend.",
  },
];
