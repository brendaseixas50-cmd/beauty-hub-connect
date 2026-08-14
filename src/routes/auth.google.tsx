import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { establishOAuthSession } from "@/modules/auth/server";
import { cacheSession } from "@/modules/auth/session-query";

const searchSchema = z.object({
  produto: z.enum(["beauty", "barber"]).optional().catch(undefined),
  redirect: z
    .string()
    .startsWith("/")
    .refine((value) => !value.startsWith("//"))
    .catch("/painel"),
});

export const Route = createFileRoute("/auth/google")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Concluindo acesso — Lu IA Studio" }] }),
  component: GoogleCallbackPage,
});

/** Tokens do broker podem voltar no hash ou na query; aceitamos as duas formas. */
function readTokens(): {
  accessToken: string | undefined;
  refreshToken: string | undefined;
  error: string | undefined;
} {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const pick = (key: string) => hash.get(key) ?? query.get(key) ?? undefined;
  return {
    accessToken: pick("access_token"),
    refreshToken: pick("refresh_token"),
    error: pick("error_description") ?? pick("error") ?? undefined,
  };
}

function GoogleCallbackPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const establish = useServerFn(establishOAuthSession);
  const [error, setError] = useState<string>();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      const fromUrl = readTokens();
      if (fromUrl.error) {
        setError("O acesso com Google não foi concluído. Tente novamente.");
        return;
      }

      let accessToken = fromUrl.accessToken;
      let refreshToken = fromUrl.refreshToken;

      if (accessToken && refreshToken) {
        // Mantém o cliente do navegador em sincronia com a sessão recém-criada.
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } else {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token;
        refreshToken = data.session?.refresh_token;
      }

      if (!accessToken || !refreshToken) {
        setError("Não recebemos a autorização do Google. Tente entrar novamente.");
        return;
      }

      try {
        const session = await establish({
          data: {
            accessToken,
            refreshToken,
            ...(search.produto ? { productType: search.produto } : {}),
          },
        });
        cacheSession(queryClient, session);
        await navigate({ href: search.redirect, replace: true });
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Não foi possível abrir o painel após o acesso.",
        );
      }
    })();
  }, [establish, navigate, queryClient, search.produto, search.redirect]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
      {error ? (
        <div className="grid max-w-sm gap-4">
          <h1 className="text-xl">Não foi possível concluir o acesso</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            onClick={() =>
              navigate({
                to: "/login",
                search: { redirect: "/painel", ...(search.produto ? { produto: search.produto } : {}) },
                replace: true,
              })
            }
          >
            Voltar para entrar
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="h-5 w-5 animate-spin" /> Concluindo seu acesso e abrindo o
          painel…
        </p>
      )}
    </main>
  );
}
