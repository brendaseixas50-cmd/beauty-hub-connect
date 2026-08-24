import { Share, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

/** Botão "Instalar aplicativo": usa o prompt nativo quando existe e instruções no iPhone. */
export function InstalarApp({ className }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            const choice = await prompt.userChoice;
            if (choice.outcome === "accepted") setInstalled(true);
            setPrompt(null);
            return;
          }
          setShowManual(true);
        }}
      >
        <Smartphone className="h-4 w-4" /> Instalar aplicativo
      </Button>
      <Dialog open={showManual} onOpenChange={setShowManual}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Instalar como aplicativo</DialogTitle>
            <DialogDescription>
              Assim o painel abre em tela cheia, direto do ícone no seu celular.
            </DialogDescription>
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
