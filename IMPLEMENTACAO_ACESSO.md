# Separação de acesso — LuBeauty e LuBarber

Esta versão adiciona a primeira camada estrutural de autorização por produto.

## Perfis demonstrativos

- `somente-beleza`: permite apenas LuBeauty.
- `somente-barbearia`: permite apenas LuBarber.
- `ambos`: permite alternar entre os dois produtos.

No painel, o seletor **Simular autorização** permite testar os três cenários enquanto o Supabase ainda não está conectado.

## Comportamento implementado

- O seletor LuBeauty/LuBarber continua visível.
- Um produto sem autorização aparece com cadeado.
- Ao tentar acessá-lo, o sistema não troca de área e mostra um aviso de acesso restrito.
- Se a autorização mudar enquanto a pessoa estiver em um produto que deixou de ser permitido, ela é devolvida automaticamente ao produto autorizado.
- O tipo ativo salvo no navegador é validado antes de ser restaurado.
- A regra de autorização fica centralizada em `src/data/acesso.tsx` e é aplicada pelo contexto do negócio.

## Próxima etapa de segurança real

Esta versão usa dados locais apenas para demonstração. Quando o Supabase for conectado, o perfil demonstrativo será substituído por uma tabela de acessos vinculada ao usuário autenticado. A proteção final também deverá existir no banco de dados, com RLS e validação no servidor, para impedir acesso pela API ou por URLs diretas.
