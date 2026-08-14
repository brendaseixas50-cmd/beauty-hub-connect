import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LoaderCircle, MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { MarcaProduto } from "@/components/marca-produto";
import { BrandCredit } from "@/components/brand-experience";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startGoogleSignIn } from "@/modules/auth/google-sign-in";
import { resendSignupConfirmation, signup } from "@/modules/auth/server";
import { cacheSession } from "@/modules/auth/session-query";

export const Route = createFileRoute("/cadastro")({
  validateSearch: z.object({ produto: z.enum(["beauty", "barber"]).catch("beauty") }),
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signupFn = useServerFn(signup);
  const resendFn = useServerFn(resendSignupConfirmation);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState<string>();
  const [reenvioStatus, setReenvioStatus] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));

    try {
      const result = await signupFn({
        data: {
          productType: produto,
          fullName: String(form.get("fullName")),
          businessName: String(form.get("businessName")),
          email,
          password: String(form.get("password")),
          passwordConfirmation: String(form.get("passwordConfirmation")),
        },
      });
      if (result.requiresEmailConfirmation) {
        setEmailEnviado(email);
      } else {
        cacheSession(queryClient, result.session);
        await navigate({ to: produto === "beauty" ? "/onboarding" : "/painel" });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar sua conta.");
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    if (!emailEnviado) return;
    setPending(true);
    setError(undefined);
    setReenvioStatus(undefined);
    try {
      await resendFn({ data: { email: emailEnviado, productType: produto } });
      setReenvioStatus("Novo link enviado. Verifique também a caixa de spam.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível reenviar o e-mail.");
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
                {reenvioStatus ? (
                  <p role="status" className="text-sm text-primary">
                    {reenvioStatus}
                  </p>
                ) : null}
                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <Button type="button" variant="outline" disabled={pending} onClick={handleResend}>
                  {pending ? "Reenviando…" : "Reenviar e-mail de confirmação"}
                </Button>
                <Button asChild>
                  <Link to="/login" search={{ redirect: "/painel", produto }}>
                    Ir para o login
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-5">
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    setError(undefined);
                    try {
                      await startGoogleSignIn({ productType: produto, redirect: "/painel" });
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Não foi possível entrar com Google.",
                      );
                      setPending(false);
                    }
                  }}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-white font-bold text-[#4285f4] shadow-sm">
                    G
                  </span>
                  Continuar com Google
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  ou crie com e-mail
                  <span className="h-px flex-1 bg-border" />
                </div>
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
                  <p className="text-xs text-muted-foreground">
                    Se você já usa outro produto Lu IA Studio, informe o mesmo e-mail e senha para
                    adicionar esta empresa à sua conta atual.
                  </p>
                  {error ? (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                  <Button type="submit" size="lg" disabled={pending}>
                    {pending ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" /> Criando e preparando sua
                        conta…
                      </>
                    ) : (
                      `Criar conta no ${produto === "barber" ? "LuBarber Pro" : "LuBeauty Pro"}`
                    )}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Já possui uma conta?{" "}
                    <Link
                      to="/login"
                      search={{ redirect: "/painel", produto }}
                      preload="render"
                      className="inline-flex min-h-11 items-center px-2 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Entrar
                    </Link>
                  </p>
                </form>
              </div>
            )}
            <BrandCredit className="mt-6" />
          </CardContent>
        </Card>
      </div>
      {pending ? (
        <div className="auth-loading-status" role="status" aria-live="assertive">
          <LoaderCircle className="h-5 w-5 animate-spin" /> Processando com segurança…
        </div>
      ) : null}
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
