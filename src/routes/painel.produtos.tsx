import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, EyeOff, ImageUp, Pencil, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { DeleteButton, EmptyState, PageHeader, SearchField } from "@/components/mvp-page";
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
import { brl, centsFromInput, type Product, type ProductWithUsage } from "@/modules/mvp/domain";
import {
  deleteProduct,
  listProducts,
  saveProduct,
  setProductActive,
  uploadPublicMedia,
} from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";
import { LuviContextBridge } from "@/modules/luvi-core/context";

export const Route = createFileRoute("/painel/produtos")({
  staleTime: 60_000,
  loader: () => listProducts(),
  head: () => ({ meta: [{ title: "Produtos — Beauty Hub Connect" }] }),
  component: ProductsPage,
});

const PAGINA = 10;

function ProductsPage() {
  const products = Route.useLoaderData();
  const remove = useServerFn(deleteProduct);
  const toggleActive = useServerFn(setProductActive);
  const action = useMvpAction();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "low">("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>();
  const categories = useMemo(
    () =>
      [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), "pt-BR"),
      ) as string[],
    [products],
  );
  const term = search.trim().toLowerCase();
  const filtered = products.filter((product) => {
    const matches =
      !term ||
      [product.name, product.sku, product.category].some((value) =>
        value?.toLowerCase().includes(term),
      );
    const low = product.active && product.stock_quantity <= product.minimum_stock;
    const situation =
      filter === "all" ||
      (filter === "active" ? product.active : filter === "inactive" ? !product.active : low);
    return matches && situation && (category === "all" || product.category === category);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGINA));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGINA, currentPage * PAGINA);

  // Volta para a primeira página quando os filtros mudam o conjunto de resultados.
  useEffect(() => {
    setPage(1);
  }, [term, filter, category]);

  return (
    <div>
      <LuviContextBridge
        facts={{
          products: products.length,
          lowStock: products.filter(
            (product) => product.active && product.stock_quantity <= product.minimum_stock,
          ).length,
        }}
      />
      <PageHeader
        eyebrow="Catálogo e insumos"
        title="Produtos"
        description="Cadastre itens de uso interno ou revenda. Ajustes de quantidade são feitos no estoque."
        action={
          <Button className="rounded-full" onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" /> Novo produto
          </Button>
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar produto, SKU ou categoria"
        />
        <select
          aria-label="Filtrar produtos"
          value={filter}
          onChange={(event) => setFilter(event.target.value as typeof filter)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
          <option value="low">Estoque baixo</option>
        </select>
        {categories.length ? (
          <select
            aria-label="Filtrar categoria"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Todas as categorias</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description="Cadastre produtos e insumos para acompanhar o estoque."
        />
      ) : (
        <>
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {visible.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                pending={action.pending}
                onEdit={() => setEditing(product)}
                onToggle={() =>
                  void action.run(
                    () => toggleActive({ data: { id: product.id, active: !product.active } }),
                    product.active ? "Produto inativado." : "Produto reativado.",
                  )
                }
                onDelete={() =>
                  void action.run(
                    () => remove({ data: { id: product.id } }),
                    "Produto excluído definitivamente.",
                  )
                }
              />
            ))}
          </div>
          <Paginacao
            page={currentPage}
            totalPages={totalPages}
            total={filtered.length}
            onChange={setPage}
          />
        </>
      )}
      {editing !== undefined ? (
        <ProductDialog
          product={editing}
          categories={categories}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}

function ProductCard({
  product,
  pending,
  onEdit,
  onToggle,
  onDelete,
}: {
  product: ProductWithUsage;
  pending: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const low = product.active && product.stock_quantity <= product.minimum_stock;

  return (
    <Card className="gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt=""
              loading="lazy"
              className="h-12 w-12 shrink-0 rounded-xl border object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-lg font-medium">{product.name}</p>
            <p className="text-sm text-muted-foreground">
              {product.category || "Sem categoria"} {product.sku ? `· SKU ${product.sku}` : ""}
            </p>
          </div>
        </div>
        <Badge variant={!product.active ? "outline" : low ? "destructive" : "secondary"}>
          {!product.active ? "Inativo" : low ? "Estoque baixo" : "Ativo"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Estoque</p>
          <p className="font-medium">
            {product.stock_quantity} {product.unit}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Custo</p>
          <p className="font-medium">{brl(product.cost_cents)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Venda</p>
          <p className="font-medium">{brl(product.sale_price_cents)}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {product.active
          ? product.public_visible
            ? "Visível na loja da página pública."
            : "Ativo no controle interno, fora da loja pública."
          : "Inativo: fora da loja pública. Estoque e histórico preservados."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" /> Editar
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={onToggle}>
          {product.active ? (
            <>
              <EyeOff className="h-4 w-4" /> Inativar
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4" /> Reativar
            </>
          )}
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/painel/estoque">Movimentar estoque</Link>
        </Button>
        {product.deletable ? (
          <DeleteButton
            label={`${product.name} (exclusão definitiva)`}
            pending={pending}
            onConfirm={onDelete}
          />
        ) : null}
      </div>
    </Card>
  );
}

function Paginacao({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1)
    return <p className="mt-4 text-xs text-muted-foreground">{total} produto(s) no total.</p>;

  return (
    <nav
      aria-label="Paginação de produtos"
      className="mt-6 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-xs text-muted-foreground">
        Página {page} de {totalPages} · {total} produto(s)
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label="Página anterior"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
          <Button
            key={item}
            variant={item === page ? "default" : "outline"}
            size="icon"
            className="rounded-full"
            aria-current={item === page ? "page" : undefined}
            onClick={() => onChange(item)}
          >
            {item}
          </Button>
        ))}
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label="Próxima página"
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

function ProductDialog({
  product,
  categories,
  onClose,
}: {
  product: Product | null;
  categories: string[];
  onClose: () => void;
}) {
  const save = useServerFn(saveProduct);
  const upload = useServerFn(uploadPublicMedia);
  const action = useMvpAction();
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [mediaKey] = useState(() => product?.id ?? crypto.randomUUID());
  const [uploading, setUploading] = useState(false);

  async function onImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (
      !(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type) ||
      file.size > 3 * 1024 * 1024
    ) {
      await action.run(
        () => Promise.reject(new Error("Use JPG, PNG ou WebP com no máximo 3 MB.")),
        "",
      );
      return;
    }
    setUploading(true);
    try {
      const result = await upload({
        data: {
          kind: "gallery",
          key: mediaKey,
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
          base64: await fileToBase64(file),
        },
      });
      setImageUrl(result.url);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await action.run(
      () =>
        save({
          data: {
            id: product?.id,
            name: String(form.get("name")),
            sku: String(form.get("sku")),
            category: String(form.get("category")),
            description: String(form.get("description")),
            costCents: centsFromInput(String(form.get("cost"))),
            salePriceCents: centsFromInput(String(form.get("salePrice"))),
            initialStock: Number(form.get("initialStock") || 0),
            minimumStock: Number(form.get("minimumStock")),
            unit: String(form.get("unit")),
            active: form.get("active") === "on",
            imageUrl,
            publicVisible: form.get("publicVisible") === "on",
          },
        }),
      product ? "Produto atualizado." : "Produto cadastrado.",
    );
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>
            Use a tela de estoque para registrar entradas e saídas posteriores.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label="Nome" name="name" defaultValue={product?.name ?? ""} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU" name="sku" defaultValue={product?.sku ?? ""} />
            <div className="grid gap-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                name="category"
                list="product-categories"
                placeholder="Digite ou escolha"
                defaultValue={product?.category ?? ""}
              />
              <datalist id="product-categories">
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Crie livremente novas categorias: elas aparecem nos filtros do painel e da loja
                pública.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Custo (R$)"
              name="cost"
              inputMode="decimal"
              defaultValue={product ? (product.cost_cents / 100).toFixed(2).replace(".", ",") : ""}
            />
            <Field
              label="Preço de venda (R$)"
              name="salePrice"
              inputMode="decimal"
              defaultValue={
                product ? (product.sale_price_cents / 100).toFixed(2).replace(".", ",") : ""
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {!product ? (
              <Field
                label="Estoque inicial"
                name="initialStock"
                type="number"
                min={0}
                defaultValue={0}
              />
            ) : (
              <input type="hidden" name="initialStock" value="0" />
            )}
            <Field
              label="Estoque mínimo"
              name="minimumStock"
              type="number"
              min={0}
              defaultValue={product?.minimum_stock ?? 0}
            />
            <Field label="Unidade" name="unit" defaultValue={product?.unit ?? "un"} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={product?.description ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="product-image">Foto do produto</Label>
            <div className="flex items-center gap-4">
              <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted text-xs text-muted-foreground">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  "Sem foto"
                )}
              </span>
              <div className="grid gap-2">
                <label
                  htmlFor="product-image"
                  className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-medium hover:bg-accent"
                >
                  <ImageUp className="h-4 w-4" /> {uploading ? "Enviando…" : "Enviar foto"}
                </label>
                {imageUrl ? (
                  <button
                    type="button"
                    className="text-left text-xs text-muted-foreground underline"
                    onClick={() => setImageUrl("")}
                  >
                    Remover foto
                  </button>
                ) : null}
              </div>
            </div>
            <input
              id="product-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(event) => void onImage(event)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input name="active" type="checkbox" defaultChecked={product?.active ?? true} /> Produto
            ativo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="publicVisible"
              type="checkbox"
              defaultChecked={product?.public_visible ?? false}
            />{" "}
            Exibir na página pública
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={action.pending}>
              {action.pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}
