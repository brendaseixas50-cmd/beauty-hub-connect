# Acabamento da página pública + combos/adicionais com vários profissionais

## Problema 1 — visual da página pública

**Resquícios de rosa**: quando a empresa não escolhe cores, o sistema aplica a paleta padrão de beleza (destaque rosado `#8b5e67` e creme derivado), inclusive em barbearias. Não é bug de tema, é o padrão salvo.

Correção:
- Paleta padrão por produto: LuBeauty mantém a rosa atual; LuBarber passa a nascer preto/grafite com dourado.
- Empresas LuBarber que nunca personalizaram as cores passam a exibir o padrão do produto (não sobrescreve quem já escolheu cores próprias).
- Chips, abas ("Serviços/Combos"), etiqueta "Combo", barra de progresso, resumo e botões passam a usar as cores da paleta ativa, sem tons fixos de beleza.

**Cards saindo da margem** (visível no print): o cartão de serviço envolve nome e preço no mesmo bloco, então o preço é empurrado para fora e o nome não quebra linha.

Correção:
- Nome do serviço quebra em várias linhas automaticamente, sempre dentro do cartão; preço fica fixo à direita, sem encolher.
- Vale para serviços, combos, adicionais e cartões de profissional.
- Remoção da duplicação do resumo "120 min / R$ 140,00" (hoje aparece duas vezes na etapa 1) e do botão "Avançar" sobreposto ao resumo.
- Revisão em 360px, 768px e desktop nos dois produtos.

## Problema 2 — combo/adicional com serviços de profissionais diferentes

Hoje um agendamento tem **um** profissional e **uma** duração total: o combo "unha + corte + barba" trava o tempo inteiro na agenda do barbeiro, e quando nenhum profissional faz todos os serviços simplesmente não sobra horário.

### O que sugiro

Um agendamento por profissional, agrupados como um único pedido do cliente:

- Cada serviço do combo/adicional é atribuído a um profissional apto (quem a gestão vinculou ao serviço em Serviços/Profissionais).
- Serviços do mesmo profissional viram um bloco contínuo; serviços de outro profissional viram outro bloco, encaixado em seguida na agenda **dele**.
- Todos os blocos compartilham um mesmo grupo/código de reserva: para o cliente é um único agendamento, com uma confirmação e um único link de gerenciamento.
- Se um único profissional faz tudo (situação de hoje), continua sendo um único agendamento — nada muda no comportamento atual.

Ganhos diretos: cada agenda consome só o tempo do que aquela pessoa executa, o horário volta a existir quando os serviços se dividem entre duas pessoas, e a comissão já cai para o profissional correto porque a regra atual calcula comissão por agendamento/profissional.

### Fluxo do cliente (sem mudar o que ele já conhece)

- Continua escolhendo o profissional principal normalmente.
- Serviços do combo/adicional que o principal executa ficam com ele automaticamente.
- Serviço que o principal não executa: se só uma pessoa faz, é atribuída em silêncio (aparece apenas como informação "Unha com Maria"); se mais de uma faz, aparece uma escolha curta só para aquele serviço.
- Horários oferecidos passam a considerar a agenda de cada profissional envolvido — só aparece horário em que o conjunto realmente cabe.

### Gestão

- Em Serviços, cada serviço ganha "quem executa" (profissionais aptos) e um profissional preferencial opcional, usado para a atribuição automática.
- Na agenda administrativa, os blocos do mesmo pedido aparecem identificados como parte do mesmo atendimento do cliente (mesmo código), cada um na coluna/linha do seu profissional.
- Financeiro, receita, comissões, repasses, "Meus ganhos", cancelamento/remarcação e permissão de conclusão continuam com as regras atuais, aplicadas por bloco.

## Detalhes técnicos

- Migração nova `docs/sql/20260833-...`: `appointments.booking_group_id`, `appointments.group_position`, `appointment_services.professional_id`, índices e RLS/grants no mesmo padrão das anteriores; nada removido.
- Nova RPC `get_public_booking_availability_v3`: em vez de exigir um profissional que faça todos os serviços, particiona os serviços por profissional apto e valida cada bloco contra a agenda daquele profissional (horário de trabalho, intervalos, bloqueios, conflitos). A v2 continua existindo.
- Nova RPC `create_public_booking_v4`: cria os agendamentos do grupo em uma única transação, com validação de conflito por bloco; devolve o mesmo código e token de gerenciamento para o grupo. Fail-closed mantido em `disponibilidade.server.ts`.
- `src/modules/public-booking/*`, `p.$slug.tsx`, `painel.agenda.tsx`, `painel.servicos.tsx` e o portal `agendamento.$token.tsx` passam a tratar grupo de agendamentos; cancelar/remarcar age no grupo.
- Comissões: `syncAppointmentFinancials` roda por agendamento do grupo, sem alteração de regra.
- Cores: `src/lib/cores-publicas.ts` ganha padrão por produto; `p.$slug.tsx` e `painel.pagina-publica.tsx` usam esse padrão.

## Rodadas

1. Migração + disponibilidade e criação de reserva por grupo (backend).
2. Fluxo público: atribuição automática, escolha só quando houver mais de um apto, horários por grupo.
3. Gestão: agenda agrupada, "quem executa" em Serviços, validação de comissões.
4. Acabamento visual: paleta padrão por produto e cards sem transbordo.

Ao final informo se há SQL para executar manualmente (haverá: a migração da rodada 1).
