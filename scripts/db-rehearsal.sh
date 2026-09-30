#!/usr/bin/env bash
# =============================================================================
# ENSAIO DE MIGRAÇÕES SOBRE UMA CÓPIA DE PRODUÇÃO
#
# O histórico de supabase/migrations não sobe num banco vazio (as primeiras
# migrações dependem de objetos criados fora dele), então o ensaio parte de um
# dump real: restaura os schemas store + public num Postgres Supabase
# descartável, aplica as migrações novas e roda os testes de supabase/tests.
#
# Nunca aponta para banco remoto: o container só escuta em 127.0.0.1.
# O dump contém dados reais — mantenha-o fora do repositório.
#
#   pg_dump --dbname="$SUPABASE_DB_URL" --schema=store --schema=public \
#     --format=custom --no-owner --no-privileges --file=<dump>
#
#   bash scripts/db-rehearsal.sh restore <dump>     recria o container e restaura
#   bash scripts/db-rehearsal.sh apply <arquivo>... aplica migrações, em ordem
#   bash scripts/db-rehearsal.sh test [arquivo]...  roda supabase/tests (ou os dados)
#   bash scripts/db-rehearsal.sh psql               sessão interativa
#   bash scripts/db-rehearsal.sh down               remove o container
# =============================================================================
set -euo pipefail
export MSYS_NO_PATHCONV=1

CONTAINER="${REHEARSAL_CONTAINER:-printiflow_rehearsal_pg}"
IMAGE="${REHEARSAL_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.167}"
PORT="${REHEARSAL_PORT:-56433}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

psql_c() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

cmd="${1:-}"; shift || true

case "$cmd" in
  restore)
    dump="${1:?informe o arquivo .dump}"
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres \
      -p "127.0.0.1:${PORT}:5432" "$IMAGE" \
      postgres -c config_file=/etc/postgresql/postgresql.conf >/dev/null
    for _ in $(seq 1 60); do
      docker exec "$CONTAINER" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break
      sleep 2
    done
    # A imagem roda seus próprios scripts de init depois do primeiro "ready".
    sleep 10
    docker cp "$dump" "$CONTAINER:/tmp/restore.dump"
    # O public vazio da imagem dá lugar ao de produção. Erros de restauração não
    # são tolerados: um ensaio sobre cópia incompleta não prova nada.
    psql_c -c "drop schema if exists public cascade;"
    restore_section() {
      docker exec "$CONTAINER" pg_restore -U postgres -d postgres --no-owner --no-privileges \
        --exit-on-error --section="$1" /tmp/restore.dump
    }
    restore_section pre-data
    restore_section data
    # auth.users fica fora do dump (e-mails, hashes de senha). Cada referência
    # a ele vira um usuário-esqueleto só com o id, antes de as FKs voltarem.
    docker exec "$CONTAINER" pg_restore --section=post-data -f - /tmp/restore.dump \
      | tr -d '\r' \
      | awk '/^ALTER TABLE ONLY /{t=$4} /FOREIGN KEY .* REFERENCES auth\.users\(id\)/{
          match($0, /FOREIGN KEY \(([a-z_]+)\)/, m);
          printf "insert into auth.users(id) select distinct %s from %s where %s is not null on conflict do nothing;\n", m[1], t, m[1] }' \
      | psql_c
    restore_section post-data
    # Os grants não vêm no dump; sem eles as políticas RLS não podem ser ensaiadas.
    psql_c <<'SQL'
grant usage on schema public, store to anon, authenticated, service_role;
grant all on all tables in schema public, store to anon, authenticated, service_role;
grant all on all sequences in schema public, store to anon, authenticated, service_role;
grant execute on all functions in schema public, store to anon, authenticated, service_role;
-- 20260822185901: as políticas RLS chamam private.is_company_member.
grant usage on schema private to anon, authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;
-- 20260928140000: a origem da variante (fornecedor) não é legível pela API.
revoke select on store.product_variants from anon, authenticated;
grant select (id, product_id, sku, selection, production_days, available, is_default, position, created_at, updated_at)
  on store.product_variants to anon, authenticated;
SQL
    echo "restaurado: $(psql_c -tAc "select count(*) from store.products") produtos no site, $(psql_c -tAc "select count(*) from public.products") no CRM"
    ;;
  apply)
    [[ $# -gt 0 ]] || { echo "informe ao menos uma migração"; exit 1; }
    for f in "$@"; do
      if psql_c -1 < "$f"; then echo "  [ok] $(basename "$f")"; else echo "  [!!] $(basename "$f")"; exit 1; fi
    done
    ;;
  test)
    files=("$@")
    [[ ${#files[@]} -gt 0 ]] || files=("$ROOT"/supabase/tests/*.sql)
    falhas=0
    for t in "${files[@]}"; do
      [[ -e "$t" ]] || continue
      if out=$(psql_c < "$t" 2>&1); then
        echo "  [ok] $(basename "$t")"; [[ -n "$out" ]] && echo "$out" | sed 's/^/       /'
      else
        echo "  [!!] $(basename "$t")"; echo "$out" | sed 's/^/       /'; falhas=$((falhas+1))
      fi
    done
    [[ $falhas -eq 0 ]] || { echo "$falhas arquivo(s) de teste falharam"; exit 1; }
    ;;
  psql) docker exec -it "$CONTAINER" psql -U postgres -d postgres ;;
  down) docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; echo "container removido" ;;
  *) sed -n '2,22p' "$0"; exit 1 ;;
esac
