import type { LuviAction, LuviRoute } from "./types.ts";

function navigate(id: string, label: string, to: LuviRoute): LuviAction {
  return { id, label, to, kind: "NAVIGATE", permission: "READ" };
}

export const luviActions = {
  dashboard: navigate("dashboard", "Ver visão geral", "/painel"),
  agenda: navigate("agenda", "Ver agenda", "/painel/agenda"),
  newAppointment: navigate("new-appointment", "Criar agendamento", "/painel/agenda"),
  clients: navigate("clients", "Abrir clientes", "/painel/clientes"),
  services: navigate("services", "Abrir serviços", "/painel/servicos"),
  professionals: navigate("professionals", "Abrir profissionais", "/painel/profissionais"),
  products: navigate("products", "Abrir produtos", "/painel/produtos"),
  stock: navigate("stock", "Ver estoque", "/painel/estoque"),
  finance: navigate("finance", "Abrir financeiro", "/painel/financeiro"),
  company: navigate("company", "Configurar negócio", "/painel/empresa"),
  settings: navigate("settings", "Abrir configurações", "/painel/configuracoes"),
  publicPage: navigate("public-page", "Configurar página", "/painel/pagina-publica"),
} as const;
