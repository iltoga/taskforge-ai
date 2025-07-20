#!/usr/bin/env sh
set -e

echo "🚀 Starting application entrypoint..."
echo "Environment: $NODE_ENV"
echo "Database Host: $DB_HOST:$DB_PORT"

# Simple database wait
wait_for_db() {
  echo "⏳ Waiting for database..."
  local attempts=0
  while [ $attempts -lt 20 ]; do
    if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
      echo "✅ Database ready!"
      return 0
    fi
    attempts=$((attempts + 1))
    echo "Waiting... ($attempts/20)"
    sleep 5
  done
  echo "❌ Database timeout"
  exit 1
}

wait_for_db

# Run migrations (don't regenerate Prisma client)
echo "📦 Running migrations..."
if [ "$RESET_DB" = "true" ]; then
  npx prisma migrate reset --force --skip-generate --skip-seed
else
  npx prisma migrate deploy
fi

echo "🎯 Starting app..."
exec npm start
