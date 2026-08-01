import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePlatform } from "@/platform/platform-context";
import type { DemoSessionKey } from "@/platform/demo-session";
import type { ProductCode } from "@/platform/types";

export type Produto = "beleza" | "barbearia";
export type PerfilAcesso = "somente-beleza" | "somente-barbearia" | "ambos";

type ContextoAcesso = {
  perfil: PerfilAcesso;
  produtosPermitidos: Produto[];
  podeAcessar: (produto: Produto) => boolean;
  definirPerfilDemo: (perfil: PerfilAcesso) => void;
  solicitarProduto: (produto: Produto) => void;
};

const AcessoContext = createContext<ContextoAcesso | null>(null);

function productCode(produto: Produto): ProductCode {
  return produto === "beleza" ? "lu-beauty" : "lu-barber";
}

function produtoFromCode(code: ProductCode): Produto {
  return code === "lu-beauty" ? "beleza" : "barbearia";
}

function profileFromDemoSession(key: DemoSessionKey): PerfilAcesso {
  if (key === "beauty") return "somente-beleza";
  if (key === "barber") return "somente-barbearia";
  return "ambos";
}

function demoSessionFromProfile(profile: PerfilAcesso): DemoSessionKey {
  if (profile === "somente-beleza") return "beauty";
  if (profile === "somente-barbearia") return "barber";
  return "both";
}

function nomeProduto(produto: Produto) {
  return produto === "beleza" ? "LuBeauty" : "LuBarber";
}

export function AcessoProvider({ children }: { children: ReactNode }) {
  const { accesses, canAccessProduct, demoSessionKey, setDemoSessionKey } = usePlatform();
  const [produtoSolicitado, setProdutoSolicitado] = useState<Produto | null>(null);

  const produtosPermitidos = useMemo(
    () =>
      accesses
        .filter((access) => access.status === "active")
        .map((access) => produtoFromCode(access.productCode)),
    [accesses],
  );

  const valor = useMemo<ContextoAcesso>(
    () => ({
      perfil: profileFromDemoSession(demoSessionKey),
      produtosPermitidos,
      podeAcessar: (produto) => canAccessProduct(productCode(produto)),
      definirPerfilDemo: (perfil) => setDemoSessionKey(demoSessionFromProfile(perfil)),
      solicitarProduto: setProdutoSolicitado,
    }),
    [canAccessProduct, demoSessionKey, produtosPermitidos, setDemoSessionKey],
  );

  return (
    <AcessoContext.Provider value={valor}>
      {children}
      <AlertDialog
        open={produtoSolicitado !== null}
        onOpenChange={(aberto) => !aberto && setProdutoSolicitado(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
              <LockKeyhole className="h-5 w-5 text-primary" />
            </div>
            <AlertDialogTitle>Produto não incluído no seu acesso</AlertDialogTitle>
            <AlertDialogDescription>
              {produtoSolicitado
                ? `Sua conta não possui autorização para entrar no ${nomeProduto(produtoSolicitado)}. Os dados e o painel do produto permanecem protegidos.`
                : "Esta área não está disponível para sua conta."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar no meu painel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setProdutoSolicitado(null)}>
              Conhecer este produto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AcessoContext.Provider>
  );
}

export function useAcesso(): ContextoAcesso {
  const contexto = useContext(AcessoContext);
  if (!contexto) throw new Error("useAcesso deve ser usado dentro de AcessoProvider");
  return contexto;
}
