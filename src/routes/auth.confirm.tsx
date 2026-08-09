import { createFileRoute, redirect } from "@tanstack/react-router";
import { BrandCredit } from "@/components/brand-experience";

import { confirmAuth, ensureOAuthProductCompany } from "@/modules/auth/server";

const otpTypes = new Set(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

type ConfirmSearch = {
  code: string | undefined;
  tokenHash: string | undefined;
  type: "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email" | undefined;
  next: "/painel" | "/onboarding" | "/redefinir-senha";
  errorDescription: string | undefined;
  produto: "beauty" | "barber" | undefined;
};

export const Route = createFileRoute("/auth/confirm")({
  validateSearch: (search: Record<string, unknown>): ConfirmSearch => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
    tokenHash: typeof search["token_hash"] === "string" ? search["token_hash"] : undefined,
    type:
      typeof search["type"] === "string" && otpTypes.has(search["type"])
        ? (search["type"] as ConfirmSearch["type"])
        : undefined,
    next:
      search["next"] === "/redefinir-senha"
        ? "/redefinir-senha"
        : search["next"] === "/onboarding"
          ? "/onboarding"
          : "/painel",
    errorDescription:
      typeof search["error_description"] === "string"
        ? search["error_description"].slice(0, 240)
        : undefined,
    produto:
      search["produto"] === "barber"
        ? "barber"
        : search["produto"] === "beauty"
          ? "beauty"
          : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (search.errorDescription) {
      throw redirect({
        to: "/login",
        search: {
          redirect: "/painel",
          message: "O link de confirmação expirou ou não é mais válido. Solicite um novo link.",
        },
      });
    }
    try {
      await confirmAuth({
        data: {
          code: search.code,
          tokenHash: search.tokenHash,
          type: search.type,
        },
      });
      if (search.produto) {
        await ensureOAuthProductCompany({ data: { productType: search.produto } });
      }
    } catch (cause) {
      throw redirect({
        to: "/login",
        search: {
          redirect: "/painel",
          message: cause instanceof Error ? cause.message : "Não foi possível confirmar este link.",
        },
      });
    }

    if (search.next === "/redefinir-senha") throw redirect({ to: "/redefinir-senha" });
    if (search.next === "/onboarding") throw redirect({ to: "/onboarding" });
    throw redirect({ to: "/painel" });
  },
  head: () => ({ meta: [{ title: "Confirmando acesso — Lu IA Studio" }] }),
  component: Confirmando,
});

function Confirmando() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="grid justify-items-center gap-4 text-center">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        <p className="text-sm text-muted-foreground">Confirmando seu acesso…</p>
        <BrandCredit />
      </div>
    </main>
  );
}
