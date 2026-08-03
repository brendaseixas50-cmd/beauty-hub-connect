import { createHmac } from "node:crypto";

import { getRequestIP } from "@tanstack/react-start/server";
import { getServerEnv } from "@/lib/server-env";

export function signupAttemptFingerprint(email: string): string {
  const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  return createHmac("sha256", getServerEnv().SIGNUP_RATE_LIMIT_SECRET)
    .update(ip)
    .update("\0")
    .update(email)
    .digest("hex");
}
