import { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '../types/index.js';

/**
 * Resolves the database User.id (UUID) for an authenticated principal.
 * Handles both production Firebase UIDs and direct test UUIDs.
 */
export async function resolveUserId(
  prisma: PrismaClient,
  user: AuthenticatedUser,
): Promise<string> {
  // 1. Try finding by firebaseUid
  const existingByFirebase = await prisma.user.findUnique({
    where: { firebaseUid: user.uid },
    select: { id: true },
  });
  if (existingByFirebase) {
    return existingByFirebase.id;
  }

  // 2. Check if the provided uid is already a valid UUID matching an existing user
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(user.uid)) {
    const existingById = await prisma.user.findUnique({
      where: { id: user.uid },
      select: { id: true },
    });
    if (existingById) {
      return existingById.id;
    }
  }

  // 3. Try finding by email if email is provided
  if (user.email) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });
    if (existingByEmail) {
      await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { firebaseUid: user.uid },
      });
      return existingByEmail.id;
    }
  }

  // 4. Otherwise, create a user record for this authenticated identity
  const created = await prisma.user.create({
    data: {
      firebaseUid: user.uid,
      email: user.email || null,
      name: user.name || null,
    },
    select: { id: true },
  });

  return created.id;
}

export const resolveInternalUserId = resolveUserId;
