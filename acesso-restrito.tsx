import { createFileRoute, Link } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/acesso-restrito")({
  component: AcessoRestrito,
});

function AcessoRestrito() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/30 px-4">
      <div className="max-w-lg rounded-2xl border bg-card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-medium">Acesso não incluído no seu plano</h1>
        <p className="mt-3 text-muted-foreground">
          Sua conta não possui autorização para abrir este produto. Mesmo usando um endereço direto, o sistema mantém a área bloqueada.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild><Link to="/painel">Voltar ao meu painel</Link></Button>
          <Button asChild variant="outline"><Link to="/">Conhecer os produtos</Link></Button>
        </div>
      </div>
    </main>
  );
}
