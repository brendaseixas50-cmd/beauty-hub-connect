# Beauty Hub Connect — desenvolvimento v3

## Entregue nesta versão

- Tela de entrada separada da página pública.
- Painel protegido: visitantes sem sessão são enviados para `/entrar`.
- Três contas demonstrativas para validar LuBeauty, LuBarber e acesso aos dois.
- Sessão demonstrativa persistida no navegador.
- Saída da conta no menu desktop e mobile.
- Tela de acesso restrito preparada para URLs e produtos não autorizados.
- Arquivo `.env.example` para Supabase, checkout e suporte.
- Migração SQL adicional para assinaturas, eventos de pagamento e auditoria.

## Limite atual

As contas ainda são demonstrativas. A proteção comercial definitiva exige:

1. criar/conectar o projeto Supabase;
2. habilitar Auth por e-mail e Google;
3. executar as migrações SQL;
4. buscar sessão e assinaturas do banco no servidor;
5. configurar webhooks da plataforma de pagamento.

Nenhuma chave administrativa deve ser exposta no navegador.
