// GET

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET /api/admin/users?query=&page=1&pageSize=20
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20'))
    );
    const skip = (page - 1) * pageSize;

    const q = (searchParams.get('query') || '').trim();

    const roleValues = ['student', 'staff', 'admin'] as const;
    const where =
      q.length > 0
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              roleValues.includes(q as any)
                ? { role: { equals: q as any } }
                : undefined,
            ].filter(Boolean) as any[],
          }
        : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ users, total, page, pageSize });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Failed to load users' },
      { status: 500 }
    );
  }
}

type Role = 'student' | 'staff' | 'admin';

// POST /api/admin/users
// body: { email, password, role, name }
export async function POST(req: Request) {
  try {
    const { email, password, role, name } = await req.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (!['student', 'staff', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // 1) Create Supabase Auth user (confirm email, embed role + name)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: role as Role },
      user_metadata: { name: name ?? '' },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const supaId = data.user?.id;
    if (!supaId) {
      return NextResponse.json(
        { error: 'Supabase did not return a user id' },
        { status: 400 }
      );
    }

    // 2) Create Prisma User row
    const newUser = await prisma.user.create({
      data: { id: supaId, email, role, name: name ?? '' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(newUser);
  } catch (e: any) {
    // Unique email violation or other DB errors
    const msg =
      e?.code === 'P2002'
        ? 'Email already exists'
        : e.message || 'Failed to create user';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
