import type { AuthUser, Permission } from "./domain";

export class UnauthorizedError extends Error {
  readonly statusCode = 401;

  constructor() {
    super("Authentication required");
  }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;

  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
  }
}

export function requirePermission(user: AuthUser | null, permission: Permission): AuthUser {
  if (!user) throw new UnauthorizedError();
  if (!user.permissions.includes(permission)) throw new ForbiddenError(permission);
  return user;
}
