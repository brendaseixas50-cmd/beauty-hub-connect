import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LockKeyhole, Mail, Scissors, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlatform } from "@/platform/platform-context";
import type { DemoSessionKey } from "@/platform/demo-session";

export const Route = createFileRoute("/entrar")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/painel",
  }),
  component: Entrar,
});

const contas: Array<{
  key: DemoSessionKey;
  title: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  { key: "beauty", title: "Testar LuBeauty", description: "Conta com acesso somente à experiência Beleza.", icon: Sparkles },
  { key: "barber", title: "Testar LuBarber", description: "Conta com acesso somente à experiência Barbearia.", icon: Scissors },
  { key: "both", title: "Testar os dois produtos", description: "Conta autorizada a alternar entre LuBeauty e LuBarber.", icon: LockKeyhole },
];

function Entrar() {
  const { signInDemo } = usePlatform();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  const acessarDemo = (key: DemoSessionKey) => {
    signInDemo(key);
    void navigate({ to: redirect === "/painel" ? "/painel" : "/painel", replace: true });
  };

  return (
    <main className="min-h-screen bg-secondary/30 px-4 py-10 sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <section className="pt-4">
          <p className="text-eyebrow">Lu IA Studio</p>
          <h1 className="mt-3 max-w-xl text-4xl font-medium tracking-tight sm:text-5xl">
            Entre no sistema contratado para o seu negócio.
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            O login real com Google, e-mail e assinatura será conectado ao Supabase. Nesta versão, as contas demonstrativas permitem validar a separação segura entre os produtos.
          </p>
          <Button asChild variant="link" className="mt-4 px-0">
            <Link to="/">Voltar para a página pública</Link>
          </Button>
        </section>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Entrar</CardTitle>
              <CardDescription>Estrutura visual pronta para autenticação real.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button type="button" variant="outline" disabled className="w-full">
                Continuar com Google — disponível após conectar o Supabase
              </Button>
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="seuemail@exemplo.com" className="pl-9" disabled />
                </div>
              </div>
              <Button type="button" disabled>Entrar com e-mail</Button>
              <p className="text-center text-xs text-muted-foreground">
                Não existe criação pública de conta gratuita. O acesso será liberado após compra ou cortesia autorizada.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            <p className="text-sm font-medium">Contas para testar agora</p>
            {contas.map((conta) => (
              <button
                key={conta.key}
                type="button"
                onClick={() => acessarDemo(conta.key)}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-secondary/40"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                  <conta.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{conta.title}</span>
                  <span className="block text-sm text-muted-foreground">{conta.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
