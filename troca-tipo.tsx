import { LockKeyhole, Scissors, Sparkles } from "lucide-react";
import { useAcesso } from "@/data/acesso";
import { useNegocio } from "@/data/negocio";

/** Controle visual para alternar entre produtos, respeitando a autorização da conta. */
export function TrocaTipo({ compacto = false }: { compacto?: boolean }) {
  const { tipo, definirTipo } = useNegocio();
  const { podeAcessar } = useAcesso();

  const opcoes = [
    { id: "beleza" as const, label: "LuBeauty", icon: Sparkles },
    { id: "barbearia" as const, label: "LuBarber", icon: Scissors },
  ];

  return (
    <div
      className="flex items-center gap-1 rounded-full border bg-card p-1"
      role="group"
      aria-label="Trocar produto"
    >
      {opcoes.map((opcao) => {
        const permitido = podeAcessar(opcao.id);
        return (
          <button
            key={opcao.id}
            type="button"
            onClick={() => definirTipo(opcao.id)}
            aria-pressed={tipo === opcao.id}
            aria-label={permitido ? opcao.label : `${opcao.label} — acesso restrito`}
            title={permitido ? opcao.label : "Produto não incluído no seu acesso"}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
              tipo === opcao.id
                ? "bg-primary font-medium text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <opcao.icon className="h-3.5 w-3.5" />
            {!compacto && opcao.label}
            {!permitido && <LockKeyhole className="h-3 w-3" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
