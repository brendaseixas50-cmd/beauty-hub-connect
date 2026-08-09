import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  LayoutGrid,
  Menu,
  Package,
  Scissors,
  Settings,
  Users,
  UserCog,
  Wallet,
  LogOut,
  Building2,
  BarChart3,
  Globe2,
  Megaphone,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MarcaProduto } from "@/components/marca-produto";
import { BrandCredit, BrandSplash } from "@/components/brand-experience";
import { getSession, logout, switchCompany } from "@/modules/auth/server";
import { AuthProvider } from "@/modules/auth/context";
import type { Session } from "@/modules/auth/domain";
import { LuviAssistant, LuviOnboardingProgress } from "@/modules/luvi-core/components";
import { LuviContextProvider } from "@/modules/luvi-core/context";

export const Route = createFileRoute("/painel")({
  staleTime: 5 * 60_000,
  beforeLoad: async ({ location }) => {
    const session = await getSession();
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    if (!session.user.betaAccessActive) {
      throw redirect({ to: "/beta-fechado" });
    }
    if (session.user.productType === "beauty" && !session.user.onboardingCompleted) {
      throw redirect({ to: "/onboarding", search: { retorno: "/painel" } });
    }
    return { session };
  },
  component: PainelLayout,
});

const itens = [
  { to: "/painel", label: "Visão Geral", icon: LayoutGrid, exact: true },
  { to: "/painel/empresa", label: "Empresa", icon: Building2 },
  { to: "/painel/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/painel/servicos", label: "Serviços", icon: Scissors },
  { to: "/painel/profissionais", label: "Profissionais", icon: UserCog },
  { to: "/painel/clientes", label: "Clientes", icon: Users },
  { to: "/painel/marketing", label: "Marketing", icon: Megaphone },
  { to: "/painel/produtos", label: "Produtos", icon: Package },
  { to: "/painel/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/painel/estoque", label: "Estoque", icon: Package },
  { to: "/painel/relatorios", label: "Relatórios", icon: BarChart3 },
] as const;

function Navegacao({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-1">
      {itens.map((item) => {
        const ativo = "exact" in item ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            preload="intent"
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              ativo
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AcoesInferiores({
  session,
  onNavigate,
  onLogout,
}: {
  session: Session;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const platformAdmin =
    session.user.isPlatformAdministrator || session.user.betaAccessType === "administrator";

  return (
    <div className="grid gap-1 border-t pt-4">
      <a
        href={`/p/${session.user.tenantSlug}`}
        target="_blank"
        rel="noreferrer"
        onClick={onNavigate}
        className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-90"
      >
        <Globe2 className="h-4 w-4" /> Minha Página Pública
      </a>
      <Link
        to="/painel/configuracoes"
        preload="intent"
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent/50"
      >
        <Settings className="h-4 w-4" /> Configurações
      </Link>
      {platformAdmin ? (
        <Link
          to="/painel/admin-acessos"
          preload="intent"
          onClick={onNavigate}
          className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-sidebar-primary/60 bg-sidebar-primary/10 px-3 py-3 text-sm font-semibold text-sidebar-foreground hover:bg-sidebar-primary/20"
        >
          <ShieldCheck className="h-4 w-4 text-sidebar-primary" /> Painel Master
          <span className="ml-auto text-[10px] font-medium uppercase tracking-wide">Acessos</span>
        </Link>
      ) : null}
      <button
        type="button"
        onClick={onLogout}
        className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-sidebar-accent/50"
      >
        <LogOut className="h-4 w-4" /> Sair
      </button>
    </div>
  );
}

function Marca({ session }: { session: Session }) {
  const initials = session.user.tenantName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-3">
      {session.user.logoUrl ? (
        <img
          src={session.user.logoUrl}
          alt={`Logo ${session.user.tenantName}`}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{session.user.tenantName}</p>
        <p className="truncate text-xs text-muted-foreground">{session.user.name}</p>
      </div>
    </div>
  );
}

function CompanySwitcher({ session }: { session: Session }) {
  const switchFn = useServerFn(switchCompany);
  const router = useRouter();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  if (session.user.companies.length < 2) return null;

  async function handleChange(tenantId: string) {
    if (tenantId === session.user.tenantId) return;
    setPending(true);
    try {
      await switchFn({ data: { tenantId } });
      await router.invalidate();
      await navigate({ to: "/painel", replace: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      Empresa ativa
      <select
        className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"
        value={session.user.tenantId}
        disabled={pending}
        onChange={(event) => void handleChange(event.currentTarget.value)}
      >
        {session.user.companies.map((company) => (
          <option key={company.tenantId} value={company.tenantId}>
            {company.tenantName} · {company.productType === "barber" ? "LuBarber" : "LuBeauty"}
          </option>
        ))}
      </select>
    </label>
  );
}

function PainelLayout() {
  const [aberto, setAberto] = useState(false);
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const logoutFn = useServerFn(logout);
  const tipo = session.user.productType === "barber" ? "barbearia" : "beleza";
  const tema = tipo === "barbearia" ? "tema-barbearia" : "tema-beleza";

  useEffect(() => {
    document.documentElement.classList.add(tema);
    return () => document.documentElement.classList.remove(tema);
  }, [tema]);

  async function handleLogout() {
    await logoutFn();
    await navigate({ to: "/login" });
  }

  return (
    <AuthProvider session={session}>
      <LuviContextProvider session={session}>
        <div className={`${tema} min-h-screen bg-background lg:flex`}>
          <div
            className={`route-progress ${navigating ? "route-progress-visible" : ""}`}
            aria-hidden="true"
          />
          <BrandSplash tipo={tipo} />
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r bg-sidebar p-4 lg:flex">
            <MarcaProduto tipo={tipo} />
            <div className="my-4 border-t" />
            <Marca session={session} />
            <div className="mt-4">
              <CompanySwitcher session={session} />
            </div>
            <div className="mt-6 flex-1 pb-4">
              <Navegacao />
            </div>
            <div className="grid gap-3">
              <LuviOnboardingProgress />
              <p className="truncate px-1 text-xs text-muted-foreground">{session.user.email}</p>
              <AcoesInferiores session={session} onLogout={() => void handleLogout()} />
              <BrandCredit />
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
              <Marca session={session} />
              <Sheet open={aberto} onOpenChange={setAberto}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Abrir menu">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 overflow-y-auto bg-sidebar p-4">
                  <SheetTitle className="sr-only">Menu do painel</SheetTitle>
                  <div className="mt-6">
                    <Navegacao onNavigate={() => setAberto(false)} />
                  </div>
                  <div className="mt-4 grid gap-3">
                    <AcoesInferiores
                      session={session}
                      onNavigate={() => setAberto(false)}
                      onLogout={() => void handleLogout()}
                    />
                    <BrandCredit />
                  </div>
                </SheetContent>
              </Sheet>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
              <Outlet />
            </main>
          </div>
          {navigating ? (
            <div className="route-loading-status" role="status" aria-live="polite">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : null}
          <LuviAssistant />
        </div>
      </LuviContextProvider>
    </AuthProvider>
  );
}
