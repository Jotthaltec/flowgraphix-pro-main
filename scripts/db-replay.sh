#!/usr/bin/env bash
# =============================================================================
# REPLAY DAS MIGRAÇÕES EM BANCO LIMPO + TESTES SQL
#
# Fonte de verdade do schema: Printiflow/supabase/migrations (ver
# supabase/replay/00_pre_history.sql). Este script prova que o histórico
# inteiro sobe num Postgres Supabase vazio e roda os testes de supabase/tests.
#
# Nunca aponta para banco remoto: sobe um container descartável próprio.
#
#   bash scripts/db-replay.sh            # cria container, aplica, testa, mantém
#   bash scripts/db-replay.sh --fresh    # recria o container do zero antes
#   bash scripts/db-replay.sh --tests    # só roda supabase/tests (banco já aplicado)
#   bash scripts/db-replay.sh --down     # remove o container
# =============================================================================
set -euo pipefail
export MSYS_NO_PATHCONV=1

CONTAINER="${REPLAY_CONTAINER:-printiflow_replay_pg}"
IMAGE="${REPLAY_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.167}"
PORT="${REPLAY_PORT:-56432}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

psql_c() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

if [[ "${1:-}" == "--down" ]]; then
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  echo "container removido"; exit 0
fi

if [[ "${1:-}" == "--fresh" ]]; then
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
fi

if [[ "${1:-}" != "--tests" ]]; then
  if ! docker ps -q -f "name=^${CONTAINER}$" | grep -q .; then
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres \
      -p "127.0.0.1:${PORT}:5432" "$IMAGE" \
      postgres -c config_file=/etc/postgresql/postgresql.conf >/dev/null
    for _ in $(seq 1 60); do
      docker exec "$CONTAINER" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break
      sleep 2
    done
    # A imagem roda seus próprios scripts de init depois do primeiro "ready".
    sleep 8
  fi

  aplicadas=$(psql_c -tAc "select to_regclass('public._replay_log') is not null")
  if [[ "$aplicadas" == "t" ]]; then
    echo "banco já tem replay; use --fresh para recomeçar"; exit 1
  fi

  echo "== aplicando migrações =="
  for f in "$ROOT"/supabase/replay/*.sql "$ROOT"/supabase/migrations/*.sql; do
    nome="$(basename "$f")"
    # Shims *.superuser.sql mexem em schemas de serviço (storage) que postgres não controla.
    usuario=postgres; [[ "$nome" == *.superuser.sql ]] && usuario=supabase_admin
    if docker exec -i "$CONTAINER" psql -U "$usuario" -d postgres -v ON_ERROR_STOP=1 -q < "$f" > /tmp/replay_out.txt 2>&1; then
      echo "  [ok] $nome"
    else
      echo "  [!!] $nome"; cat /tmp/replay_out.txt; exit 1
    fi
  done
  psql_c -c "create table public._replay_log(at timestamptz default now()); revoke all on public._replay_log from anon, authenticated;"
fi

echo "== testes SQL =="
falhas=0
for t in "$ROOT"/supabase/tests/*.sql; do
  [[ -e "$t" ]] || continue
  nome="$(basename "$t")"
  if out=$(psql_c < "$t" 2>&1); then
    echo "  [ok] $nome"
    [[ -n "$out" ]] && echo "$out" | sed 's/^/       /'
  else
    echo "  [!!] $nome"; echo "$out" | sed 's/^/       /'; falhas=$((falhas+1))
  fi
done
[[ $falhas -eq 0 ]] && echo "todos os testes SQL passaram" || { echo "$falhas arquivo(s) de teste falharam"; exit 1; }
