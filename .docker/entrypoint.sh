#!/usr/bin/env sh
set -e

if [ "$RESET_DB" = "true" ]; then
  echo "⚠️  RESET_DB=true → dropping and recreating schema…"
  npx prisma migrate reset --force --skip-generate --skip-seed
else
  npx prisma migrate deploy       # normal “no-data-loss” path
fi

exec npm start