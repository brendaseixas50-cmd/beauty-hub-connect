import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { MarcaProduto } from "@/components/marca-produto";
import { BrandCredit } from "@/components/brand-experience";
import { LuviWelcome } from "@/modules/luvi-core/components";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readSession } from "@/modules/auth/session-query";
import { centsFromInput } from "@/modules/mvp/domain";
import {
  completeOnboarding,
  getOnboardingData,
  type ServiceSuggestion,
} from "@/modules/onboarding/server";

type DraftService = ServiceSuggestion & { selected: boolean };

export const Route = createFileRoute("/onboarding")({
  validateSearch: z.object({
    retorno: z.enum(["/painel", "/painel/configuracoes"]).catch("/painel"),
  }),
  beforeLoad: async ({ context }) => {
    const session = await readSession(context.queryClient);
    if (!session) throw redirect({ to: "/login", search: { redirect: "/onboarding" } });
    if (!session.user.betaAccessActive)
      throw redirect({
        to: "/beta-fechado",
        search: { produto: session.user.productType },
      });
    return { session };
  },
  loader: () => getOnboardingData(),
  head: () => ({ meta: [{ title: "Configuração inicial — LuBeauty" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const data = Route.useLoaderData();
  const { retorno } = Route.useSearch();
  const navigate = useNavigate();
  const save = useServerFn(completeOnboarding);
  const isBeauty = data.productType === "beauty";
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedIds, setSelectedIds] = useState<string[]>(data.selectedIds);
  const [primaryId, setPrimaryId] = useState<string | null>(data.primaryId);
  const [services, setServices] = useState<DraftService[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const storageKey = `lu-onboarding-${data.tenantId}`;

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        selectedIds?: string[];
        primaryId?: string | null;
        services?: DraftService[];
      };
      if (parsed.selectedIds) setSelectedIds(parsed.selectedIds);
      if (parsed.primaryId !== undefined) setPrimaryId(parsed.primaryId);
      if (parsed.services) setServices(parsed.services);
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify({ selectedIds, primaryId, services }));
  }, [primaryId, selectedIds, services, storageKey]);

  const selectedNames = useMemo(
    () => data.specialties.filter((item) => selectedIds.includes(item.id)).map((item) => item.name),
    [data.specialties, selectedIds],
  );

  function toggleArea(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    if (primaryId === id) setPrimaryId(null);
  }

  function continueToServices() {
    if (isBeauty && (!primaryId || !selectedIds.includes(primaryId))) {
      setError("Escolha uma área principal para continuar.");
      return;
    }
    const matching = data.suggestions.filter((item) => selectedIds.includes(item.specialtyId));
    setServices((current) => {
      const byKey = new Map(current.map((item) => [item.key, item]));
      for (const suggestion of matching)
        if (!byKey.has(suggestion.key))
          byKey.set(suggestion.key, { ...suggestion, selected: true });
      return [...byKey.values()].filter(
        (item) =>
          item.key.startsWith("custom-") || matching.some((match) => match.key === item.key),
      );
    });
    setError(undefined);
    setStep(2);
  }

  function patchService(key: string, values: Partial<DraftService>) {
    setServices((current) =>
      current.map((item) => (item.key === key ? { ...item, ...values } : item)),
    );
  }

  function addCustomService() {
    setServices((current) => [
      ...current,
      {
        key: `custom-${crypto.randomUUID()}`,
        specialtyId: primaryId ?? selectedIds[0] ?? "custom",
        name: "Novo serviço",
        category: null,
        durationMinutes: 60,
        priceCents: 0,
        selected: true,
      },
    ]);
  }

  async function finish() {
    setPending(true);
    setError(undefined);
    try {
      await save({
        data: {
          selectedIds,
          primaryId,
          services: services
            .filter((item) => item.selected)
            .map((item) => ({
              key: item.key,
              name: item.name,
              category: item.category,
              durationMinutes: item.durationMinutes,
              priceCents: item.priceCents,
            })),
        },
      });
      sessionStorage.removeItem(storageKey);
      await navigate({ to: retorno });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível concluir a configuração.",
      );
    } finally {
      setPending(false);
    }
  }

  const tipo = data.productType === "barber" ? "barbearia" : "beleza";
  return (
    <main
      className={`${tipo === "barbearia" ? "tema-barbearia" : "tema-beleza"} min-h-screen bg-secondary/30 px-4 py-8`}
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <MarcaProduto tipo={tipo} />
          <span className="text-sm text-muted-foreground">Etapa {step} de 2</span>
        </div>
        <LuviWelcome product={data.productType} />
        {step === 1 ? (
          <Card className="gap-6 p-6 sm:p-8">
            <div>
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <h1 className="font-display text-3xl">
                {isBeauty
                  ? "Quais são suas áreas de atuação?"
                  : "Comece com seus serviços mais comuns"}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {isBeauty
                  ? "Escolha uma área principal e marque quantas áreas adicionais desejar."
                  : "Esta etapa é opcional e não bloqueia seu acesso ao LuBarber."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.specialties.map((area) => {
                const checked = selectedIds.includes(area.id);
                return (
                  <div
                    key={area.id}
                    className={`rounded-xl border p-4 ${checked ? "border-primary bg-primary/5" : ""}`}
                  >
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleArea(area.id)}
                      />
                      <span className="font-medium">{area.name}</span>
                    </label>
                    {isBeauty && checked ? (
                      <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="radio"
                          name="primary"
                          checked={primaryId === area.id}
                          onChange={() => setPrimaryId(area.id)}
                        />{" "}
                        Área principal
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {!isBeauty ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedIds([]);
                    setPrimaryId(null);
                    continueToServices();
                  }}
                >
                  Pular por enquanto
                </Button>
              ) : null}
              <Button onClick={continueToServices}>
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="gap-6 p-6 sm:p-8">
            <div>
              <h1 className="font-display text-3xl">Escolha seus serviços</h1>
              <p className="mt-2 text-muted-foreground">
                Sugestões para {selectedNames.join(", ") || "seu negócio"}. Edite tudo antes de
                adicionar.
              </p>
            </div>
            <div className="grid gap-3">
              {services.map((service) => (
                <div
                  key={service.key}
                  className={`grid gap-3 rounded-xl border p-4 ${service.selected ? "bg-card" : "opacity-60"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={service.selected}
                        onChange={(event) =>
                          patchService(service.key, { selected: event.target.checked })
                        }
                      />{" "}
                      Adicionar
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover sugestão"
                      onClick={() =>
                        setServices((current) => current.filter((item) => item.key !== service.key))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_9rem]">
                    <div className="grid gap-1">
                      <Label>Nome</Label>
                      <Input
                        value={service.name}
                        onChange={(event) =>
                          patchService(service.key, { name: event.target.value })
                        }
                        disabled={!service.selected}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label>Duração</Label>
                      <Input
                        type="number"
                        min={5}
                        value={service.durationMinutes}
                        onChange={(event) =>
                          patchService(service.key, { durationMinutes: Number(event.target.value) })
                        }
                        disabled={!service.selected}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label>Valor (R$)</Label>
                      <Input
                        inputMode="decimal"
                        value={(service.priceCents / 100).toFixed(2).replace(".", ",")}
                        onChange={(event) =>
                          patchService(service.key, {
                            priceCents: centsFromInput(event.target.value),
                          })
                        }
                        disabled={!service.selected}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {!services.length ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhuma sugestão selecionada. Você pode adicionar um serviço próprio ou concluir
                  sem serviços.
                </p>
              ) : null}
            </div>
            <Button type="button" variant="outline" className="w-fit" onClick={addCustomService}>
              <Plus className="h-4 w-4" /> Adicionar serviço próprio
            </Button>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button disabled={pending} onClick={() => void finish()}>
                {pending ? (
                  "Salvando…"
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Concluir configuração
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}
        <BrandCredit className="mt-8" />
      </div>
    </main>
  );
}
