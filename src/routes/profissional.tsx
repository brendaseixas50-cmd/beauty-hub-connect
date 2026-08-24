import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock, LogOut, ShieldAlert } from "lucide-react";

import { InstalarApp } from "@/components/instalar-app";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionCache } from "@/modules/auth/session-query";
import { getProfessionalPanel } from "@/modules/professional-panel/server";

export const Route = createFileRoute("/profissional")({
  loader: async () => {
    const result = await getProfessionalPanel();
    if (result.status === "unauthenticated") {
      throw redirect({ to: "/login", search: { redirect: "/profissional" } });
    }
    if (result.status === "not_professional") throw redirect({ to: "/painel" });
    return result;
  },
  head: () => ({
    meta: [
      { title: "Painel Profissional — Lu IA Studio" },
      {
        name: "description",
        content:
          "Agenda pessoal, clientes, horários e bloqueios do profissional em um painel mobile-first.",
      },
      { property: "og:title", content: "Painel Profissional — Lu IA Studio" },
      {
        property: "og:description",
        content: "Acompanhe seus atendimentos do dia direto do celular.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfessionalLayout,
  errorComponent: () => (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Não foi possível abrir seu painel</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Atualize a página em alguns instantes ou entre novamente.
        </p>
      </Card>
    </main>
  ),
});

function ProfessionalLayout() {
  const result = Route.useLoaderData();

  if (result.status === "not_authorized") {
    return (
      <main className="tema-beleza grid min-h-screen place-items-center bg-background px-4 py-12">
        <Card className="max-w-md gap-3 p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-semibold">Acesso não autorizado</h1>
          <p className="text-sm text-muted-foreground">
            {result.email ? `O e-mail ${result.email} ` : "Este e-mail "}
            não está autorizado como profissional de nenhuma empresa. Peça ao proprietário para
            cadastrar seu e-mail na equipe.
          </p>
          <SairButton />
        </Card>
      </main>
    );
  }

  const produto = result.status === "ok" ? result.data.identity.productType : result.productType;
  const tema = produto === "barber" ? "tema-barbearia" : "tema-beleza";

  if (result.status === "disabled") {
    return (
      <main className={`${tema} grid min-h-screen place-items-center bg-background px-4 py-12`}>
        <Card className="max-w-md gap-3 p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-semibold">Acesso profissional desativado</h1>
          <p className="text-sm text-muted-foreground">{disabledAccessMessage}</p>
          <p className="text-xs text-muted-foreground">
            {result.name} — {result.tenantName}
          </p>
          <SairButton />
        </Card>
      </main>
    );
  }


  const { identity } = result.data;

  return (
    <div className={`${tema} min-h-screen bg-background text-foreground`}>
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {identity.photoUrl ? (
            <img
              src={identity.photoUrl}
              alt={`Foto de ${identity.name}`}
              className="h-10 w-10 rounded-full border object-cover"
            />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {identity.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{identity.name}</p>
            <p className="truncate text-xs text-muted-foreground">{identity.tenantName}</p>
          </div>
          <InstalarApp className="hidden sm:inline-flex" />
          <SairButton />
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 pb-2">
          <TabLink to="/profissional" icon={<CalendarDays className="h-4 w-4" />} label="Agenda" />
          <TabLink
            to="/profissional/horarios"
            icon={<Clock className="h-4 w-4" />}
            label="Meus horários"
          />
          <TabLink
            to="/profissional/bloqueios"
            icon={<ShieldAlert className="h-4 w-4" />}
            label="Folgas e bloqueios"
          />
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5 pb-16">
        <Outlet />
      </main>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:hidden">
        <InstalarApp className="rounded-full shadow-lg" />
      </div>
    </div>
  );
}

function TabLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/profissional" }}
      className="flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary [&.active]:bg-primary [&.active]:text-primary-foreground"
    >
      {icon}
      {label}
    </Link>
  );
}

function SairButton() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        clearSessionCache(queryClient);
        await supabase.auth.signOut();
        await navigate({ to: "/login", replace: true });
      }}
    >
      <LogOut className="h-4 w-4" />
      <span className="sr-only sm:not-sr-only">Sair</span>
    </Button>
  );
}
