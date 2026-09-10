# Correção de legibilidade na página pública de agendamento (LuBeauty e LuBarber)

## O que está acontecendo

Na etapa "Confira seus dados" as palavras "Nome" e "WhatsApp" (e o título da etapa) ficam invisíveis quando a empresa escolhe um fundo escuro para a página pública. O motivo: existem regras de cor fixas criadas para o painel do LuBarber que pintam qualquer texto dentro de um card de cinza-escuro e o fundo dos campos de branco. A página pública, porém, calcula suas próprias cores a partir das 3 cores da empresa; quando o fundo é escuro, o card também fica escuro e o texto fixo escuro desaparece.

O resultado é o que aparece na imagem enviada: campos sem etiqueta visível, cliente sem saber o que preencher.

## O que será feito

1. A página pública passa a usar exclusivamente as cores calculadas dela mesma — as regras fixas do painel deixam de valer ali. Assim, com fundo claro o texto sai escuro; com fundo escuro, claro.
2. Revisão de todos os textos de apoio da página pública para que sigam a mesma lógica de contraste: etiquetas dos campos ("Nome", "WhatsApp"), títulos de etapa, "Etapa X de 5", resumo do agendamento, blocos de aviso/política, textos secundários (duração, "Opcional — você pode seguir sem escolher"), preços, formas de pagamento e tela de confirmação.
3. Campos de digitação (nome, WhatsApp, data, busca) com fundo e texto sempre contrastantes entre si, incluindo o texto de exemplo dentro do campo e o cursor.
4. Botões da página ("Voltar", "Avançar", "Confirmar") com texto legível sobre a cor escolhida pela empresa.
5. Validação visual em telas estreitas (360 px) com três combinações: fundo branco, fundo escuro e fundo colorido — nos dois produtos, LuBeauty e LuBarber.

Nada de comportamento muda: horários, preços, regras de agendamento, pagamento e banco de dados continuam iguais. É somente correção de cor de texto.

## Observações técnicas

- Marcar o `main` da rota `src/routes/p.$slug.tsx` com uma classe própria (ex.: `pagina-publica`) e excluir essa árvore das regras fixas `.tema-barbearia main [data-slot="card"] …` em `src/styles.css` via `:not(.pagina-publica)`.
- Na página pública, derivar tokens faltantes do card (`--card-foreground`, fundo/texto de input, `--muted-foreground`, `--secondary-foreground`, `--warning`/`--warning-foreground`) a partir da luminância do card, reusando `contrast()` / `textOnBackground()` já existentes no arquivo.
- Trocar cores fixas remanescentes nos componentes da página pública por tokens semânticos.
- Sem alteração em regras de negócio, servidor, migrações SQL ou temas do painel.
