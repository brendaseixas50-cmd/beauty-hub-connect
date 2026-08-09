# Luvi Core

Módulo compartilhado da assistente institucional da Lu IA Studio. O código não pertence ao LuBeauty ou ao LuBarber; cada produto fornece apenas tema, assets oficiais, tom e contexto autorizado.

## Fluxo atual

1. `LuviContextProvider` recebe a sessão já autenticada e identifica produto, tenant, usuário, permissões e rota.
2. Cada tela privada entrega somente fatos derivados dos dados que ela já carregou, sem novas consultas ou mudanças no backend.
3. `RuleBasedLuviProvider` executa regras determinísticas e retorna no máximo três orientações.
4. `LuviAssistant` apresenta contexto, respostas guiadas, atalhos e histórico apenas da sessão.
5. Ações disponíveis são navegação ou explicação. Nenhuma gravação é executada pela Luvi.

## IA futura

`FutureOpenAIProvider` é apenas um contrato inativo. A futura integração deverá ocorrer no servidor em `/api/luvi/chat`, autenticando novamente usuário e tenant, aplicando permissões, limites e ferramentas autorizadas. O navegador nunca deverá receber `OPENAI_API_KEY` nem chamar a OpenAI diretamente.

Configuração futura prevista:

```env
OPENAI_API_KEY=
LUVI_AI_ENABLED=false
LUVI_AI_PROVIDER=guided
```

Essas variáveis não são necessárias para o modo guiado atual e nenhuma chave foi adicionada ao projeto.

## Reutilização

Um produto futuro usa o mesmo provider e componentes ao registrar um `LuviTheme` e informar seu `LuviProductId`. Enquanto não existir arte aprovada, deve utilizar os assets lilás oficiais do tema `default`.
