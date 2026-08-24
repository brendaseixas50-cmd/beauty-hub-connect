import { Share, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type EscopoApp = "gestao" | "profissional";

const textos: Record<EscopoApp, { titulo: string; descricao: string }> = {
  gestao: {
    titulo: "Instalar o aplicativo de Gestão",
    descricao:
      "O atalho “Gestão” abre direto o Painel Administrativo da sua empresa, em tela cheia.",
  },
  profissional: {
    titulo: "Instalar o aplicativo Profissional",
    descricao: "O atalho “Profissional” abre direto a sua agenda pessoal, em tela cheia.",
  },
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

/**
 * Botão + aviso de primeiro acesso para instalar o app.
 * Cada escopo tem seu próprio manifest (Gestão x Profissional), então o
 * proprietário pode manter os dois atalhos no mesmo celular.
 */
export function InstalarApp({
  className,
  escopo = "gestao",
}: {
  className?: string;
  escopo?: EscopoApp;
}) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [showFirst, setShowFirst] = useState(false);
  const dismissKey = `lu-instalar-dispensado:${escopo}`;

  useEffect(() => {
    const standalone = isStandalone();
    setInstalled(standalone);
    if (!standalone && window.localStorage.getItem(dismissKey) !== "1") {
      const timer = window.setTimeout(() => setShowFirst(true), 1200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [dismissKey]);

  useEffect(() => {
    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setPrompt(null);
      setShowFirst(false);
      window.localStorage.setItem(dismissKey, "1");
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [dismissKey]);

  async function instalar() {
    setShowFirst(false);
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setPrompt(null);
      return;
    }
    setShowManual(true);
  }

  if (installed) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        onClick={() => void instalar()}
      >
        <Smartphone className="h-4 w-4" /> Instalar aplicativo
      </Button>

      <Dialog open={showFirst} onOpenChange={setShowFirst}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{textos[escopo].titulo}</DialogTitle>
            <DialogDescription>{textos[escopo].descricao}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                window.localStorage.setItem(dismissKey, "1");
                setShowFirst(false);
              }}
            >
              Agora não
            </Button>
            <Button type="button" onClick={() => void instalar()}>
              <Smartphone className="h-4 w-4" /> Instalar aplicativo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showManual} onOpenChange={setShowManual}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{textos[escopo].titulo}</DialogTitle>
            <DialogDescription>{textos[escopo].descricao}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 text-sm">
            <div>
              <p className="font-medium">iPhone / iPad (Safari)</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>
                  Toque em <Share className="inline h-3.5 w-3.5" /> Compartilhar.
                </li>
                <li>Escolha “Adicionar à Tela de Início”.</li>
                <li>Confirme em “Adicionar”.</li>
              </ol>
            </div>
            <div>
              <p className="font-medium">Android (Chrome)</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Abra o menu ⋮ do navegador.</li>
                <li>Escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
