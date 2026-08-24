import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/modules/mvp/domain";
import {
  professionalDeleteBlock,
  professionalSaveBlock,
} from "@/modules/professional-panel/server";

const layoutApi = getRouteApi("/profissional");

export const Route = createFileRoute("/profissional/bloqueios")({
  head: () => ({ meta: [{ title: "Folgas e bloqueios — Painel Profissional" }] }),
  component: ProfessionalBlocks,
});

function ProfessionalBlocks() {
  const result = layoutApi.useLoaderData();
  const router = useRouter();
  const save = useServerFn(professionalSaveBlock);
  const remove = useServerFn(professionalDeleteBlock);
  const [pending, setPending] = useState(false);

  if (result.status !== "ok") return null;
  const { blocks } = result.data;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const element = event.currentTarget;
    setPending(true);
    try {
      await save({
        data: {
          startsAt: new Date(String(form.get("startsAt"))).toISOString(),
          endsAt: new Date(String(form.get("endsAt"))).toISOString(),
          reason: String(form.get("reason") ?? ""),
        },
      });
      element.reset();
      await router.invalidate();
      toast.success("Bloqueio registrado.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível salvar o bloqueio.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Folgas e bloqueios</h1>
        <p className="text-sm text-muted-foreground">
          Períodos bloqueados deixam de aparecer para agendamento na página pública.
        </p>
      </div>

      <Card className="gap-4 p-4">
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="startsAt">Início</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endsAt">Fim</Label>
              <Input id="endsAt" name="endsAt" type="datetime-local" required />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Input id="reason" name="reason" maxLength={160} placeholder="Folga, curso, férias…" />
          </div>
          <Button type="submit" disabled={pending} className="w-full sm:w-fit">
            {pending ? "Salvando…" : "Bloquear período"}
          </Button>
        </form>
      </Card>

      <div className="grid gap-2">
        {blocks.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">Nenhum bloqueio registrado.</Card>
        ) : (
          blocks.map((block) => (
            <Card key={block.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {formatDateTime(block.startsAt)} → {formatDateTime(block.endsAt)}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {block.reason || "Sem motivo informado"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Remover bloqueio"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  try {
                    await remove({ data: { id: block.id } });
                    await router.invalidate();
                    toast.success("Bloqueio removido.");
                  } catch (cause) {
                    toast.error(
                      cause instanceof Error ? cause.message : "Não foi possível remover.",
                    );
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
