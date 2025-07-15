#!/bin/bash
# Script to generate and apply new Prisma migrations
# Usage: ./prisma-migrate.sh "migration_name" [--reset]

set -e

# --- Validation ---
if [ -z "$1" ]; then
  echo "Error: Please provide a migration name."
  echo "Usage: $0 \"migration_name\" [--reset]"
  exit 1
fi

MIGRATION_NAME="$1"
RESET_FLAG=false

if [ "$2" = "--reset" ]; then
  RESET_FLAG=true
fi

# --- Main Logic ---

# Handle the database reset scenario
if [ "$RESET_FLAG" = true ]; then
  echo "Resetting the database and starting with a fresh migration..."

  # Reset the database to its initial state, removing all data and migrations.
  # The --force flag skips the confirmation prompt.
  npx prisma migrate reset --force
  echo "Database reset complete."

  # The MIGRATION_NAME for the very first migration after a reset is often named 'init' or 'initial'.
  # The command below will create a new migration based on the current state of your schema.prisma
  # and apply it to the now-empty database.
  npx prisma migrate dev --name "$MIGRATION_NAME"
  echo "Initial migration '$MIGRATION_NAME' created and applied successfully."

else
  # Generate and apply a new migration without resetting the database.
  # This is the standard development workflow.
  echo "Creating and applying new migration: '$MIGRATION_NAME'"
  npx prisma migrate dev --name "$MIGRATION_NAME"
  echo "Migration '$MIGRATION_NAME' generated and applied successfully."
fi

# It's good practice to ensure the Prisma Client is up-to-date
# with the latest schema changes after any migration operation.
echo "Generating Prisma Client..."
npx prisma generate
echo "Prisma Client generated successfully."

echo "Script finished."