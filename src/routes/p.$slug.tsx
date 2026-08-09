import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Facebook,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Scissors,
  ShoppingBag,
  Star,
  UserRound,
} from "lucide-react";
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BrandCredit } from "@/components/brand-experience";
import { brl, type BookingResult } from "@/modules/public-booking/domain";
import {
  createPublicBooking,
  getPublicAvailability,
  getPublicCompanyPage,
} from "@/modules/public-booking/server";

export const Route = createFileRoute("/p/$slug")({
  loader: ({ params }) => getPublicCompanyPage({ data: { slug: params.slug } }),
  staleTime: 5 * 60_000,
  preloadStaleTime: 5 * 60_000,
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.company.name} — Agendamento` : "Página indisponível" },
      {
        name: "description",
        content: loaderData?.company.description ?? "Serviços e agendamento online.",
      },
    ],
  }),
  component: PublicCompanyPage,
});

function PublicCompanyPage() {
  const page = Route.useLoaderData();
  if (!page) return <Unavailable />;
  const { company, services, professionals, products, gallery, reviews } = page;
  const style = {
    "--background": company.backgroundColor,
    "--foreground": company.textColor,
    "--card": company.cardColor,
    "--card-foreground": company.textColor,
    "--primary": company.buttonColor,
    "--primary-foreground": contrast(company.buttonColor),
    "--secondary": company.secondaryColor,
    "--secondary-foreground": company.titleColor,
    "--accent": company.accentColor,
    "--accent-foreground": company.titleColor,
    "--muted": company.menuColor,
    "--muted-foreground": company.textColor,
    "--title-color": company.titleColor,
  } as CSSProperties;
  const address = [company.addressLine, company.city, company.state, company.postalCode]
    .filter(Boolean)
    .join(" · ");

  return (
    <main
      className="min-h-screen bg-background text-foreground [&_h2]:text-[var(--title-color)] [&_h3]:text-[var(--title-color)]"
      style={style}
    >
      <header
        className="sticky top-0 z-30 border-t-4 border-b bg-background/95 backdrop-blur"
        style={{ borderTopColor: company.primaryColor, backgroundColor: company.menuColor }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={`Logo ${company.name}`}
                className="h-11 w-11 rounded-xl object-cover"
              />
            ) : (
              <Scissors className="h-7 w-7 text-primary" />
            )}
            <strong className="truncate" style={{ color: company.titleColor }}>
              {company.name}
            </strong>
          </div>
          <Button asChild className="rounded-full">
            <a href="#agendar">
              <CalendarDays className="h-4 w-4" /> Agendar
            </a>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden">
        {company.bannerUrl ? (
          <img
            src={company.bannerUrl}
            alt={`Ambiente de ${company.name}`}
            className="h-[22rem] w-full object-cover sm:h-[30rem]"
          />
        ) : (
          <div
            className="h-72"
            style={{
              background: `linear-gradient(135deg, ${company.primaryColor}, ${company.secondaryColor}, ${company.accentColor})`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-6xl items-end gap-5 px-4 pb-8 text-white sm:px-6">
          {company.photoUrl ? (
            <img
              src={company.photoUrl}
              alt="Foto principal"
              className="hidden h-32 w-32 rounded-3xl border-4 border-white/80 object-cover shadow-xl sm:block"
            />
          ) : null}
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em]">
              {company.productType === "barber" ? "LuBarber Pro" : "LuBeauty Pro"}
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold sm:text-6xl">{company.name}</h1>
            <p className="mt-2 max-w-2xl text-white/90">
              {company.welcomeMessage || company.description}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-12">
          <section className="grid gap-4 sm:grid-cols-2">
            <Card className="gap-3 p-6">
              <h2 className="text-2xl" style={{ color: company.titleColor }}>
                Sobre nós
              </h2>
              <p className="leading-relaxed">
                {company.description || "Cuidado profissional com atendimento personalizado."}
              </p>
              <ContactLinks company={company} />
            </Card>
            <Card className="gap-3 p-6">
              <h2 className="text-2xl" style={{ color: company.titleColor }}>
                Localização e horários
              </h2>
              {address ? (
                <p className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  {address}
                </p>
              ) : null}
              <BusinessHours hours={company.businessHours} />
              {company.mapUrl ? (
                isEmbeddableMap(company.mapUrl) ? (
                  <iframe
                    title={`Mapa de ${company.name}`}
                    src={company.mapUrl}
                    className="h-52 w-full rounded-xl border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <Button asChild variant="outline">
                    <a href={company.mapUrl} target="_blank" rel="noreferrer">
                      Abrir mapa
                    </a>
                  </Button>
                )
              ) : null}
            </Card>
          </section>

          <CatalogSection title="Serviços" icon={Scissors} empty="Nenhum serviço disponível.">
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((service) => (
                <Card key={service.id} className="gap-2 p-5">
                  <div className="flex justify-between gap-4">
                    <h3 className="font-semibold" style={{ color: company.titleColor }}>
                      {service.name}
                    </h3>
                    <strong className="text-primary">{brl(service.priceCents)}</strong>
                  </div>
                  <p className="text-sm">{service.description || service.category}</p>
                  <p className="flex items-center gap-1 text-sm">
                    <Clock className="h-4 w-4" /> {service.durationMinutes} min
                  </p>
                </Card>
              ))}
            </div>
          </CatalogSection>

          <CatalogSection
            title="Profissionais"
            icon={UserRound}
            empty="Nenhum profissional disponível."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {professionals.map((professional) => (
                <Card key={professional.id} className="items-center gap-3 p-5 text-center">
                  {professional.photoUrl ? (
                    <img
                      src={professional.photoUrl}
                      alt={professional.name}
                      className="h-24 w-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid h-24 w-24 place-items-center rounded-full bg-secondary">
                      <UserRound className="h-9 w-9" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold" style={{ color: company.titleColor }}>
                      {professional.name}
                    </h3>
                    <p className="text-sm">{professional.specialty}</p>
                  </div>
                  {professional.bio ? <p className="text-sm">{professional.bio}</p> : null}
                </Card>
              ))}
            </div>
          </CatalogSection>

          {gallery.length ? (
            <CatalogSection title="Galeria" icon={Star}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gallery.map((item) => (
                  <img
                    key={item.id}
                    src={item.imageUrl}
                    alt={item.altText || "Trabalho realizado"}
                    className="aspect-square w-full rounded-2xl object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            </CatalogSection>
          ) : null}
          {reviews.length ? (
            <CatalogSection title="Avaliações" icon={Star}>
              <div className="grid gap-3 sm:grid-cols-2">
                {reviews.map((review) => (
                  <Card key={review.id} className="gap-3 p-5">
                    <div className="flex gap-1 text-gold">
                      {Array.from({ length: review.rating }, (_, index) => (
                        <Star key={index} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <p>“{review.comment}”</p>
                    <strong className="text-sm">{review.clientName}</strong>
                  </Card>
                ))}
              </div>
            </CatalogSection>
          ) : null}
          {products.length ? (
            <CatalogSection title="Produtos" icon={ShoppingBag}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <Card key={product.id} className="gap-3 overflow-hidden p-0">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="aspect-video w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    <div className="grid gap-2 p-5">
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="text-sm">{product.description}</p>
                      <strong className="text-primary">{brl(product.priceCents)}</strong>
                    </div>
                  </Card>
                ))}
              </div>
            </CatalogSection>
          ) : null}
        </div>

        <aside id="agendar" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          <BookingWizard
            slug={company.slug}
            timezone={company.timezone}
            services={services}
            professionals={professionals}
          />
        </aside>
      </div>

      {company.whatsapp ? (
        <a
          href={whatsappUrl(company.whatsapp, company.whatsappInitialMessage)}
          target="_blank"
          rel="noreferrer"
          aria-label="Falar pelo WhatsApp"
          className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-xl transition-transform duration-200 hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      ) : null}
      <footer className="border-t py-8 text-center text-xs">
        Desenvolvido por{" "}
        <Link to="/" className="font-semibold text-primary">
          Lu IA Studio
        </Link>
      </footer>
    </main>
  );
}

type PageData = NonNullable<ReturnType<typeof Route.useLoaderData>>;
type Service = PageData["services"][number];
type Professional = PageData["professionals"][number];

function BookingWizard({
  slug,
  timezone,
  services,
  professionals,
}: {
  slug: string;
  timezone: string;
  services: Service[];
  professionals: Professional[];
}) {
  const availabilityFn = useServerFn(getPublicAvailability);
  const bookingFn = useServerFn(createPublicBooking);
  const [step, setStep] = useState(1);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Awaited<ReturnType<typeof availabilityFn>>["slots"]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<BookingResult>();
  const selectedServices = services.filter((service) => serviceIds.includes(service.id));
  const availableProfessionals = professionals.filter(
    (professional) =>
      !professional.serviceIds.length ||
      serviceIds.every((id) => professional.serviceIds.includes(id)),
  );
  const selectedProfessional = professionals.find((item) => item.id === professionalId);
  const total = selectedServices.reduce((sum, service) => sum + service.priceCents, 0);
  const duration = selectedServices.reduce((sum, service) => sum + service.durationMinutes, 0);
  const today = dateInTimeZone(timezone);
  const maxDate = dateInTimeZone(timezone, 180);

  async function loadSlots() {
    setPending(true);
    setError(undefined);
    try {
      const response = await availabilityFn({ data: { slug, date, serviceIds, professionalId } });
      setSlots(response.slots);
      setStep(5);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar horários.");
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const key = "lu-public-booking-fingerprint";
      let fingerprint = localStorage.getItem(key);
      if (!fingerprint) {
        fingerprint = crypto.randomUUID();
        localStorage.setItem(key, fingerprint);
      }
      const response = await bookingFn({
        data: {
          slug,
          serviceIds,
          professionalId,
          startsAt,
          customerName: String(form.get("name")),
          customerPhone: String(form.get("phone")),
          customerEmail: String(form.get("email")),
          customerBirthDate: String(form.get("birthDate")),
          notes: String(form.get("notes")),
          requestId: crypto.randomUUID(),
          fingerprint,
          website: String(form.get("website")),
        },
      });
      if (!response.ok) throw new Error(response.error || "Não foi possível confirmar.");
      setResult(response);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível confirmar.");
    } finally {
      setPending(false);
    }
  }

  if (result?.ok)
    return (
      <Card className="gap-5 p-6 text-center shadow-xl">
        <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
        <div>
          <h2 className="text-2xl font-semibold">Agendamento confirmado</h2>
          <p className="text-sm">Código {result.code}</p>
        </div>
        <div className="rounded-xl bg-secondary p-4 text-sm">
          {result.services?.map((service) => (
            <p key={service}>{service}</p>
          ))}
          <p>{result.professional}</p>
          <p>{result.startsAt ? formatSlot(result.startsAt, timezone) : ""}</p>
          {result.totalPriceCents !== undefined ? (
            <strong>{brl(result.totalPriceCents)}</strong>
          ) : null}
        </div>
        {result.notificationStatus === "development" ? (
          <p className="text-sm">
            A notificação da empresa foi registrada em modo de desenvolvimento.
          </p>
        ) : null}
      </Card>
    );

  return (
    <Card className="gap-5 p-5 shadow-xl sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Etapa {step} de 6
        </p>
        <h2 className="mt-1 text-2xl font-semibold">Agendar horário</h2>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(step / 6) * 100}%` }}
        />
      </div>
      {step === 1 ? (
        <Step title="Escolha o serviço">
          <div className="grid gap-2">
            {services.map((service) => (
              <Choice
                key={service.id}
                selected={serviceIds[0] === service.id}
                onClick={() => setServiceIds([service.id])}
              >
                <span>{service.name}</span>
                <strong>{brl(service.priceCents)}</strong>
              </Choice>
            ))}
          </div>
          <Next disabled={!serviceIds.length} onClick={() => setStep(2)} />
        </Step>
      ) : null}
      {step === 2 ? (
        <Step title="Escolha o profissional">
          <div className="grid gap-2">
            {availableProfessionals.map((professional) => (
              <Choice
                key={professional.id}
                selected={professionalId === professional.id}
                onClick={() => setProfessionalId(professional.id)}
              >
                <span>{professional.name}</span>
                <small>{professional.specialty}</small>
              </Choice>
            ))}
          </div>
          <Next disabled={!professionalId} onClick={() => setStep(3)} />
        </Step>
      ) : null}
      {step === 3 ? (
        <Step title="Adicionar outros serviços">
          <p className="text-sm">Opcional: selecione outros serviços para o mesmo horário.</p>
          <div className="grid gap-2">
            {services
              .filter((item) => item.id !== serviceIds[0])
              .filter(
                (item) =>
                  !selectedProfessional?.serviceIds.length ||
                  selectedProfessional.serviceIds.includes(item.id),
              )
              .map((service) => (
                <Choice
                  key={service.id}
                  selected={serviceIds.includes(service.id)}
                  onClick={() =>
                    setServiceIds((current) =>
                      current.includes(service.id)
                        ? current.filter((id) => id !== service.id)
                        : [...current, service.id],
                    )
                  }
                >
                  <span>{service.name}</span>
                  <strong>{brl(service.priceCents)}</strong>
                </Choice>
              ))}
          </div>
          <Next onClick={() => setStep(4)} />
        </Step>
      ) : null}
      {step === 4 ? (
        <Step title="Escolha a data">
          <Input
            type="date"
            min={today}
            max={maxDate}
            value={date}
            onChange={(event) => setDate(event.currentTarget.value)}
          />
          <Next
            disabled={!date || pending}
            onClick={() => void loadSlots()}
            label={pending ? "Consultando…" : "Ver horários"}
          />
        </Step>
      ) : null}
      {step === 5 ? (
        <Step title="Escolha o horário">
          {slots.length ? (
            <div className="grid grid-cols-2 gap-2">
              {slots.map((slot) => (
                <Button
                  key={slot.startsAt}
                  variant={startsAt === slot.startsAt ? "default" : "outline"}
                  onClick={() => setStartsAt(slot.startsAt)}
                >
                  {new Date(slot.startsAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: timezone,
                  })}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm">Nenhum horário disponível nesta data.</p>
          )}
          <Next disabled={!startsAt} onClick={() => setStep(6)} />
        </Step>
      ) : null}
      {step === 6 ? (
        <form className="grid gap-4" onSubmit={submit}>
          <div className="rounded-xl bg-secondary p-4 text-sm">
            <strong className="block">Resumo</strong>
            {selectedServices.map((service) => (
              <p key={service.id}>{service.name}</p>
            ))}
            <p>{selectedProfessional?.name}</p>
            <p>{formatSlot(startsAt, timezone)}</p>
            <p>
              {duration} min · {brl(total)}
            </p>
          </div>
          <Field label="Nome" name="name" required minLength={2} />
          <Field label="WhatsApp" name="phone" required minLength={10} inputMode="tel" />
          <Field label="E-mail (opcional)" name="email" type="email" />
          <Field label="Aniversário (opcional)" name="birthDate" type="date" />
          <div className="grid gap-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" name="notes" maxLength={500} />
          </div>
          <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />
          <Button type="submit" disabled={pending}>
            {pending ? "Confirmando…" : "Confirmar agendamento"}
          </Button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {step > 1 && !pending ? (
        <button
          type="button"
          onClick={() => {
            setError(undefined);
            setStep((current) => current - 1);
          }}
          className="flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>
      ) : null}
    </Card>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}
function Next({
  disabled,
  onClick,
  label = "Continuar",
}: {
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button type="button" disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
}
function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm ${selected ? "border-primary bg-primary/10" : "bg-card"}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
        {children}
      </span>
    </button>
  );
}
function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

function CatalogSection({
  title,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  icon: typeof Star;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 font-display text-3xl">
        <Icon className="h-6 w-6 text-primary" />
        {title}
      </h2>
      <div className="mt-5">{children || <p>{empty}</p>}</div>
    </section>
  );
}
function ContactLinks({ company }: { company: PageData["company"] }) {
  return (
    <div className="grid gap-2 text-sm">
      {company.phone ? (
        <a href={`tel:${company.phone}`} className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          {company.phone}
        </a>
      ) : null}
      {company.whatsapp ? (
        <a
          href={whatsappUrl(company.whatsapp, company.whatsappInitialMessage)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>
      ) : null}
      {company.instagram ? (
        <a
          href={`https://instagram.com/${company.instagram.replace(/^@/, "")}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2"
        >
          <Instagram className="h-4 w-4" />
          {company.instagram}
        </a>
      ) : null}
      {company.facebook ? (
        <a
          href={
            company.facebook.startsWith("http")
              ? company.facebook
              : `https://facebook.com/${company.facebook}`
          }
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2"
        >
          <Facebook className="h-4 w-4" />
          Facebook
        </a>
      ) : null}
    </div>
  );
}
function BusinessHours({ hours }: { hours: Record<string, string> }) {
  const labels: Record<string, string> = {
    monday: "Segunda",
    tuesday: "Terça",
    wednesday: "Quarta",
    thursday: "Quinta",
    friday: "Sexta",
    saturday: "Sábado",
    sunday: "Domingo",
  };
  return (
    <div className="grid gap-1 text-sm">
      {Object.entries(labels).map(([key, label]) => (
        <div key={key} className="flex justify-between gap-3">
          <span>{label}</span>
          <span>{hours[key] === "closed" ? "Fechado" : hours[key] || "—"}</span>
        </div>
      ))}
    </div>
  );
}
function formatSlot(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
function dateInTimeZone(timezone: string, daysFromNow = 0) {
  return new Date(Date.now() + daysFromNow * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: timezone,
  });
}
function isEmbeddableMap(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["www.google.com", "maps.google.com"].includes(url.hostname) &&
      url.pathname.includes("/maps/embed")
    );
  } catch {
    return false;
  }
}
function whatsappUrl(phone: string, message: string | null) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message || "Olá! Gostaria de mais informações.")}`;
}
function contrast(hex: string) {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111827" : "#ffffff";
}
function Unavailable() {
  return (
    <main className="flex min-h-screen flex-col bg-background px-4">
      <div className="grid flex-1 place-items-center py-8">
        <Card className="max-w-md gap-4 p-8 text-center">
          <Scissors className="mx-auto h-10 w-10" />
          <h1 className="text-2xl font-semibold">Página indisponível</h1>
          <p>Este estabelecimento ainda não publicou sua página ou está sem licença ativa.</p>
          <Button asChild variant="outline">
            <Link to="/">Conhecer a Lu IA Studio</Link>
          </Button>
        </Card>
      </div>
      <BrandCredit className="pb-6" />
    </main>
  );
}
