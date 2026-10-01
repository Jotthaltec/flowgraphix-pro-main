create extension if not exists pg_net with schema extensions;

create table if not exists store.social_product_campaigns (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique,
  status text not null default 'waiting_data'
    check (status in ('waiting_data', 'processing', 'ready', 'approval_sent', 'approved', 'rejected', 'published', 'ignored', 'retryable_error')),
  product_snapshot jsonb,
  copy jsonb,
  caption text,
  feed_path text,
  story_path text,
  notification_status text,
  last_error text,
  notified_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table store.social_product_campaigns enable row level security;

create index if not exists idx_social_product_campaigns_status
  on store.social_product_campaigns (status, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-campaigns', 'social-campaigns', false, 12582912, array['image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function store.touch_social_product_campaign_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tr_social_product_campaign_updated_at on store.social_product_campaigns;
create trigger tr_social_product_campaign_updated_at
before update on store.social_product_campaigns
for each row execute function store.touch_social_product_campaign_updated_at();

create or replace function store.dispatch_social_product_campaign(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'social_webhook_url'
  order by created_at desc
  limit 1;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'social_webhook_secret'
  order by created_at desc
  limit 1;

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('product_id', p_product_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    timeout_milliseconds := 5000
  );
end;
$$;

revoke all on function store.dispatch_social_product_campaign(uuid) from public, anon, authenticated;

create or replace function store.on_social_product_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_eligible boolean;
  v_exists boolean;
begin
  if tg_table_name = 'product_images' then
    v_product_id := new.product_id;
  else
    v_product_id := new.id;
  end if;

  if tg_table_name = 'products' and tg_op = 'INSERT' then
    insert into store.social_product_campaigns (product_id, status, last_error)
    values (v_product_id, 'waiting_data', 'Aguardando publicação, foto e dados comerciais completos.')
    on conflict (product_id) do nothing;
  end if;

  select exists (
    select 1 from store.social_product_campaigns c where c.product_id = v_product_id
  ) into v_exists;

  if not v_exists then
    return new;
  end if;

  select coalesce(p.active, false)
    and p.archived_at is null
    and p.unpublished_at is null
    and p.sync_status in ('native', 'synced')
  into v_eligible
  from store.products p
  where p.id = v_product_id;

  if coalesce(v_eligible, false) then
    perform store.dispatch_social_product_campaign(v_product_id);
  end if;
  return new;
end;
$$;

revoke all on function store.on_social_product_signal() from public, anon, authenticated;

drop trigger if exists tr_social_product_created_or_published on store.products;
create trigger tr_social_product_created_or_published
after insert or update of active, archived_at, unpublished_at, sync_status on store.products
for each row execute function store.on_social_product_signal();

drop trigger if exists tr_social_product_image_added on store.product_images;
create trigger tr_social_product_image_added
after insert on store.product_images
for each row execute function store.on_social_product_signal();

comment on table store.social_product_campaigns is
  'Campanhas sociais geradas uma única vez para produtos realmente novos; aprovação é obrigatória antes de publicar.';
