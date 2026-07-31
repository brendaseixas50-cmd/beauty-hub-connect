import { createContext, useContext, type ReactNode } from "react";

import { can, type AuthUser, type Permission, type Session } from "./domain";

interface AuthContextValue {
  session: Session;
  user: AuthUser;
  tenantId: string;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ session, children }: { session: Session; children: ReactNode }) {
  const value: AuthContextValue = {
    session,
    user: session.user,
    tenantId: session.user.tenantId,
    can: (permission) => can(session.user, permission),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
