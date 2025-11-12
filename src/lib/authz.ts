// lib/authz.ts
import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function requireStaffOrAdmin() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const authId = data.user?.id;
  if (!authId) throw Object.assign(new Error("Unauthorized"), { status: 401 });

  const user = await prisma.user.findUnique({
    where: { authId },
    select: { id: true, role: true },
  });
  if (!user || (user.role !== "admin" && user.role !== "staff")) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return user;
}

// 👇 Add this for admin-only enforcement
export async function requireAdmin() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const authId = data.user?.id;
  if (!authId) throw Object.assign(new Error("Unauthorized"), { status: 401 });

  const user = await prisma.user.findUnique({
    where: { authId },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "admin") {
    throw Object.assign(new Error("Forbidden – Admins only"), { status: 403 });
  }
  return user;
}

export async function getCurrentUser() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const authId = data.user?.id;
  if (!authId) return null;

  // look up your local user record
  const user = await prisma.user.findUnique({
    where: { authId },
    select: { id: true, email: true, role: true },
  });

  return user;
}
