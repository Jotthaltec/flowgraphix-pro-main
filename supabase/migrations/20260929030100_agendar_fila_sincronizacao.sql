-- Processa a fila de sincronização de produtos a cada minuto (pg_cron).
--
-- Separada de 20260929030000 para poder ser aplicada ou revertida sozinha:
-- sem este agendamento a fila continua registrando e agrupando alterações,
-- e a publicação manual no Flow continua fechando os itens.
--
-- Cada execução é uma transação: se cair no meio, os itens voltam como
-- estavam e são pegos na execução seguinte. cron.schedule com o mesmo nome
-- substitui o agendamento, então rodar de novo não duplica o job.

create extension if not exists pg_cron;

select cron.schedule(
  'store-product-sync-queue',
  '* * * * *',
  $job$select store.process_product_sync_queue(20)$job$
);
