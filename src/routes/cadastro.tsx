import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { MarcaProduto } from "@/components/marca-produto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSession, signup } from "@/modules/auth/server";

export const Route = createFileRoute("/cadastro")({
  validateSearch: z.object({ produto: z.enum(["beauty", "barber"]).catch("beauty") }),
  beforeLoad: async () => {
    if (await getSession()) throw redirect({ to: "/painel" });
  },
  head: () => ({
    meta: [
      { title: "Criar conta — Lu IA Studio" },
      {
        name: "description",
        content: "Crie sua conta profissional com confirmação segura por e-mail.",
      },
    ],
  }),
  component: Cadastro,
});

function Cadastro() {
  const { produto } = Route.useSearch();
  const tipo = produto === "barber" ? "barbearia" : "beleza";
  const signupFn = useServerFn(signup);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));

    try {
      await signupFn({
        data: {
          productType: produto,
          fullName: String(form.get("fullName")),
          businessName: String(form.get("businessName")),
          email,
          password: String(form.get("password")),
          passwordConfirmation: String(form.get("passwordConfirmation")),
        },
      });
      setEmailEnviado(email);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar sua conta.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main
      className={`${tipo === "barbearia" ? "tema-barbearia" : "tema-beleza"} min-h-screen bg-secondary/40 px-4 py-10`}
    >
      <div className="mx-auto w-full max-w-lg">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <Card className="border-border/70 shadow-xl">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <MarcaProduto tipo={tipo} />
            </div>
            {emailEnviado ? (
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
                <MailCheck className="h-5 w-5" />
              </div>
            ) : null}
            <div>
              <CardTitle className="text-2xl">
                {emailEnviado ? "Confirme seu e-mail" : "Crie sua conta profissional"}
              </CardTitle>
              <CardDescription className="mt-2">
                {emailEnviado
                  ? `Enviamos um link de confirmação para ${emailEnviado}.`
                  : "Seus dados e os dados da sua empresa ficarão isolados em um ambiente próprio."}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {emailEnviado ? (
              <div className="grid gap-4 text-center">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Abra o link recebido para ativar sua conta. Depois da confirmação, sua sessão será
                  criada e você poderá entrar no painel.
                </p>
                <Button asChild>
                  <Link to="/login" search={{ redirect: "/painel" }}>
                    Ir para o login
                  </Link>
                </Button>
              </div>
            ) : (
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <Campo id="fullName" label="Nome completo" autoComplete="name" />
                <Campo id="businessName" label="Nome da empresa" autoComplete="organization" />
                <Campo id="email" label="E-mail" type="email" autoComplete="email" />
                <Campo
                  id="password"
                  label="Senha"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                />
                <Campo
                  id="passwordConfirmation"
                  label="Confirmar senha"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Use pelo menos 8 caracteres, incluindo letras e números.
                </p>
                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" size="lg" disabled={pending}>
                  {pending
                    ? "Criando conta…"
                    : `Criar conta no ${produto === "barber" ? "LuBarber Pro" : "LuBeauty Pro"}`}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Já possui uma conta?{" "}
                  <Link to="/login" search={{ redirect: "/painel" }} className="text-primary">
                    Entrar
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Campo({
  id,
  label,
  type = "text",
  autoComplete,
  minLength,
}: {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        required
      />
    </div>
  );
}
