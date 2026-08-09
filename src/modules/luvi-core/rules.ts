import { luviActions } from "./actions.ts";
import type { LuviContextSnapshot, LuviSuggestion } from "./types.ts";

function copy(context: LuviContextSnapshot, beauty: string, barber: string) {
  return context.product === "barber" ? barber : beauty;
}

export function evaluateLuviRules(context: LuviContextSnapshot): LuviSuggestion[] {
  const suggestions: LuviSuggestion[] = [];
  const { facts, pathname } = context;

  if (pathname === "/painel") {
    suggestions.push({
      id: "dashboard-today",
      title: copy(context, "Vamos preparar sua agenda?", "Vamos organizar os atendimentos?"),
      message:
        (facts.appointmentsToday ?? 0) === 0
          ? copy(context, "Sua agenda está livre hoje.", "Não há atendimentos marcados para hoje.")
          : copy(
              context,
              `Você tem ${facts.appointmentsToday ?? 0} atendimento(s) marcado(s) para hoje.`,
              `Hoje há ${facts.appointmentsToday ?? 0} atendimento(s) na agenda.`,
            ),
      priority: "informative",
      action: luviActions.agenda,
      dismissible: true,
    });
    if ((facts.lowStock ?? 0) > 0)
      suggestions.push({
        id: "dashboard-low-stock",
        title: "Estoque precisa de atenção",
        message: `${facts.lowStock} item(ns) estão abaixo do mínimo configurado.`,
        priority: "high",
        action: luviActions.stock,
        dismissible: true,
      });
  }

  if (pathname.startsWith("/painel/clientes"))
    suggestions.push({
      id: facts.clients === 0 ? "clients-empty" : "clients-help",
      title: facts.clients === 0 ? "Vamos cadastrar o primeiro cliente?" : "Clientes organizados",
      message:
        facts.clients === 0
          ? copy(
              context,
              "Eu acompanho você no primeiro cadastro.",
              "Comece cadastrando o primeiro cliente.",
            )
          : `${facts.clients} cliente(s) estão disponíveis nesta empresa.`,
      priority: facts.clients === 0 ? "high" : "informative",
      action: luviActions.clients,
      dismissible: true,
    });

  if (pathname.startsWith("/painel/servicos"))
    suggestions.push({
      id: facts.services === 0 ? "services-empty" : "services-help",
      title: facts.services === 0 ? "Cadastre seus serviços" : "Catálogo de serviços",
      message:
        facts.services === 0
          ? "Os serviços liberam o cálculo de horários e o agendamento."
          : `${facts.services} serviço(s) cadastrado(s); ${facts.inactiveServices ?? 0} inativo(s).`,
      priority: facts.services === 0 ? "high" : "informative",
      action: luviActions.services,
      dismissible: true,
    });

  if (pathname.startsWith("/painel/profissionais"))
    suggestions.push({
      id: "professionals-context",
      title:
        facts.professionals === 0 ? "Adicione quem realiza os atendimentos" : "Equipe cadastrada",
      message: `${facts.professionals ?? 0} profissional(is) disponível(is) nesta empresa.`,
      priority: facts.professionals === 0 ? "high" : "informative",
      action: luviActions.professionals,
      dismissible: true,
    });

  if (pathname.startsWith("/painel/agenda"))
    suggestions.push({
      id: "agenda-context",
      title: (facts.appointmentsToday ?? 0) === 0 ? "Sua agenda está livre" : "Agenda atualizada",
      message:
        (facts.appointmentsToday ?? 0) === 0
          ? "Você pode criar um atendimento ou compartilhar sua página pública."
          : `Há ${facts.appointmentsToday ?? 0} atendimento(s) no período exibido.`,
      priority: "informative",
      action: luviActions.newAppointment,
      dismissible: true,
    });

  if (pathname.startsWith("/painel/produtos") || pathname.startsWith("/painel/estoque"))
    suggestions.push({
      id: "stock-context",
      title: (facts.lowStock ?? 0) > 0 ? "Seu estoque precisa de atenção" : "Estoque acompanhado",
      message:
        (facts.lowStock ?? 0) > 0
          ? `${facts.lowStock} item(ns) estão no mínimo ou abaixo dele.`
          : "Não há alerta de estoque nos dados desta tela.",
      priority: (facts.lowStock ?? 0) > 0 ? "high" : "informative",
      action: luviActions.stock,
      dismissible: true,
    });

  if (pathname.startsWith("/painel/financeiro"))
    suggestions.push({
      id: "finance-context",
      title:
        facts.financialEntries === 0 ? "Comece seu controle financeiro" : "Financeiro atualizado",
      message:
        facts.financialEntries === 0
          ? "Suas entradas e despesas aparecerão aqui."
          : `${facts.financialEntries} lançamento(s) no período carregado.`,
      priority: facts.financialEntries === 0 ? "medium" : "informative",
      action: luviActions.finance,
      dismissible: true,
    });

  if (pathname.startsWith("/painel/pagina-publica"))
    suggestions.push({
      id: "public-page-context",
      title:
        (facts.publicPageMissingFields ?? 0) > 0 ? "Falta pouco para publicar" : "Página preparada",
      message:
        (facts.publicPageMissingFields ?? 0) > 0
          ? `${facts.publicPageMissingFields} informação(ões) essencial(is) ainda precisam ser preenchidas.`
          : "Os dados essenciais desta página estão preenchidos.",
      priority: (facts.publicPageMissingFields ?? 0) > 0 ? "high" : "informative",
      action: luviActions.publicPage,
      dismissible: true,
    });

  if (suggestions.length === 0)
    suggestions.push({
      id: "area-help",
      title: "Posso ajudar nesta área",
      message: copy(context, "Escolha um atalho para continuar.", "Use os atalhos para avançar."),
      priority: "informative",
      action: luviActions.dashboard,
      dismissible: true,
    });

  return [...suggestions]
    .sort((a, b) => priorityValue(b.priority) - priorityValue(a.priority))
    .slice(0, 3);
}

function priorityValue(priority: LuviSuggestion["priority"]) {
  return { critical: 4, high: 3, medium: 2, informative: 1 }[priority];
}
