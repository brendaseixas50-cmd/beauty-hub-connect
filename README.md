# Beauty Hub Connect

SaaS multiempresa da Lu IA Studio para profissionais de beleza e barbearias. A aplicação usa React 19, TanStack Start, Supabase Auth/Postgres e Vercel.

## MVP operacional

- Cadastro com confirmação obrigatória por e-mail;
- login e logout reais pelo Supabase Auth;
- sessão persistente em cookies `httpOnly`, com renovação feita no servidor;
- recuperação e redefinição de senha;
- provisionamento automático de uma empresa e perfil proprietário por cadastro;
- painel protegido no servidor;
- isolamento multiempresa por Row Level Security;
- cadastro e edição da empresa;
- CRUD de profissionais, clientes, serviços e produtos;
- agenda com criação, edição, filtros, status e bloqueio de conflito de horários;
- estoque com saldo atual e histórico imutável de entradas e saídas;
- financeiro com receitas, despesas, status e exportação CSV;
- dashboard e relatórios calculados com dados reais;
- experiências LuBeauty Pro e LuBarber Pro vinculadas à empresa no banco;
- nenhuma chave `service_role` no código ou no navegador.

## Desenvolvimento local

Requisitos: Node.js 22 ou superior. Bun é opcional.

```bash
npm install
npm run dev
```

Os scripts também funcionam com Bun:

```bash
bun install
bun run dev
```

As variáveis públicas necessárias estão documentadas em `.env.example`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

A publishable key identifica o projeto e foi criada para uso público. A segurança dos dados depende das políticas RLS. Nunca adicione uma chave `service_role` a variáveis `VITE_*`.

## Banco e migrations

O schema oficial está em `supabase/migrations/`. As migrations criam:

- `tenants`;
- `profiles`;
- `clients`;
- `services`;
- `appointments`;
- `professionals`;
- `products` e `inventory_movements`;
- `financial_entries`;
- triggers de provisionamento e atualização;
- funções internas no schema não exposto `private`;
- índices, permissões e políticas RLS.

Cada usuário novo recebe um tenant próprio e um perfil `owner`. As tabelas privadas usam `auth.uid()` para resolver o tenant da sessão, e as referências de agendamento usam chaves compostas para impedir associações entre empresas.

## Validação

```bash
npm run check
# ou
bun run build
```

`npm run check` executa typecheck, lint e build. O Nitro gera o Vercel Build Output em `.vercel/output`.

## Rotas de autenticação

- `/cadastro` — criação de conta;
- `/login` — acesso ao painel;
- `/recuperar-senha` — solicitação de recuperação;
- `/auth/confirm` — troca segura do código/token enviado por e-mail;
- `/redefinir-senha` — definição da nova senha;
- `/painel` — área autenticada.
- `/painel/empresa` — cadastro da empresa;
- `/painel/profissionais`, `/clientes` e `/servicos` — operação comercial;
- `/painel/agenda` — agendamentos;
- `/painel/produtos` e `/estoque` — catálogo e inventário;
- `/painel/financeiro` e `/relatorios` — gestão financeira e indicadores;
- `/painel/configuracoes` — produto e horários da empresa.
