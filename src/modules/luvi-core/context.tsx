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

/** Estados visuais da assistente flutuante. */
export type LuviAssistantState = "hidden" | "bubble" | "open";

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
  tenantName: string;
  assistantState: LuviAssistantState;
  showAssistant: () => void;
  openAssistant: () => void;
  minimizeAssistant: () => void;
  hideAssistant: () => void;
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

  const assistantKey = `luvi:assistant:v1:${product}:${session.user.id}`;
  const [assistantState, setAssistantState] = useState<LuviAssistantState>("bubble");
  // Restaura a preferência somente após a hidratação para não divergir do HTML do servidor.
  useEffect(() => {
    setAssistantState(readAssistantState(assistantKey));
  }, [assistantKey]);
  const persistAssistant = useCallback(
    (next: LuviAssistantState) => {
      setAssistantState(next);
      try {
        window.localStorage.setItem(assistantKey, next);
      } catch {
        // Armazenamento indisponível: o estado vale apenas para esta navegação.
      }
    },
    [assistantKey],
  );
  const showAssistant = useCallback(() => persistAssistant("bubble"), [persistAssistant]);
  const openAssistant = useCallback(() => persistAssistant("open"), [persistAssistant]);
  const minimizeAssistant = useCallback(() => persistAssistant("bubble"), [persistAssistant]);
  const hideAssistant = useCallback(() => persistAssistant("hidden"), [persistAssistant]);

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
      tenantName: session.user.tenantName,
      assistantState,
      showAssistant,
      openAssistant,
      minimizeAssistant,
      hideAssistant,
    }),
    [
      assistantState,
      clearHistory,
      context,
      dismiss,
      dismissed,
      hideAssistant,
      history,
      minimizeAssistant,
      openAssistant,
      remember,
      session.user.tenantName,
      showAssistant,
      suggestions,
      theme,
    ],
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
