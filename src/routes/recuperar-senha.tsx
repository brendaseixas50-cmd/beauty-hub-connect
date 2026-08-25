import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { BrandCredit } from "@/components/brand-experience";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/modules/auth/server";
import { useTemaProduto } from "@/components/tema-produto";
import { useProdutoDaJornada } from "@/lib/produto-preferido";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({ meta: [{ title: "Recuperar senha — Lu IA Studio" }] }),
  component: RecuperarSenha,
});

function RecuperarSenha() {
  const resetFn = useServerFn(requestPasswordReset);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const tema = useTemaProduto(useProdutoDaJornada());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);

    try {
      await resetFn({ data: { email: String(form.get("email")) } });
      setEnviado(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar o e-mail.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={`${tema} flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-12`}>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          {enviado ? (
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
              <MailCheck className="h-5 w-5" />
            </div>
          ) : null}
          <CardTitle>{enviado ? "Verifique seu e-mail" : "Recuperar senha"}</CardTitle>
          <CardDescription className="mt-2">
            {enviado
              ? "Se existir uma conta para este endereço, você receberá um link seguro para criar uma nova senha."
              : "Informe o e-mail usado no cadastro."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enviado ? (
            <Button asChild variant="outline" className="w-full">
              <Link to="/login" search={{ redirect: "/painel" }}>
                <ArrowLeft className="h-4 w-4" /> Voltar ao login
              </Link>
            </Button>
          ) : (
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={pending}>
                {pending ? "Enviando…" : "Enviar link de recuperação"}
              </Button>
              <Button asChild variant="ghost">
                <Link to="/login" search={{ redirect: "/painel" }}>
                  Voltar ao login
                </Link>
              </Button>
            </form>
          )}
          <BrandCredit className="mt-6" />
        </CardContent>
      </Card>
    </main>
  );
}
