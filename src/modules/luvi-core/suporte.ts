import { whatsappDigits } from "@/lib/telefone";
import type { LuviProductId } from "@/modules/luvi-core/types";

/** WhatsApp oficial de suporte do Lu IA Studio (configurável por ambiente). */
const suporteWhatsapp = (import.meta.env["VITE_SUPORTE_WHATSAPP"] as string | undefined) ?? "";

const telas: Record<string, string> = {
  "/painel": "Visão Geral",
  "/painel/empresa": "Empresa",
  "/painel/agenda": "Agenda",
  "/painel/servicos": "Serviços",
  "/painel/profissionais": "Profissionais",
  "/painel/clientes": "Clientes",
  "/painel/marketing": "Marketing",
  "/painel/produtos": "Produtos",
  "/painel/financeiro": "Financeiro",
  "/painel/estoque": "Estoque",
  "/painel/relatorios": "Relatórios",
  "/painel/configuracoes": "Configurações",
  "/painel/pagina-publica": "Página Pública",
  "/painel/admin-acessos": "Painel Master",
};

/** Nome amigável da tela atual, usado no contexto e no pedido de suporte. */
export function nomeDaTela(pathname: string) {
  const exato = telas[pathname];
  if (exato) return exato;
  const parcial = Object.keys(telas)
    .filter((rota) => rota !== "/painel" && pathname.startsWith(rota))
    .sort((a, b) => b.length - a.length)[0];
  return parcial ? telas[parcial]! : "Painel";
}

export function nomeDoProduto(product: LuviProductId) {
  return product === "barber" ? "LuBarber" : "LuBeauty";
}

export function suporteConfigurado() {
  return whatsappDigits(suporteWhatsapp).length >= 12;
}

/** Link de suporte humano com produto, negócio e tela atual — sem dados sensíveis. */
export function linkSuporteWhatsapp(input: {
  product: LuviProductId;
  tenantName: string;
  pathname: string;
}) {
  const digits = whatsappDigits(suporteWhatsapp);
  if (!digits) return null;
  const mensagem = [
    `Olá! Preciso de ajuda com o ${nomeDoProduto(input.product)}.`,
    `Negócio: ${input.tenantName}`,
    `Tela: ${nomeDaTela(input.pathname)}`,
  ].join("\n");
  return `https://wa.me/${digits}?text=${encodeURIComponent(mensagem)}`;
}
