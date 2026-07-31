import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ComponentProps, ReactNode } from "react";

/**
 * Feedback padrão do protótipo: confirma a ação para o usuário e deixa claro
 * que a persistência real chega na etapa de banco de dados.
 */
export function avisoDemo(titulo: string, descricao?: string) {
  toast.success(titulo, {
    description:
      descricao ?? "Ação demonstrativa — será salva de verdade quando o banco de dados for conectado.",
  });
}

type Props = Omit<ComponentProps<typeof Button>, "onClick"> & {
  /** Mensagem exibida no toast ao clicar. */
  mensagem: string;
  descricao?: string;
  children: ReactNode;
};

/** Botão de protótipo: sempre dá retorno visual, nunca fica “morto”. */
export function BotaoDemo({ mensagem, descricao, children, ...props }: Props) {
  return (
    <Button {...props} onClick={() => avisoDemo(mensagem, descricao)}>
      {children}
    </Button>
  );
}
