// src/app/api/users/role/route.ts
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    if (!email)
      return Response.json({ error: 'Missing email' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return Response.json({ error: 'User not found' }, { status: 404 });

    return Response.json({ role: user.role });
  } catch (err) {
    console.error('GET /api/users/role error', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
