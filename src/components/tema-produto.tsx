import { useEffect, type ReactNode } from "react";

/**
 * Produto ativo que define a identidade visual de toda a área interna.
 * "portal" é a base neutra do portal Lu IA Studio (sem identidade de produto).
 */
export type ProdutoTema = "beauty" | "barber" | "portal";

const classes: Record<ProdutoTema, string> = {
  beauty: "tema-beleza",
  barber: "tema-barbearia",
  portal: "tema-portal",
};

export function classeTema(produto: ProdutoTema) {
  return classes[produto] ?? classes.beauty;
}

/**
 * Aplica o tema do produto no <html>, e não apenas no container da tela.
 * Isso é obrigatório porque modais, toasts, dropdowns e telas de erro são
 * renderizados em portais fora da árvore da rota: sem a classe na raiz eles
 * herdariam o tema padrão (LuBeauty) dentro do LuBarber.
 */
export function useTemaProduto(produto: ProdutoTema) {
  const tema = classeTema(produto);
  useEffect(() => {
    const raiz = document.documentElement;
    for (const classe of Object.values(classes)) {
      if (classe !== tema) raiz.classList.remove(classe);
    }
    raiz.classList.add(tema);
    raiz.dataset["produto"] = produto;
    // Mantemos a classe após desmontar para que telas de erro, 404 e estados
    // intermediários continuem no tema correto do produto.
  }, [produto, tema]);
  return tema;
}

/** Container que aplica o tema no SSR e na raiz do documento no cliente. */
export function TemaProduto({
  produto,
  className,
  children,
}: {
  produto: ProdutoTema;
  className?: string;
  children: ReactNode;
}) {
  const tema = useTemaProduto(produto);
  return <div className={`${tema}${className ? ` ${className}` : ""}`}>{children}</div>;
}
