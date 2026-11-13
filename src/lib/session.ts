import { auth } from "@/auth";
import { Role } from "@prisma/client";

/**
 * Returns the currently authenticated user session on the server.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Helper to require an authenticated user, throwing or returning null if unauthorized.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

/**
 * Helper to require a specific role (e.g. Role.ADMIN).
 */
export async function requireRole(role: Role) {
  const user = await requireAuth();
  if (user.role !== role) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

