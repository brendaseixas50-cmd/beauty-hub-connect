import { Scissors, Sparkles } from "lucide-react";
import { useNegocio } from "@/data/negocio";

/** Controle visual de demonstração para alternar entre as duas experiências. */
export function TrocaTipo({ compacto = false }: { compacto?: boolean }) {
  const { tipo, definirTipo } = useNegocio();

  const opcoes = [
    { id: "beleza" as const, label: "Beleza", icon: Sparkles },
    { id: "barbearia" as const, label: "Barbearia", icon: Scissors },
  ];

  return (
    <div
      className="flex items-center gap-1 rounded-full border bg-card p-1"
      role="group"
      aria-label="Trocar tipo de negócio (demonstração)"
    >
      {opcoes.map((o) => (
        <button
          key={o.id}
          onClick={() => definirTipo(o.id)}
          aria-pressed={tipo === o.id}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
            tipo === o.id
              ? "bg-primary font-medium text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          <o.icon className="h-3.5 w-3.5" />
          {!compacto && o.label}
        </button>
      ))}
    </div>
  );
}
