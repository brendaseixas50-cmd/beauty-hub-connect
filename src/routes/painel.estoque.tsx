import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/data/demo";
import { useDemo, useNegocio } from "@/data/negocio";
import { DialogoInfo } from "@/components/dialogo-info";
import { avisoDemo, BotaoDemo } from "@/components/acao-demo";

export const Route = createFileRoute("/painel/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Painel Lu IA Studio" },
      { name: "description", content: "Controle de produtos, quantidade mínima e reposição." },
      { property: "og:title", content: "Estoque — Painel Lu IA Studio" },
      { property: "og:description", content: "Controle de produtos e reposição." },
    ],
  }),
  component: Estoque,
});

const cor = (status: string) =>
  status === "Ok" ? "secondary" : status === "Esgotado" ? "destructive" : ("outline" as const);

function Estoque() {
  const { tipo } = useNegocio();
  const { estoque, produtos } = useDemo();

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow">Insumos</p>
          <h1 className="mt-1 text-3xl">Estoque</h1>
        </div>
        <DialogoInfo
          gatilho={
            <Button className="shrink-0 rounded-full">
              <Plus className="h-4 w-4" /> Novo item
            </Button>
          }
          titulo="Novo item de estoque"
          descricao="Cadastro demonstrativo de insumo."
          acao="Salvar item"
          onAcao={() => avisoDemo("Item adicionado ao estoque")}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="est-item">Item</Label>
            <Input id="est-item" placeholder="Nome do produto" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="est-qtd">Quantidade</Label>
            <Input id="est-qtd" type="number" defaultValue={10} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="est-min">Quantidade mínima</Label>
            <Input id="est-min" type="number" defaultValue={3} />
          </div>
        </DialogoInfo>
      </div>

      <Card className="mt-8 divide-y p-0">
        {estoque.map((e) => (
          <div
            key={e.item}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{e.item}</p>
              <p className="text-sm text-muted-foreground">
                {e.categoria} · mínimo {e.minimo}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-lg font-medium">{e.quantidade}</span>
              <Badge
                variant={cor(e.status) as "secondary" | "destructive" | "outline"}
                className="rounded-full font-normal"
              >
                {e.status}
              </Badge>
            </div>
          </div>
        ))}
      </Card>

      <section className="mt-10">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <h2 className="text-2xl">
            {tipo === "barbearia" ? "Loja — venda de produtos" : "Produtos para revenda"}
          </h2>
          <BotaoDemo
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full"
            mensagem="Venda registrada"
            descricao="Baixa no estoque e recibo entram com o banco de dados conectado."
          >
            Nova venda
          </BotaoDemo>
        </div>
        <Card className="mt-4 divide-y p-0">
          {produtos.map((p) => (
            <div
              key={p.nome}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{p.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {p.vendidos} vendidos no mês · {p.estoque} em estoque
                </p>
              </div>
              <span className="shrink-0 font-medium">{brl(p.preco)}</span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
