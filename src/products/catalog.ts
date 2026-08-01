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
    selo: "Beleza com gestão leve",
    assinatura: "Sua arte, sua agenda, seu crescimento.",
    descricao:
      "Uma experiência elegante e acolhedora para profissionais de beleza, estética e bem-estar.",
    estilo: "Rosé, areia e luz suave",
    destaque: "Organização delicada. Gestão profissional.",
    recursos: ["Agenda inteligente", "Página profissional", "Relacionamento com clientes"],
  },
  barbearia: {
    tipo: "barbearia",
    nome: "LuBarber",
    selo: "Gestão afiada para barbearias",
    assinatura: "Mais controle. Mais presença. Mais barbearia.",
    descricao:
      "Uma experiência forte e direta para barbeiros, equipes e barbearias que querem crescer.",
    estilo: "Grafite, cobre e madeira",
    destaque: "Operação precisa. Experiência marcante.",
    recursos: ["Agenda por barbeiro", "Fila e encaixes", "Combos e desempenho"],
  },
};

export function marcaDoProduto(tipo: TipoNegocio): MarcaProduto {
  return marcasProduto[tipo];
}
