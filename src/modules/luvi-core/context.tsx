import { useRouterState } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Session } from "@/modules/auth/domain";
import { getLuviTheme } from "@/modules/luvi-core/config";
import { RuleBasedLuviProvider, SafeFallbackLuviProvider } from "@/modules/luvi-core/providers";
import type {
  LuviContextSnapshot,
  LuviFacts,
  LuviHistoryItem,
  LuviSuggestion,
  LuviTheme,
} from "@/modules/luvi-core/types";

interface LuviContextValue {
  context: LuviContextSnapshot;
  theme: LuviTheme;
  suggestions: LuviSuggestion[];
  history: LuviHistoryItem[];
  dismissed: ReadonlySet<string>;
  setFacts: (facts: LuviFacts) => void;
  dismiss: (id: string) => void;
  remember: (title: string) => void;
  clearHistory: () => void;
}

const LuviContext = createContext<LuviContextValue | null>(null);
const guidedProvider = new RuleBasedLuviProvider();
const fallbackProvider = new SafeFallbackLuviProvider();

export function LuviContextProvider({
  session,
  children,
}: {
  session: Session;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [facts, setFacts] = useState<LuviFacts>({});
  const [suggestions, setSuggestions] = useState<LuviSuggestion[]>([]);
  const [history, setHistory] = useState<LuviHistoryItem[]>([]);
  const storageKey = `luvi:dismissed:v1:${session.user.tenantId}:${session.user.id}`;
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => readDismissed(storageKey));
  const product = session.user.productType;
  const theme = getLuviTheme(product);
  const context = useMemo<LuviContextSnapshot>(
    () => ({
      product,
      tenantId: session.user.tenantId,
      userId: session.user.id,
      permissions: session.user.permissions,
      pathname,
      facts,
    }),
    [facts, pathname, product, session.user.id, session.user.permissions, session.user.tenantId],
  );

  useEffect(() => {
    setFacts({});
    setDismissed(readDismissed(storageKey));
  }, [pathname, storageKey]);

  useEffect(() => {
    let active = true;
    guidedProvider
      .getSuggestions(context)
      .catch(() => fallbackProvider.getSuggestions(context))
      .then((next) => {
        if (active) setSuggestions(next);
      });
    return () => {
      active = false;
    };
  }, [context]);

  const dismiss = useCallback(
    (id: string) => {
      setDismissed((current) => {
        const next = new Set(current).add(id);
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
        return next;
      });
    },
    [storageKey],
  );
  const remember = useCallback((title: string) => {
    setHistory((current) =>
      [{ id: crypto.randomUUID(), title, createdAt: new Date().toISOString() }, ...current].slice(
        0,
        6,
      ),
    );
  }, []);
  const clearHistory = useCallback(() => setHistory([]), []);

  const value = useMemo(
    () => ({
      context,
      theme,
      suggestions,
      history,
      dismissed,
      setFacts,
      dismiss,
      remember,
      clearHistory,
    }),
    [clearHistory, context, dismiss, dismissed, history, remember, suggestions, theme],
  );

  return <LuviContext.Provider value={value}>{children}</LuviContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLuvi() {
  const value = useContext(LuviContext);
  if (!value) throw new Error("useLuvi deve ser usado dentro de LuviContextProvider.");
  return value;
}

export function LuviContextBridge({ facts }: { facts: LuviFacts }) {
  const { setFacts } = useLuvi();
  const serialized = JSON.stringify(facts);
  useEffect(() => setFacts(JSON.parse(serialized) as LuviFacts), [serialized, setFacts]);
  return null;
}

function readDismissed(key: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    return new Set(
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [],
    );
  } catch {
    return new Set<string>();
  }
}
