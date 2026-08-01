import { Scissors, Sparkles } from "lucide-react";
import { marcasProduto } from "@/products/catalog";

export function MarcaProduto({
  compacta = false,
  tipo = "beleza",
}: {
  compacta?: boolean;
  tipo?: "beleza" | "barbearia";
}) {
  const marca = marcasProduto[tipo];
  const Icone = tipo === "barbearia" ? Scissors : Sparkles;

  return (
    <div
      className="inline-flex items-center gap-2"
      aria-label={`${marca.nome}: ${marca.assinatura}`}
    >
      <span
        className="product-mark grid h-8 w-8 place-items-center rounded-full"
        aria-hidden="true"
      >
        <Icone className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="product-wordmark block truncate text-lg leading-none">{marca.nome}</span>
        {!compacta && (
          <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {marca.selo}
          </span>
        )}
      </span>
    </div>
  );
}
