import beautyLogo from "@/assets/brand/lubeauty-logo-horizontal.png";
import barberLogo from "@/assets/brand/lubarber-logo-horizontal.png";
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
        <img className="barber-logo" src={barberLogo} alt="" aria-hidden="true" />
      ) : (
        <img className="beauty-logo" src={beautyLogo} alt="" aria-hidden="true" />
      )}
    </div>
  );
}
