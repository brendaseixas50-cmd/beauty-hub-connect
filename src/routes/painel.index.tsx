import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, Clock, Star, TrendingUp, UserRound, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { brl } from "@/data/demo";
import { useDemo, useNegocio } from "@/data/negocio";

export const Route = createFileRoute("/painel/")({
  head: () => ({
    meta: [
      { title: "Visão geral — Painel Lu IA Studio" },
      { name: "description", content: "Resumo do dia: agendamentos, faturamento e clientes." },
      { property: "og:title", content: "Visão geral — Painel Lu IA Studio" },
      { property: "og:description", content: "Resumo do dia da sua agenda e do seu faturamento." },
    ],
  }),
  component: VisaoGeral,
});

function VisaoGeral() {
  const { tipo } = useNegocio();
  const {
    agendamentosHoje,
    proximosAtendimentos,
    horariosDisponiveis,
    financeiro,
    clientes,
    saudacao,
    servicoTop,
    rotulos,
    fila,
    encaixes,
    profissionais,
    assinaturas,
  } = useDemo();
  const barbearia = tipo === "barbearia";
  const maior = Math.max(...profissionais.map((p) => p.faturamento));

  return (
    <div>
      <p className="text-eyebrow">{saudacao.eyebrow}</p>
      <h1 className="mt-1 text-3xl">{saudacao.titulo}</h1>
      <p className="mt-1 text-muted-foreground">{saudacao.subtitulo}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metrica
          icon={CalendarCheck}
          titulo="Agendamentos de hoje"
          valor={String(agendamentosHoje.length)}
          detalhe={barbearia ? `${encaixes.length} encaixe(s) no dia` : "1 aguardando análise"}
        />
        <Metrica
          icon={TrendingUp}
          titulo="Faturamento do mês"
          valor={brl(financeiro.mes)}
          detalhe={`Ticket médio ${brl(financeiro.ticket)}`}
        />
        <Metrica
          icon={Users}
          titulo={rotulos.clientes}
          valor={String(clientes.length * 32)}
          detalhe="+9 neste mês"
        />
        <Metrica
          icon={Clock}
          titulo="Horários disponíveis hoje"
          valor={String(horariosDisponiveis.length)}
          detalhe={horariosDisponiveis.slice(0, 3).join(" · ")}
        />
        <Metrica
          icon={Star}
          titulo="Serviço mais procurado"
          valor={servicoTop.nome}
          detalhe={servicoTop.detalhe}
        />
        <Metrica
          icon={UserRound}
          titulo="Próximos atendimentos"
          valor={String(proximosAtendimentos.length)}
          detalhe="nos próximos 3 dias"
        />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-2xl">Agendamentos de hoje</h2>
          <Card className="divide-y p-0">
            {agendamentosHoje.map((a) => (
              <div key={a.hora} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 px-5 py-4">
                <span className="text-sm font-medium">{a.hora}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.cliente}</p>
                  <p className="truncate text-sm text-muted-foreground">{a.servico}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="rounded-full font-normal">
                      {a.formato}
                    </Badge>
                    <Badge variant="outline" className="rounded-full font-normal">
                      {a.profissional}
                    </Badge>
                    <Badge
                      variant={a.status === "Confirmado" ? "secondary" : "default"}
                      className="rounded-full font-normal"
                    >
                      {a.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-2xl">Próximos atendimentos</h2>
          <Card className="divide-y p-0">
            {proximosAtendimentos.map((a) => (
              <div key={a.cliente} className="flex items-center justify-between px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.cliente}</p>
                  <p className="truncate text-sm text-muted-foreground">{a.servico}</p>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {a.data} · {a.hora}
                </span>
              </div>
            ))}
          </Card>
        </section>
      </div>

      {barbearia && (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-2xl">Fila de atendimento</h2>
            <Card className="divide-y p-0">
              {fila.map((f) => (
                <div
                  key={f.cliente}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{f.cliente}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {f.servico} · {f.profissional}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 rounded-full font-normal">
                    espera {f.espera}
                  </Badge>
                </div>
              ))}
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-2xl">Encaixes do dia</h2>
            <Card className="divide-y p-0">
              {encaixes.map((e) => (
                <div key={e.cliente} className="flex items-center justify-between px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.cliente}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {e.servico} · {e.horario}
                    </p>
                  </div>
                  <Badge
                    variant={e.status === "Aprovado" ? "secondary" : "default"}
                    className="shrink-0 rounded-full font-normal"
                  >
                    {e.status}
                  </Badge>
                </div>
              ))}
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-2xl">Desempenho por {rotulos.profissionalSingular.toLowerCase()}</h2>
            <Card className="gap-4 p-5">
              {profissionais.map((p) => (
                <div key={p.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="truncate">{p.nome}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {p.atendimentosMes} · {brl(p.faturamento)}
                    </span>
                  </div>
                  <Progress value={(p.faturamento / maior) * 100} />
                </div>
              ))}
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-2xl">Assinaturas ativas</h2>
            <Card className="divide-y p-0">
              {assinaturas.map((a) => (
                <div key={a.nome} className="flex items-center justify-between px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.nome}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {a.beneficios.join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium">{a.assinantes} assinantes</span>
                </div>
              ))}
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}

function Metrica({
  icon: Icon,
  titulo,
  valor,
  detalhe,
}: {
  icon: typeof Users;
  titulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <Card className="gap-2 p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{titulo}</span>
      </div>
      <p className="font-display text-3xl">{valor}</p>
      <p className="text-xs text-muted-foreground">{detalhe}</p>
    </Card>
  );
}
