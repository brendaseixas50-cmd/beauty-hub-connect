# Correção visual — botões ilegíveis e bolinha da Luvi (somente LuBarber)

O LuBeauty não será alterado em nada. Todas as mudanças ficam restritas ao tema do LuBarber e ao avatar da Luvi no LuBarber.

## O que está acontecendo

Confirmado no código:

1. **Filtros que aparecem "vazios"** (Financeiro, Produtos, Estoque, Clientes, Profissionais, Relatórios): são listas suspensas nativas. O tema do LuBarber força texto escuro (#161616) em todo `select`, incluindo os que ficam sobre o fundo preto da página — texto preto no preto, ilegível.
2. **Pastilhas vazias ao lado de "Receita"** (Financeiro) e etiquetas semelhantes em outras telas: são etiquetas do tipo "contorno", que usam a cor de texto global do tema (branco) dentro de cards brancos — branco no branco.
3. **Telinha da Luvi**: a janela de conversa usa fundo claro, mas o texto herda o branco do tema. Por isso os atalhos ("Como cadastro um cliente?", "Como abro a agenda?", "Como crio um serviço?") e o título "Sugestões rápidas" aparecem como pílulas vazias.
4. **Bolinha da Luvi**: o avatar atual é recortado com zoom de 1.35 e foco em 20% da altura, cortando o rosto do robô — em 3,25 rem não se reconhece a carinha.

## O que será feito

### 1. Legibilidade dos controles no LuBarber
- Listas suspensas sobre o fundo escuro: texto branco, seta visível, e opções do menu nativo com texto escuro sobre branco (comportamento do sistema).
- Listas suspensas dentro de cards claros: mantêm texto escuro (como já está).
- Etiquetas de contorno dentro de cards claros: texto e borda escuros legíveis; sobre fundo escuro, texto claro.
- Revisão dos botões auxiliares das telas afetadas (Editar, Excluir, Movimentar, Exportar CSV, Desativar/Revalidar acesso, Copiar link) para garantir contraste do texto e do ícone em ambas as superfícies.
- Telas revisadas: Financeiro, Relatórios, Estoque, Produtos, Clientes, Profissionais.

### 2. Telinha da Luvi (LuBarber)
- Definir a cor de texto correta para a janela de conversa, cabeçalho, corpo, rodapé e balões.
- Atalhos rápidos com texto visível (contorno dourado + texto escuro sobre a superfície clara).
- "Sugestões rápidas", "Limpar conversa" e "Pedir suporte no WhatsApp" com contraste adequado.

### 3. Bolinha da Luvi com a nova robô (LuBeauty **e** LuBarber)
- Publicar a imagem enviada (`facep.png`) como asset e usá-la como rosto da Luvi nos dois produtos (bolinha flutuante, cabeçalho da conversa e cartões da Luvi).
- Reenquadrar: foco no centro do rosto, zoom reduzido, e aumentar levemente a bolinha flutuante para a robô ficar reconhecível.
- No LuBeauty, **somente** a imagem/enquadramento da Luvi muda; cores, textos e botões continuam exatamente como estão.


## Observações técnicas
- Mudanças concentradas em `src/styles.css` (regras já existentes com prefixo `.tema-barbearia`) e em `src/modules/luvi-core/config.ts` (apenas o tema barber).
- Nenhuma alteração de regra de negócio, backend ou migração SQL.
- Validação com captura em 360 px nas telas citadas, no LuBarber e no LuBeauty (para provar que o Beauty não mudou).
