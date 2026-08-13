/** Modelo simplificado de cores da página pública: fundo, destaque e texto. */
export type CoresPublicas = { fundo: string; destaque: string; texto: string };

export const coresPublicasPadrao: CoresPublicas = {
  fundo: "#ffffff",
  destaque: "#8b5e67",
  texto: "#161616",
};

function canal(hex: string, offset: number) {
  return Number.parseInt(hex.replace("#", "").slice(offset, offset + 2), 16);
}

export function corValida(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export function luminancia(hex: string) {
  if (!corValida(hex)) return 1;
  return (canal(hex, 0) * 299 + canal(hex, 2) * 587 + canal(hex, 4) * 114) / 1000 / 255;
}

/** Preto ou branco, escolhido para manter contraste sobre a cor informada. */
export function corDeContraste(hex: string) {
  return luminancia(hex) > 0.58 ? "#161616" : "#ffffff";
}

export function misturar(hex: string, alvo: string, proporcao: number) {
  if (!corValida(hex) || !corValida(alvo)) return hex;
  const parte = (offset: number) =>
    Math.round(canal(hex, offset) * (1 - proporcao) + canal(alvo, offset) * proporcao)
      .toString(16)
      .padStart(2, "0");
  return `#${parte(0)}${parte(2)}${parte(4)}`;
}

/**
 * Garante contraste mínimo do texto sobre o fundo escolhido,
 * corrigindo automaticamente combinações ilegíveis.
 */
export function textoSeguro(texto: string, fundo: string) {
  const diferenca = Math.abs(luminancia(texto) - luminancia(fundo));
  return diferenca >= 0.42 ? texto : corDeContraste(fundo);
}

/** Deriva a paleta completa usada no banco a partir das 3 cores simples. */
export function derivarPaleta(cores: CoresPublicas) {
  const fundo = corValida(cores.fundo) ? cores.fundo : coresPublicasPadrao.fundo;
  const destaque = corValida(cores.destaque) ? cores.destaque : coresPublicasPadrao.destaque;
  const texto = textoSeguro(
    corValida(cores.texto) ? cores.texto : coresPublicasPadrao.texto,
    fundo,
  );
  const escuro = luminancia(fundo) < 0.5;
  return {
    primaryColor: destaque,
    secondaryColor: misturar(destaque, fundo, escuro ? 0.78 : 0.86),
    accentColor: destaque,
    buttonColor: destaque,
    cardColor: escuro ? misturar(fundo, "#ffffff", 0.1) : "#ffffff",
    menuColor: misturar(destaque, fundo, escuro ? 0.78 : 0.86),
    backgroundColor: fundo,
    titleColor: texto,
    textColor: texto,
  };
}

/** Lê as 3 cores simples de um registro já salvo com a paleta completa. */
export function coresDaEmpresa(company: {
  background_color?: string | null;
  primary_color?: string | null;
  text_color?: string | null;
}): CoresPublicas {
  return {
    fundo: company.background_color || coresPublicasPadrao.fundo,
    destaque: company.primary_color || coresPublicasPadrao.destaque,
    texto: company.text_color || coresPublicasPadrao.texto,
  };
}
