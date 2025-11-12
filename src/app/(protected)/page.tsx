// src/app/(protected)/page.tsx
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import HomeClient from "./HomeClient";
import { unstable_cache } from "next/cache";
import { toFacilityCardData } from "@/lib/mappers/facility";

export const runtime = "nodejs";
const FACILITY_TAG = "facilities";

const getFacilities = unstable_cache(
  async () => {
    const rows = await prisma.facility.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toFacilityCardData);
  },
  ["protected-home-facilities"],
  { tags: [FACILITY_TAG], revalidate: 60 }
);

export default async function ProtectedHome() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/");

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { role: true },
  });

  if (dbUser?.role === "admin") redirect("/admin");

  const facilities = await getFacilities();
  return <HomeClient facilities={facilities} />;
}
