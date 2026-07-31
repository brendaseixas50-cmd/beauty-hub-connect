# Beauty Hub Connect

Plataforma SaaS multiempresa para profissionais da beleza, desenvolvida pela Lu IA Studio. O projeto reúne página pública, agendamento e painel privado responsivo em uma arquitetura preparada para Supabase e implantação na Vercel.

## Estado desta versão

- Aplicação React 19 + TypeScript + TanStack Start, compilada pelo Vite;
- adaptador Nitro fixado para Vercel;
- login separado da página pública e painel protegido no servidor;
- sessão demonstrativa em cookie `httpOnly` (adaptador temporário);
- contexto de usuário com empresa, papel e permissões;
- contratos de repositório que exigem `tenantId` em toda operação privada;
- esquema SQL de referência com Row Level Security para isolamento multiempresa;
- dados visuais demonstrativos preservados;
- Supabase ainda não conectado a nenhum projeto real.

## Executando localmente

Requisitos: Node.js 22 ou superior. Bun é opcional.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Para acessar o painel demonstrativo:

```text
E-mail: demo@beautyhub.local
Senha: demo123
```

Os mesmos scripts funcionam com Bun:

```bash
bun install
bun run dev
```

## Validação antes do deploy

```bash
npm run typecheck
npm run lint
npm run build
# ou
bun run build
```

`npm run check` executa typecheck, lint e build em sequência. O build de produção gera a estrutura da Vercel em `.vercel/output`.

Para validar localmente o artefato já compilado, execute `npm run preview`.

## Implantação na Vercel

1. Importe este repositório na Vercel.
2. Use Node.js 22 ou superior.
3. Mantenha o comando de build como `npm run build` (ou `bun run build`).
4. Não configure manualmente um diretório de saída: o Nitro gera o Vercel Build Output API.

As variáveis abaixo são opcionais nesta versão e estão documentadas em `.env.example`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Arquitetura

```text
src/
├── components/              componentes reutilizáveis e UI
├── data/                    dados demonstrativos atuais
├── modules/
│   ├── auth/                sessão, login, contexto, papéis e permissões
│   ├── supabase/            fronteira da futura integração
│   └── tenancy/             domínio e contratos multiempresa
├── routes/                  rotas públicas e painel protegido
├── server.ts                entrada SSR e tratamento de falhas críticas
└── start.ts                 middleware global e proteção CSRF
supabase/schema.sql           modelo relacional e políticas RLS de referência
```

### Autenticação

`/login` é público e `/painel` protege todas as rotas filhas em `beforeLoad`. A validação consulta uma server function e usa cookie `httpOnly`; digitar a URL do painel sem sessão redireciona para o login. O adaptador demonstrativo deve ser substituído por Supabase Auth quando o banco for conectado, mantendo os contratos e a interface de sessão.

### Isolamento multiempresa

Cada usuário autenticado pertence a um único `tenantId`. Todos os modelos privados carregam esse identificador e todo repositório recebe um `TenantContext` obrigatório. No banco, `supabase/schema.sql` ativa RLS e limita consultas e alterações ao tenant retornado pelo perfil do usuário autenticado. A aplicação deve manter as duas camadas: filtro explícito no repositório e RLS no Supabase.

### Permissões

Papéis disponíveis: `owner`, `admin`, `professional` e `receptionist`. As permissões são tipadas por domínio (agenda, clientes, serviços, financeiro, equipe e configurações) e podem ser verificadas pelo contexto de autenticação ou na camada de servidor.

## Conectando o Supabase futuramente

1. Crie o projeto e revise/aplique `supabase/schema.sql` por migration.
2. Instale o cliente oficial e implemente o adaptador em `src/modules/supabase`.
3. Troque a sessão temporária de `src/modules/auth/server.ts` por Supabase Auth.
4. Exija autenticação e permissão em cada server function privada.
5. Implemente repositórios sempre filtrando `tenant_id`; nunca use a chave `service_role` no navegador.
6. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na Vercel.

## Escopo visual preservado

A plataforma será destinada a profissionais como manicures, nail designers, lash designers, designers de sobrancelhas, cabeleireiras, depiladoras, esteticistas e massoterapeutas.

Neste primeiro momento, crie somente a interface, as telas e a navegação utilizando dados demonstrativos.

Não conecte banco de dados, pagamentos, WhatsApp ou inteligência artificial ainda.

A plataforma deve ser multiempresa. Futuramente, cada profissional terá uma conta própria, um painel privado e uma página pública personalizada.

Os dados de uma profissional nunca poderão aparecer na conta de outra.

Antes de criar as telas, apresente um plano resumido das páginas, dos componentes e do fluxo de navegação.

Depois, implemente apenas essa primeira estrutura visual.

Crie dois ambientes principais:

Página pública da profissional

A página pública deve ser moderna, elegante, leve e profissional, sem aparência infantil.

Deve conter:

logo e nome do espaço ou da profissional;

foto da profissional;

descrição sobre a profissional;

endereço ou região de atendimento;

Instagram;

WhatsApp;

horários de funcionamento;

banner principal;

botão “Agendar horário”;

lista de serviços;

categorias de serviços;

preço e duração de cada serviço;

galeria de trabalhos realizados;

avaliações de clientes;

políticas de cancelamento, atraso e remarcação;

formas de pagamento;

botão para falar no WhatsApp.

Crie também uma página de detalhes do serviço contendo:

nome do serviço;

descrição;

fotos;

categoria;

duração;

preço;

formato de atendimento disponível;

profissional responsável;

botão “Agendar este serviço”.

Painel privado da profissional

Crie um painel responsivo, com menu lateral no computador e navegação adaptada para celular e tablet.

O painel deve ter as seguintes áreas:

Visão geral;

Agenda;

Serviços;

Clientes;

Galeria;

Financeiro;

Estoque;

Marketing;

Configurações da página pública.

Na visão geral, mostre cartões demonstrativos com:

agendamentos de hoje;

próximos atendimentos;

faturamento do mês;

clientes cadastrados;

horários disponíveis;

serviço mais procurado.

Na agenda, crie visualizações por:

dia;

semana;

mês.

Na área de serviços, permita visualizar, adicionar e editar:

nome;

categoria;

descrição;

preço;

duração;

fotos;

disponibilidade;

profissional responsável;

formato de atendimento;

preço no local;

preço em domicílio;

taxa de deslocamento.

Na área de clientes, mostre:

nome;

telefone;

aniversário;

endereço;

último atendimento;

próximo agendamento;

histórico;

observações.

Na área de configurações, permita visualizar campos para alterar:

logo;

cores;

banner;

descrição;

endereço;

região atendida;

WhatsApp;

Instagram;

políticas;

horários de funcionamento;

formatos de atendimento.

Configuração dos formatos de atendimento

Crie uma seção chamada “Formato de atendimento”.

A profissional deve poder escolher entre:

somente no meu espaço;

somente em domicílio;

atendimento no meu espaço e em domicílio.

Quando escolher somente no próprio espaço, o cliente deve visualizar apenas a opção de atendimento no local.

Quando escolher somente em domicílio, o cliente deve visualizar apenas a opção de atendimento em domicílio.

Quando escolher atendimento nos dois formatos, deve existir um botão para ativar ou desativar a exibição da opção de atendimento em domicílio na página pública.

A opção de atendimento em domicílio só pode aparecer para os clientes quando estiver ativada pela profissional.

Crie campos para a profissional informar:

nome ou identificação do local de atendimento;

endereço ou região do espaço;

cidades, bairros ou regiões atendidas em domicílio;

observações sobre atendimento externo;

dias disponíveis para atendimento em domicílio.

Configuração dos preços por formato de atendimento

Cada serviço deve permitir diferentes formas de cobrança.

A profissional deve poder escolher entre:

utilizar o mesmo preço no local e em domicílio;

cadastrar um preço no local e outro preço em domicílio;

cobrar apenas uma taxa de deslocamento adicional;

cobrar um preço diferente em domicílio mais uma taxa de deslocamento;

não cobrar taxa de deslocamento.

Crie os seguintes campos no cadastro do serviço:

preço no local;

preço em domicílio;

utilizar o mesmo preço nos dois formatos;

cobrar taxa de deslocamento;

tipo de taxa de deslocamento.

No campo “Tipo de taxa de deslocamento”, ofereça as opções:

taxa fixa;

taxa a combinar;

sem taxa.

Se a profissional escolher taxa fixa, exiba um campo para informar o valor.

Se escolher taxa a combinar, exiba uma mensagem para o cliente informando:

“O valor da taxa de deslocamento será confirmado após a análise do endereço.”

A profissional pode utilizar apenas um valor para o serviço e deixar a taxa de deslocamento a combinar.

Ela também pode cadastrar um valor mais alto para atendimento em domicílio e, além disso, cobrar uma taxa de deslocamento fixa ou a combinar.

Todos esses campos devem ser opcionais e devem aparecer ou desaparecer de acordo com as escolhas realizadas.

Fluxo visual do agendamento

Na tela de agendamento, o cliente deve seguir este fluxo:

escolher o serviço;

escolher o formato de atendimento;

escolher a data;

escolher o horário;

preencher nome e WhatsApp;

informar endereço, quando escolher atendimento em domicílio;

visualizar o resumo do agendamento;

confirmar.

Quando a profissional atender somente no próprio espaço, não mostre a escolha do formato de atendimento.

Quando atender somente em domicílio, a opção em domicílio deve aparecer automaticamente.

Quando atender nos dois formatos, mostre:

“Como você deseja ser atendido?”

Com as opções:

no espaço da profissional;

em domicílio.

Se o cliente escolher atendimento em domicílio, mostre campos para:

CEP;

rua;

número;

complemento;

bairro;

cidade;

ponto de referência.

No resumo do agendamento, mostre:

serviço;

data;

horário;

duração;

formato de atendimento;

endereço;

valor do serviço;

preço em domicílio, quando aplicável;

taxa de deslocamento fixa, quando aplicável;

aviso de taxa a combinar, quando aplicável;

valor final conhecido até aquele momento.

Quando a taxa estiver a combinar, não invente um valor final.

Mostre a mensagem:

“Seu agendamento será enviado para análise. A profissional confirmará a disponibilidade e o valor do deslocamento após verificar o endereço.”

Estilo visual

Use uma identidade visual sofisticada, leve e acolhedora.

A interface não deve ser infantil.

Utilize:

bastante espaço em branco;

textos legíveis;

cartões organizados;

botões claros;

navegação simples;

formulários bem divididos;

boa experiência no celular.

A página pública será acessada principalmente por celular.

O painel da profissional deve funcionar bem no computador, celular e tablet.

Utilize dados fictícios realistas para demonstrar todas as telas.

Nesta primeira etapa, não implemente funções reais.

Crie apenas:

as telas;

os formulários;

os botões;

as opções;

os estados visuais;

os fluxos de navegação;

os dados demonstrativos.

Não conecte Supabase, pagamentos, WhatsApp, mapas, cálculo de distância ou inteligência artificial nesta etapa.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/027aad8e-1cf5-4443-873a-cad03450a045).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
