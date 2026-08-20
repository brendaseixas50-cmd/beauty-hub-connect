import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  Headphones,
  Minus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { luviActions } from "@/modules/luvi-core/actions";
import { getLuviTheme } from "@/modules/luvi-core/config";
import { useLuvi } from "@/modules/luvi-core/context";
import { linkSuporteWhatsapp, nomeDaTela, nomeDoProduto } from "@/modules/luvi-core/suporte";
import type { LuviAction, LuviSuggestion } from "@/modules/luvi-core/types";

const quickActions = [
  luviActions.newAppointment,
  luviActions.clients,
  luviActions.services,
  luviActions.finance,
] as const;

const BUBBLE_SIZE = 64;
const MARGIN = 12;

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

interface Mensagem {
  id: string;
  autor: "luvi" | "voce";
  texto: string;
  action?: LuviAction;
}

/** Assistente flutuante: bolinha arrastável, cápsula e conversa completa. */
export function LuviAssistant() {
  const {
    theme,
    context,
    tenantName,
    suggestions,
    dismissed,
    assistantState,
    openAssistant,
    minimizeAssistant,
    hideAssistant,
    remember,
  } = useLuvi();
  const product = context.product;
  const tela = nomeDaTela(context.pathname);
  const [capsula, setCapsula] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const visiveis = suggestions.filter((item) => !dismissed.has(item.id));
  const suporte = linkSuporteWhatsapp({ product, tenantName, pathname: context.pathname });
  const boasVindas = useMemo(
    () =>
      product === "barber"
        ? `Fala, chefe! Eu sou a Luvi, assistente do ${nomeDoProduto(product)}. Você está em ${tela}. Me diga o que precisa resolver.`
        : `Oi! Eu sou a Luvi, assistente do ${nomeDoProduto(product)}. Você está em ${tela}. Como posso te ajudar agora?`,
    [product, tela],
  );

  useEffect(() => {
    if (assistantState !== "open") setCapsula(false);
  }, [assistantState]);

  function enviar(texto: string) {
    const valor = texto.trim();
    if (!valor) return;
    const resposta = answerGuidedQuestion(valor);
    setMensagens((atual) => [
      ...atual,
      { id: crypto.randomUUID(), autor: "voce", texto: valor },
      {
        id: crypto.randomUUID(),
        autor: "luvi",
        texto: resposta.message,
        ...(resposta.action ? { action: resposta.action } : {}),
      },
    ]);
    remember(valor);
    setPergunta("");
  }

  if (assistantState === "hidden") return null;

  if (assistantState !== "open") {
    return (
      <LuviBubble
        className={theme.className}
        capsula={capsula}
        onToque={() => (capsula ? openAssistant() : setCapsula(true))}
        onAbrir={openAssistant}
      />
    );
  }

  return (
    <div className={`${theme.className} luvi-chat`} role="dialog" aria-label="Conversa com a Luvi">
      <header className="luvi-chat-header">
        <LuviAvatar size="medium" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold leading-tight">Luvi</p>
          <p className="truncate text-xs text-muted-foreground">
            Assistente do {nomeDoProduto(product)}
          </p>
        </div>
        <button
          type="button"
          aria-label="Minimizar conversa"
          className="luvi-chat-icon"
          onClick={minimizeAssistant}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Fechar assistente"
          className="luvi-chat-icon"
          onClick={hideAssistant}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="luvi-chat-body">
        <div className="luvi-chat-msg luvi-chat-msg-luvi">{boasVindas}</div>

        {mensagens.map((mensagem) => (
          <div
            key={mensagem.id}
            className={`luvi-chat-msg ${
              mensagem.autor === "voce" ? "luvi-chat-msg-voce" : "luvi-chat-msg-luvi"
            }`}
          >
            {mensagem.texto}
            {mensagem.action ? (
              <div className="mt-2">
                <ActionLink action={mensagem.action} close={minimizeAssistant} />
              </div>
            ) : null}
          </div>
        ))}

        {visiveis.length ? (
          <section aria-label="Sugestões para esta tela" className="grid gap-2">
            {visiveis.slice(0, 2).map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                close={minimizeAssistant}
              />
            ))}
          </section>
        ) : null}

        {mensagens.length === 0 ? (
          <section aria-label="Sugestões rápidas" className="grid gap-2">
            <p className="text-eyebrow">Sugestões rápidas</p>
            <div className="flex flex-wrap gap-2">
              {["Como cadastro um cliente?", "Como abro a agenda?", "Como crio um serviço?"].map(
                (texto) => (
                  <button
                    key={texto}
                    type="button"
                    className="luvi-chip"
                    onClick={() => enviar(texto)}
                  >
                    {texto}
                  </button>
                ),
              )}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <ActionLink key={action.id} action={action} close={minimizeAssistant} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <form
        className="luvi-chat-footer"
        onSubmit={(event) => {
          event.preventDefault();
          enviar(pergunta);
        }}
      >
        <div className="flex gap-2">
          <Input
            aria-label="Digite uma dúvida"
            value={pergunta}
            onChange={(event) => setPergunta(event.currentTarget.value)}
            placeholder="Digite uma dúvida..."
            maxLength={180}
          />
          <Button type="submit" size="icon" disabled={!pergunta.trim()} aria-label="Enviar">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground"
            onClick={() => setMensagens([])}
          >
            <Trash2 className="h-3.5 w-3.5" /> Limpar conversa
          </button>
          {suporte ? (
            <a
              href={suporte}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-[var(--luvi-accent)]"
            >
              <Headphones className="h-3.5 w-3.5" /> Pedir suporte no WhatsApp
            </a>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function LuviBubble({
  className,
  capsula,
  onToque,
  onAbrir,
}: {
  className: string;
  capsula: boolean;
  onToque: () => void;
  onAbrir: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const arrastou = useRef(false);
  const inicio = useRef({ x: 0, y: 0, left: 0, top: 0 });
  const [posicao, setPosicao] = useState<{ left: number; top: number } | null>(null);

  const limitar = useCallback((left: number, top: number) => {
    const largura = ref.current?.offsetWidth ?? BUBBLE_SIZE;
    const altura = ref.current?.offsetHeight ?? BUBBLE_SIZE;
    return {
      left: Math.min(Math.max(left, MARGIN), Math.max(MARGIN, window.innerWidth - largura - MARGIN)),
      top: Math.min(Math.max(top, MARGIN), Math.max(MARGIN, window.innerHeight - altura - MARGIN)),
    };
  }, []);

  useLayoutEffect(() => {
    const salvo = lerPosicao();
    const largura = ref.current?.offsetWidth ?? BUBBLE_SIZE;
    const altura = ref.current?.offsetHeight ?? BUBBLE_SIZE;
    setPosicao(
      limitar(
        salvo?.left ?? window.innerWidth - largura - MARGIN * 2,
        salvo?.top ?? window.innerHeight - altura - MARGIN * 5,
      ),
    );
  }, [limitar]);

  // Mantém a bolinha inteira dentro da viewport ao girar a tela ou redimensionar.
  useEffect(() => {
    function ajustar() {
      setPosicao((atual) => (atual ? limitar(atual.left, atual.top) : atual));
    }
    window.addEventListener("resize", ajustar);
    window.addEventListener("orientationchange", ajustar);
    return () => {
      window.removeEventListener("resize", ajustar);
      window.removeEventListener("orientationchange", ajustar);
    };
  }, [limitar]);

  // Reposiciona quando a cápsula muda de largura.
  useEffect(() => {
    setPosicao((atual) => (atual ? limitar(atual.left, atual.top) : atual));
  }, [capsula, limitar]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!posicao) return;
    arrastou.current = false;
    inicio.current = { x: event.clientX, y: event.clientY, left: posicao.left, top: posicao.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const dx = event.clientX - inicio.current.x;
    const dy = event.clientY - inicio.current.y;
    if (!arrastou.current && Math.hypot(dx, dy) < 6) return;
    arrastou.current = true;
    setPosicao(limitar(inicio.current.left + dx, inicio.current.top + dy));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (arrastou.current) {
      if (posicao) gravarPosicao(posicao);
      return;
    }
    onToque();
  }

  return (
    <div
      ref={ref}
      className={`${className} luvi-bubble ${capsula ? "luvi-bubble-capsule" : ""}`}
      style={
        posicao ? { left: posicao.left, top: posicao.top, visibility: "visible" } : { left: -9999 }
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <button
        type="button"
        className="luvi-bubble-avatar"
        aria-label={capsula ? "Fale com a Luvi" : "Abrir assistente Luvi"}
        onClick={(event) => event.preventDefault()}
      >
        <LuviAvatar size="floating" />
      </button>
      {capsula ? (
        <button type="button" className="luvi-bubble-label" onClick={onAbrir}>
          Fale com a Luvi
        </button>
      ) : null}
    </div>
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

function LuviAvatar({ size }: { size: "small" | "medium" | "floating" }) {
  const { theme } = useLuvi();
  return (
    <span className={`luvi-avatar luvi-avatar-${size}`} aria-hidden="true">
      <img src={theme.faceAsset} alt="" />
      {size === "floating" ? <Sparkles className="luvi-status-star" /> : null}
    </span>
  );
}

function lerPosicao() {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem("luvi:posicao:v1");
    if (!bruto) return null;
    const valor = JSON.parse(bruto) as { left?: number; top?: number };
    if (typeof valor.left !== "number" || typeof valor.top !== "number") return null;
    return { left: valor.left, top: valor.top };
  } catch {
    return null;
  }
}

function gravarPosicao(posicao: { left: number; top: number }) {
  try {
    window.localStorage.setItem("luvi:posicao:v1", JSON.stringify(posicao));
  } catch {
    // Armazenamento indisponível: a posição vale apenas para esta navegação.
  }
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
  if (value.includes("serviço") || value.includes("servico") || value.includes("combo"))
    return {
      message: "Em Serviços você define nome, duração, preço, combos e disponibilidade.",
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
  if (value.includes("página") || value.includes("pagina") || value.includes("public"))
    return {
      message: "Na configuração da página pública você confere os dados antes de compartilhar.",
      action: luviActions.publicPage,
    };
  if (value.includes("horário") || value.includes("horario") || value.includes("configura"))
    return {
      message: "As informações do negócio e seus horários ficam nas configurações da empresa.",
      action: luviActions.company,
    };
  return {
    message:
      "Ainda não tenho uma resposta guiada para essa dúvida. Use os atalhos rápidos ou peça suporte no WhatsApp.",
  };
}
