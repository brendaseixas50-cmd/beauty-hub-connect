import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Instagram,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, type BookingResult } from "@/modules/public-booking/domain";
import {
  createSimplePublicBooking,
  createPublicStoreOrder,
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
        content: loaderData?.company.description ?? "Agendamento online simples e rápido.",
      },
    ],
  }),
  component: PublicBookingApp,
});

function PublicBookingApp() {
  const page = Route.useLoaderData();
  const [area, setArea] = useState<"booking" | "store">("booking");
  if (!page) return <Unavailable />;
  const { company } = page;
  const theme = publicTheme(company);
  const style = {
    "--background": "#ffffff",
    "--foreground": "#1f1f1f",
    "--card": "#ffffff",
    "--card-foreground": "#1f1f1f",
    "--primary": theme.primary,
    "--primary-foreground": contrast(theme.primary),
    "--secondary": theme.secondary,
    "--secondary-foreground": contrast(theme.secondary),
    "--accent": theme.secondary,
    "--accent-foreground": contrast(theme.secondary),
    "--muted": theme.secondary,
    "--muted-foreground": "#5f5f5f",
    "--border": theme.border,
    "--input": theme.border,
    "--ring": company.productType === "barber" ? "#c9a227" : theme.primary,
    "--destructive": company.productType === "barber" ? "#9f1d1d" : "#d54d83",
    "--destructive-foreground": "#ffffff",
  } as CSSProperties;

  return (
    <main className="min-h-screen bg-background text-foreground" style={style}>
      <header className="border-b bg-card px-4 py-4 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {company.logoUrl ? (
            <img
              src={company.logoUrl}
              alt={`Logo ${company.name}`}
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-lg font-bold">
              {company.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="min-w-0 truncate font-display text-2xl font-semibold">{company.name}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5 sm:py-8">
        <div className="grid grid-cols-2 gap-3" aria-label="Escolha entre agendamento e loja">
          <button
            type="button"
            aria-pressed={area === "booking"}
            className={`grid min-h-28 place-items-center rounded-2xl border-2 p-4 text-center shadow-sm transition ${area === "booking" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-card-foreground"}`}
            onClick={() => setArea("booking")}
          >
            <span className="grid gap-2">
              <CalendarDays className="mx-auto h-7 w-7" />
              <strong>Agendamento</strong>
              <small className="font-normal">Escolher serviços e horário</small>
            </span>
          </button>
          <button
            type="button"
            aria-pressed={area === "store"}
            className={`grid min-h-28 place-items-center rounded-2xl border-2 p-4 text-center shadow-sm transition disabled:cursor-not-allowed disabled:opacity-55 ${area === "store" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-card-foreground"}`}
            onClick={() => setArea("store")}
          >
            <span className="grid gap-2">
              <ShoppingBag className="mx-auto h-7 w-7" />
              <strong>Loja</strong>
              <small className="font-normal">Ver produtos à venda</small>
            </span>
          </button>
        </div>
        {area === "booking" ? <BookingWizard page={page} /> : <StoreCatalog page={page} />}
        <CompanyInformation page={page} />
      </div>
      <footer className="border-t px-4 py-7 text-center text-xs text-muted-foreground">
        Agendamento seguro · Desenvolvido por{" "}
        <Link to="/" className="font-semibold text-primary">
          Lu IA Studio
        </Link>
      </footer>
    </main>
  );
}

type PageData = NonNullable<Awaited<ReturnType<typeof getPublicCompanyPage>>>;
type Service = PageData["services"][number];
type Professional = PageData["professionals"][number];

function BookingWizard({ page }: { page: PageData }) {
  const { company, services, professionals } = page;
  const availabilityFn = useServerFn(getPublicAvailability);
  const bookingFn = useServerFn(createSimplePublicBooking);
  const [step, setStep] = useState(1);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [professionalChoice, setProfessionalChoice] = useState("any");
  const [resolvedProfessionalId, setResolvedProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Awaited<ReturnType<typeof availabilityFn>>["slots"]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card" | "local" | "mercado_pago">(
    "local",
  );
  const [paymentOption, setPaymentOption] = useState<"deposit" | "full">("full");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<BookingResult>();
  const selectedServices = services.filter((service) => serviceIds.includes(service.id));
  const total = selectedServices.reduce((sum, service) => sum + service.priceCents, 0);
  const duration = selectedServices.reduce((sum, service) => sum + service.durationMinutes, 0);
  const signal = depositAmount(company, total);
  const availableProfessionals = professionals.filter(
    (professional) =>
      !professional.serviceIds.length ||
      serviceIds.every((id) => professional.serviceIds.includes(id)),
  );
  const chosenProfessional = professionals.find(
    (professional) => professional.id === resolvedProfessionalId,
  );
  const today = dateInTimeZone(company.timezone);
  const maxDate = dateInTimeZone(company.timezone, 180);

  async function loadSlots(targetDate = date) {
    if (!targetDate) return;
    setPending(true);
    setError(undefined);
    setStartsAt("");
    try {
      const response = await availabilityFn({
        data: {
          slug: company.slug,
          date: targetDate,
          serviceIds,
          professionalId: professionalChoice === "any" ? null : professionalChoice,
        },
      });
      setSlots(response.slots);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar os horários.");
    } finally {
      setPending(false);
    }
  }

  async function confirmBooking(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const key = "lu-public-booking-fingerprint";
      let fingerprint = localStorage.getItem(key);
      if (!fingerprint) {
        fingerprint = crypto.randomUUID();
        localStorage.setItem(key, fingerprint);
      }
      const response = await bookingFn({
        data: {
          slug: company.slug,
          serviceIds,
          professionalId: resolvedProfessionalId,
          startsAt,
          customerName: name,
          customerPhone: phone,
          requestId: crypto.randomUUID(),
          fingerprint,
          paymentMethod,
          paymentOption: signal > 0 ? paymentOption : "full",
          website: "",
        },
      });
      if (!response.ok) throw new Error(response.error || "Não foi possível confirmar.");
      setResult(response);
      if (response.checkoutUrl) {
        window.location.assign(response.checkoutUrl);
        return;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir o agendamento.");
    } finally {
      setPending(false);
    }
  }

  if (result?.ok)
    return (
      <BookingSuccess
        result={result}
        timezone={company.timezone}
        customerName={name}
        whatsapp={company.whatsapp}
        paymentMethod={paymentMethod}
      />
    );

  return (
    <Card id="agendar" className="mt-5 gap-5 p-4 shadow-md sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Etapa {step} de 5
          </p>
          <h2 className="mt-1 text-2xl font-semibold">
            {
              [
                "",
                "Escolha os serviços",
                "Escolha o profissional",
                "Escolha data e horário",
                "Confira seus dados",
                "Forma de pagamento",
              ][step]
            }
          </h2>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
          {Math.round((step / 5) * 100)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(step / 5) * 100}%` }}
        />
      </div>

      {step === 1 ? (
        <StepServices
          services={services}
          selected={serviceIds}
          onToggle={(id) =>
            setServiceIds((current) =>
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
            )
          }
          total={total}
          duration={duration}
        />
      ) : null}
      {step === 2 ? (
        <StepProfessionals
          professionals={availableProfessionals}
          value={professionalChoice}
          onChange={setProfessionalChoice}
        />
      ) : null}
      {step === 3 ? (
        <div className="grid gap-4">
          <Input
            type="date"
            min={today}
            max={maxDate}
            value={date}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setDate(value);
              void loadSlots(value);
            }}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {pending ? (
              <p className="col-span-full text-sm">Consultando horários…</p>
            ) : slots.length ? (
              slots.map((slot) => (
                <Button
                  key={slot.startsAt}
                  type="button"
                  variant={startsAt === slot.startsAt ? "default" : "outline"}
                  onClick={() => {
                    setStartsAt(slot.startsAt);
                    const professional =
                      professionalChoice === "any" ? slot.professionals[0]?.id : professionalChoice;
                    setResolvedProfessionalId(professional ?? "");
                  }}
                >
                  {formatTime(slot.startsAt, company.timezone)}
                </Button>
              ))
            ) : date ? (
              <p className="col-span-full rounded-xl bg-secondary p-4 text-sm">
                Nenhum horário disponível nesta data.
              </p>
            ) : (
              <p className="col-span-full text-sm text-muted-foreground">
                Escolha uma data para ver os horários.
              </p>
            )}
          </div>
        </div>
      ) : null}
      {step === 4 ? (
        <div className="grid gap-4">
          <Summary
            services={selectedServices}
            professional={chosenProfessional}
            startsAt={startsAt}
            timezone={company.timezone}
            duration={duration}
            total={total}
          />
          <Field label="Nome" value={name} onChange={setName} autoComplete="name" />
          <Field
            label="WhatsApp"
            value={phone}
            onChange={setPhone}
            inputMode="tel"
            autoComplete="tel"
          />
          {company.cancellationPolicyEnabled && company.cancellationPolicy ? (
            <div className="rounded-2xl border border-warning bg-warning/10 p-4">
              <strong>⚠️ Política de Agendamento e Cancelamento</strong>
              <p className="mt-2 whitespace-pre-line text-sm">{company.cancellationPolicy}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {step === 5 ? (
        <form onSubmit={confirmBooking} className="grid gap-4">
          <div className="rounded-2xl bg-secondary p-4">
            <p>
              Valor total: <strong>{brl(total)}</strong>
            </p>
            {signal > 0 ? (
              <>
                <p>
                  Sinal: <strong>{brl(signal)}</strong>
                </p>
                <p>
                  Saldo restante:{" "}
                  <strong>{brl(paymentOption === "deposit" ? total - signal : 0)}</strong>
                </p>
              </>
            ) : null}
          </div>
          {signal > 0 ? (
            <div className="grid gap-2">
              <Choice
                selected={paymentOption === "deposit"}
                onClick={() => setPaymentOption("deposit")}
              >
                <span>Pagar apenas o sinal</span>
                <strong>{brl(signal)}</strong>
              </Choice>
              <Choice selected={paymentOption === "full"} onClick={() => setPaymentOption("full")}>
                <span>Pagar o valor total</span>
                <strong>{brl(total)}</strong>
              </Choice>
            </div>
          ) : (
            <p className="rounded-xl bg-secondary p-4 text-sm">
              Não há cobrança de sinal. O pagamento será do valor total.
            </p>
          )}
          <div className="grid gap-2">
            {paymentChoices(company).map((choice) => (
              <Choice
                key={choice.id}
                selected={paymentMethod === choice.id}
                onClick={() => setPaymentMethod(choice.id)}
              >
                <span>{choice.label}</span>
              </Choice>
            ))}
          </div>
          <input name="website" className="sr-only" tabIndex={-1} autoComplete="off" />
          <Button type="submit" size="lg" disabled={pending}>
            {pending
              ? "Confirmando…"
              : paymentMethod === "local"
                ? "Confirmar agendamento"
                : "Continuar para pagamento"}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError(undefined);
              setStep((current) => current - 1);
            }}
          >
            <ChevronLeft /> Voltar
          </Button>
        ) : (
          <span />
        )}
        {step < 5 ? (
          <Button
            type="button"
            disabled={
              !canAdvance(step, { serviceIds, professionalChoice, date, startsAt, name, phone })
            }
            onClick={() => setStep((current) => current + 1)}
          >
            Avançar <ChevronRight />
          </Button>
        ) : null}
      </div>
      {step === 1 && serviceIds.length ? (
        <div className="sticky bottom-3 flex justify-between rounded-2xl bg-card p-3 text-sm shadow-lg">
          <span>{duration} min</span>
          <strong>{brl(total)}</strong>
        </div>
      ) : null}
    </Card>
  );
}

function StepServices({
  services,
  selected,
  onToggle,
  total,
  duration,
}: {
  services: Service[];
  selected: string[];
  onToggle: (id: string) => void;
  total: number;
  duration: number;
}) {
  return (
    <div className="grid gap-3">
      {services.length ? (
        services.map((service) => (
          <Choice
            key={service.id}
            selected={selected.includes(service.id)}
            onClick={() => onToggle(service.id)}
          >
            <span>
              <strong className="block">{service.name}</strong>
              <small className="text-muted-foreground">{service.durationMinutes} min</small>
            </span>
            <strong>{brl(service.priceCents)}</strong>
          </Choice>
        ))
      ) : (
        <p className="rounded-xl bg-secondary p-4">Nenhum serviço disponível.</p>
      )}
      <div className="flex justify-between rounded-xl bg-secondary p-3 text-sm">
        <span>{duration} min</span>
        <strong>{brl(total)}</strong>
      </div>
    </div>
  );
}
function StepProfessionals({
  professionals,
  value,
  onChange,
}: {
  professionals: Professional[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Choice selected={value === "any"} onClick={() => onChange("any")}>
        <span>⭐ Qualquer profissional disponível</span>
      </Choice>
      {professionals.map((professional) => (
        <Choice
          key={professional.id}
          selected={value === professional.id}
          onClick={() => onChange(professional.id)}
        >
          <span className="flex items-center gap-3">
            {professional.photoUrl ? (
              <img
                src={professional.photoUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full border object-cover"
              />
            ) : (
              <UserRound className="h-5 w-5" />
            )}
            <span>
              <strong className="block">{professional.name}</strong>
              <small>{professional.specialty}</small>
            </span>
          </span>
        </Choice>
      ))}
    </div>
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
      className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left ${selected ? "border-primary bg-primary/10" : "border-border bg-card"}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {selected ? <Check className="h-5 w-5 shrink-0 text-primary" /> : null}
        {children}
      </span>
    </button>
  );
}
function Summary({
  services,
  professional,
  startsAt,
  timezone,
  duration,
  total,
}: {
  services: Service[];
  professional: Professional | undefined;
  startsAt: string;
  timezone: string;
  duration: number;
  total: number;
}) {
  return (
    <div className="grid gap-2 rounded-2xl bg-secondary p-4 text-sm">
      <strong>Resumo do agendamento</strong>
      <p>{services.map((service) => service.name).join(", ")}</p>
      <p>{professional?.name ?? "Qualquer profissional disponível"}</p>
      <p>{formatSlot(startsAt, timezone)}</p>
      <p>
        <Clock className="mr-1 inline h-4 w-4" />
        {duration} min · <strong>{brl(total)}</strong>
      </p>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  ...props
}: { label: string; value: string; onChange: (value: string) => void } & Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange"
>) {
  const id = `field-${label}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        required
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        {...props}
      />
    </div>
  );
}
function BookingSuccess({
  result,
  timezone,
  customerName,
  whatsapp,
  paymentMethod,
}: {
  result: BookingResult;
  timezone: string;
  customerName: string;
  whatsapp: string | null;
  paymentMethod: "pix" | "card" | "local" | "mercado_pago";
}) {
  const [summaryOpened, setSummaryOpened] = useState(false);
  const localPayment = paymentMethod === "local";
  const url = whatsapp
    ? bookingWhatsappUrl(whatsapp, result, customerName, result.paymentMethod ?? "local")
    : null;
  return (
    <Card className="mt-5 items-center gap-5 p-6 text-center">
      <CheckCircle2 className="h-14 w-14 text-success" />
      <div>
        <h2 className="text-2xl font-semibold">
          {localPayment && !summaryOpened
            ? "Envie o resumo para confirmar"
            : "Agendamento confirmado"}
        </h2>
        <p className="text-sm">Código {result.code}</p>
      </div>
      <div className="w-full rounded-2xl bg-secondary p-4 text-sm">
        {result.services?.map((service) => (
          <p key={service}>{service}</p>
        ))}
        <p>{result.professional}</p>
        <p>{result.startsAt ? formatSlot(result.startsAt, timezone) : ""}</p>
        {result.totalPriceCents !== undefined ? (
          <p>
            Valor total: <strong>{brl(result.totalPriceCents)}</strong>
          </p>
        ) : null}
        {result.remainingCents ? (
          <p>
            Saldo restante: <strong>{brl(result.remainingCents)}</strong>
          </p>
        ) : null}
      </div>
      {result.paymentError ? (
        <p
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          Agendamento reservado, mas o pagamento não pôde ser aberto: {result.paymentError}
        </p>
      ) : null}
      {localPayment && !url ? (
        <p
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          O estabelecimento precisa cadastrar o WhatsApp para concluir pagamentos no local.
        </p>
      ) : null}
      {url && (!localPayment || !summaryOpened) ? (
        <Button asChild size="lg" className="min-h-12 w-full sm:w-auto">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={() => localPayment && setSummaryOpened(true)}
          >
            <MessageCircle /> Enviar resumo pelo WhatsApp
          </a>
        </Button>
      ) : null}
      {!localPayment ? (
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          Finalizar
        </Button>
      ) : summaryOpened ? (
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          Voltar ao início
        </Button>
      ) : null}
    </Card>
  );
}

function StoreCatalog({ page }: { page: PageData }) {
  const orderFn = useServerFn(createPublicStoreOrder);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkout, setCheckout] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card" | "local" | "mercado_pago">(
    "local",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<{ code: string; total: number }>();
  const categories = useMemo(
    () => [...new Set(page.products.map((product) => product.category).filter(Boolean))],
    [page.products],
  );
  const items = page.products
    .filter((product) => cart[product.id])
    .map((product) => ({ product, quantity: cart[product.id] ?? 0 }));
  const total = items.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  if (!page.company.publicStoreEnabled) {
    return (
      <Card className="mt-5 items-center gap-4 p-6 text-center">
        <ShoppingBag className="h-12 w-12 text-primary" />
        <h2 className="text-2xl font-semibold">Loja</h2>
        <p className="text-sm text-muted-foreground">
          O catálogo desta empresa ainda não está aberto para vendas.
        </p>
      </Card>
    );
  }

  function change(productId: string, delta: number, stock: number) {
    setCart((current) => {
      const quantity = Math.max(0, Math.min((current[productId] ?? 0) + delta, stock));
      if (!quantity) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: quantity };
    });
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const key = "lu-public-store-fingerprint";
      let fingerprint = localStorage.getItem(key);
      if (!fingerprint) {
        fingerprint = crypto.randomUUID();
        localStorage.setItem(key, fingerprint);
      }
      const result = await orderFn({
        data: {
          slug: page.company.slug,
          customerName: name,
          customerPhone: phone,
          items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
          paymentMethod,
          requestId: crypto.randomUUID(),
          fingerprint,
          website: "",
        },
      });
      if (!result.ok) throw new Error(result.error || "Não foi possível concluir o pedido.");
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setSuccess({ code: result.code ?? "", total: result.totalCents ?? total });
      if (result.paymentError)
        setError(`Pedido criado, mas o pagamento não pôde ser aberto: ${result.paymentError}`);
      setCart({});
      if (paymentMethod === "local" && page.company.whatsapp) {
        const message = [
          `Olá! Fiz o pedido ${result.code ?? ""} pela loja.`,
          `Nome: ${name}`,
          `Total: ${brl(result.totalCents ?? total)}`,
          "Forma de pagamento: Pagamento no local.",
        ].join("\n");
        window.open(
          `https://wa.me/${digits(page.company.whatsapp)}?text=${encodeURIComponent(message)}`,
          "_blank",
          "noopener,noreferrer",
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir o pedido.");
    } finally {
      setPending(false);
    }
  }

  if (success)
    return (
      <Card className="mt-5 items-center gap-4 p-6 text-center">
        <CheckCircle2 className="h-14 w-14 text-success" />
        <h2 className="text-2xl font-semibold">Pedido realizado</h2>
        <p>
          Código <strong>{success.code}</strong>
        </p>
        <p>
          Total: <strong>{brl(success.total)}</strong>
        </p>
        <p className="text-sm text-muted-foreground">
          O pagamento está pendente até a confirmação da empresa.
        </p>
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
          >
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSuccess(undefined);
            setCheckout(false);
          }}
        >
          Continuar na loja
        </Button>
      </Card>
    );

  return (
    <section className="mt-5 grid gap-4">
      <div>
        <h2 className="text-2xl font-semibold">Loja</h2>
        <p className="text-sm text-muted-foreground">
          Escolha os produtos e finalize pelo carrinho.
        </p>
      </div>
      {categories.length ? (
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((category) => (
            <span
              key={category!}
              className="whitespace-nowrap rounded-full bg-secondary px-3 py-2 text-sm"
            >
              {category}
            </span>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {page.products.length ? (
          page.products.map((product) => (
            <Card key={product.id} className="overflow-hidden p-0">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="aspect-square w-full object-cover"
                />
              ) : null}
              <div className="grid gap-2 p-4">
                <strong>{product.name}</strong>
                <p className="text-sm">{product.description}</p>
                <strong className="text-primary">{brl(product.priceCents)}</strong>
                <small className="text-muted-foreground">{product.stockQuantity} em estoque</small>
                {(cart[product.id] ?? 0) > 0 ? (
                  <div className="flex items-center justify-between rounded-xl border p-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => change(product.id, -1, product.stockQuantity)}
                    >
                      <Minus />
                    </Button>
                    <strong>{cart[product.id]}</strong>
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => change(product.id, 1, product.stockQuantity)}
                      disabled={(cart[product.id] ?? 0) >= product.stockQuantity}
                    >
                      <Plus />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={() => change(product.id, 1, product.stockQuantity)}
                  >
                    <ShoppingCart /> Adicionar ao carrinho
                  </Button>
                )}
              </div>
            </Card>
          ))
        ) : (
          <p className="rounded-xl bg-secondary p-4">
            A loja ainda não possui produtos disponíveis.
          </p>
        )}
      </div>
      {count ? (
        <Card className="sticky bottom-3 gap-4 p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span>
              <strong>{count}</strong> {count === 1 ? "item" : "itens"}
            </span>
            <strong>{brl(total)}</strong>
          </div>
          {!checkout ? (
            <Button type="button" size="lg" onClick={() => setCheckout(true)}>
              <ShoppingCart /> Abrir carrinho
            </Button>
          ) : (
            <form className="grid gap-4" onSubmit={submitOrder}>
              <div className="grid gap-2">
                {items.map(({ product, quantity }) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3"
                  >
                    <span>
                      <strong className="block">{product.name}</strong>
                      <small>
                        {quantity} × {brl(product.priceCents)}
                      </small>
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remover ${product.name}`}
                      onClick={() => change(product.id, -quantity, product.stockQuantity)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
              <Field label="Nome" value={name} onChange={setName} autoComplete="name" />
              <Field
                label="WhatsApp"
                value={phone}
                onChange={setPhone}
                inputMode="tel"
                autoComplete="tel"
              />
              <div className="grid gap-2">
                {paymentChoices(page.company).map((choice) => (
                  <Choice
                    key={choice.id}
                    selected={paymentMethod === choice.id}
                    onClick={() => setPaymentMethod(choice.id)}
                  >
                    <span>{choice.label}</span>
                  </Choice>
                ))}
              </div>
              <input name="website" className="sr-only" tabIndex={-1} autoComplete="off" />
              <Button
                type="submit"
                size="lg"
                disabled={pending || name.trim().length < 2 || digits(phone).length < 10}
              >
                {pending ? "Finalizando…" : "Finalizar pedido"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setCheckout(false)}>
                Continuar comprando
              </Button>
            </form>
          )}
          {error ? (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}
function CompanyInformation({ page }: { page: PageData }) {
  const { company, gallery } = page;
  const address = [company.addressLine, company.city, company.state].filter(Boolean).join(" · ");
  const showLocation = company.showPublicLocation && Boolean(address);
  if (
    !showLocation &&
    !company.whatsapp &&
    !company.instagram &&
    !gallery.length &&
    !company.description
  )
    return null;
  return (
    <section className="mt-12 grid gap-5 border-t pt-8">
      <h2 className="text-xl font-semibold">Informações</h2>
      {showLocation ? (
        <div className="grid gap-4 overflow-hidden rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Localização</h3>
              <p className="mt-1 text-sm leading-relaxed">{address}</p>
              {company.postalCode ? (
                <p className="text-sm text-muted-foreground">CEP {company.postalCode}</p>
              ) : null}
            </div>
          </div>
          <iframe
            title={`Mapa de ${company.name}`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
            className="h-64 w-full rounded-xl border-0 sm:h-72"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <Button asChild size="lg" className="min-h-12 w-full rounded-xl">
            <a
              href={
                company.mapUrl ||
                `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
              }
              target="_blank"
              rel="noreferrer"
            >
              <MapPin /> Como chegar
            </a>
          </Button>
        </div>
      ) : null}
      {company.whatsapp ? (
        <a
          className="flex gap-2"
          href={`https://wa.me/${digits(company.whatsapp)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle className="h-5 w-5" /> WhatsApp
        </a>
      ) : null}
      {company.instagram ? (
        <a
          className="flex gap-2"
          href={`https://instagram.com/${company.instagram.replace(/^@/, "")}`}
          target="_blank"
          rel="noreferrer"
        >
          <Instagram className="h-5 w-5" /> {company.instagram}
        </a>
      ) : null}
      {company.description ? (
        <div>
          <h3 className="font-semibold">Sobre a empresa</h3>
          <p className="mt-2 text-sm leading-relaxed">{company.description}</p>
        </div>
      ) : null}
      {gallery.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {gallery.map((item) => (
            <img
              key={item.id}
              src={item.imageUrl}
              alt={item.altText ?? "Foto da empresa"}
              className="aspect-square w-full rounded-2xl object-cover"
              loading="lazy"
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
function Unavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <h1 className="text-3xl">Página indisponível</h1>
        <p className="mt-2 text-muted-foreground">Este endereço não está publicado.</p>
        <Button asChild className="mt-5">
          <Link to="/">Voltar</Link>
        </Button>
      </div>
    </main>
  );
}

function canAdvance(
  step: number,
  state: {
    serviceIds: string[];
    professionalChoice: string;
    date: string;
    startsAt: string;
    name: string;
    phone: string;
  },
) {
  if (step === 1) return state.serviceIds.length > 0;
  if (step === 2) return Boolean(state.professionalChoice);
  if (step === 3) return Boolean(state.date && state.startsAt);
  if (step === 4) return state.name.trim().length >= 2 && digits(state.phone).length >= 10;
  return true;
}
function paymentChoices(
  company: PageData["company"],
): { id: "pix" | "card" | "local" | "mercado_pago"; label: string }[] {
  const choices: { id: "pix" | "card" | "local" | "mercado_pago"; label: string }[] = [];
  if (company.paymentMethods.pix) choices.push({ id: "pix", label: "Pix" });
  if (company.paymentMethods.card) choices.push({ id: "card", label: "Cartão" });
  if (company.paymentMethods.local) choices.push({ id: "local", label: "Pagamento no local" });
  if (company.paymentMethods.mercadoPago)
    choices.push({ id: "mercado_pago", label: "Mercado Pago" });
  return choices.length ? choices : [{ id: "local", label: "Pagamento no local" }];
}
function depositAmount(company: PageData["company"], total: number) {
  if (!company.depositEnabled) return 0;
  if (company.depositType === "percent_30") return Math.round(total * 0.3);
  if (company.depositType === "percent_50") return Math.round(total * 0.5);
  if (company.depositType === "fixed") return Math.min(company.depositValueCents, total);
  return 0;
}
function formatTime(value: string, timezone: string) {
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}
function formatSlot(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
function dateInTimeZone(timezone: string, days = 0) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
function digits(value: string) {
  return value.replace(/\D/g, "");
}
function contrast(hex: string) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? "#161616" : "#ffffff";
}

function publicTheme(company: PageData["company"]) {
  const barber = company.productType === "barber";
  const legacyWrongColor =
    barber &&
    [company.primaryColor, company.secondaryColor].some((color) =>
      ["#7c3aed", "#8b5e67", "#a66ef2", "#ec78a8", "#c9b8ff", "#f5e7ea", "#f9e7ef"].includes(
        color.toLowerCase(),
      ),
    );
  const primary = legacyWrongColor ? "#161616" : company.primaryColor;
  const secondaryBase = legacyWrongColor ? "#c9a227" : company.secondaryColor;
  return {
    primary,
    secondary: mixWithWhite(secondaryBase, barber ? 0.88 : 0.9),
    border: mixWithWhite(barber ? "#c9a227" : primary, 0.72),
  };
}

function mixWithWhite(hex: string, whiteRatio: number) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return "#f5f5f5";
  const channel = (offset: number) =>
    Math.round(
      Number.parseInt(value.slice(offset, offset + 2), 16) * (1 - whiteRatio) + 255 * whiteRatio,
    )
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}
function bookingWhatsappUrl(
  phone: string,
  result: BookingResult,
  name: string,
  paymentMethod: string,
) {
  const lines = [
    "Olá!",
    "Acabei de realizar um agendamento pelo site.",
    `Nome: ${name}`,
    `Serviços: ${result.services?.join(", ") ?? ""}`,
    `Profissional: ${result.professional ?? ""}`,
    `Data e horário: ${result.startsAt ?? ""}`,
    `Valor total: ${result.totalPriceCents !== undefined ? brl(result.totalPriceCents) : ""}`,
    result.depositCents ? `Sinal solicitado: ${brl(result.depositCents)}` : "",
    result.remainingCents ? `Saldo restante: ${brl(result.remainingCents)}` : "",
    `Forma de pagamento: ${paymentMethod === "local" ? "Pagamento no local" : paymentMethod}`,
    "Gostaria de combinar a confirmação do meu agendamento.",
  ].filter(Boolean);
  return `https://wa.me/${digits(phone)}?text=${encodeURIComponent(lines.join("\n"))}`;
}
