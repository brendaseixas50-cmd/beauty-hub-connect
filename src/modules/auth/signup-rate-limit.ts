import { createHmac } from "node:crypto";

import { getRequestIP } from "@tanstack/react-start/server";
import { getSignupRateLimitSecret } from "@/lib/server-env";

export function signupAttemptFingerprint(email: string): string {
  const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  return createHmac("sha256", getSignupRateLimitSecret())
    .update(ip)
    .update("\0")
    .update(email)
    .digest("hex");
}
