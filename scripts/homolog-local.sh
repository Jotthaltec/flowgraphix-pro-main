#!/usr/bin/env bash
# =============================================================================
# HOMOLOGAÇÃO LOCAL: stack Supabase do projeto com uma cópia da produção
#
# Não existe projeto de homologação; branching exige plano pago. A jornada
# operacional (pedido, pagamento, produção, financeiro) roda aqui: o stack
# local (`npx supabase start`, API em 127.0.0.1:54321) recebe os schemas da
# aplicação copiados da produção, com as permissões reais, e os dois apps
# apontam para ele. Nada sai da máquina.
#
# O dump precisa ter os privilégios (sem --no-privileges):
#   pg_dump --dbname="$SUPABASE_DB_URL" --schema=store --schema=public \
#     --schema=private --format=custom --no-owner --file=<dump>
#
#   bash scripts/homolog-local.sh refresh <dump>   substitui os dados locais pela cópia
#   bash scripts/homolog-local.sh status           o que está no banco local
#
# Login local (só existe neste banco): dono@homolog.local / Homolog#2026
#
# Só fala com o container local do projeto; nunca recebe URL de banco.
# =============================================================================
set -euo pipefail
export MSYS_NO_PATHCONV=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' "$ROOT/supabase/config.toml")"
CONTAINER="supabase_db_${PROJECT_ID}"
BACKUPS="$ROOT/../backups"

# docker cp recebe caminho do Windows; MSYS_NO_PATHCONV desliga a conversão automática.
host_path() { if command -v cygpath >/dev/null; then cygpath -w "$1"; else echo "$1"; fi; }

psql_c() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

if ! docker ps -q -f "name=^${CONTAINER}$" -f "health=healthy" | grep -q .; then
  echo "O banco local ($CONTAINER) não está no ar. Rode: npx supabase start"; exit 1
fi

cmd="${1:-}"; shift || true

case "$cmd" in
  refresh)
    dump="${1:?informe o arquivo .dump (com privilégios)}"
    mkdir -p "$BACKUPS"
    stamp="$(date +%Y%m%d-%H%M%S)"
    echo "== backup do banco local em backups/homolog-local-antes-$stamp.dump"
    docker exec "$CONTAINER" pg_dump -U postgres -d postgres --schema=store --schema=public \
      --schema=private --format=custom --file=/tmp/antes.dump
    docker cp "$CONTAINER:/tmp/antes.dump" "$(host_path "$BACKUPS/homolog-local-antes-$stamp.dump")"

    echo "== restaurando a cópia"
    docker cp "$(host_path "$dump")" "$CONTAINER:/tmp/restore.dump"
    psql_c -c "drop schema if exists store cascade; drop schema if exists private cascade; drop schema if exists public cascade;"
    # Privilégios padrão de supabase_admin só o superusuário interno altera, e
    # não afetam os objetos restaurados: saem do índice.
    docker exec "$CONTAINER" sh -c "pg_restore -l /tmp/restore.dump | grep -v ' DEFAULT ACL ' > /tmp/restore.list"
    restore_section() {
      docker exec "$CONTAINER" pg_restore -U postgres -d postgres --no-owner \
        --exit-on-error --section="$1" -L /tmp/restore.list /tmp/restore.dump
    }
    restore_section pre-data
    restore_section data
    # auth.users fica fora do dump (e-mails, hashes de senha): cada referência
    # vira um usuário-esqueleto só com o id, antes de as FKs voltarem.
    docker exec "$CONTAINER" pg_restore --section=post-data -f - /tmp/restore.dump \
      | tr -d '\r' \
      | awk '/^ALTER TABLE ONLY /{t=$4} /FOREIGN KEY .* REFERENCES auth\.users\(id\)/{
          match($0, /FOREIGN KEY \(([a-z_]+)\)/, m);
          printf "insert into auth.users(id) select distinct %s from %s where %s is not null on conflict do nothing;\n", m[1], t, m[1] }' \
      | psql_c
    restore_section post-data

    echo "== storage e fila"
    psql_c < "$ROOT/supabase/homolog/storage.sql"
    psql_c < "$ROOT/supabase/homolog/auth.sql"
    psql_c < "$ROOT/supabase/migrations/20260929030100_agendar_fila_sincronizacao.sql"
    # O PostgREST local precisa reler o schema recém-criado.
    psql_c -c "notify pgrst, 'reload schema';"
    "$0" status
    ;;
  status)
    psql_c -tA <<'SQL'
select 'produtos na loja: ' || count(*) from store.products;
select 'produtos no Flow: ' || count(*) from public.products;
select 'pedidos: ' || count(*) from store.orders;
select 'usuários (auth): ' || count(*) || ', com login: ' || count(email) from auth.users;
SQL
    ;;
  *) sed -n '2,20p' "$0"; exit 1 ;;
esac
