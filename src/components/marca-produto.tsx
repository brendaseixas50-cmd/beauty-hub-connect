import beautyLogo from "@/assets/brand/lubeauty-app-icon.png";
import barberLogo from "@/assets/brand/lubarber-logo-round.png";
import { marcasProduto } from "@/products/catalog";

export function MarcaProduto({
  compacta = false,
  tipo = "beleza",
}: {
  compacta?: boolean;
  tipo?: "beleza" | "barbearia";
}) {
  const marca = marcasProduto[tipo];
  const isBarber = tipo === "barbearia";

  return (
    <div
      className={`brand-lockup ${isBarber ? "brand-lockup-barber" : "brand-lockup-beauty"} ${compacta ? "brand-lockup-compact" : ""}`}
      aria-label={`${marca.nome}: ${marca.assinatura}`}
    >
      {isBarber ? (
        <img className="barber-logo brand-logo-symbol" src={barberLogo} alt="" aria-hidden="true" />
      ) : (
        <img className="beauty-logo brand-logo-symbol" src={beautyLogo} alt="" aria-hidden="true" />
      )}
    </div>
  );
}
