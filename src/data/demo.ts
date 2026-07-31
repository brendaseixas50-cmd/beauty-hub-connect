import banner from "@/assets/banner.jpg";
import profissional from "@/assets/profissional.jpg";
import trabalho1 from "@/assets/trabalho-1.jpg";
import trabalho2 from "@/assets/trabalho-2.jpg";
import trabalho3 from "@/assets/trabalho-3.jpg";
import trabalho4 from "@/assets/trabalho-4.jpg";
import type { DadosNegocio, Estudio, Servico } from "./tipos";

export type { FormatoAtendimento, TipoTaxa, Servico, Estudio, DadosNegocio } from "./tipos";

/**
 * Dados demonstrativos da experiência BELEZA.
 * Estrutura preparada para multiempresa: cada estúdio tem o seu próprio
 * registro e nenhum dado é compartilhado entre contas.
 */

export const estudio: Estudio = {
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
  formatoAtendimento: "ambos",
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
    texto:
      "A Lu é impecável. Ambiente calmo, unhas perfeitas e nunca atrasa. Já virei cliente fixa.",
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
  {
    hora: "09:00",
    cliente: "Patrícia Lemos",
    servico: "Manutenção de unhas em gel",
    formato: "No espaço",
    status: "Confirmado",
    profissional: "Luana Ferreira",
  },
  {
    hora: "11:00",
    cliente: "Marina Prado",
    servico: "Alongamento em fibra de vidro",
    formato: "No espaço",
    status: "Confirmado",
    profissional: "Luana Ferreira",
  },
  {
    hora: "14:30",
    cliente: "Juliana Reis",
    servico: "Lash lifting com hidratação",
    formato: "Em domicílio",
    status: "Aguardando análise",
    profissional: "Luana Ferreira",
  },
  {
    hora: "17:00",
    cliente: "Beatriz Nogueira",
    servico: "Design de sobrancelhas com henna",
    formato: "No espaço",
    status: "Confirmado",
    profissional: "Camila Duarte",
  },
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
    {
      data: "30/07",
      cliente: "Patrícia Lemos",
      servico: "Manutenção em gel",
      forma: "Pix",
      valor: 150,
    },
    {
      data: "29/07",
      cliente: "Marina Prado",
      servico: "Alongamento em fibra",
      forma: "Crédito",
      valor: 220,
    },
    {
      data: "28/07",
      cliente: "Juliana Reis",
      servico: "Lash lifting + deslocamento",
      forma: "Pix",
      valor: 225,
    },
    {
      data: "27/07",
      cliente: "Beatriz Nogueira",
      servico: "Design com henna",
      forma: "Débito",
      valor: 90,
    },
  ],
};

export const estoque = [
  { item: "Gel construtor nude", categoria: "Unhas", quantidade: 4, minimo: 3, status: "Ok" },
  { item: "Fibra de vidro", categoria: "Unhas", quantidade: 1, minimo: 2, status: "Baixo" },
  { item: "Cola para cílios", categoria: "Cílios", quantidade: 2, minimo: 2, status: "Atenção" },
  {
    item: "Henna castanho médio",
    categoria: "Sobrancelhas",
    quantidade: 6,
    minimo: 2,
    status: "Ok",
  },
  { item: "Máscara calmante", categoria: "Estética", quantidade: 0, minimo: 1, status: "Esgotado" },
];

export const campanhas = [
  {
    nome: "Indique uma amiga",
    publico: "Clientes fixas",
    status: "Ativa",
    retorno: "8 novas clientes",
  },
  { nome: "Aniversariantes de agosto", publico: "12 clientes", status: "Programada", retorno: "—" },
  { nome: "Reativação 60 dias", publico: "23 clientes", status: "Rascunho", retorno: "—" },
];

const semana = [
  { dia: "Seg 28", itens: [] as string[] },
  { dia: "Ter 29", itens: ["09:00 Patrícia", "14:00 Renata"] },
  { dia: "Qua 30", itens: ["10:30 Marina"] },
  { dia: "Qui 31", itens: ["09:00 Patrícia", "11:00 Marina", "14:30 Juliana", "17:00 Beatriz"] },
  { dia: "Sex 01", itens: ["10:00 Camila"] },
  { dia: "Sáb 02", itens: ["08:30 Renata", "13:00 Ana"] },
  { dia: "Dom 03", itens: [] },
];

const profissionais: DadosNegocio["profissionais"] = [
  {
    id: "e1",
    nome: "Luana Ferreira",
    funcao: "Nail & lash designer · proprietária",
    foto: profissional,
    especialidades: ["Fibra de vidro", "Volume brasileiro", "Lash lifting"],
    comissao: 100,
    atendimentosMes: 96,
    faturamento: 9120,
    agendaHoje: ["09:00 Patrícia", "11:00 Marina", "14:30 Juliana"],
  },
  {
    id: "e2",
    nome: "Camila Duarte",
    funcao: "Designer de sobrancelhas & esteticista",
    foto: trabalho3,
    especialidades: ["Henna", "Limpeza de pele", "Depilação"],
    comissao: 45,
    atendimentosMes: 52,
    faturamento: 4360,
    agendaHoje: ["17:00 Beatriz"],
  },
];

export const dadosBeleza: DadosNegocio = {
  estudio,
  servicos,
  categorias,
  galeria,
  avaliacoes,
  clientes,
  agendamentosHoje,
  proximosAtendimentos,
  horariosDisponiveis,
  semana,
  financeiro,
  estoque,
  campanhas,
  profissionais,
  fila: [
    {
      cliente: "Renata Alves",
      servico: "Esmaltação em gel",
      espera: "10 min",
      profissional: "Qualquer disponível",
    },
    {
      cliente: "Ana Beatriz",
      servico: "Design de sobrancelhas",
      espera: "25 min",
      profissional: "Camila Duarte",
    },
  ],
  encaixes: [
    {
      cliente: "Camila Souza",
      servico: "Manutenção em gel",
      horario: "16:00",
      status: "Aguardando",
    },
  ],
  combos: [
    {
      nome: "Dia de cuidado",
      itens: ["Manutenção em gel", "Design com henna"],
      preco: 225,
      duracao: "2h30",
    },
    {
      nome: "Olhar completo",
      itens: ["Lash lifting", "Design de sobrancelhas"],
      preco: 230,
      duracao: "2h",
    },
  ],
  assinaturas: [
    {
      nome: "Clube Mãos Sempre Prontas",
      preco: 260,
      beneficios: ["2 manutenções por mês", "Agenda prioritária", "10% em esmaltes"],
      assinantes: 14,
    },
  ],
  fidelidade: {
    regra: "A cada 8 atendimentos, o próximo esmalte em gel é cortesia.",
    clientes: [
      { nome: "Patrícia Lemos", selos: 7, meta: 8 },
      { nome: "Marina Prado", selos: 5, meta: 8 },
    ],
  },
  produtos: [
    { nome: "Óleo para cutículas", preco: 42, estoque: 8, vendidos: 12 },
    { nome: "Sérum para cílios", preco: 89, estoque: 4, vendidos: 9 },
  ],
  saudacao: {
    eyebrow: "Sexta-feira, 31 de julho",
    titulo: "Olá, Luana",
    subtitulo: "Aqui está o resumo do seu dia.",
  },
  servicoTop: { nome: "Fibra de vidro", detalhe: "38% dos agendamentos" },
  rotulos: {
    clientes: "Clientes cadastradas",
    profissionais: "Profissionais",
    profissionalSingular: "Profissional",
    equipeEyebrow: "Equipe",
  },
};

/** Áreas de atuação da experiência Beleza — mudam apenas exemplos e textos. */
export type AreaBeleza =
  | "unhas"
  | "cabelos"
  | "cilios"
  | "estetica"
  | "massoterapia"
  | "depilacao"
  | "maquiagem"
  | "outra";

export const areasBeleza: { id: AreaBeleza; label: string }[] = [
  { id: "unhas", label: "Unhas" },
  { id: "cabelos", label: "Cabelos" },
  { id: "cilios", label: "Cílios e sobrancelhas" },
  { id: "estetica", label: "Estética" },
  { id: "massoterapia", label: "Massoterapia" },
  { id: "depilacao", label: "Depilação" },
  { id: "maquiagem", label: "Maquiagem" },
  { id: "outra", label: "Outra área de beleza" },
];

const s = (v: Partial<Servico> & { id: string; nome: string; categoria: string }): Servico => ({
  descricao: "",
  duracao: "1h",
  precoLocal: 120,
  precoDomicilio: null,
  mesmoPreco: true,
  cobrarTaxa: false,
  tipoTaxa: "sem",
  valorTaxa: null,
  formato: "ambos",
  responsavel: "Luana Ferreira",
  disponivel: true,
  fotos: [trabalho1],
  ...v,
});

const porArea: Record<
  AreaBeleza,
  { especialidade: string; categorias: string[]; servicos: Servico[] } | null
> = {
  unhas: null,
  cabelos: {
    especialidade: "Hair Stylist & Colorista",
    categorias: ["Cortes", "Coloração", "Tratamentos"],
    servicos: [
      s({
        id: "corte-feminino",
        nome: "Corte feminino com finalização",
        categoria: "Cortes",
        duracao: "1h15",
        precoLocal: 140,
        descricao: "Corte personalizado com visagismo e escova de finalização.",
        fotos: [trabalho3],
      }),
      s({
        id: "coloracao-raiz",
        nome: "Coloração de raiz",
        categoria: "Coloração",
        duracao: "1h30",
        precoLocal: 180,
        descricao: "Cobertura de brancos com coloração profissional e matização.",
      }),
      s({
        id: "mechas",
        nome: "Mechas iluminadas",
        categoria: "Coloração",
        duracao: "3h",
        precoLocal: 420,
        descricao: "Iluminação natural com técnica de papel e tonalização.",
        fotos: [trabalho2],
      }),
      s({
        id: "cronograma",
        nome: "Cronograma capilar",
        categoria: "Tratamentos",
        duracao: "1h",
        precoLocal: 160,
        descricao: "Hidratação, nutrição e reconstrução conforme diagnóstico do fio.",
        fotos: [trabalho4],
      }),
    ],
  },
  cilios: {
    especialidade: "Lash & Brow Designer",
    categorias: ["Cílios", "Sobrancelhas"],
    servicos: [
      s({
        id: "volume-russo",
        nome: "Volume russo",
        categoria: "Cílios",
        duracao: "2h30",
        precoLocal: 280,
        descricao: "Fios ultrafinos em leques, olhar marcante e leve.",
        fotos: [trabalho2],
      }),
      s({
        id: "fio-a-fio",
        nome: "Extensão fio a fio clássica",
        categoria: "Cílios",
        duracao: "1h45",
        precoLocal: 200,
        descricao: "Um fio para cada cílio natural, resultado discreto.",
      }),
      s({
        id: "brow-lamination",
        nome: "Brow lamination",
        categoria: "Sobrancelhas",
        duracao: "1h",
        precoLocal: 170,
        descricao: "Alinhamento dos fios com efeito preenchido.",
        fotos: [trabalho3],
      }),
      s({
        id: "design-simples",
        nome: "Design de sobrancelhas",
        categoria: "Sobrancelhas",
        duracao: "40min",
        precoLocal: 70,
        descricao: "Limpeza com pinça e visagismo do formato.",
      }),
    ],
  },
  estetica: {
    especialidade: "Esteticista facial e corporal",
    categorias: ["Facial", "Corporal"],
    servicos: [
      s({
        id: "limpeza-pele",
        nome: "Limpeza de pele profunda",
        categoria: "Facial",
        duracao: "1h30",
        precoLocal: 190,
        descricao: "Higienização, extração, alta frequência e máscara calmante.",
        fotos: [trabalho4],
      }),
      s({
        id: "peeling",
        nome: "Peeling de diamante",
        categoria: "Facial",
        duracao: "1h",
        precoLocal: 210,
        descricao: "Renovação celular com ponteira de diamante e ativos.",
      }),
      s({
        id: "drenagem",
        nome: "Drenagem linfática",
        categoria: "Corporal",
        duracao: "1h",
        precoLocal: 160,
        descricao: "Manobras manuais para reduzir retenção e inchaço.",
      }),
      s({
        id: "massagem-modeladora",
        nome: "Massagem modeladora",
        categoria: "Corporal",
        duracao: "1h",
        precoLocal: 170,
        descricao: "Modelagem corporal com movimentos vigorosos.",
      }),
    ],
  },
  massoterapia: {
    especialidade: "Massoterapeuta",
    categorias: ["Relaxamento", "Terapêutica"],
    servicos: [
      s({
        id: "relaxante",
        nome: "Massagem relaxante",
        categoria: "Relaxamento",
        duracao: "1h",
        precoLocal: 170,
        descricao: "Toque suave com óleos essenciais para aliviar o estresse.",
        fotos: [trabalho4],
      }),
      s({
        id: "pedras-quentes",
        nome: "Pedras quentes",
        categoria: "Relaxamento",
        duracao: "1h15",
        precoLocal: 210,
        descricao: "Termoterapia com pedras vulcânicas e aromaterapia.",
      }),
      s({
        id: "desportiva",
        nome: "Massagem desportiva",
        categoria: "Terapêutica",
        duracao: "1h",
        precoLocal: 190,
        descricao: "Liberação muscular profunda para quem treina.",
      }),
      s({
        id: "liberacao-miofascial",
        nome: "Liberação miofascial",
        categoria: "Terapêutica",
        duracao: "50min",
        precoLocal: 180,
        descricao: "Alívio de pontos de tensão e dores posturais.",
      }),
    ],
  },
  depilacao: {
    especialidade: "Especialista em depilação",
    categorias: ["Cera", "Laser"],
    servicos: [
      s({
        id: "virilha-completa",
        nome: "Virilha completa",
        categoria: "Cera",
        duracao: "40min",
        precoLocal: 90,
        descricao: "Cera quente com pós-depilatório calmante.",
      }),
      s({
        id: "pernas-inteiras",
        nome: "Pernas inteiras",
        categoria: "Cera",
        duracao: "50min",
        precoLocal: 110,
        descricao: "Depilação completa com cera de mel.",
      }),
      s({
        id: "axilas",
        nome: "Axilas",
        categoria: "Cera",
        duracao: "20min",
        precoLocal: 45,
        descricao: "Rápida, com aplicação de gel calmante.",
      }),
      s({
        id: "laser-axila",
        nome: "Laser — axilas (sessão)",
        categoria: "Laser",
        duracao: "30min",
        precoLocal: 160,
        descricao: "Sessão de laser de diodo com resfriamento.",
        formato: "espaco",
        fotos: [trabalho4],
      }),
    ],
  },
  maquiagem: {
    especialidade: "Maquiadora profissional",
    categorias: ["Social", "Noiva"],
    servicos: [
      s({
        id: "maquiagem-social",
        nome: "Maquiagem social",
        categoria: "Social",
        duracao: "1h",
        precoLocal: 180,
        descricao: "Pele natural e olhar marcante para festas e eventos.",
        fotos: [trabalho3],
      }),
      s({
        id: "maquiagem-noiva",
        nome: "Maquiagem de noiva",
        categoria: "Noiva",
        duracao: "2h",
        precoLocal: 650,
        descricao: "Inclui teste prévio, longa duração e retoque.",
      }),
      s({
        id: "madrinha",
        nome: "Madrinhas e formandas",
        categoria: "Social",
        duracao: "1h15",
        precoLocal: 260,
        descricao: "Maquiagem à prova de fotos com cílios inclusos.",
      }),
      s({
        id: "aula-automaquiagem",
        nome: "Aula de automaquiagem",
        categoria: "Social",
        duracao: "1h30",
        precoLocal: 320,
        descricao: "Aula individual com análise do rosto e lista de produtos.",
      }),
    ],
  },
  outra: null,
};

/** Retorna os dados de beleza ajustados à área de atuação escolhida. */
export function dadosBelezaPorArea(area: AreaBeleza | null): DadosNegocio {
  const variante = area ? porArea[area] : null;
  if (!variante) return dadosBeleza;
  return {
    ...dadosBeleza,
    estudio: { ...dadosBeleza.estudio, especialidade: variante.especialidade },
    categorias: variante.categorias,
    servicos: variante.servicos,
    servicoTop: {
      nome: variante.servicos[0]?.nome ?? dadosBeleza.servicoTop.nome,
      detalhe: "36% dos agendamentos",
    },
  };
}

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
