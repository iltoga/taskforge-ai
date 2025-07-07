#!/bin/bash


# Find project root (directory containing this script, then go up one level)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"


# Load .env from project root (only valid KEY=VALUE, ignore comments/blank lines)
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  while IFS= read -r line; do
    # Only process lines that look like KEY=VALUE
    if [[ $line =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      eval "$line"
    fi
  done < "$PROJECT_ROOT/.env"
  set +a
else
  echo ".env file not found in $PROJECT_ROOT!"
  exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
  echo "OPENAI_API_KEY not set in .env"
  exit 1
fi

# Get all files from OpenAI
files=$(curl -s https://api.openai.com/v1/files \
  -H "Authorization: Bearer $OPENAI_API_KEY")

# Extract file IDs and filenames, filter by prefix, and delete
echo "$files" | jq -r '.data[] | select(.filename | test("^(Passport|carta_ident)")) | .id + " " + .filename' | while read -r id name; do
  echo "Deleting $name ($id)..."
  curl -s -X DELETE https://api.openai.com/v1/files/$id \
    -H "Authorization: Bearer $OPENAI_API_KEY" > /dev/null
done

echo "Done."
