# Profissionais por serviço principal + adicionais multiprofissionais

Reaproveita a arquitetura de blocos (`booking_blocks_plan`, `booking_group_id`, `execution_mode`) já usada nos combos e a estende aos adicionais. Nada é reconstruído: as funções atuais (v3/v4) continuam existindo e o fluxo de serviço simples segue gerando um único bloco.

## O que está errado hoje

1. **Etapa "Escolha o profissional"** (`src/routes/p.$slug.tsx`): a lista aceita qualquer profissional que execute *ao menos um* dos serviços selecionados — incluindo adicionais. Logo, a manicure aparece como opção de um Corte.
2. **Resolução no banco** (`resolve_item_professional`): o adicional cai no fallback "qualquer apto, `order by id`", sem olhar agenda, e o serviço principal aceita o mesmo fallback — o que permite profissional incompatível.
3. **Configuração**: `service_addon_links` já tem `assigned_professional_id` e `execution_mode`, mas não há como definir *como* o executor é escolhido (automático / preferencial / cliente escolhe), nem UI para isso.
4. **Disponibilidade**: os horários só verificam conflito de agendamento por bloco; jornada, intervalo e bloqueio são checados no app (`disponibilidade.server.ts`) contra a janela inteira do atendimento, não bloco por bloco.

## Banco (migração nova, aditiva)

`docs/sql/20260837-adicionais-multiprofissionais.sql`:

- `service_addon_links`: novas colunas
  - `professional_mode text default 'any'` — `any` | `preferred` | `client_choice`
  - `preferred_fallback text default 'any'` — `any` (usa outro apto) | `none` (não oferece o horário)
- `resolve_item_professional_v2(tenant, service_id, assigned, chosen, mode, fallback, starts_at, duration, role)`:
  - papel **principal**: só aceita profissional ativo e vinculado ao serviço; sem apto compatível → retorna `null` (sem fallback incompatível).
  - papel **adicional**: respeita `mode`/`assigned`/escolha do cliente e, no automático, escolhe entre os aptos o primeiro **realmente livre** naquele intervalo (jornada, intervalo, bloqueio e agendamentos).
- `booking_blocks_plan_v2(tenant, service_ids, professional_id, addon_professionals jsonb, starts_at)`:
  - separa raízes **principais** (não `is_addon`) de **adicionais**;
  - principais e combos: comportamento atual, inalterado;
  - adicionais: bloco próprio, com `execution_mode` do vínculo (`parallel` = mesmo início do serviço pai; `sequential` = após o pai), preço e duração próprios do adicional;
  - devolve vazio quando qualquer bloco obrigatório não tem executor possível.
- `get_public_booking_availability_v4(...)` e `create_public_booking_v5(...)`: cópias das v3/v4 chamando o plano v2 e recebendo o mapa `addon_professionals` (adicional → profissional escolhido pelo cliente). Um único bloco continua delegando ao fluxo antigo. Mantêm código de reserva único, `booking_group_id` único, token único, cobrança única e comissão por bloco.
- `get_public_company_page_v4`: cada adicional passa a informar `professionalMode`, `preferredProfessionalId` e `eligibleProfessionalIds`.

## Backend do app

- `src/modules/public-booking/server.ts`: novos campos `addonProfessionals` (mapa validado por Zod) na disponibilidade e na reserva; chamada preferencial às v4/v5 com fallback para v3/v4 (mesmo padrão de continuidade já usado hoje).
- **Validação de servidor (não só visual)**: antes de criar a reserva, confirmar que o profissional escolhido é ativo e vinculado a **todos** os serviços principais, e que cada adicional foi atribuído a alguém vinculado àquele adicional. Falha → erro claro, sem fallback.
- `src/modules/public-booking/disponibilidade.server.ts`: passar a validar jornada/intervalo/bloqueio **por bloco** (usando o plano), em vez da janela inteira, para não descartar horário válido nem criar disponibilidade artificial.

## Frontend

- `p.$slug.tsx`
  - lista da etapa "Escolha o profissional" = apenas ativos vinculados aos **serviços principais** selecionados; "Qualquer profissional disponível" passa a significar "qualquer entre esses".
  - sem apto ao principal: mensagem clara, sem oferecer incompatível.
  - card de cada adicional: seletor compacto (`Profissional: [ Joana ▼ ]`) **somente** quando `professional_mode = client_choice` e houver mais de um apto; 1 apto ou modo automático → atribuição silenciosa.
  - resumo/confirmação: um único agendamento, com linhas discretas "Corte — Anthony / Unha — Bruna".
- `painel.servicos.tsx`: no vínculo de cada adicional, escolher entre "Qualquer profissional disponível", "Profissional preferencial" (+ comportamento se indisponível) e "Cliente escolhe", além de simultâneo/sequencial já existente.

## Agenda, financeiro e comissão

Sem mudança estrutural: cada profissional recebe só o seu bloco, a receita segue registrada uma vez por grupo (soma dos blocos = total do pedido) e a comissão sai por bloco. Cancelar/remarcar/confirmar continua agindo sobre o grupo.

## Testes (produção, com limpeza no final)

Script de QA cobrindo os 7 cenários pedidos, mais regressão de serviço simples, combo de um profissional e combo multiprofissional.

## Entrega

1. Migração SQL para você aplicar.
2. Depois de aplicada: código do app + UI e a bateria de testes.
