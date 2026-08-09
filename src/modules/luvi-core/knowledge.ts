import type { LuviProductId } from "@/modules/luvi-core/types";

export interface LuviHelpArticle {
  id: string;
  product: LuviProductId | "shared";
  title: string;
  category: string;
  content: string;
  keywords: readonly string[];
  status: "published" | "draft";
  updatedAt: string;
}

export const luviHelpArticles: readonly LuviHelpArticle[] = [
  {
    id: "clients-first",
    product: "shared",
    title: "Cadastrar o primeiro cliente",
    category: "clientes",
    content: "Abra Clientes, selecione Novo cliente e preencha os dados necessários.",
    keywords: ["cliente", "cadastro", "whatsapp"],
    status: "published",
    updatedAt: "2026-08-03",
  },
  {
    id: "appointment-create",
    product: "shared",
    title: "Criar um agendamento",
    category: "agenda",
    content: "Abra Agenda e selecione Novo agendamento. A gravação depende de confirmação.",
    keywords: ["agenda", "agendamento", "horário"],
    status: "published",
    updatedAt: "2026-08-03",
  },
  {
    id: "public-page-ready",
    product: "shared",
    title: "Preparar a página pública",
    category: "página pública",
    content: "Confira nome, descrição, WhatsApp, horários e serviços ativos antes de compartilhar.",
    keywords: ["página", "publicar", "slug"],
    status: "published",
    updatedAt: "2026-08-03",
  },
];
