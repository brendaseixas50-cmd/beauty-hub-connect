import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDemo } from "@/data/negocio";
import { BotaoDemo, avisoDemo } from "@/components/acao-demo";

export const Route = createFileRoute("/painel/galeria")({
  head: () => ({
    meta: [
      { title: "Galeria — Painel Lu IA Studio" },
      {
        name: "description",
        content: "Organize as fotos dos trabalhos exibidos na página pública.",
      },
      { property: "og:title", content: "Galeria — Painel Lu IA Studio" },
      { property: "og:description", content: "Fotos dos trabalhos realizados." },
    ],
  }),
  component: Galeria,
});

function Galeria() {
  const { galeria, categorias } = useDemo();
  const [filtro, setFiltro] = useState("Todas");

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow">Portfólio</p>
          <h1 className="mt-1 text-3xl">Galeria</h1>
        </div>
        <BotaoDemo
          className="shrink-0 rounded-full"
          mensagem="Envio de fotos disponível em breve"
          descricao="O upload será liberado junto com o armazenamento de arquivos."
        >
          <Plus className="h-4 w-4" /> Enviar foto
        </BotaoDemo>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {["Todas", ...categorias].map((c) => (
          <button key={c} onClick={() => setFiltro(c)} aria-pressed={filtro === c}>
            <Badge
              variant={filtro === c ? "default" : "outline"}
              className="rounded-full px-3 py-1.5 font-normal"
            >
              {c}
            </Badge>
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {filtro === "Todas"
          ? `${galeria.length} fotos publicadas na página pública.`
          : `Exibindo os trabalhos da categoria ${filtro}.`}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {galeria.map((foto, i) => (
          <div key={i} className="group relative overflow-hidden rounded-xl">
            <img
              src={foto}
              alt={`Trabalho ${i + 1}`}
              loading="lazy"
              width={800}
              height={800}
              className="aspect-square w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-foreground/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
              <BotaoDemo
                size="sm"
                variant="secondary"
                className="rounded-full"
                mensagem={`Foto ${i + 1} atualizada`}
              >
                Editar
              </BotaoDemo>
            </div>
          </div>
        ))}
        <button
          onClick={() => avisoDemo("Envio de fotos disponível em breve")}
          aria-label="Adicionar foto"
          className="grid aspect-square place-items-center rounded-xl border border-dashed text-muted-foreground"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
