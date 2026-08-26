# Combos multiprofissionais + WhatsApp do cliente + confirmação e lembretes

Vale para LuBeauty e LuBarber. Nada do que funciona hoje é removido: combo executado por um único profissional continua exatamente como está.

## 1. Combos/adicionais com profissionais diferentes

Hoje um agendamento tem um profissional e uma duração única: o combo "Corte + Barba + Unha" trava o tempo total na agenda do barbeiro e, quando ninguém faz todos os serviços, não sobra horário nenhum.

Solução: **um pedido (grupo) com blocos por profissional**.

- Cada serviço é atribuído a um profissional apto (vínculo já existente entre serviço e profissional).
- Serviços do mesmo profissional formam um bloco contínuo; serviços de outro profissional formam outro bloco.
- **Modo de execução explícito e previsível:** cada item/bloco do combo pode ser configurado pela gestão como **simultâneo** ou **sequencial**. Itens sem configuração específica, quando executados por profissionais diferentes, usam simultâneo se houver disponibilidade compatível; caso não haja, caem para sequencial. Serviços do mesmo profissional são sempre sequenciais.
- Exemplo real: em "Corte + Barba + Unha", barbeiro e manicure iniciam às 14h, cada um ocupando só o próprio tempo.
- Todos os blocos compartilham `booking_group_id`, código e token: para o cliente é **um** agendamento.
- Um único profissional fazendo tudo → um único agendamento, comportamento atual intacto.

### Financeiro sem duplicar receita

- A receita é registrada **uma única vez por grupo** (valor pago pelo cliente), vinculada ao bloco principal/ao grupo, nunca uma cópia por profissional.
- Comissão e participação continuam por bloco/profissional, calculadas sobre o valor dos serviços daquele bloco.
- Relatórios de receita passam a somar por grupo; comissões seguem por profissional.

### Fluxo do cliente (sem mudança perceptível)

- Escolhe o profissional principal normalmente.
- Serviços que o principal executa ficam com ele automaticamente.
- Serviço que ele não executa: com um único apto, atribuição silenciosa (só informa "Unha com Maria"); com mais de um apto, aparece uma escolha curta apenas para aquele serviço.
- Horários oferecidos consideram a agenda de todos os envolvidos, com encaixe simultâneo quando possível.
- **Cancelar/remarcar age no grupo inteiro por padrão, com um único link/token.**

### Gestão

- Em Serviços: "quem executa" e profissional preferencial opcional (usado na atribuição automática).
- Agenda administrativa: blocos do mesmo pedido identificados pelo mesmo código, cada um na agenda do seu profissional.

## 2. Telefone do cliente abre o WhatsApp

Hoje o número no card do Painel Profissional usa `tel:`, o que abre o discador/Zoom.

- Clique no número/ícone abre a conversa do cliente no WhatsApp (`wa.me`), funcionando em celular e WhatsApp Web no desktop.
- Número normalizado apenas para o link (55 + DDD + número), sem alterar o valor armazenado nem o exibido.
- Nenhuma mensagem enviada automaticamente: abre a conversa vazia.
- Ícone de telefone substituído por ícone de WhatsApp.
- Aplicado no Painel Profissional e nos cards/detalhes de agendamento da Agenda Administrativa. Onde já existir ação específica de ligar, ela é mantida em separado; o clique principal prioriza WhatsApp.

## 3. Confirmação com aviso ao cliente

- "Confirmar" continua atualizando o status oficial, respeitando permissões atuais.
- Após confirmar, aparece a ação **"Avisar cliente no WhatsApp"**, que abre a conversa com mensagem pronta usando dados reais: "Olá, {nome}! 😊 Seu agendamento de {serviço} foi confirmado para {data}, às {horário}. Esperamos você!"
- Nada é enviado automaticamente — o profissional/gestão toca em Enviar.
- Grupo/combo multiprofissional: **uma única confirmação e uma única mensagem** com o resumo do atendimento, sem mensagem por profissional.

## 4. Permissão de confirmação

Nova opção nas Configurações da empresa: **"Permitir que profissionais confirmem agendamentos com o cliente"** — padrão desativado.

- Desativada: gestão/recepção confirma oficialmente; o profissional não confirma oficialmente nem abre a mensagem ao cliente. A ação dele no card passa a se chamar **"Aceitar atendimento"** (registro interno de ciência), nunca "Confirmar", para não se confundir com a confirmação oficial enviada ao cliente.
- Ativada: o profissional vê **"Confirmar"** e confirma oficialmente **apenas os próprios atendimentos**, podendo então usar "Avisar cliente no WhatsApp".
- Gestão/recepção confirma qualquer agendamento. Em grupos, a confirmação oficial é única para o pedido.
- Validação no servidor, não só na interface.

## 5. Lembretes aos clientes (preparado)

Nova área em Configurações de Agendamento → "Lembretes aos clientes":

- ativar/desativar; antecedência (24h, 12h, 2h); texto padrão editável;
- variáveis: nome do cliente, serviço, data, horário e nome da empresa.

Sem simulação de envio: enquanto não houver integração de WhatsApp capaz de disparar, a tela indica claramente que o envio depende dessa integração. "Confirmar", "Avisar cliente" e "Lembrete automático" ficam nomeados e explicados separadamente.

## Detalhes técnicos

- Migração `docs/sql/20260833-...`: `appointments.booking_group_id` + `group_position`, `appointment_services.professional_id`, `tenants.confirmation_permission`, campos de lembrete (`reminder_enabled`, `reminder_lead_minutes`, `reminder_template`), índices, RLS e grants no padrão das anteriores.
- `get_public_booking_availability_v3`: particiona serviços por profissional apto e valida cada bloco contra horário de trabalho, intervalos, bloqueios e conflitos daquele profissional, permitindo blocos simultâneos.
- `create_public_booking_v4`: cria os blocos do grupo em uma transação, conflito checado por bloco, código/token compartilhados. v2/v3 preservadas; fail-closed mantido em `disponibilidade.server.ts`.
- Receita: `syncAppointmentFinancials` passa a lançar receita idempotente por `booking_group_id` (uma entrada por grupo) e comissões por bloco.
- Front: `p.$slug.tsx`, `agendamento.$token.tsx` (grupo), `painel.agenda.tsx`, `painel.servicos.tsx`, `painel.empresa.tsx`/configurações, `profissional.index.tsx` (WhatsApp + confirmar). Link via `whatsappDigits` de `src/lib/telefone.ts`.

## Rodadas

1. Migração + disponibilidade/criação por grupo (backend) e receita única por grupo.
2. Fluxo público: atribuição automática, escolha quando houver mais de um apto, horários simultâneos, cancelar/remarcar em grupo.
3. Gestão/profissional: agenda agrupada, "quem executa", permissões de confirmação, validação de comissões.
4. WhatsApp do cliente, "Avisar cliente no WhatsApp" e área de lembretes.

Ao final informo a SQL a executar manualmente (a migração da rodada 1).
