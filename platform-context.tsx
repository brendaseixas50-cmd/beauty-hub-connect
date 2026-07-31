import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { demoSessions, type DemoSessionKey } from "./demo-session";
import type { PlatformSession, ProductAccess, ProductCode } from "./types";

const ACTIVE_STATUSES = new Set(["active"]);
const SESSION_STORAGE_KEY = "luia-demo-session";
const AUTH_STORAGE_KEY = "luia-demo-authenticated";

type PlatformContextValue = {
  session: PlatformSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  demoSessionKey: DemoSessionKey;
  signInDemo: (key: DemoSessionKey) => void;
  signOut: () => void;
  setDemoSessionKey: (key: DemoSessionKey) => void;
  accesses: ProductAccess[];
  canAccessProduct: (productCode: ProductCode) => boolean;
  getProductAccess: (productCode: ProductCode) => ProductAccess | null;
};

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [demoSessionKey, setDemoSessionKeyState] = useState<DemoSessionKey>("both");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const savedSession = window.localStorage.getItem(SESSION_STORAGE_KEY) as DemoSessionKey | null;
      const savedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
      if (savedSession && savedSession in demoSessions) setDemoSessionKeyState(savedSession);
      setIsAuthenticated(savedAuth);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setDemoSessionKey = (key: DemoSessionKey) => {
    setDemoSessionKeyState(key);
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, key);
    } catch {
      // O modo demonstrativo continua funcional mesmo sem armazenamento local.
    }
  };

  const signInDemo = (key: DemoSessionKey) => {
    setDemoSessionKey(key);
    setIsAuthenticated(true);
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    } catch {
      // O modo demonstrativo continua funcional mesmo sem armazenamento local.
    }
  };

  const signOut = () => {
    setIsAuthenticated(false);
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Sem ação adicional.
    }
  };

  const session = isAuthenticated ? demoSessions[demoSessionKey] : null;

  const value = useMemo<PlatformContextValue>(() => {
    const accesses = session?.accesses ?? [];
    const getProductAccess = (productCode: ProductCode) =>
      accesses.find((access) => access.productCode === productCode) ?? null;

    return {
      session,
      isAuthenticated,
      isLoading,
      demoSessionKey,
      signInDemo,
      signOut,
      setDemoSessionKey,
      accesses,
      getProductAccess,
      canAccessProduct: (productCode) => {
        const access = getProductAccess(productCode);
        return Boolean(access && ACTIVE_STATUSES.has(access.status));
      },
    };
  }, [demoSessionKey, isAuthenticated, isLoading, session]);

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): PlatformContextValue {
  const context = useContext(PlatformContext);
  if (!context) throw new Error("usePlatform deve ser usado dentro de PlatformProvider");
  return context;
}
