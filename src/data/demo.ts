import banner from "@/assets/banner.jpg";
import profissional from "@/assets/profissional.jpg";
import trabalho1 from "@/assets/trabalho-1.jpg";
import trabalho2 from "@/assets/trabalho-2.jpg";
import trabalho3 from "@/assets/trabalho-3.jpg";
import trabalho4 from "@/assets/trabalho-4.jpg";

/**
 * Dados demonstrativos. Toda a plataforma lê deste "estúdio ativo".
 * Estrutura preparada para multiempresa: cada estúdio terá o seu próprio
 * registro e nenhum dado é compartilhado entre contas.
 */

export type FormatoAtendimento = "espaco" | "domicilio" | "ambos";
export type TipoTaxa = "fixa" | "combinar" | "sem";

export const estudio = {
  id: "estudio-lu-atelier",
  nome: "Atelier Lu Beauty",
  profissional: "Luana Ferreira",
  especialidade: "Nail Designer & Lash Designer",
  descricao:
    "Há 8 anos cuidando de mãos, olhares e da autoestima de mulheres em São Paulo. Atendimento individual, ambiente reservado e produtos premium — para você sair daqui se sentindo inteira.",
  fotoPerfil: profissional,
  banner,
  endereco: "Rua das Acácias, 240 — Vila Madalena, São Paulo/SP",
  regiao: "Vila Madalena, Pinheiros, Perdizes e Sumaré",
  instagram: "@atelier.lubeauty",
  whatsapp: "(11) 98877-2200",
  formatoAtendimento: "ambos" as FormatoAtendimento,
  domicilioAtivo: true,
  nomeLocal: "Atelier Lu Beauty — Studio Vila Madalena",
  regioesDomicilio: "Vila Madalena, Pinheiros, Perdizes, Sumaré e Alto de Pinheiros",
  observacoesDomicilio:
    "Atendimento em domicílio mediante agendamento com 48h de antecedência. É necessário um ponto de energia e uma mesa disponível.",
  diasDomicilio: ["Terça", "Quinta", "Sábado"],
  horarios: [
    { dia: "Segunda", horario: "Fechado" },
    { dia: "Terça", horario: "09h — 19h" },
    { dia: "Quarta", horario: "09h — 19h" },
    { dia: "Quinta", horario: "09h — 20h" },
    { dia: "Sexta", horario: "09h — 20h" },
    { dia: "Sábado", horario: "08h — 16h" },
    { dia: "Domingo", horario: "Fechado" },
  ],
  pagamentos: ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito"],
  politicas: [
    {
      titulo: "Cancelamento",
      texto:
        "Cancelamentos com até 24h de antecedência não têm custo. Após esse prazo, é cobrada uma taxa de 30% do valor do serviço.",
    },
    {
      titulo: "Atraso",
      texto:
        "Há tolerância de 15 minutos. Acima disso o atendimento poderá ser reduzido ou remarcado, conforme a agenda do dia.",
    },
    {
      titulo: "Remarcação",
      texto: "Cada horário pode ser remarcado uma vez, com no mínimo 24h de antecedência.",
    },
  ],
};

export type Servico = {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  duracao: string;
  precoLocal: number;
  precoDomicilio: number | null;
  mesmoPreco: boolean;
  cobrarTaxa: boolean;
  tipoTaxa: TipoTaxa;
  valorTaxa: number | null;
  formato: FormatoAtendimento;
  responsavel: string;
  disponivel: boolean;
  fotos: string[];
};

export const categorias = ["Unhas", "Cílios", "Sobrancelhas", "Estética"];

export const servicos: Servico[] = [
  {
    id: "alongamento-fibra",
    nome: "Alongamento em fibra de vidro",
    categoria: "Unhas",
    descricao:
      "Alongamento leve e resistente com acabamento natural. Inclui preparo da cunha, modelagem e esmaltação em gel da sua escolha.",
    duracao: "2h30",
    precoLocal: 220,
    precoDomicilio: 260,
    mesmoPreco: false,
    cobrarTaxa: true,
    tipoTaxa: "fixa",
    valorTaxa: 35,
    formato: "ambos",
    responsavel: "Luana Ferreira",
    disponivel: true,
    fotos: [trabalho1, trabalho4],
  },
  {
    id: "manutencao-gel",
    nome: "Manutenção de unhas em gel",
    categoria: "Unhas",
    descricao:
      "Manutenção do alongamento com refil de gel, correção de curvatura e nova esmaltação.",
    duracao: "1h45",
    precoLocal: 150,
    precoDomicilio: null,
    mesmoPreco: true,
    cobrarTaxa: true,
    tipoTaxa: "combinar",
    valorTaxa: null,
    formato: "ambos",
    responsavel: "Luana Ferreira",
    disponivel: true,
    fotos: [trabalho1],
  },
  {
    id: "volume-brasileiro",
    nome: "Extensão de cílios — Volume brasileiro",
    categoria: "Cílios",
    descricao:
      "Fios em Y aplicados fio a fio, resultado volumoso e leve. Inclui mapeamento personalizado do olhar.",
    duracao: "2h",
    precoLocal: 240,
    precoDomicilio: null,
    mesmoPreco: true,
    cobrarTaxa: false,
    tipoTaxa: "sem",
    valorTaxa: null,
    formato: "espaco",
    responsavel: "Luana Ferreira",
    disponivel: true,
    fotos: [trabalho2],
  },
  {
    id: "lash-lifting",
    nome: "Lash lifting com hidratação",
    categoria: "Cílios",
    descricao: "Curvatura dos fios naturais com nutrição em queratina. Duração média de 8 semanas.",
    duracao: "1h15",
    precoLocal: 160,
    precoDomicilio: 190,
    mesmoPreco: false,
    cobrarTaxa: false,
    tipoTaxa: "sem",
    valorTaxa: null,
    formato: "ambos",
    responsavel: "Luana Ferreira",
    disponivel: true,
    fotos: [trabalho2],
  },
  {
    id: "design-henna",
    nome: "Design de sobrancelhas com henna",
    categoria: "Sobrancelhas",
    descricao: "Visagismo, limpeza com pinça e coloração em henna respeitando o formato do rosto.",
    duracao: "50min",
    precoLocal: 90,
    precoDomicilio: null,
    mesmoPreco: true,
    cobrarTaxa: true,
    tipoTaxa: "fixa",
    valorTaxa: 25,
    formato: "ambos",
    responsavel: "Camila Duarte",
    disponivel: true,
    fotos: [trabalho3],
  },
  {
    id: "limpeza-profunda",
    nome: "Limpeza de pele profunda",
    categoria: "Estética",
    descricao: "Higienização, esfoliação, extração, alta frequência e máscara calmante.",
    duracao: "1h30",
    precoLocal: 190,
    precoDomicilio: null,
    mesmoPreco: true,
    cobrarTaxa: false,
    tipoTaxa: "sem",
    valorTaxa: null,
    formato: "espaco",
    responsavel: "Camila Duarte",
    disponivel: false,
    fotos: [trabalho4],
  },
];

export const galeria = [trabalho1, trabalho2, trabalho3, trabalho4, trabalho2, trabalho1];

export const avaliacoes = [
  {
    nome: "Marina Prado",
    nota: 5,
    data: "há 3 dias",
    texto: "A Lu é impecável. Ambiente calmo, unhas perfeitas e nunca atrasa. Já virei cliente fixa.",
  },
  {
    nome: "Juliana Reis",
    nota: 5,
    data: "há 1 semana",
    texto: "Fez meu lash lifting em casa e ficou lindo. Super caprichosa e pontual.",
  },
  {
    nome: "Beatriz Nogueira",
    nota: 4,
    data: "há 2 semanas",
    texto: "Adorei o design de sobrancelhas. Só achei o atelier um pouco cheio no sábado.",
  },
];

export const clientes = [
  {
    id: "c1",
    nome: "Marina Prado",
    telefone: "(11) 99123-4455",
    aniversario: "14/03",
    endereco: "Rua Harmonia, 88 — Vila Madalena",
    ultimo: "18/07/2026",
    proximo: "01/08/2026 às 10h",
    historico: 12,
    observacoes: "Prefere tons nude. Alergia a acetona.",
  },
  {
    id: "c2",
    nome: "Juliana Reis",
    telefone: "(11) 98444-1010",
    aniversario: "02/09",
    endereco: "Rua Fradique Coutinho, 512 — Pinheiros",
    ultimo: "24/07/2026",
    proximo: "—",
    historico: 6,
    observacoes: "Atende em domicílio. Portaria pede documento.",
  },
  {
    id: "c3",
    nome: "Beatriz Nogueira",
    telefone: "(11) 97777-3322",
    aniversario: "27/11",
    endereco: "Av. Sumaré, 1200 — Sumaré",
    ultimo: "12/07/2026",
    proximo: "03/08/2026 às 15h",
    historico: 4,
    observacoes: "Gosta de sobrancelha bem natural.",
  },
  {
    id: "c4",
    nome: "Patrícia Lemos",
    telefone: "(11) 96555-8899",
    aniversario: "05/01",
    endereco: "Rua Cardeal Arcoverde, 300 — Pinheiros",
    ultimo: "29/07/2026",
    proximo: "12/08/2026 às 09h",
    historico: 19,
    observacoes: "Sempre agenda manutenção a cada 21 dias.",
  },
];

export const agendamentosHoje = [
  { hora: "09:00", cliente: "Patrícia Lemos", servico: "Manutenção de unhas em gel", formato: "No espaço", status: "Confirmado" },
  { hora: "11:00", cliente: "Marina Prado", servico: "Alongamento em fibra de vidro", formato: "No espaço", status: "Confirmado" },
  { hora: "14:30", cliente: "Juliana Reis", servico: "Lash lifting com hidratação", formato: "Em domicílio", status: "Aguardando análise" },
  { hora: "17:00", cliente: "Beatriz Nogueira", servico: "Design de sobrancelhas com henna", formato: "No espaço", status: "Confirmado" },
];

export const proximosAtendimentos = [
  { data: "Amanhã", hora: "10:00", cliente: "Camila Souza", servico: "Volume brasileiro" },
  { data: "02/08", hora: "13:00", cliente: "Renata Alves", servico: "Limpeza de pele profunda" },
  { data: "03/08", hora: "15:00", cliente: "Beatriz Nogueira", servico: "Design com henna" },
];

export const horariosDisponiveis = ["09:00", "10:30", "13:00", "14:30", "16:00", "17:30", "19:00"];

export const financeiro = {
  mes: 12480,
  semana: 3120,
  ticket: 178,
  aReceber: 940,
  lancamentos: [
    { data: "30/07", cliente: "Patrícia Lemos", servico: "Manutenção em gel", forma: "Pix", valor: 150 },
    { data: "29/07", cliente: "Marina Prado", servico: "Alongamento em fibra", forma: "Crédito", valor: 220 },
    { data: "28/07", cliente: "Juliana Reis", servico: "Lash lifting + deslocamento", forma: "Pix", valor: 225 },
    { data: "27/07", cliente: "Beatriz Nogueira", servico: "Design com henna", forma: "Débito", valor: 90 },
  ],
};

export const estoque = [
  { item: "Gel construtor nude", categoria: "Unhas", quantidade: 4, minimo: 3, status: "Ok" },
  { item: "Fibra de vidro", categoria: "Unhas", quantidade: 1, minimo: 2, status: "Baixo" },
  { item: "Cola para cílios", categoria: "Cílios", quantidade: 2, minimo: 2, status: "Atenção" },
  { item: "Henna castanho médio", categoria: "Sobrancelhas", quantidade: 6, minimo: 2, status: "Ok" },
  { item: "Máscara calmante", categoria: "Estética", quantidade: 0, minimo: 1, status: "Esgotado" },
];

export const campanhas = [
  { nome: "Indique uma amiga", publico: "Clientes fixas", status: "Ativa", retorno: "8 novas clientes" },
  { nome: "Aniversariantes de agosto", publico: "12 clientes", status: "Programada", retorno: "—" },
  { nome: "Reativação 60 dias", publico: "23 clientes", status: "Rascunho", retorno: "—" },
];

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
