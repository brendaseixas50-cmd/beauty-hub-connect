import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, LogOut, ShieldCheck } from "lucide-react";

import { BrandCredit } from "@/components/brand-experience";
import { MarcaProduto } from "@/components/marca-produto";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSession, logout } from "@/modules/auth/server";

export const Route = createFileRoute("/beta-fechado")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session)
      throw redirect({ to: "/login", search: { redirect: "/painel", produto: undefined } });
    if (session.user.betaAccessActive) throw redirect({ to: "/painel" });
    return { session };
  },
  head: () => ({ meta: [{ title: "Beta fechado — Lu IA Studio" }] }),
  component: ClosedBetaPage,
});

function ClosedBetaPage() {
  const { session } = Route.useRouteContext();
  const logoutFn = useServerFn(logout);
  const navigate = useNavigate();
  const isBarber = session.user.productType === "barber";
  const tipo = isBarber ? "barbearia" : "beleza";

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
            Testes privados
          </p>
          <h1 className="font-display text-3xl font-semibold">Beta fechado</h1>
          <p className="leading-relaxed text-muted-foreground">
            O {isBarber ? "LuBarber Pro" : "LuBeauty Pro"} está disponível somente para
            participantes autorizados. Seu cadastro foi realizado com sucesso e agora aguarda
            liberação da administração.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-4 py-3 text-sm">
          <Clock3 className="h-4 w-4 shrink-0" /> Em breve abriremos novas vagas.
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={async () => {
            await logoutFn();
            await navigate({
              to: "/login",
              search: { redirect: "/painel", produto: session.user.productType },
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
