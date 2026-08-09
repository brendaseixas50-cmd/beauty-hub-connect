import { Link } from "@tanstack/react-router";
import { ChevronRight, MessageCircle, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { luviActions } from "@/modules/luvi-core/actions";
import { getLuviTheme } from "@/modules/luvi-core/config";
import { useLuvi } from "@/modules/luvi-core/context";
import type { LuviAction, LuviSuggestion } from "@/modules/luvi-core/types";

const quickActions = [
  luviActions.newAppointment,
  luviActions.clients,
  luviActions.services,
  luviActions.finance,
  luviActions.settings,
] as const;

export function LuviWelcome({ product }: { product: "beauty" | "barber" }) {
  const theme = getLuviTheme(product);
  return (
    <Card
      className={`${theme.className} mb-6 flex-row items-center gap-4 border-[var(--luvi-border)] p-5`}
    >
      <span className="luvi-avatar luvi-avatar-medium" aria-hidden="true">
        <img src={theme.faceAsset} alt="" />
      </span>
      <div>
        <p className="font-display text-lg font-semibold">Olá! Eu sou a Luvi.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {product === "barber"
            ? "Vou ajudar você a preparar a gestão da barbearia. Você pode continuar depois."
            : "Vou ajudar você a configurar seu negócio. Você pode continuar depois."}
        </p>
      </div>
    </Card>
  );
}

export function LuviAssistant() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [guidedAnswer, setGuidedAnswer] = useState<{ message: string; action?: LuviAction }>();
  const { theme, suggestions, dismissed, history, clearHistory, remember } = useLuvi();
  const visible = suggestions.filter((item) => !dismissed.has(item.id));

  return (
    <div className={theme.className}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            size="icon"
            aria-label="Abrir assistente Luvi"
            className="luvi-floating-button"
          >
            <LuviAvatar size="floating" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="luvi-panel w-[min(92vw,25rem)] overflow-y-auto p-0 sm:max-w-md"
        >
          <SheetHeader className="luvi-panel-header pr-10 text-left">
            <div className="flex items-center gap-3">
              <LuviAvatar size="medium" />
              <div>
                <SheetTitle>Olá! Eu sou a Luvi.</SheetTitle>
                <SheetDescription>Assistente guiada · {theme.label}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="grid gap-6 p-5">
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const answer = answerGuidedQuestion(question);
                setGuidedAnswer(answer);
                rememberQuestion(question);
                setQuestion("");
              }}
            >
              <label htmlFor="luvi-question" className="text-sm font-medium">
                Como posso ajudar hoje?
              </label>
              <div className="flex gap-2">
                <Input
                  id="luvi-question"
                  value={question}
                  onChange={(event) => setQuestion(event.currentTarget.value)}
                  placeholder="Ex.: Como cadastro um cliente?"
                  maxLength={180}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!question.trim()}
                  aria-label="Enviar pergunta"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Resposta automática baseada nas funções do sistema.
              </p>
            </form>

            {guidedAnswer ? (
              <Card className="gap-3 border-[var(--luvi-border)] p-4" aria-live="polite">
                <p className="text-sm">{guidedAnswer.message}</p>
                {guidedAnswer.action ? (
                  <ActionLink action={guidedAnswer.action} close={() => setOpen(false)} />
                ) : null}
              </Card>
            ) : null}

            <section aria-labelledby="luvi-context-title">
              <p id="luvi-context-title" className="text-eyebrow">
                Contexto desta área
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Estou acompanhando esta tela e mostrando apenas informações disponíveis para a
                empresa ativa.
              </p>
              <div className="mt-3 grid gap-3">
                {visible.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    close={() => setOpen(false)}
                  />
                ))}
              </div>
            </section>

            <section aria-labelledby="luvi-actions-title">
              <p id="luvi-actions-title" className="text-eyebrow">
                Ações rápidas
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {quickActions.map((action) => (
                  <ActionLink key={action.id} action={action} close={() => setOpen(false)} />
                ))}
              </div>
            </section>

            <section aria-labelledby="luvi-help-title">
              <p id="luvi-help-title" className="text-eyebrow">
                Dúvidas frequentes
              </p>
              <div className="mt-3 grid gap-2 text-sm">
                <HelpItem label="Como uso esta área?" />
                <HelpItem label="Quais dados aparecem aqui?" />
                <HelpItem label="Como volto para a visão geral?" />
              </div>
            </section>

            <section aria-labelledby="luvi-history-title">
              <div className="flex items-center justify-between gap-3">
                <p id="luvi-history-title" className="text-eyebrow">
                  Histórico local
                </p>
                {history.length ? (
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Limpar
                  </button>
                ) : null}
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                {history.length ? (
                  history.map((item) => <p key={item.id}>{item.title}</p>)
                ) : (
                  <p>Nenhuma orientação aberta nesta sessão.</p>
                )}
              </div>
            </section>

            <div className="rounded-2xl border bg-muted/45 p-4 text-xs leading-relaxed text-muted-foreground">
              Modo guiado ativo. Nenhuma informação é enviada à OpenAI. A Luvi nunca grava ou exclui
              dados sem confirmação explícita.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );

  function rememberQuestion(value: string) {
    const normalized = value.trim();
    if (normalized) remember(normalized);
  }
}

export function LuviInlineSuggestion() {
  const { theme, suggestions, dismissed } = useLuvi();
  const suggestion = suggestions.find((item) => !dismissed.has(item.id));
  if (!suggestion) return null;
  return (
    <Card className={`${theme.className} luvi-inline-card mt-6 flex-row items-center gap-4 p-5`}>
      <LuviAvatar size="medium" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-semibold">{suggestion.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{suggestion.message}</p>
      </div>
      {suggestion.action ? <ActionLink action={suggestion.action} /> : null}
    </Card>
  );
}

export function LuviOnboardingProgress() {
  const { context, theme } = useLuvi();
  const steps = [
    context.facts.professionals === undefined ? undefined : context.facts.professionals > 0,
    context.facts.services === undefined ? undefined : context.facts.services > 0,
    context.facts.clients === undefined ? undefined : context.facts.clients > 0,
    context.facts.publicPageMissingFields === undefined
      ? undefined
      : context.facts.publicPageMissingFields === 0,
  ].filter((step): step is boolean => step !== undefined);
  if (steps.length === 0) return null;
  const complete = steps.filter(Boolean).length;
  return (
    <div className={`${theme.className} rounded-2xl border bg-card p-4`}>
      <div className="flex items-center gap-3">
        <LuviAvatar size="small" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Progresso com dados desta área</p>
          <p className="text-xs text-muted-foreground">
            {complete} de {steps.length} etapas identificadas
          </p>
        </div>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={complete}
      >
        <div
          className="h-full rounded-full bg-[var(--luvi-accent)] transition-[width] duration-200"
          style={{ width: `${(complete / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion, close }: { suggestion: LuviSuggestion; close: () => void }) {
  const { dismiss } = useLuvi();
  return (
    <Card className="relative gap-3 p-4">
      {suggestion.dismissible ? (
        <button
          type="button"
          aria-label="Dispensar orientação"
          onClick={() => dismiss(suggestion.id)}
          className="absolute right-3 top-3 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <div className="pr-6">
        <p className="font-semibold">{suggestion.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{suggestion.message}</p>
      </div>
      {suggestion.action ? <ActionLink action={suggestion.action} close={close} /> : null}
    </Card>
  );
}

function ActionLink({ action, close }: { action: LuviAction; close?: () => void }) {
  const { remember } = useLuvi();
  if (!action.to) return null;
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="h-auto min-h-10 justify-between whitespace-normal text-left"
    >
      <Link
        to={action.to}
        onClick={() => {
          remember(action.label);
          close?.();
        }}
      >
        {action.label} <ChevronRight className="h-4 w-4 shrink-0" />
      </Link>
    </Button>
  );
}

function HelpItem({ label }: { label: string }) {
  const { remember } = useLuvi();
  return (
    <button
      type="button"
      onClick={() => remember(label)}
      className="flex min-h-10 items-center justify-between rounded-xl border px-3 py-2 text-left hover:bg-muted/50"
    >
      <span className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-[var(--luvi-accent)]" /> {label}
      </span>
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

function LuviAvatar({ size }: { size: "small" | "medium" | "floating" }) {
  const { theme } = useLuvi();
  return (
    <span className={`luvi-avatar luvi-avatar-${size}`} aria-hidden="true">
      <img src={theme.faceAsset} alt="" />
      {size === "floating" ? <Sparkles className="luvi-status-star" /> : null}
    </span>
  );
}

function answerGuidedQuestion(question: string): { message: string; action?: LuviAction } {
  const value = question.trim().toLocaleLowerCase("pt-BR");
  if (value.includes("cliente"))
    return {
      message: "Abra Clientes e toque em Novo cliente. Posso levar você até lá.",
      action: luviActions.clients,
    };
  if (value.includes("agenda") || value.includes("agendamento"))
    return {
      message:
        "Na Agenda você consulta horários e cria atendimentos. Nenhuma alteração será feita sem sua confirmação.",
      action: luviActions.agenda,
    };
  if (value.includes("serviço"))
    return {
      message: "Em Serviços você define nome, duração, preço e disponibilidade.",
      action: luviActions.services,
    };
  if (value.includes("produto") || value.includes("estoque"))
    return {
      message: "Use Produtos para o cadastro e Estoque para registrar entradas ou saídas.",
      action: luviActions.stock,
    };
  if (value.includes("finance"))
    return {
      message: "A área Financeiro reúne entradas, despesas e os totais calculados pelo sistema.",
      action: luviActions.finance,
    };
  if (value.includes("página") || value.includes("public"))
    return {
      message: "Na configuração da página pública você confere os dados antes de compartilhar.",
      action: luviActions.publicPage,
    };
  if (value.includes("horário") || value.includes("configura"))
    return {
      message: "As informações do negócio e seus horários ficam nas configurações da empresa.",
      action: luviActions.company,
    };
  return {
    message:
      "Ainda não tenho uma resposta guiada para essa dúvida. Use os atalhos abaixo; a integração com IA permanece desativada.",
  };
}
