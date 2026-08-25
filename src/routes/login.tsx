import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";

import { MarcaProduto } from "@/components/marca-produto";
import { BrandCredit } from "@/components/brand-experience";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startGoogleSignIn } from "@/modules/auth/google-sign-in";
import { login, switchCompany } from "@/modules/auth/server";
import { cacheSession, clearSessionCache, peekSession } from "@/modules/auth/session-query";
import { useTemaProduto } from "@/components/tema-produto";
import { useProdutoDaJornada } from "@/lib/produto-preferido";

const safeRedirect = z
  .string()
  .startsWith("/")
  .refine((value) => !value.startsWith("//"))
  .catch("/painel");

const searchSchema = z.object({
  redirect: safeRedirect,
  message: z.string().max(240).optional().catch(undefined),
  produto: z.enum(["beauty", "barber"]).optional().catch(undefined),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Entrar — Lu IA Studio" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const loginFn = useServerFn(login);
  const switchFn = useServerFn(switchCompany);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  // A identidade do login vem da URL e, quando ausente (ex.: redirect do Painel
  // Profissional), do último produto usado — nunca do padrão LuBeauty.
  const produtoAtivo = useProdutoDaJornada(search.produto);
  const tipo = produtoAtivo === "barber" ? "barbearia" : "beleza";

  useEffect(() => {
    const session = peekSession(queryClient);
    if (!session) return;
    let active = true;
    void (async () => {
      try {
        const preferred = produtoAtivo
          ? session.user.companies.find((company) => company.productType === produtoAtivo)
          : undefined;
        const nextSession =
          preferred && preferred.tenantId !== session.user.tenantId
            ? await switchFn({ data: { tenantId: preferred.tenantId } })
            : session;
        if (!active) return;
        cacheSession(queryClient, nextSession);
        await navigate({ href: search.redirect, replace: true });
      } catch {
        clearSessionCache(queryClient);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate, produtoAtivo, queryClient, search.redirect, switchFn]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);

    try {
      const session = await loginFn({
        data: {
          email: String(form.get("email")),
          password: String(form.get("password")),
          productType: search.produto,
          remember: form.get("remember") !== null,
        },
      });
      cacheSession(queryClient, session);
      await navigate({ href: search.redirect });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
    } finally {
      setPending(false);
    }
  }

  const tema = useTemaProduto(tipo === "barbearia" ? "barber" : "beauty");

  return (
    <main
      className={`${tema} flex min-h-screen items-center justify-center bg-background px-4 py-12`}
    >
      <Card className="w-full max-w-md border-border/70 shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <MarcaProduto tipo={tipo} />
          </div>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">Acesso profissional</CardTitle>
            <CardDescription className="mt-2">
              Entre com a conta confirmada da sua empresa.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {search.message ? (
              <p className="rounded-lg bg-secondary px-3 py-2 text-sm" role="status">
                {search.message}
              </p>
            ) : null}
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError(undefined);
                try {
                  await startGoogleSignIn({
                    ...(search.produto ? { productType: search.produto } : {}),
                    redirect: search.redirect,
                  });
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Não foi possível iniciar o acesso com Google.",
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
              ou entre com e-mail
              <span className="h-px flex-1 bg-border" />
            </div>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  name="remember"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 accent-primary"
                />
                Manter conectado neste dispositivo
              </label>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password">Senha</Label>
                  <Link to="/recuperar-senha" className="text-xs text-primary hover:underline">
                    Esqueci minha senha
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" /> Entrando no painel…
                  </>
                ) : (
                  "Entrar no painel"
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Ainda não possui conta?{" "}
                <Link
                  to="/cadastro"
                  search={{ produto: search.produto ?? "beauty" }}
                  preload="render"
                  className="inline-flex min-h-11 items-center px-2 text-primary hover:underline"
                >
                  Criar conta
                </Link>
              </p>
              <BrandCredit className="mt-2" />
            </form>
          </div>
        </CardContent>
      </Card>
      {pending ? (
        <div className="auth-loading-status" role="status" aria-live="assertive">
          <LoaderCircle className="h-5 w-5 animate-spin" /> Validando e abrindo seu painel…
        </div>
      ) : null}
    </main>
  );
}
