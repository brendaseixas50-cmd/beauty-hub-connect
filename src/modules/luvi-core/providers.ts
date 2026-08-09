import { evaluateLuviRules } from "@/modules/luvi-core/rules";
import type { LuviContextSnapshot, LuviProvider, LuviSuggestion } from "@/modules/luvi-core/types";

export class RuleBasedLuviProvider implements LuviProvider {
  readonly id = "guided" as const;
  async getSuggestions(context: LuviContextSnapshot) {
    return evaluateLuviRules(context);
  }
}

export class FutureOpenAIProvider implements LuviProvider {
  readonly id = "openai" as const;
  async getSuggestions(_context: LuviContextSnapshot): Promise<LuviSuggestion[]> {
    throw new Error("O provedor OpenAI da Luvi ainda não está habilitado.");
  }
}

export class SafeFallbackLuviProvider implements LuviProvider {
  readonly id = "unavailable" as const;
  async getSuggestions(_context: LuviContextSnapshot): Promise<LuviSuggestion[]> {
    return [
      {
        id: "safe-fallback",
        title: "Ainda posso ajudar",
        message: "Não consegui carregar as orientações agora, mas o painel continua disponível.",
        priority: "informative",
        dismissible: false,
      },
    ];
  }
}
