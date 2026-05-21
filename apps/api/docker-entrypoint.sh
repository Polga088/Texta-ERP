#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "Running seed..."
  python -m src.scripts.seed
fi

echo "Starting API..."
exec "$@"
