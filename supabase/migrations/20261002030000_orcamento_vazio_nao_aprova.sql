-- Orçamento sem item ou com total zero não pode ser aprovado nem convertido.
--
-- Em 02/10/2026 o ORC-26-01004 (pedido de orçamento do site, ainda sem itens
-- nem preço) foi marcado como aprovado com total R$ 0,00. A trava fica no
-- banco para valer em todos os caminhos: Flow, admin da loja e link público.
-- Só age quando o status muda; registros antigos não são tocados.

create or replace function store.guard_quote_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('aprovado', 'convertido')
     and new.status is distinct from old.status
     and new.is_demo is not true then
    if coalesce(new.total, 0) <= 0 then
      raise exception 'Defina o valor do orcamento antes de aprova-lo.' using errcode = '22023';
    end if;
    if not exists (select 1 from store.quote_items i where i.quote_id = new.id) then
      raise exception 'Inclua ao menos um item no orcamento antes de aprova-lo.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_guard_quote_approval on store.quotes;
create trigger tr_guard_quote_approval
  before update of status on store.quotes
  for each row execute function store.guard_quote_approval();
