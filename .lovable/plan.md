# Novo favicon unissex para Lu IA Studio

## Contexto
O favicon atual (`public/favicon.png`) ficou visualmente feminino (monograma rosé/dourado), mas a plataforma atende tanto profissionais da beleza quanto barbearias. Precisamos de um ícone neutro que funcione bem nos dois temas.

## O que será feito
1. **Remover o favicon atual** `public/favicon.png` e seu source `src/assets/brand/favicon-source.png`.
2. **Gerar um novo favicon** com identidade unissex:
   - Forma: monograma "L" minimalista ou ícone de agendamento/horário em estilo geométrico.
   - Paleta: fundo escuro neutro (carbono/grafite) com acento dourado/cobre — funciona no tema claro (Beleza) e no tema escuro (Barbearia), sem conotação feminina.
   - Estilo: limpo, moderno, profissional, com bom contraste em 16px e 32px.
3. **Ajustar dimensões** para favicon quadrado (64x64 px, PNG transparente ou fundo sólido, conforme renderizar melhor).
4. **Referenciar corretamente** em `src/routes/__root.tsx` (já aponta para `/favicon.png`; manter link, mas garantir que o tipo e caminho estejam corretos).

## Entregáveis
- `public/favicon.png` (novo, quadrado, otimizado para navegador).
- `src/assets/brand/favicon-source.png` (source 1024x1024, se gerado maior).
- Link atualizado em `src/routes/__root.tsx`.

## Fora do escopo
- Não alterar logos horizontais ou redondas existentes da LuBeauty/LuBarber.
- Não modificar a lógica de cores da página pública.
- Não conectar banco de dados ou backend.
