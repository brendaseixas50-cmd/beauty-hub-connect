export type TipoNegocio = "beleza" | "barbearia";

export type MarcaProduto = {
  tipo: TipoNegocio;
  nome: "LuBeauty" | "LuBarber";
  selo: string;
  assinatura: string;
  descricao: string;
  estilo: string;
  destaque: string;
  recursos: readonly string[];
};

export const marcasProduto: Record<TipoNegocio, MarcaProduto> = {
  beleza: {
    tipo: "beleza",
    nome: "LuBeauty",
    selo: "Sistema de gestão premium",
    assinatura: "O sistema que organiza e faz seu negócio crescer.",
    descricao:
      "Uma experiência elegante e acolhedora para profissionais de beleza, estética e bem-estar.",
    estilo: "Elegância, tecnologia e crescimento",
    destaque: "Organização profissional para crescer.",
    recursos: ["Agenda e clientes", "Financeiro e estoque", "Gestão completa do negócio"],
  },
  barbearia: {
    tipo: "barbearia",
    nome: "LuBarber",
    selo: "Sistema de gestão premium",
    assinatura: "Sistema inteligente para barbeiros que querem crescer.",
    descricao:
      "Uma experiência forte e direta para barbeiros, equipes e barbearias que querem crescer.",
    estilo: "Confiança, tecnologia e profissionalismo",
    destaque: "Controle total da sua barbearia.",
    recursos: ["Agenda e equipe", "Financeiro e estoque", "Gestão completa da barbearia"],
  },
};

export function marcaDoProduto(tipo: TipoNegocio): MarcaProduto {
  return marcasProduto[tipo];
}
