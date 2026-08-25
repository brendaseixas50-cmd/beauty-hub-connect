# Correção de contraste — títulos dos cards e "Sugestões rápidas" (somente LuBarber)

## O que está acontecendo

As etiquetas em maiúsculas dos cards ("RECEITAS PAGAS", "SALDO PENDENTE", "AGENDAMENTOS", "ATENDIMENTOS CONCLUÍDOS", "RECEITAS REALIZADAS", "SALDO DO PERÍODO") usam o estilo de "eyebrow", cuja cor vem da cor suave global do tema. No LuBarber esse tom foi calculado para o fundo escuro; dentro dos cards brancos ele fica cinza-claro, quase ilegível.

O mesmo estilo é usado no título "Sugestões rápidas" da janela da Luvi, que também fica claro sobre a superfície clara da conversa.

## O que será feito

1. Etiquetas em maiúsculas dentro dos cards claros do LuBarber passam a usar um cinza-escuro legível (mesmo tom já usado nos textos secundários dos cards), mantendo o estilo em maiúsculas e o espaçamento atual.
2. Mesma correção para as etiquetas dentro da janela da Luvi ("Sugestões rápidas") no LuBarber.
3. Revisão rápida das telas afetadas (Financeiro, Relatórios, Estoque, Produtos, Clientes, Profissionais, Comissões) para confirmar que nenhuma etiqueta continua clara sobre branco.
4. Nada muda no LuBeauty nem no portal: as regras ficam restritas ao tema barbearia.

## Observações técnicas

- Alteração apenas em `src/styles.css`, em regras com escopo `.tema-barbearia` (cards claros e `.luvi-chat`), cobrindo a utilidade `text-eyebrow`.
- Sem mudanças de componentes, regras de negócio, backend ou SQL.
- Validação com captura em 360 px nas telas citadas, no LuBarber e no LuBeauty.
