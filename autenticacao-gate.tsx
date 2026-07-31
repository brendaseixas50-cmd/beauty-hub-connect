import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { usePlatform } from "@/platform/platform-context";

export function AutenticacaoGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = usePlatform();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({ to: "/entrar", search: { redirect: "/painel" }, replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="grid justify-items-center gap-3 text-center">
          <LoaderCircle className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando seu acesso…</p>
        </div>
      </div>
    );
  }

  return children;
}
