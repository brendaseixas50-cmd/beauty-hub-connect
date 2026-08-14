# Correção real: login Google em 1 tentativa + planos no Painel Master

Peço desculpas: as duas últimas rodadas mexeram no código sem provar a causa. Este plano começa provando o erro no navegador antes de mudar qualquer coisa.

## 1. Descobrir a causa de verdade (primeiro passo, antes de corrigir)

- Rodar o fluxo completo no navegador automatizado (sessão nova) e capturar: URLs de redirecionamento, cabeçalhos `Set-Cookie` do callback `/auth/confirm`, e o que o servidor responde.
- Chamar a listagem de empresas do Painel Master e capturar a mensagem de erro real do banco (hoje ela é engolida e trocada por "Não foi possível carregar as empresas agora").
- Só depois aplicar a correção, com a causa confirmada nos registros.

Hipótese principal do login (a confirmar): o callback troca o código do Google pela sessão dentro de `beforeLoad` e em seguida lança um redirecionamento. Se os cookies gravados nessa etapa não seguirem junto com a resposta de redirecionamento, o navegador chega ao painel sem sessão e volta ao login — exatamente o comportamento do vídeo. É por isso que a segunda tentativa "funciona": o cookie da primeira só entra em outro momento do fluxo.

Hipótese principal do card de planos (a confirmar): uma das consultas do card (empresas, assinaturas, e-mail do responsável via API administrativa, contagem de profissionais) falha e derruba o card inteiro.

## 2. Login Google: uma única tentativa

- Mover a troca do código do Google para um endpoint de servidor dedicado que responde o redirecionamento com os cookies de sessão anexados de forma explícita — sem depender do caminho que hoje perde o cookie.
- Nesse mesmo passo, no mesmo pedido: identificar o produto de origem (`beauty` / `barber`), preparar/selecionar a empresa correta e redirecionar direto para o painel daquele produto.
- Se a sessão não puder ser criada, voltar ao login com mensagem clara em vez de silêncio.
- Testes obrigatórios: entrar no LuBeauty em 1 tentativa, sair, entrar de novo; mesmo roteiro no LuBarber; confirmar que o login por e-mail/senha, o link de confirmação de cadastro e a recuperação de senha continuam funcionando.

## 3. Painel Master: planos Solo/Equipe claros e funcionando

- Tornar cada consulta do card independente: se o e-mail do responsável não puder ser lido, a empresa ainda aparece (sem e-mail) em vez de o card inteiro falhar.
- Mostrar o motivo curto da falha dentro do card quando algo realmente falhar, para você me enviar em vez de vermos só a mensagem genérica.
- Cada empresa localizada exibe: nome, e-mail do responsável, produto (LuBeauty Pro / LuBarber Pro), plano atual em destaque (Solo ou Equipe) e quantos profissionais ativos existem hoje.
- Dois botões claros: "Definir como Solo" (1 profissional) e "Definir como Equipe" (até 8). O botão do plano atual aparece marcado como atual.
- Ao trocar: salva no banco, atualiza a tela na hora e confirma ("Plano alterado para Equipe — até 8 profissionais").
- Equipe → Solo com mais de 1 profissional ativo: nada é excluído; aviso informando quantos precisam ser desativados e bloqueio de novas ativações até ficar compatível.
- Plano Empresa (50) continua no banco, mas oculto nesta versão.
- Acesso ao produto (ativo/bloqueado) segue como controle separado, intacto.

## Observação sobre o site testado

O vídeo e a foto são de `hub-connect.vercel.app`. As correções feitas aqui só chegam nesse endereço depois que o código vai para o GitHub e a Vercel publica um novo deploy. Vou validar no preview do Lovable e, ao terminar, aviso o que você precisa ver após o deploy.

## Detalhes técnicos

- Callback OAuth: endpoint de servidor (rota de servidor) fazendo `exchangeCodeForSession` e devolvendo `302` com `Set-Cookie` explícito; `redirectTo` do Google passa a apontar para ele, mantendo o parâmetro `produto`. `auth.confirm` continua atendendo os links de e-mail.
- `listTenantPlans` em `src/modules/beta-access/server.ts`: cada consulta em `try/catch` próprio, retorno com campo de aviso, e `listUsers` da API administrativa com fallback quando indisponível.
- `painel.admin-acessos.tsx`: card de plano reescrito na apresentação (plano atual, contagem de ativos, dois botões, confirmação e aviso de redução). Sem mudanças no gate de administrador.
- Limites permanecem Solo = 1 e Equipe = 8 em `src/modules/mvp/server.ts`; nenhuma alteração em agenda individual, página pública, WhatsApp ou identidade visual.
