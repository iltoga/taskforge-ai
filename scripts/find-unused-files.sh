#!/bin/bash
# scripts/find-unused-files.sh
#
# Find all unused files in the project (excluding those in .gitignore)

# Usage:
#   bash scripts/find-unused-files.sh           # Dry run (default)
#   bash scripts/find-unused-files.sh --delete  # Delete unused files


set -e

# Default: dry run
DELETE_MODE=false
if [[ "$1" == "--delete" ]]; then
  DELETE_MODE=true
fi

# Get all tracked files (respects .gitignore)
ALL_FILES=$(git ls-files)

# File extensions to check (customize as needed)
EXTENSIONS="js|jsx|ts|tsx|json|mjs|css|md|sh|yml|yaml|prisma|svg|ico|pdf|toml"

UNUSED_FILES=()

# Loop through each file
while IFS= read -r file; do
  # Only check files with relevant extensions, but skip all .md files
  if [[ ! $file =~ \.($EXTENSIONS)$ || $file == *.md ]]; then
    continue
  fi
  # Skip files in node_modules, .next, .git, tmp, src/__tests__, .github, .vscode, prisma, public, scripts, prompts, settings, docs, and specific files
  if [[ $file == node_modules/* || $file == .next/* || $file == .git/* || $file == tmp/* || $file == src/__tests__/* || $file == .github/* || $file == .vscode/* || $file == prisma/* || $file == public/* || $file == scripts/* || $file == prompts/* || $file == settings/* || $file == docs/* || $file == src/components/* || $file == src/contexts/* || $file == next.config.ts || $file == package.json || $file == package-lock.json || $file == postcss.config.mjs || $file == docker-compose.yml || $file == eslint.config.mjs || $file == jest-resolver.js || $file == jest.config.js || $file == jest.functional.config.js || $file == jest.setup.js || $file == tsconfig.json || $file == tsconfig.test.json ]]; then
    continue
  fi
  # Search for references (excluding itself)
  if ! grep -rFq "$(basename \"$file\")" . --exclude="$file" --exclude-dir={.git,node_modules,.next,tmp,src/__tests__,.github,.vscode,prisma,public,scripts,prompts,settings,docs,src/components,src/contexts} --exclude=next.config.ts --exclude=package.json --exclude=package-lock.json --exclude=postcss.config.mjs --exclude=docker-compose.yml --exclude=eslint.config.mjs --exclude=jest-resolver.js --exclude=jest.config.js --exclude=jest.functional.config.js --exclude=jest.setup.js --exclude=tsconfig.json --exclude=tsconfig.test.json ; then
    UNUSED_FILES+=("$file")
  fi
done <<< "$ALL_FILES"

# Output results
if [ ${#UNUSED_FILES[@]} -eq 0 ]; then
  echo "No unused files found."
else
  echo "Unused files:"
  for f in "${UNUSED_FILES[@]}"; do
    echo "$f"
    if [ "$DELETE_MODE" = true ]; then
      rm -v -- "$f"
    fi
  done
  if [ "$DELETE_MODE" = true ]; then
    echo "All unused files deleted."
  else
    echo "(Dry run: pass --delete to actually delete these files)"
  fi
fi
