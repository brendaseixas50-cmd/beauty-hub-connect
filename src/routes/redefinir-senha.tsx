import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSession, updatePassword } from "@/modules/auth/server";

export const Route = createFileRoute("/redefinir-senha")({
  beforeLoad: async () => {
    if (!(await getSession())) {
      throw redirect({
        to: "/login",
        search: {
          redirect: "/redefinir-senha",
          message: "O link de recuperação expirou ou já foi utilizado.",
        },
      });
    }
  },
  head: () => ({ meta: [{ title: "Nova senha — Lu IA Studio" }] }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const updateFn = useServerFn(updatePassword);
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);

    try {
      await updateFn({
        data: {
          password: String(form.get("password")),
          passwordConfirmation: String(form.get("passwordConfirmation")),
        },
      });
      await navigate({ to: "/painel" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível alterar a senha.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <KeyRound className="h-5 w-5" />
          </div>
          <CardTitle>Crie uma nova senha</CardTitle>
          <CardDescription className="mt-2">
            Use pelo menos 8 caracteres, incluindo letras e números.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="passwordConfirmation">Confirmar nova senha</Label>
              <Input
                id="passwordConfirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
