import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { galeria, categorias } from "@/data/demo";

export const Route = createFileRoute("/painel/galeria")({
  head: () => ({
    meta: [
      { title: "Galeria — Painel Lu IA Studio" },
      { name: "description", content: "Organize as fotos dos trabalhos exibidos na página pública." },
      { property: "og:title", content: "Galeria — Painel Lu IA Studio" },
      { property: "og:description", content: "Fotos dos trabalhos realizados." },
    ],
  }),
  component: Galeria,
});

function Galeria() {
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow">Portfólio</p>
          <h1 className="mt-1 text-3xl">Galeria</h1>
        </div>
        <Button className="shrink-0 rounded-full">
          <Plus className="h-4 w-4" /> Enviar foto
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {["Todas", ...categorias].map((c, i) => (
          <Badge
            key={c}
            variant={i === 0 ? "default" : "outline"}
            className="rounded-full px-3 py-1.5 font-normal"
          >
            {c}
          </Badge>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
              <Button size="sm" variant="secondary" className="rounded-full">
                Editar
              </Button>
            </div>
          </div>
        ))}
        <button className="grid aspect-square place-items-center rounded-xl border border-dashed text-muted-foreground">
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
