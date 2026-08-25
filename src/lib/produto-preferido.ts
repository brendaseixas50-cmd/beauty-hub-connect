import { useEffect, useState } from "react";

export type ProdutoSlug = "beauty" | "barber";

const chave = "luia.produto";

/** Guarda o último produto usado para manter LuBeauty e LuBarber separados após expiração de sessão. */
export function lembrarProduto(produto: ProdutoSlug) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(chave, produto);
  } catch {
    // Armazenamento indisponível: seguimos com o padrão do produto.
  }
}

export function produtoLembrado(): ProdutoSlug | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const valor = window.localStorage.getItem(chave);
    return valor === "beauty" || valor === "barber" ? valor : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve o produto da jornada (login, recuperação de senha) mesmo quando a URL
 * não traz `?produto=`: usa o último produto usado, lido apenas no cliente para
 * não gerar divergência de hidratação no SSR.
 */
export function useProdutoDaJornada(produtoNaUrl?: ProdutoSlug): ProdutoSlug {
  const [produto, setProduto] = useState<ProdutoSlug>(produtoNaUrl ?? "beauty");
  useEffect(() => {
    if (produtoNaUrl) {
      setProduto(produtoNaUrl);
      lembrarProduto(produtoNaUrl);
      return;
    }
    const lembrado = produtoLembrado();
    if (lembrado) setProduto(lembrado);
  }, [produtoNaUrl]);
  return produto;
}
