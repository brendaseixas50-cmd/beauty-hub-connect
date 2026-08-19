import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, LogOut, ShieldCheck } from "lucide-react";
import { z } from "zod";

import { BrandCredit } from "@/components/brand-experience";
import { MarcaProduto } from "@/components/marca-produto";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { logout } from "@/modules/auth/server";
import { clearSessionCache, readSession } from "@/modules/auth/session-query";
import { requestBetaAccess } from "@/modules/beta-access/server";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/beta-fechado")({
  validateSearch: z.object({
    produto: z.enum(["beauty", "barber"]).optional().catch(undefined),
  }),
  beforeLoad: async ({ context }) => {
    const session = await readSession(context.queryClient);
    if (!session)
      throw redirect({ to: "/login", search: { redirect: "/painel", produto: undefined } });
    if (session.user.betaAccessActive) throw redirect({ to: "/painel" });
    return { session };
  },
  // Registra a solicitação pendente no Painel Master do produto correspondente.
  loader: async ({ context }) =>
    requestBetaAccess({ data: { productType: context.session.user.productType } }).catch(() => ({
      requested: false as const,
    })),
  head: () => ({ meta: [{ title: "Beta fechado — Lu IA Studio" }] }),
  component: ClosedBetaPage,
});

function ClosedBetaPage() {
  const { session } = Route.useRouteContext();
  const { produto } = Route.useSearch();
  const logoutFn = useServerFn(logout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const productType = produto ?? session.user.productType;
  const isBarber = productType === "barber";
  const tipo = isBarber ? "barbearia" : "beleza";
  const status = session.user.betaAccessStatus;
  const produtoNome = isBarber ? "LuBarber Pro" : "LuBeauty Pro";
  const copy =
    status === "pending"
      ? {
          eyebrow: "Aguardando aprovação",
          title: "Acesso em análise",
          text: `Seu cadastro no ${produtoNome} foi realizado com sucesso e sua solicitação já foi enviada para a administração do beta fechado. Você receberá acesso assim que for liberado.`,
          nota: "Em breve abriremos novas vagas.",
        }
      : status === "expired"
        ? {
            eyebrow: "Acesso expirado",
            title: "Seu período de acesso terminou",
            text: `Seu acesso ao ${produtoNome} expirou. Fale com a administração para renovar a participação no beta fechado.`,
            nota: "Seus dados continuam preservados.",
          }
        : {
            eyebrow: "Acesso indisponível",
            title: status === "suspended" ? "Acesso suspenso" : "Acesso encerrado",
            text: `Seu acesso ao ${produtoNome} não está ativo neste momento. Entre em contato com a administração do beta fechado para mais informações.`,
            nota: "Seus dados continuam preservados.",
          };

  return (
    <main
      className={`${isBarber ? "tema-barbearia" : "tema-beleza"} grid min-h-screen place-items-center bg-background px-4 py-10`}
    >
      <Card className="w-full max-w-xl items-center gap-6 p-6 text-center shadow-xl sm:p-10">
        <MarcaProduto tipo={tipo} />
        <div className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-primary">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {copy.eyebrow}
          </p>
          <h1 className="font-display text-3xl font-semibold">{copy.title}</h1>
          <p className="leading-relaxed text-muted-foreground">{copy.text}</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-4 py-3 text-sm">
          <Clock3 className="h-4 w-4 shrink-0" /> {copy.nota}
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={async () => {
            await logoutFn();
            clearSessionCache(queryClient);
            await navigate({
              to: "/login",
              search: { redirect: "/painel", produto: productType },
            });
          }}
        >
          <LogOut /> Sair da conta
        </Button>
        <BrandCredit />
      </Card>
    </main>
  );
}
