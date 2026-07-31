import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { brl, type Servico, type TipoTaxa } from "@/data/demo";
import { useDemo } from "@/data/negocio";
import { avisoDemo } from "@/components/acao-demo";



export const Route = createFileRoute("/painel/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Painel Lu IA Studio" },
      { name: "description", content: "Cadastre serviços, preços por formato e taxa de deslocamento." },
      { property: "og:title", content: "Serviços — Painel Lu IA Studio" },
      { property: "og:description", content: "Preços no local, em domicílio e taxa de deslocamento." },
    ],
  }),
  component: Servicos,
});

function Servicos() {
  const { servicos } = useDemo();
  return (

    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow">Catálogo</p>
          <h1 className="mt-1 text-3xl">Serviços</h1>
        </div>
        <FormularioServico
          gatilho={
            <Button className="shrink-0 rounded-full">
              <Plus className="h-4 w-4" /> Novo serviço
            </Button>
          }
        />
      </div>

      <div className="mt-8 grid gap-3">
        {servicos.map((s) => (
          <Card key={s.id} className="grid gap-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
            <img
              src={s.fotos[0]}
              alt={s.nome}
              loading="lazy"
              width={800}
              height={800}
              className="h-20 w-20 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="text-eyebrow">
                {s.categoria} · {s.responsavel}
              </p>
              <p className="text-lg">{s.nome}</p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{s.descricao}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="rounded-full font-normal">
                  {s.duracao}
                </Badge>
                <Badge variant="outline" className="rounded-full font-normal">
                  No local {brl(s.precoLocal)}
                </Badge>
                {s.formato !== "espaco" && (
                  <Badge variant="outline" className="rounded-full font-normal">
                    Domicílio{" "}
                    {s.mesmoPreco ? brl(s.precoLocal) : brl(s.precoDomicilio ?? s.precoLocal)}
                  </Badge>
                )}
                {s.cobrarTaxa && (
                  <Badge variant="outline" className="rounded-full font-normal">
                    Taxa {s.tipoTaxa === "fixa" ? brl(s.valorTaxa ?? 0) : "a combinar"}
                  </Badge>
                )}
                {!s.disponivel && (
                  <Badge variant="destructive" className="rounded-full font-normal">
                    Indisponível
                  </Badge>
                )}
              </div>
            </div>
            <FormularioServico
              servico={s}
              gatilho={
                <Button variant="outline" size="sm" className="rounded-full">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
              }
            />
          </Card>
        ))}
      </div>
    </div>
  );
}

function FormularioServico({
  servico,
  gatilho,
}: {
  servico?: Servico;
  gatilho: React.ReactNode;
}) {
  const { categorias } = useDemo();
  const [aberto, setAberto] = useState(false);
  const [mesmoPreco, setMesmoPreco] = useState(servico?.mesmoPreco ?? true);

  const [cobrarTaxa, setCobrarTaxa] = useState(servico?.cobrarTaxa ?? false);
  const [tipoTaxa, setTipoTaxa] = useState<TipoTaxa>(servico?.tipoTaxa ?? "sem");
  const [formato, setFormato] = useState(servico?.formato ?? "ambos");
  const [disponivel, setDisponivel] = useState(servico?.disponivel ?? true);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{gatilho}</DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {servico ? "Editar serviço" : "Novo serviço"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" defaultValue={servico?.nome} />
          </div>

          <div className="grid gap-2">
            <Label>Categoria</Label>
            <Select defaultValue={servico?.categoria ?? ""}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="desc">Descrição</Label>
            <Textarea id="desc" rows={3} defaultValue={servico?.descricao} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="duracao">Duração</Label>
              <Input id="duracao" defaultValue={servico?.duracao} placeholder="1h30" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="resp">Profissional responsável</Label>
              <Input id="resp" defaultValue={servico?.responsavel} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Fotos do serviço</Label>
            <div className="flex gap-2">
              {servico?.fotos.map((f: string, i: number) => (
                <img
                  key={i}
                  src={f}
                  alt=""
                  loading="lazy"
                  width={800}
                  height={800}
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ))}
              <button className="grid h-16 w-16 place-items-center rounded-lg border border-dashed text-muted-foreground">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <Separator />

          <div className="grid gap-2">
            <Label>Formato de atendimento</Label>
            <Select value={formato} onValueChange={(v) => setFormato(v as Servico["formato"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="espaco">Somente no meu espaço</SelectItem>
                <SelectItem value="domicilio">Somente em domicílio</SelectItem>
                <SelectItem value="ambos">No meu espaço e em domicílio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="precoLocal">Preço no local</Label>
            <Input id="precoLocal" defaultValue={servico?.precoLocal} placeholder="R$ 0,00" />
          </div>

          {formato !== "espaco" && (
            <>
              <label className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">Utilizar o mesmo preço nos dois formatos</span>
                <Switch checked={mesmoPreco} onCheckedChange={setMesmoPreco} />
              </label>

              {!mesmoPreco && (
                <div className="grid gap-2">
                  <Label htmlFor="precoDom">Preço em domicílio</Label>
                  <Input
                    id="precoDom"
                    defaultValue={servico?.precoDomicilio ?? ""}
                    placeholder="R$ 0,00"
                  />
                </div>
              )}

              <label className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">Cobrar taxa de deslocamento</span>
                <Switch
                  checked={cobrarTaxa}
                  onCheckedChange={(v) => {
                    setCobrarTaxa(v);
                    setTipoTaxa(v ? "fixa" : "sem");
                  }}
                />
              </label>

              {cobrarTaxa && (
                <div className="grid gap-2">
                  <Label>Tipo de taxa de deslocamento</Label>
                  <Select value={tipoTaxa} onValueChange={(v) => setTipoTaxa(v as TipoTaxa)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixa">Taxa fixa</SelectItem>
                      <SelectItem value="combinar">Taxa a combinar</SelectItem>
                      <SelectItem value="sem">Sem taxa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {cobrarTaxa && tipoTaxa === "fixa" && (
                <div className="grid gap-2">
                  <Label htmlFor="valorTaxa">Valor da taxa</Label>
                  <Input
                    id="valorTaxa"
                    defaultValue={servico?.valorTaxa ?? ""}
                    placeholder="R$ 0,00"
                  />
                </div>
              )}

              {cobrarTaxa && tipoTaxa === "combinar" && (
                <p className="rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">
                  O cliente verá: “O valor da taxa de deslocamento será confirmado após a análise do
                  endereço.”
                </p>
              )}
            </>
          )}

          <Separator />

          <label className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">Disponível para agendamento</span>
            <Switch checked={disponivel} onCheckedChange={setDisponivel} />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              className="rounded-full sm:flex-1"
              onClick={() => {
                setAberto(false);
                avisoDemo(servico ? "Serviço atualizado" : "Serviço criado");
              }}
            >
              Salvar serviço
            </Button>
            <Button
              variant="outline"
              className="rounded-full sm:flex-1"
              onClick={() => setAberto(false)}
            >
              Cancelar
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
