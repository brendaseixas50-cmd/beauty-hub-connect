import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, ExternalLink, ImageUp, Settings2, Share2, Star, Trash2 } from "lucide-react";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/mvp-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteGalleryItem,
  deletePublicReview,
  getCompany,
  getPublicPageContent,
  saveGalleryItem,
  savePublicReview,
  uploadPublicMedia,
} from "@/modules/mvp/server";
import { useMvpAction } from "@/modules/mvp/use-action";
import { LuviContextBridge } from "@/modules/luvi-core/context";

export const Route = createFileRoute("/painel/pagina-publica")({
  staleTime: 60_000,
  loader: async () => {
    const [company, content] = await Promise.all([getCompany(), getPublicPageContent()]);
    return { company, ...content };
  },
  head: () => ({ meta: [{ title: "Minha página pública — Lu IA Studio" }] }),
  component: PublicPageManager,
});

const statusCopy = {
  published: { label: "Publicada", variant: "default" as const },
  draft: { label: "Rascunho", variant: "secondary" as const },
  disabled: { label: "Desativada", variant: "outline" as const },
};

function PublicPageManager() {
  const { company, gallery, reviews } = Route.useLoaderData();
  const upload = useServerFn(uploadPublicMedia);
  const savePhoto = useServerFn(saveGalleryItem);
  const removePhoto = useServerFn(deleteGalleryItem);
  const saveReview = useServerFn(savePublicReview);
  const removeReview = useServerFn(deletePublicReview);
  const action = useMvpAction();
  const [galleryUrl, setGalleryUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const path = `/p/${company.slug}`;
  const url = useMemo(
    () => (typeof window === "undefined" ? path : `${window.location.origin}${path}`),
    [path],
  );
  const status =
    statusCopy[company.public_page_status as keyof typeof statusCopy] ?? statusCopy.draft;

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link público copiado.");
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function shareLink() {
    if (!navigator.share) return;
    await navigator.share({ title: company.public_name ?? company.name, url });
  }

  async function uploadGallery(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (
      !(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type) ||
      file.size > 3 * 1024 * 1024
    ) {
      toast.error("Use JPG, PNG ou WebP com no máximo 3 MB.");
      return;
    }
    const result = await upload({
      data: {
        kind: "gallery",
        key: crypto.randomUUID(),
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        base64: await fileToBase64(file),
      },
    });
    setGalleryUrl(result.url);
  }

  async function addGallery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await action.run(
      () =>
        savePhoto({
          data: {
            imageUrl: galleryUrl,
            altText: String(form.get("altText")),
            sortOrder: gallery.length,
            active: true,
          },
        }),
      "Foto adicionada.",
    );
    if (ok) setGalleryUrl("");
  }

  async function addReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(
      () =>
        saveReview({
          data: {
            clientName: String(form.get("clientName")),
            rating: Number(form.get("rating")),
            comment: String(form.get("comment")),
            sortOrder: reviews.length,
            active: true,
          },
        }),
      "Avaliação adicionada.",
    );
  }

  return (
    <div className="max-w-3xl">
      <LuviContextBridge
        facts={{
          publicPageMissingFields: [
            company.public_name,
            company.description,
            company.whatsapp,
            company.slug,
          ].filter((value) => !value).length,
        }}
      />
      <PageHeader
        eyebrow="Presença online"
        title="Minha página pública"
        description="Abra, copie ou compartilhe o endereço público exclusivo desta empresa."
      />
      <Card className="mt-8 grid gap-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Situação atual</p>
            <Badge variant={status.variant} className="mt-1">
              {status.label}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            URL pública
          </p>
          <p className="mt-1 break-all text-sm font-medium">{url}</p>
        </div>

        {company.public_page_status !== "published" ? (
          <p className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
            O endereço já está reservado, mas só abrirá para clientes quando a página estiver
            publicada.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={path} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Visualizar página pública
            </a>
          </Button>
          <Button type="button" variant="outline" onClick={() => void copyLink()}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar link"}
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <Button type="button" variant="outline" onClick={() => void shareLink()}>
              <Share2 className="h-4 w-4" /> Compartilhar
            </Button>
          ) : null}
          <Button asChild type="button" variant="outline">
            <Link to="/painel/configuracoes">
              <Settings2 className="h-4 w-4" /> Configurar página
            </Link>
          </Button>
        </div>
      </Card>

      <Card className="mt-6 grid gap-5 p-6">
        <div>
          <h2 className="text-xl">Galeria de fotos</h2>
          <p className="text-sm text-muted-foreground">Mostre trabalhos e detalhes do espaço.</p>
        </div>
        {gallery.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((item) => (
              <div key={item.id} className="relative">
                <img
                  src={item.image_url}
                  alt={item.alt_text ?? "Foto da galeria"}
                  className="aspect-square w-full rounded-xl object-cover"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute right-2 top-2"
                  aria-label="Excluir foto"
                  onClick={() =>
                    void action.run(() => removePhoto({ data: { id: item.id } }), "Foto excluída.")
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma foto adicionada.</p>
        )}
        <form className="grid gap-3" onSubmit={addGallery}>
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium">
            <ImageUp className="h-4 w-4" /> Escolher foto
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => void uploadGallery(event)}
            />
          </label>
          {galleryUrl ? (
            <img src={galleryUrl} alt="Prévia" className="h-32 w-full rounded-xl object-cover" />
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="altText">Descrição da imagem</Label>
            <Input id="altText" name="altText" maxLength={160} />
          </div>
          <Button disabled={!galleryUrl || action.pending}>Adicionar à galeria</Button>
        </form>
      </Card>

      <Card className="mt-6 grid gap-5 p-6">
        <div>
          <h2 className="text-xl">Avaliações em destaque</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre depoimentos autorizados para a página pública.
          </p>
        </div>
        {reviews.map((review) => (
          <div
            key={review.id}
            className="flex items-start justify-between gap-4 rounded-xl border p-4"
          >
            <div>
              <div className="flex text-gold">
                {Array.from({ length: review.rating }, (_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-2 text-sm">“{review.comment}”</p>
              <strong className="text-sm">{review.client_name}</strong>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Excluir avaliação"
              onClick={() =>
                void action.run(
                  () => removeReview({ data: { id: review.id } }),
                  "Avaliação excluída.",
                )
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <form className="grid gap-3" onSubmit={addReview}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div className="grid gap-2">
              <Label htmlFor="clientName">Nome do cliente</Label>
              <Input id="clientName" name="clientName" required minLength={2} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rating">Nota</Label>
              <select
                id="rating"
                name="rating"
                className="h-10 rounded-md border bg-background px-3"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} estrelas
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="comment">Depoimento</Label>
            <Textarea id="comment" name="comment" required minLength={2} maxLength={1000} />
          </div>
          <Button disabled={action.pending}>Adicionar avaliação</Button>
        </form>
      </Card>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}
