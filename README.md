# APU Sports Facility Booking System

A Next.js web application for booking sports facilities at APU (Asia Pacific University). Features include facility browsing, court booking, equipment requests, and an AI-powered chatbot assistant.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (React 19)
- **Database**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Authentication**: [Supabase Auth](https://supabase.com/docs/guides/auth)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with [Radix UI](https://www.radix-ui.com/) components
- **AI Chatbot**: OpenAI API via [Vercel AI SDK](https://sdk.vercel.ai/)
- **Package Manager**: pnpm

---

## Prerequisites

Before running this project, ensure you have the following installed:

- **Node.js** (v18.17 or later) - [Download](https://nodejs.org/)
- **pnpm** (v8 or later) - Install with `npm install -g pnpm`
- **PostgreSQL** database (or use Supabase hosted database)

---

## Installation & Setup

### 1. Install Dependencies

```bash
pnpm install
```

This will also automatically generate the Prisma client (via the `postinstall` script).

### 2. Set Up the Database

Ensure your PostgreSQL database is running and the `DATABASE_URL` in `.env` is correct.

### 3. Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Command                | Description                     |
| ---------------------- | ------------------------------- |
| `pnpm dev`             | Start development server        |
| `pnpm build`           | Build for production            |
| `pnpm start`           | Start production server         |
| `pnpm lint`            | Run ESLint                      |
| `pnpm prisma studio`   | Open Prisma database GUI        |
| `pnpm prisma db push`  | Push schema changes to database |
| `pnpm prisma generate` | Regenerate Prisma client        |

---

## Project Structure

```
├── prisma/
│   └── schema.prisma    # Database schema
├── public/              # Static assets
├── src/
│   ├── app/             # Next.js App Router pages & API routes
│   ├── components/      # React components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions & configurations
│   └── styles/          # Global styles
├── supabase/            # Supabase configurations
└── types/               # TypeScript type definitions
```

---

## Features

- **Facility Browsing**: View available sports facilities with details
- **Court Booking**: Book specific courts with date/time selection
- **Equipment Requests**: Request equipment for bookings
- **AI Chatbot**: Natural language booking assistant
- **Push Notifications**: Booking reminders and alerts
- **Admin Dashboard**: Manage facilities, bookings, and equipment

---

## Login Credentials

| Role        | Email                 | Password   |
| ----------- | --------------------- | ---------- |
| **Admin**   | admin@gmail.com       | Testing123 |
| **Staff**   | staff@mail.apu.edu.my | staff123   |
| **Student** | dleong45@gmail.com    | Testing123 |
