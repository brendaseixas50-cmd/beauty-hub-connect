import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarcaProduto } from "@/components/marca-produto";
import { getSession, login } from "@/modules/auth/server";

const searchSchema = z.object({
  redirect: z.string().startsWith("/").catch("/painel"),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    if (await getSession()) throw redirect({ to: "/painel" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const loginFn = useServerFn(login);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);

    try {
      await loginFn({
        data: {
          email: String(form.get("email")),
          password: String(form.get("password")),
        },
      });
      await navigate({ href: search.redirect });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-12">
      <Card className="w-full max-w-md border-border/70 shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <MarcaProduto />
          </div>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">Acesso profissional</CardTitle>
            <CardDescription className="mt-2">
              Entre para acessar o painel privado da sua empresa.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue="demo@beautyhub.local"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                defaultValue="demo123"
                minLength={6}
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Entrando…" : "Entrar no painel"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Ambiente demonstrativo: use os dados já preenchidos.
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
