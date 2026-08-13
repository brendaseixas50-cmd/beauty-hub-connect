import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, PackagePlus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { EmptyState, PageHeader, SearchField } from "@/components/mvp-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Product } from "@/modules/mvp/domain";
import { adjustStock, getInventory } from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";
import { LuviContextBridge } from "@/modules/luvi-core/context";

export const Route = createFileRoute("/painel/estoque")({
  staleTime: 60_000,
  loader: () => getInventory(),
  head: () => ({ meta: [{ title: "Estoque — Beauty Hub Connect" }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const { products, movements } = Route.useLoaderData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "zero">("all");
  const [selected, setSelected] = useState<Product>();
  const term = search.trim().toLowerCase();
  const filtered = products.filter((product) => {
    const matches = !term || product.name.toLowerCase().includes(term);
    return (
      matches &&
      (filter === "all" ||
        (filter === "low"
          ? product.stock_quantity <= product.minimum_stock
          : product.stock_quantity === 0))
    );
  });

  return (
    <div>
      <LuviContextBridge
        facts={{
          products: products.length,
          lowStock: products.filter(
            (product) => product.active && product.stock_quantity <= product.minimum_stock,
          ).length,
          stockMovements: movements.length,
        }}
      />
      <PageHeader
        eyebrow="Controle de insumos"
        title="Estoque"
        description="Registre todas as entradas e saídas. O histórico de movimentações é imutável para preservar a auditoria."
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar item" />
        <select
          aria-label="Filtrar estoque"
          value={filter}
          onChange={(event) => setFilter(event.target.value as typeof filter)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">Todos</option>
          <option value="low">Abaixo do mínimo</option>
          <option value="zero">Esgotados</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum item encontrado"
          description="Cadastre produtos antes de movimentar o estoque."
        />
      ) : (
        <Card className="mt-6 divide-y p-0">
          {filtered.map((product) => {
            const low = product.stock_quantity <= product.minimum_stock;
            return (
              <div
                key={product.id}
                className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Mínimo: {product.minimum_stock} {product.unit}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg font-medium">
                    {product.stock_quantity} {product.unit}
                  </span>
                  <Badge variant={low ? "destructive" : "secondary"}>{low ? "Repor" : "OK"}</Badge>
                  <Button variant="outline" size="sm" onClick={() => setSelected(product)}>
                    <PackagePlus className="h-4 w-4" /> Movimentar
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <section className="mt-10">
        <h2 className="text-2xl">Últimas movimentações</h2>
        {movements.length === 0 ? (
          <EmptyState
            title="Sem movimentações"
            description="As entradas e saídas registradas aparecerão aqui."
          />
        ) : (
          <Card className="mt-4 divide-y p-0">
            {movements.map((movement) => (
              <div key={movement.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{movement.products?.name ?? "Produto"}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {reasonLabel(movement.reason)} ·{" "}
                    {new Date(movement.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <span
                  className={`flex shrink-0 items-center gap-1 font-medium ${movement.quantity_delta > 0 ? "text-success" : "text-destructive"}`}
                >
                  {movement.quantity_delta > 0 ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                  {Math.abs(movement.quantity_delta)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
      {selected ? <StockDialog product={selected} onClose={() => setSelected(undefined)} /> : null}
    </div>
  );
}

function StockDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const adjust = useServerFn(adjustStock);
  const action = useMvpAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const direction = String(form.get("direction"));
    const quantity = Number(form.get("quantity"));
    const ok = await action.run(
      () =>
        adjust({
          data: {
            productId: product.id,
            quantityDelta: direction === "out" ? -quantity : quantity,
            reason: String(form.get("reason")) as
              "purchase" | "sale" | "use" | "loss" | "adjustment",
            notes: String(form.get("notes")),
          },
        }),
      "Estoque atualizado.",
    );
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentar {product.name}</DialogTitle>
          <DialogDescription>
            Saldo atual: {product.stock_quantity} {product.unit}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="direction">Movimento</Label>
            <select
              id="direction"
              name="direction"
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="in">Entrada</option>
              <option value="out">Saída</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quantity">Quantidade</Label>
            <Input id="quantity" name="quantity" type="number" min={1} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason">Motivo</Label>
            <select
              id="reason"
              name="reason"
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="purchase">Compra</option>
              <option value="sale">Venda</option>
              <option value="use">Uso interno</option>
              <option value="loss">Perda</option>
              <option value="adjustment">Ajuste</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Observação</Label>
            <Textarea id="notes" name="notes" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={action.pending}>
              {action.pending ? "Salvando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function reasonLabel(reason: string) {
  return (
    (
      {
        purchase: "Compra",
        sale: "Venda",
        use: "Uso interno",
        loss: "Perda",
        adjustment: "Ajuste",
        initial: "Saldo inicial",
      } as Record<string, string>
    )[reason] ?? reason
  );
}
