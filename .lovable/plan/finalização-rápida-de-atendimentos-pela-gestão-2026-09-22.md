# Finalização rápida de atendimentos pela gestão

## Objetivo
Deixar a conclusão ou o cancelamento diretamente na agenda da gestão. Ao concluir, a comissão será lançada automaticamente para o profissional responsável e aparecerá em “Meus ganhos”.

## Alterações
- Adicionar ações rápidas **Finalizar** e **Cancelar** ao abrir cada atendimento na agenda da gestão.
- Pedir confirmação antes de alterar o status, evitando toques acidentais.
- Atualizar o atendimento sem exigir a abertura do formulário completo e atualizar a agenda imediatamente.
- Reutilizar o cálculo já existente de receita e comissão, com proteção contra lançamentos duplicados.
- Remover do painel profissional os controles de conclusão, cancelamento e falta.
- Bloquear essas mudanças também no servidor para que não possam ser acionadas pelo painel profissional fora da interface.

## Validação
- Confirmar que somente a gestão vê e usa os novos botões.
- Confirmar que finalizar muda o atendimento para concluído e gera a comissão do profissional.
- Confirmar que cancelar não gera comissão e desfaz lançamento automático, se houver.
- Confirmar que o painel profissional continua exibindo a agenda e os ganhos, sem controles de finalização.
