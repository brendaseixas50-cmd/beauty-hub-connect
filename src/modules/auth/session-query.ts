import type { QueryClient } from "@tanstack/react-query";

import type { Session } from "./domain";
import { getSession } from "./server";

export const sessionQueryKey = ["auth", "session"] as const;

export function peekSession(queryClient: QueryClient): Session | null | undefined {
  return queryClient.getQueryData<Session | null>(sessionQueryKey);
}

export function readSession(queryClient: QueryClient): Promise<Session | null> {
  return queryClient.ensureQueryData({
    queryKey: sessionQueryKey,
    queryFn: () => getSession(),
    staleTime: 5 * 60_000,
  });
}

export function cacheSession(queryClient: QueryClient, session: Session | null): void {
  queryClient.setQueryData(sessionQueryKey, session);
}

export function clearSessionCache(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: sessionQueryKey, exact: true });
}
