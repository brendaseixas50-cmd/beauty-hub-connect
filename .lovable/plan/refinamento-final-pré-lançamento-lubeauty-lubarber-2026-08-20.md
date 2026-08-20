# Refinamento final pré-lançamento — LuBeauty + LuBarber

Entrega em 3 etapas verificáveis. Nada de redesenho: página pública, cores, mapa, pagamento, autenticação, Beta Fechado, planos e dados existentes ficam intactos.

Cada etapa que precisa de banco vem com um arquivo SQL pronto em `docs/sql/` para você rodar no SQL Editor do Supabase de produção. O código é escrito para não quebrar antes do SQL: os recursos novos só aparecem depois que as tabelas/funções existirem.

## Etapa 1 — Luvi flutuante + menu lateral (sem banco)

- Remover a apresentação da Luvi de dentro do Dashboard (o cartão de boas-vindas e a sugestão embutida), reorganizando o espaço sem card substituto.
- Luvi passa a ter 3 estados: bolinha flutuante → cápsula "Fale com a Luvi" → conversa aberta.
- Bolinha arrastável, presa dentro da área visível, com posição lembrada no navegador; confortável no mobile.
- Conversa: cabeçalho com avatar + "Luvi · Assistente do LuBeauty/LuBarber", mensagem inicial, contexto da tela, histórico, sugestões rápidas, campo "Digite uma dúvida...", Enviar, Limpar conversa, Pedir suporte no WhatsApp, minimizar e X.
- Minimizar volta para a bolinha; X esconde a Luvi por completo, e ela não reaparece ao navegar.
- Item "Luvi Assistente" no menu lateral restaura apenas a bolinha (não abre página nem a conversa).
- Avatar refinado: rosto maior e centralizado no círculo, recorte limpo, contorno na cor do produto, nítido no tamanho pequeno. Mesma personagem, só melhor enquadramento.
- Suporte no WhatsApp abre o número de suporte já configurado com mensagem pronta contendo produto, nome do negócio e tela atual.
- Textos e cores separados por produto (LuBarber sem rosa nem termos do LuBeauty).
- Acionador do menu lateral no mobile passa para o lado esquerdo, junto da área da logo, mesmo lado em que o menu abre. Conteúdo do menu não muda.

## Etapa 2 — Produtos: status, categorias, filtros e paginação

- Painel de produtos com filtros **Todos | Ativos | Inativos**, badge de inativo, ações Inativar / Reativar / Editar.
- Produto inativo continua no painel e no histórico, mas sai da loja pública e de novas compras.
- Exclusão definitiva liberada quando não houver vínculo ativo impeditivo (carrinho/pedido em andamento). Quando houver, mensagem explicando o motivo exato. Histórico financeiro e vendas concluídas nunca são apagados.
- Cadastro próprio de **categorias de produto**: criar, renomear, excluir com segurança (aviso quando há produtos associados) e associar produtos. Nenhuma categoria é criada automaticamente.
- Loja pública: filtros **Todos | categorias com produtos ativos**. Sem categorias criadas, nenhum filtro aparece.
- Paginação de 10 produtos por página, com `‹ 1 2 3 … 12 ›` responsivo; ao trocar de página o cliente volta suavemente ao início da seção Loja, não ao topo do site.
- Filtro + paginação trabalham juntos: trocar de categoria volta para a página 1 e recalcula o total.

SQL desta etapa: tabela de categorias por empresa, vínculo do produto à categoria e atualização da função da página pública para devolver as categorias com produtos ativos.

## Etapa 3 — Serviços com foto + Combos

- Cadastro/edição de serviço ganha **"Foto do serviço (opcional)"**, mesmo padrão de upload dos produtos. Sem foto, o card público continua correto e sem espaço vazio. Foto do profissional continua como está.
- Serviços continuam sem paginação.
- Nova área **Combos** dentro do módulo de Serviços: + Novo combo com nome, serviços incluídos, preço, foto opcional, duração e status Ativo/Inativo.
- Ao montar o combo, o painel mostra: valor normal somado, preço do combo e a economia em R$ e %.
- Duração calculada pela soma dos serviços, com ajuste manual; a duração final é a usada na disponibilidade da agenda.
- Combo inativo fica no painel com histórico preservado e fora de novos agendamentos; exclusão definitiva apenas quando segura.
- Página pública: a etapa continua abrindo em **Serviços**. Só quando existir pelo menos um combo ativo aparecem as abas **[ Serviços ] [ Combos ]**, com Serviços selecionado por padrão.
- Cliente pode combinar um combo com serviços individuais que não estejam nele. Duplicidade é impedida com aviso flutuante imediato:
  - "Este serviço já está incluído no combo selecionado."
  - "Você já selecionou um serviço que faz parte deste combo. Remova o serviço individual ou escolha outro combo."
- Depois da escolha, o fluxo segue exatamente como hoje: profissional, data, horário, resumo, pagamento, confirmação, WhatsApp.
- Profissionais continuam filtrados pelas regras atuais: quem não executa todos os serviços do combo não é oferecido.

SQL desta etapa: foto no serviço, tabelas de combo e itens do combo, e novas versões das funções públicas de página, disponibilidade e criação de agendamento para que **preço e duração reais do combo** valham no horário reservado e no total cobrado. As versões atuais continuam existindo, então nada para de funcionar durante a atualização.

## Detalhes técnicos

- Luvi: refatorar `src/modules/luvi-core/components.tsx` para um container flutuante próprio (drag com Pointer Events, clamp na viewport, estado `hidden | bubble | capsule | open` em `localStorage` por produto), remover `LuviWelcome`/`LuviInlineSuggestion` do Dashboard e adicionar o acionador no menu de `src/routes/painel.tsx` via contexto em `luvi-core/context.tsx`.
- Avatar: novo recorte/enquadramento do asset atual da Luvi por produto e ajuste das classes `luvi-avatar*` em `src/styles.css`.
- Produtos: `listProducts`/`saveProduct`/`deleteProduct` em `src/modules/mvp/server.ts` ganham status, categoria por id e checagem de vínculo impeditivo; UI em `src/routes/painel.produtos.tsx`; loja em `src/routes/p.$slug.tsx` com filtro + paginação client-side sobre os produtos ativos já retornados.
- Combos: novo módulo de servidor com CRUD de combos, schema Zod em `src/modules/public-booking/domain.ts`, seleção e avisos (toast) na etapa de serviços de `p.$slug.tsx`, e disponibilidade usando a duração do combo em `disponibilidade.server.ts`.
- Banco: SQL versionado em `docs/sql/` (categorias de produto, foto de serviço, combos, RPCs `v4`). Nenhum `DROP`, nenhuma alteração de dados existentes.

## Validação

Ao fim de cada etapa: navegação real no preview (mobile 360px e desktop) percorrendo os testes das seções 29-31 aplicáveis, mais verificação de regressão no fluxo público de agendamento e no login. No fechamento eu informo o que entrou em cada produto, quais SQL você precisa rodar, o que foi testado, o que precisou ser adaptado e limitações restantes.
