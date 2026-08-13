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
