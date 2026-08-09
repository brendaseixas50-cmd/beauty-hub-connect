import { useEffect, useState } from "react";

import { MarcaProduto } from "@/components/marca-produto";
import { getLuviTheme } from "@/modules/luvi-core/config";

export type BrandType = "beleza" | "barbearia";

export function BrandCredit({ className = "" }: { className?: string }) {
  return (
    <p className={`brand-credit ${className}`}>
      Desenvolvido por <strong>Lu IA Studio</strong>
    </p>
  );
}

export function BrandSplash({ tipo }: { tipo: BrandType }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = `brand-splash:${tipo}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "shown");
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1200);
    return () => window.clearTimeout(timer);
  }, [tipo]);

  if (!visible) return null;

  const isBarber = tipo === "barbearia";
  const luviTheme = getLuviTheme(isBarber ? "barber" : "beauty");
  return (
    <div
      className={`${isBarber ? "tema-barbearia" : "tema-beleza"} brand-splash`}
      role="status"
      aria-label={`Carregando ${isBarber ? "LuBarber Pro" : "LuBeauty Pro"}`}
    >
      <div className="brand-splash-content">
        <MarcaProduto tipo={tipo} />
        <p className="brand-splash-name">{isBarber ? "LuBarber Pro" : "LuBeauty Pro"}</p>
        <p className="brand-splash-slogan">
          {isBarber
            ? "Gestão inteligente para barbeiros de sucesso."
            : "O sistema que organiza e faz seu negócio crescer."}
        </p>
        <BrandCredit />
        <img
          src={luviTheme.faceAsset}
          alt="Luvi, assistente da Lu IA Studio"
          className="brand-splash-luvi"
        />
      </div>
    </div>
  );
}
