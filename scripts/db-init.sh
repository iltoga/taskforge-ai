#!/bin/bash
# db-init.sh: Ensures the calendar_assistant database and passport table exist, using .env variables
set -e

# Load environment variables from .env file in the repo root
ENV_FILE="$(dirname "$0")/../../.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ ERROR: .env file not found at $ENV_FILE"
  exit 1
fi

# Export variables from .env (handle quoted values)
export $(grep -E '^(DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASS)=' "$ENV_FILE" | sed 's/\r$//' | xargs)

# Remove quotes if present
DB_HOST=$(echo $DB_HOST | sed 's/^"//;s/"$//')
DB_PORT=$(echo $DB_PORT | sed 's/^"//;s/"$//')
DB_NAME=$(echo $DB_NAME | sed 's/^"//;s/"$//')
DB_USER=$(echo $DB_USER | sed 's/^"//;s/"$//')
DB_PASS=$(echo $DB_PASS | sed 's/^"//;s/"$//')

# Check for required vars
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASS" ]; then
  echo "❌ ERROR: One or more DB environment variables are missing."
  exit 1
fi

# Function to run psql with password
run_psql() {
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$1" -tAc "$2"
}

# Check if database exists
DB_EXISTS=$(run_psql postgres "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME';")
if [ "$DB_EXISTS" != "1" ]; then
  echo "Database $DB_NAME does not exist. Creating..."
  run_psql postgres "CREATE DATABASE \"$DB_NAME\";"
else
  echo "Database $DB_NAME already exists."
fi

# Create table if not exists
CREATE_TABLE_SQL="CREATE TABLE IF NOT EXISTS passport (
  id SERIAL PRIMARY KEY,
  passport_number VARCHAR(32) NOT NULL,
  surname VARCHAR(64) NOT NULL,
  given_names VARCHAR(64) NOT NULL,
  nationality VARCHAR(64) NOT NULL,
  date_of_birth DATE NOT NULL,
  sex CHAR(1) NOT NULL,
  place_of_birth VARCHAR(128) NOT NULL,
  date_of_issue DATE NOT NULL,
  date_of_expiry DATE NOT NULL,
  issuing_authority VARCHAR(128) NOT NULL,
  holder_signature_present BOOLEAN NOT NULL,
  residence VARCHAR(128),
  height_cm INTEGER,
  eye_color VARCHAR(32),
  type VARCHAR(64) NOT NULL
);"

run_psql "$DB_NAME" "$CREATE_TABLE_SQL"
echo "✅ Database and passport table are ready."
