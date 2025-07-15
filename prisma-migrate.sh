#!/bin/bash
# Script to generate and apply new Prisma migrations
# Usage: ./prisma-migrate.sh "migration_name" [--reset]

set -e

if [ -z "$1" ]; then
  echo "Error: Please provide a migration name."
  echo "Usage: $0 \"migration_name\" [--reset]"
  exit 1
fi

MIGRATION_NAME="$1"
RESET_DB=false

if [ "$2" = "--reset" ]; then
  RESET_DB=true
fi

if [ "$RESET_DB" = true ]; then
  echo "Resetting the database (all data will be lost)..."
  npx prisma migrate reset --force
fi

# Generate new migration
npx prisma migrate dev --name "$MIGRATION_NAME"

echo "Migration '$MIGRATION_NAME' generated and applied successfully."
