# Painel Profissional — LuBeauty + LuBarber

Implementação incremental. Nada de infraestrutura, autenticação, Mercado Pago, URLs, página pública ou fluxo público de agendamento é alterado.

## 1. Acesso individual do profissional

- Cada profissional passa a ter conta própria de login (e-mail + senha), vinculada ao `professional_id` e ao tenant.
- O administrador cadastra o profissional com e-mail individual e clica em **Gerar acesso**: o sistema cria (ou vincula) a conta de autenticação, marca a função "profissional" na empresa e mostra uma senha temporária de primeiro acesso, junto com o link do Painel Profissional para copiar e enviar.
- O link vai para a tela de login normal; após autenticar, cada pessoa entra somente no próprio painel.
- Sessão segue o comportamento atual (não pede login a cada abertura; ao expirar, pede novamente).
- O proprietário que também atende usa a própria conta — sem conta duplicada — e tem acesso ao Painel Administrativo e ao seu Painel Profissional.

## 2. Painel Profissional (rota nova `/profissional`)

Identidade visual herdada do produto (LuBeauty ou LuBarber), responsivo/mobile-first.

Conteúdo restrito ao profissional autenticado:
- agenda por dia e por semana, com serviço, combo, adicionais, duração real, data, hora, status e observações;
- cliente do atendimento com telefone/contato;
- criar agendamento manual, remarcar, cancelar, concluir;
- bloqueio de horário, folga, férias, indisponibilidade por imprevisto;
- edição dos próprios horários de atendimento.

Nenhum dado de outro profissional é exibido ou consultável.

## 3. Painel Administrativo

- Continua com agenda geral, filtro por profissional, agenda individual, bloqueios, férias, folgas, conflitos e histórico (sem mudanças destrutivas).
- Módulo **Equipe** (a partir da tela de Profissionais) lista: nome — função — status — Ver painel — Copiar link, com ativar/desativar e gerar acesso.

## 4. Solo x Equipe

- **Solo**: módulo Equipe oculto no menu; limite de 1 profissional ativo; tentativa de adicionar outro mostra orientação de upgrade para Equipe. Proprietário mantém Painel Administrativo, Painel Profissional próprio e Página Pública.
- **Equipe**: até 8 profissionais no total (incluindo o proprietário se atender); módulo Equipe visível; administrador cadastra, edita, ativa e desativa.
- Limites validados no servidor (regra `planCapacity` já existente é reutilizada).

## 5. Desativação e revogação

- Ao desativar, o acesso ao Painel Profissional é bloqueado imediatamente no backend, inclusive para sessões já abertas e para o PWA instalado.
- Dados e histórico são preservados; nada é excluído.
- Tela de bloqueio: "Seu acesso a esta empresa está desativado. Entre em contato com o administrador."
- Reativar restaura permissões mantendo a mesma conta, agenda e histórico.

## 6. PWA — instalar como aplicativo

- Manifesto e ícones por produto, com nome e cores do LuBeauty/LuBarber.
- Primeiro acesso ao Painel Profissional: aviso discreto "Instale o app no seu celular" / "Tenha acesso rápido à sua agenda direto da tela inicial." com **Instalar aplicativo** e **Agora não**. Não reaparece após instalar; "Agora não" não bloqueia nada.
- Item fixo no menu lateral: **Instalar aplicativo** (Android/Chrome usa o prompt nativo; iPhone/Safari abre instruções passo a passo de Compartilhar → Adicionar à Tela de Início → Adicionar).
- Em modo standalone, o item vira "Aplicativo instalado"; se o app for removido do celular, a opção reaparece.
- Linguagem sem menção a lojas de aplicativos.

## Detalhes técnicos

**SQL versionado (executar nesta ordem, depois dos arquivos já pendentes 20260822 → 20260823 → 20260824):**
1. `docs/sql/20260825-painel-profissional-acesso.sql`
   - índice único parcial em `professionals(tenant_id, user_id)` e em e-mail normalizado (nada destrutivo);
   - função `get_my_professional_context()` (SECURITY DEFINER): retorna `professional_id`, `tenant_id`, `active`, produto e função para o usuário autenticado;
   - RPC administrativa `admin_link_professional_account(p_professional_id, p_user_id)` que grava `user_id` e cria a membresia com função `professional`;
   - políticas RLS adicionais: profissional lê/escreve apenas linhas de `appointments`, `appointment_services`, `professional_unavailability` e `professionals` cujo `professional_id` seja o seu, dentro do próprio tenant, e somente enquanto `professionals.active = true`; leitura de `clients` limitada a clientes com atendimento dele; `services`/`service_combo_items`/`service_addon_links` somente leitura no tenant;
   - GRANTs correspondentes para `authenticated`/`service_role`.

**Backend/app:**
- `src/modules/professional-panel/server.ts` — server functions com validação de permissão no banco (contexto do profissional resolvido pelo servidor, nunca por `professional_id` vindo da URL): agenda do dia/semana, criar/remarcar/cancelar/concluir, bloqueios/folga/férias, horários próprios.
- `src/modules/professional-panel/access.server.ts` — resolve o contexto do profissional e nega acesso quando inativo.
- `src/modules/mvp/server.ts` — ações de administrador: gerar acesso do profissional (via cliente privilegiado, apenas depois de verificar que o solicitante é owner/admin do tenant), ativar/desativar, limites Solo/Equipe.
- Novas rotas: `src/routes/profissional.tsx` (layout + guarda + PWA), `src/routes/profissional.index.tsx` (agenda), `src/routes/profissional.horarios.tsx`, `src/routes/profissional.bloqueios.tsx`, `src/routes/profissional.acesso-desativado.tsx`.
- `src/routes/painel.tsx` — menu ganha "Ver Meu Painel Profissional", "Equipe"/"Ver Painéis Profissionais" (só no plano Equipe) e "Instalar aplicativo".
- `src/routes/painel.profissionais.tsx` — gerar/ver acesso, copiar link, status, orientação de upgrade no Solo.
- PWA: `public/manifest.webmanifest` (+ ícones existentes), registro de service worker mínimo em `public/sw.js`, componente `src/components/instalar-app.tsx` e hook de instalação.

**Preservado sem alteração:** URLs, domínio, deploy, backend existente, autenticação e login Google, webhooks, secrets, variáveis de ambiente, Mercado Pago, página pública, os 5 passos do agendamento, Beta Fechado/Painel Master, planos e identidade visual.
