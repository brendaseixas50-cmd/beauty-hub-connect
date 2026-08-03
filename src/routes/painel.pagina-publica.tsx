import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, Settings2, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/mvp-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCompany } from "@/modules/mvp/server";

export const Route = createFileRoute("/painel/pagina-publica")({
  loader: () => getCompany(),
  head: () => ({ meta: [{ title: "Minha página pública — Lu IA Studio" }] }),
  component: PublicPageManager,
});

const statusCopy = {
  published: { label: "Publicada", variant: "default" as const },
  draft: { label: "Rascunho", variant: "secondary" as const },
  disabled: { label: "Desativada", variant: "outline" as const },
};

function PublicPageManager() {
  const company = Route.useLoaderData();
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

  return (
    <div className="max-w-3xl">
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
          <p className="text-sm text-muted-foreground">
            {company.product_type === "barber" ? "LuBarber Pro" : "LuBeauty Pro"}
          </p>
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
            <Link to="/painel/empresa">
              <Settings2 className="h-4 w-4" /> Configurar página
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
