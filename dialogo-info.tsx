import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Modal de leitura/edição leve usado nas telas do painel do protótipo. */
export function DialogoInfo({
  gatilho,
  titulo,
  descricao,
  children,
  acao,
  onAcao,
}: {
  gatilho: ReactNode;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  acao?: string;
  onAcao?: () => void;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao && <DialogDescription>{descricao}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-3 text-sm">{children}</div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => setAberto(false)}>
            Fechar
          </Button>
          {acao && (
            <Button
              className="rounded-full"
              onClick={() => {
                onAcao?.();
                setAberto(false);
              }}
            >
              {acao}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
