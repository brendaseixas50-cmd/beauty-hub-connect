export type FormatoAtendimento = "espaco" | "domicilio" | "ambos";
export type TipoTaxa = "fixa" | "combinar" | "sem";

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

export type Estudio = {
  id: string;
  nome: string;
  profissional: string;
  especialidade: string;
  descricao: string;
  fotoPerfil: string;
  banner: string;
  endereco: string;
  regiao: string;
  instagram: string;
  whatsapp: string;
  formatoAtendimento: FormatoAtendimento;
  domicilioAtivo: boolean;
  nomeLocal: string;
  regioesDomicilio: string;
  observacoesDomicilio: string;
  diasDomicilio: string[];
  horarios: { dia: string; horario: string }[];
  pagamentos: string[];
  politicas: { titulo: string; texto: string }[];
};

export type Profissional = {
  id: string;
  nome: string;
  funcao: string;
  foto: string;
  especialidades: string[];
  comissao: number;
  atendimentosMes: number;
  faturamento: number;
  agendaHoje: string[];
};

export type DadosNegocio = {
  estudio: Estudio;
  servicos: Servico[];
  categorias: string[];
  galeria: string[];
  avaliacoes: { nome: string; nota: number; data: string; texto: string }[];
  clientes: {
    id: string;
    nome: string;
    telefone: string;
    aniversario: string;
    endereco: string;
    ultimo: string;
    proximo: string;
    historico: number;
    observacoes: string;
  }[];
  agendamentosHoje: {
    hora: string;
    cliente: string;
    servico: string;
    formato: string;
    status: string;
    profissional: string;
  }[];
  proximosAtendimentos: { data: string; hora: string; cliente: string; servico: string }[];
  horariosDisponiveis: string[];
  semana: { dia: string; itens: string[] }[];
  financeiro: {
    mes: number;
    semana: number;
    ticket: number;
    aReceber: number;
    lancamentos: {
      data: string;
      cliente: string;
      servico: string;
      forma: string;
      valor: number;
    }[];
  };
  estoque: {
    item: string;
    categoria: string;
    quantidade: number;
    minimo: number;
    status: string;
  }[];
  campanhas: { nome: string; publico: string; status: string; retorno: string }[];
  profissionais: Profissional[];
  fila: { cliente: string; servico: string; espera: string; profissional: string }[];
  encaixes: { cliente: string; servico: string; horario: string; status: string }[];
  combos: { nome: string; itens: string[]; preco: number; duracao: string }[];
  assinaturas: { nome: string; preco: number; beneficios: string[]; assinantes: number }[];
  fidelidade: { regra: string; clientes: { nome: string; selos: number; meta: number }[] };
  produtos: { nome: string; preco: number; estoque: number; vendidos: number }[];
  saudacao: { titulo: string; subtitulo: string; eyebrow: string };
  servicoTop: { nome: string; detalhe: string };
  rotulos: {
    clientes: string;
    profissionais: string;
    profissionalSingular: string;
    equipeEyebrow: string;
  };
};
