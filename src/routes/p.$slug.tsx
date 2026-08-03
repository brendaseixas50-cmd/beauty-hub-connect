import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, CheckCircle2, Clock, Instagram, MapPin, Scissors } from "lucide-react";
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";

import { MarcaProduto } from "@/components/marca-produto";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brl, type BookingResult } from "@/modules/public-booking/domain";
import {
  createPublicBooking,
  getPublicAvailability,
  getPublicCompanyPage,
} from "@/modules/public-booking/server";

export const Route = createFileRoute("/p/$slug")({
  loader: ({ params }) => getPublicCompanyPage({ data: { slug: params.slug } }),
  staleTime: 60_000,
  preloadStaleTime: 60_000,
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.company.name} — Agendamento` : "Página indisponível" },
      {
        name: "description",
        content: loaderData?.company.description ?? "Consulte serviços e solicite seu horário.",
      },
    ],
  }),
  component: PublicCompanyPage,
});

function PublicCompanyPage() {
  const page = Route.useLoaderData();
  if (!page) return <Unavailable />;

  const { company, services, professionals } = page;
  const theme = company.productType === "barber" ? "tema-barbearia" : "tema-beleza";
  const style = {
    "--primary": company.primaryColor,
    "--accent": company.secondaryColor,
  } as CSSProperties;

  return (
    <main className={`${theme} min-h-screen bg-background text-foreground`} style={style}>
      <section className="relative overflow-hidden border-b bg-card">
        {company.bannerUrl ? (
          <img
            src={company.bannerUrl}
            alt=""
            className="h-48 w-full object-cover sm:h-72"
            loading="eager"
          />
        ) : (
          <div className="h-36 bg-gradient-to-br from-secondary via-accent/60 to-background sm:h-52" />
        )}
        <div className="mx-auto -mt-12 flex max-w-5xl items-end gap-4 px-4 pb-6 sm:px-6">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-background bg-card shadow-lg">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={`Logo ${company.name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <Scissors className="h-9 w-9 text-primary" />
            )}
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="truncate font-display text-3xl font-semibold sm:text-4xl">
              {company.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {company.productType === "barber" ? "Barbearia" : "Beleza e autocuidado"}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-6">
          <Card className="gap-3 p-6">
            <p className="text-lg font-medium">
              {company.welcomeMessage || "Boas-vindas! Escolha um serviço e solicite seu horário."}
            </p>
            {company.description ? (
              <p className="leading-relaxed text-muted-foreground">{company.description}</p>
            ) : null}
            <CompanyDetails company={company} />
          </Card>

          <section>
            <h2 className="font-display text-3xl">Serviços</h2>
            {services.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {services.map((service) => (
                  <Card key={service.id} className="gap-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{service.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {service.category || "Serviço"}
                        </p>
                      </div>
                      <span className="font-semibold text-primary">{brl(service.priceCents)}</span>
                    </div>
                    {service.description ? (
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                    ) : null}
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" /> {service.durationMinutes} min
                    </p>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="mt-4 p-6 text-sm text-muted-foreground">
                Nenhum serviço disponível no momento.
              </Card>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <BookingCard slug={company.slug} services={services} professionals={professionals} />
        </aside>
      </div>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        Agendamento seguro por{" "}
        <Link to="/" className="font-medium text-primary">
          Lu IA Studio
        </Link>
      </footer>
    </main>
  );
}

function CompanyDetails({
  company,
}: {
  company: NonNullable<ReturnType<typeof Route.useLoaderData>>["company"];
}) {
  const location = [company.addressLine, company.city, company.state].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
      {location ? (
        <span className="flex items-center gap-1">
          <MapPin className="h-4 w-4" /> {location}
        </span>
      ) : null}
      {company.instagram ? (
        <a
          className="flex items-center gap-1 hover:text-primary"
          href={`https://instagram.com/${company.instagram.replace(/^@/, "")}`}
          target="_blank"
          rel="noreferrer"
        >
          <Instagram className="h-4 w-4" /> {company.instagram}
        </a>
      ) : null}
      {company.publicInformation ? (
        <p className="basis-full whitespace-pre-line">{company.publicInformation}</p>
      ) : null}
      {company.cancellationPolicy ? (
        <p className="basis-full">
          <strong>Cancelamento:</strong> {company.cancellationPolicy}
        </p>
      ) : null}
    </div>
  );
}

type PublicService = NonNullable<ReturnType<typeof Route.useLoaderData>>["services"][number];
type PublicProfessional = NonNullable<
  ReturnType<typeof Route.useLoaderData>
>["professionals"][number];

function BookingCard({
  slug,
  services,
  professionals,
}: {
  slug: string;
  services: PublicService[];
  professionals: PublicProfessional[];
}) {
  const availabilityFn = useServerFn(getPublicAvailability);
  const bookingFn = useServerFn(createPublicBooking);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Awaited<ReturnType<typeof availabilityFn>>["slots"]>([]);
  const [selectedStart, setSelectedStart] = useState("");
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<BookingResult>();
  const selectedService = useMemo(
    () => services.find((item) => item.id === serviceId),
    [services, serviceId],
  );
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });

  async function findSlots() {
    if (!serviceId || !date) return;
    setPending(true);
    setError(undefined);
    setSelectedStart("");
    try {
      const response = await availabilityFn({
        data: { slug, date, serviceId, professionalId: professionalId || null },
      });
      setSlots(response.slots);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar os horários.");
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStart || !selectedProfessional) return;
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const storageKey = "lu-public-booking-fingerprint";
      let fingerprint = localStorage.getItem(storageKey);
      if (!fingerprint) {
        fingerprint = crypto.randomUUID();
        localStorage.setItem(storageKey, fingerprint);
      }
      const response = await bookingFn({
        data: {
          slug,
          serviceId,
          professionalId: selectedProfessional,
          startsAt: selectedStart,
          customerName: String(form.get("name")),
          customerPhone: String(form.get("phone")),
          customerEmail: String(form.get("email")),
          notes: String(form.get("notes")),
          requestId: crypto.randomUUID(),
          fingerprint,
          website: String(form.get("website")),
        },
      });
      if (!response.ok) throw new Error(response.error || "Não foi possível enviar o agendamento.");
      setResult(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar o agendamento.");
    } finally {
      setPending(false);
    }
  }

  if (result?.ok)
    return (
      <Card className="gap-4 p-6 text-center shadow-lg">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <div>
          <h2 className="text-xl font-semibold">Solicitação enviada</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O estabelecimento recebeu seu pedido de horário.
          </p>
        </div>
        <div className="rounded-xl bg-secondary p-4 text-sm">
          <p>{result.service}</p>
          <p>{result.professional}</p>
          <p>{result.startsAt ? formatSlot(result.startsAt) : ""}</p>
          <p className="mt-2 font-semibold">Código {result.code}</p>
        </div>
        {result.whatsapp ? (
          <Button asChild>
            <a
              href={`https://wa.me/${result.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              Falar pelo WhatsApp
            </a>
          </Button>
        ) : null}
      </Card>
    );

  return (
    <Card className="gap-5 p-6 shadow-lg">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <CalendarDays className="h-5 w-5" /> Agendar horário
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o serviço, o profissional e uma data.
        </p>
      </div>
      {!services.length ? (
        <p className="text-sm text-muted-foreground">
          Os agendamentos ainda não estão disponíveis.
        </p>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="booking-service">Serviço</Label>
            <select
              id="booking-service"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setSlots([]);
              }}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              {services.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {brl(item.priceCents)}
                </option>
              ))}
            </select>
            {selectedService ? (
              <p className="text-xs text-muted-foreground">
                Duração aproximada: {selectedService.durationMinutes} min
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="booking-professional">Profissional</Label>
            <select
              id="booking-professional"
              value={professionalId}
              onChange={(e) => {
                setProfessionalId(e.target.value);
                setSlots([]);
              }}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Qualquer profissional disponível</option>
              {professionals.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="booking-date">Data</Label>
            <Input
              id="booking-date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSlots([]);
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!date || pending}
              onClick={() => void findSlots()}
            >
              {pending ? "Consultando…" : "Ver horários"}
            </Button>
          </div>
          {slots.length ? (
            <div className="grid grid-cols-2 gap-2">
              {slots.map((slot) => (
                <Button
                  key={slot.startsAt}
                  type="button"
                  size="sm"
                  variant={selectedStart === slot.startsAt ? "default" : "outline"}
                  onClick={() => {
                    setSelectedStart(slot.startsAt);
                    setSelectedProfessional(professionalId || slot.professionals[0]?.id || "");
                  }}
                >
                  {new Date(slot.startsAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Button>
              ))}
            </div>
          ) : date && !pending ? (
            <p className="text-sm text-muted-foreground">
              Nenhum horário encontrado para esta data.
            </p>
          ) : null}
          {selectedStart ? (
            <form className="grid gap-3 border-t pt-5" onSubmit={submit}>
              <p className="text-sm font-medium">Seus dados</p>
              <div className="grid gap-2">
                <Label htmlFor="customer-name">Nome</Label>
                <Input id="customer-name" name="name" autoComplete="name" required minLength={2} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer-phone">WhatsApp</Label>
                <Input
                  id="customer-phone"
                  name="phone"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  minLength={10}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer-email">E-mail (opcional)</Label>
                <Input id="customer-email" name="email" type="email" autoComplete="email" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer-notes">Observações</Label>
                <Textarea id="customer-notes" name="notes" maxLength={500} />
              </div>
              <input
                name="website"
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              <Button type="submit" disabled={pending}>
                {pending ? "Enviando…" : "Solicitar agendamento"}
              </Button>
            </form>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}

function formatSlot(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );
}

function Unavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="max-w-md gap-4 p-8 text-center">
        <Scissors className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Página indisponível</h1>
        <p className="text-muted-foreground">
          Este estabelecimento ainda não publicou sua página ou desativou temporariamente os
          agendamentos.
        </p>
        <Button asChild variant="outline">
          <Link to="/">Conhecer a Lu IA Studio</Link>
        </Button>
      </Card>
    </main>
  );
}
