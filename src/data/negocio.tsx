import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dadosBelezaPorArea, type AreaBeleza } from "./demo";
import { dadosBarbearia } from "./demo-barbearia";
import type { DadosNegocio } from "./tipos";

export type TipoNegocio = "beleza" | "barbearia";

type Perfil = { tipo: TipoNegocio; area: AreaBeleza | null; concluido: boolean };

type Contexto = Perfil & {
  definirTipo: (tipo: TipoNegocio) => void;
  definirArea: (area: AreaBeleza) => void;
  concluir: () => void;
  reiniciar: () => void;
  dados: DadosNegocio;
  tema: string;
};

const CHAVE = "luia-perfil-negocio";
const PADRAO: Perfil = { tipo: "beleza", area: null, concluido: false };

const NegocioContext = createContext<Contexto | null>(null);

export function NegocioProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil>(PADRAO);

  // Lido após a hidratação para não divergir do HTML renderizado no servidor.
  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(CHAVE);
      if (salvo) setPerfil({ ...PADRAO, ...(JSON.parse(salvo) as Partial<Perfil>) });
    } catch {
      /* protótipo: ignora falhas de leitura */
    }
  }, []);

  const salvar = (proximo: Perfil) => {
    setPerfil(proximo);
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(proximo));
    } catch {
      /* protótipo: ignora falhas de escrita */
    }
  };

  const valor = useMemo<Contexto>(() => {
    const dados = perfil.tipo === "barbearia" ? dadosBarbearia : dadosBelezaPorArea(perfil.area);
    return {
      ...perfil,
      dados,
      tema: perfil.tipo === "barbearia" ? "tema-barbearia" : "tema-beleza",
      definirTipo: (tipo) =>
        salvar({ ...perfil, tipo, area: tipo === "barbearia" ? null : perfil.area }),
      definirArea: (area) => salvar({ ...perfil, area }),
      concluir: () => salvar({ ...perfil, concluido: true }),
      reiniciar: () => salvar(PADRAO),
    };
  }, [perfil]);

  return <NegocioContext.Provider value={valor}>{children}</NegocioContext.Provider>;
}

export function useNegocio(): Contexto {
  const ctx = useContext(NegocioContext);
  if (!ctx) throw new Error("useNegocio deve ser usado dentro de NegocioProvider");
  return ctx;
}

/** Atalho para os dados demonstrativos do negócio ativo. */
export function useDemo(): DadosNegocio {
  return useNegocio().dados;
}
