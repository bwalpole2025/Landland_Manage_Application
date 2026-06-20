// Profile/security mutations that need credential handling.

import { prisma } from "@/server/db";
import { hashPassword, verifyPassword } from "./password";

export class ProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileError";
  }
}

/**
 * Change the signed-in user's password. Requires the current password and
 * revokes all other sessions on success.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ProfileError("User not found.");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ProfileError("Your current password is incorrect.");
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
