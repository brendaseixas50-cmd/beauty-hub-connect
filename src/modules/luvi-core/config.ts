import luviFaceBarber from "@/modules/luvi-core/assets/luvi-face-barber.png";
import luviFaceDefault from "@/modules/luvi-core/assets/luvi-face-default.png";
import luviFullBarber from "@/modules/luvi-core/assets/luvi-full-barber.png";
import luviFullDefault from "@/modules/luvi-core/assets/luvi-full-default.png";
import type { LuviProductId, LuviTheme, LuviToolDefinition } from "@/modules/luvi-core/types";

const themes: Record<LuviProductId, LuviTheme> = {
  beauty: {
    product: "beauty",
    label: "LuBeauty Pro",
    className: "luvi-theme-beauty",
    faceAsset: luviFaceDefault,
    fullAsset: luviFullDefault,
    tone: "welcoming",
  },
  barber: {
    product: "barber",
    label: "LuBarber Pro",
    className: "luvi-theme-barber",
    faceAsset: luviFaceBarber,
    fullAsset: luviFullBarber,
    tone: "confident",
  },
  default: {
    product: "default",
    label: "Lu IA Studio",
    className: "luvi-theme-default",
    faceAsset: luviFaceDefault,
    fullAsset: luviFullDefault,
    tone: "welcoming",
  },
};

export function getLuviTheme(product: LuviProductId) {
  return themes[product] ?? themes.default;
}

export const luviToolRegistry: readonly LuviToolDefinition[] = [
  {
    id: "consultar_agenda",
    description: "Consultar agenda da empresa ativa",
    permission: "READ",
    enabled: true,
  },
  {
    id: "listar_agendamentos",
    description: "Listar agendamentos autorizados",
    permission: "READ",
    enabled: true,
  },
  {
    id: "consultar_cliente",
    description: "Consultar cliente autorizado",
    permission: "READ",
    enabled: false,
  },
  {
    id: "listar_servicos",
    description: "Listar serviços da empresa ativa",
    permission: "READ",
    enabled: true,
  },
  {
    id: "consultar_financeiro_resumido",
    description: "Consultar resumo financeiro",
    permission: "READ",
    enabled: true,
  },
  {
    id: "verificar_estoque",
    description: "Verificar itens abaixo do mínimo",
    permission: "READ",
    enabled: true,
  },
  {
    id: "criar_rascunho_agendamento",
    description: "Preparar agendamento sem gravar",
    permission: "DRAFT",
    enabled: false,
  },
  {
    id: "criar_rascunho_cliente",
    description: "Preparar cliente sem gravar",
    permission: "DRAFT",
    enabled: false,
  },
  {
    id: "abrir_tela",
    description: "Navegar para uma área autorizada",
    permission: "READ",
    enabled: true,
  },
  {
    id: "buscar_artigo_ajuda",
    description: "Buscar orientação local",
    permission: "READ",
    enabled: true,
  },
];

export const luviFutureAIConfig = {
  provider: "guided" as const,
  endpoint: "/api/luvi/chat",
  browserCallsProviderDirectly: false,
  openAIEnabled: false,
};
