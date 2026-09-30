-- Estado completo de um pedido na homologação: psql -v num=NP-26-01005
\pset footer off
\echo '--- pedido (loja)'
select o.number, o.status, o.payment_status, o.total from store.orders o where o.number = :'num';

\echo '--- pagamentos'
select p.method, p.status, p.amount, p.paid_at is not null as pago
from store.payments p join store.orders o on o.id = p.order_id where o.number = :'num';

\echo '--- financeiro (store.finance_entries)'
select f.type, f.status, f.amount, f.category, f.paid_at is not null as pago
from store.finance_entries f join store.orders o on o.id = f.order_id where o.number = :'num';

\echo '--- produção (store.production_orders)'
select po.number, po.stage, po.product_name, po.quantity, po.due_date
from store.production_orders po join store.orders o on o.id = po.order_id where o.number = :'num';

\echo '--- espelho no CRM (public.orders)'
select order_number, total_value, payment_status, production_status, deadline
from public.orders where order_number = :'num';

\echo '--- histórico de status'
select h.from_status, h.to_status, h.created_at::timestamp(0)
from store.order_status_history h join store.orders o on o.id = h.order_id where o.number = :'num' order by h.created_at;

\echo '--- notificações'
select n.event, n.channel, n.title
from store.notifications n
where n.link like '%' || (select id::text from store.orders where number = :'num') || '%'
   or n.title like '%' || :'num' || '%' or n.body like '%' || :'num' || '%'
order by n.created_at;
