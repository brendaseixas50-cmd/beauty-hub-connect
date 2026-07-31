import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  CalendarDays,
  Images,
  LayoutGrid,
  Megaphone,
  Menu,
  Package,
  Scissors,
  Settings,
  Users,
  UserCog,
  Wallet,
  ExternalLink,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TrocaTipo } from "@/components/troca-tipo";
import { useDemo, useNegocio } from "@/data/negocio";

export const Route = createFileRoute("/painel")({
  component: PainelLayout,
});

const itens = [
  { to: "/painel", label: "Visão geral", icon: LayoutGrid, exact: true },
  { to: "/painel/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/painel/servicos", label: "Serviços", icon: Scissors },
  { to: "/painel/profissionais", label: "Profissionais", icon: UserCog },
  { to: "/painel/clientes", label: "Clientes", icon: Users },
  { to: "/painel/galeria", label: "Galeria", icon: Images },
  { to: "/painel/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/painel/estoque", label: "Estoque", icon: Package },
  { to: "/painel/marketing", label: "Marketing", icon: Megaphone },
  { to: "/painel/configuracoes", label: "Configurações", icon: Settings },
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

function Marca() {
  const { estudio } = useDemo();
  const { rotulos } = useDemo();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src={estudio.fotoPerfil}
        alt={estudio.profissional}
        width={800}
        height={800}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{estudio.nome}</p>
        <p className="truncate text-xs text-muted-foreground">
          {estudio.profissional} · {rotulos.profissionalSingular}
        </p>
      </div>
    </div>
  );
}


function PainelLayout() {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar p-4 lg:flex">
        <Marca />
        <div className="mt-6 flex-1">
          <Navegacao />
        </div>
        <Button asChild variant="outline" size="sm" className="w-full rounded-full">
          <Link to="/">
            <ExternalLink className="h-3.5 w-3.5" /> Ver página pública
          </Link>
        </Button>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <Marca />
          <Sheet open={aberto} onOpenChange={setAberto}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Abrir menu">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-4">
              <SheetTitle className="sr-only">Menu do painel</SheetTitle>
              <div className="mt-6">
                <Navegacao onNavigate={() => setAberto(false)} />
              </div>
              <Button asChild variant="outline" size="sm" className="mt-4 w-full rounded-full">
                <Link to="/">
                  <ExternalLink className="h-3.5 w-3.5" /> Ver página pública
                </Link>
              </Button>
            </SheetContent>
          </Sheet>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
