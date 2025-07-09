#!/usr/bin/env ts-node
/**
 * scripts/find-dead-code.ts
 *
 * Find unused functions, classes, and exports in the project using ts-morph.
 *
 * Usage:
 *   npx ts-node scripts/find-dead-code.ts
 *
 * For additional coverage, run ESLint with:
 *   npx eslint . --ext .ts,.tsx,.js,.jsx --rule 'no-unused-vars: error' --rule 'no-unused-private-class-members: error' --rule '@typescript-eslint/no-unused-vars: error'
 */

import fs from 'fs';
import path from 'path';
// Make sure to install ts-morph: npm install --save-dev ts-morph
import { Node, Project } from 'ts-morph';

const EXCLUDE_DIRS = [
  'node_modules', 'dist', 'build', 'out', 'tmp', 'scripts', 'public', 'prisma', 'docs',
  '.next', '.git', '.vscode', '.github', 'settings', 'prompts', 'src/__tests__', 'src/components', 'src/contexts', 'src/__mocks__'
];
const EXCLUDE_FILES = [
  'next.config.ts', 'package.json', 'package-lock.json', 'postcss.config.mjs', 'docker-compose.yml',
  'eslint.config.mjs', 'jest-resolver.js', 'jest.config.js', 'jest.functional.config.js', 'jest.setup.js',
  'tsconfig.json', 'tsconfig.test.json', 'src/app/layout.tsx'
];

function isExcluded(filePath: string): boolean {
  return EXCLUDE_DIRS.some(dir => filePath.includes(path.sep + dir + path.sep)) ||
    EXCLUDE_FILES.some(f => filePath.endsWith(f)) ||
    filePath.endsWith('.md');
}

function getAllSourceFiles(dir: string): string[] {
  let results: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (isExcluded(fullPath)) continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllSourceFiles(fullPath));
    } else if (/\.(ts|tsx|js|jsx)$/.test(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
  skipAddingFilesFromTsConfig: true,
});

const files = getAllSourceFiles(process.cwd());
files.forEach(f => project.addSourceFileAtPath(f));

const unused: { file: string; name: string; kind: string }[] = [];

// CLI flag for JSON output
const outputJson = process.argv.includes('--json');



function isSymbolUsedAnywhere(symbolName: string | undefined, declarationFile: import('ts-morph').SourceFile, declarationPos: number): boolean {
  if (!symbolName) return false;
  let used = false;
  for (const file of project.getSourceFiles()) {
    file.forEachDescendant((node) => {
      if (Node.isIdentifier(node) && node.getText() === symbolName) {
        // Exclude the declaration itself
        if (!(file === declarationFile && node.getStart() === declarationPos)) {
          used = true;
          return false; // stop traversal in this file
        }
      }
      return undefined;
    });
    if (used) break;
  }
  return used;
}

for (const sourceFile of project.getSourceFiles()) {
  // Functions
  sourceFile.getFunctions().forEach((fn: import('ts-morph').FunctionDeclaration) => {
    const name = fn.getName();
    const pos = fn.getNameNode() ? fn.getNameNode()!.getStart() : fn.getStart();
    // Only check for usage in the same file if not exported, otherwise check project-wide
    const isExported = fn.isExported();
    const used = isExported
      ? isSymbolUsedAnywhere(name, sourceFile, pos)
      : isSymbolUsedAnywhere(name, sourceFile, pos); // For now, treat all as project-wide for safety
    if (!used) {
      unused.push({ file: sourceFile.getFilePath(), name: `#${name || '<anonymous>'}`, kind: 'function' });
    }
  });
  // Classes
  sourceFile.getClasses().forEach((cls: import('ts-morph').ClassDeclaration) => {
    const name = cls.getName();
    const pos = cls.getNameNode() ? cls.getNameNode()!.getStart() : cls.getStart();
    const isExported = cls.isExported();
    const used = isExported
      ? isSymbolUsedAnywhere(name, sourceFile, pos)
      : isSymbolUsedAnywhere(name, sourceFile, pos);
    if (!used) {
      unused.push({ file: sourceFile.getFilePath(), name: `#${name || '<anonymous>'}`, kind: 'class' });
    }
  });
  // Exported symbols
  sourceFile.getExportedDeclarations().forEach((decls: Node[], name: string) => {
    for (const decl of decls) {
      let pos = decl.getStart();
      // Try to get the name node for known declaration types
      if (Node.isFunctionDeclaration(decl) && decl.getNameNode()) {
        pos = decl.getNameNode()!.getStart();
      } else if (Node.isClassDeclaration(decl) && decl.getNameNode()) {
        pos = decl.getNameNode()!.getStart();
      } else if (Node.isVariableDeclaration(decl) && decl.getNameNode()) {
        pos = decl.getNameNode()!.getStart();
      } else if (Node.isEnumDeclaration(decl) && decl.getNameNode()) {
        pos = decl.getNameNode()!.getStart();
      } else if (Node.isInterfaceDeclaration(decl) && decl.getNameNode()) {
        pos = decl.getNameNode()!.getStart();
      }
      if (!isSymbolUsedAnywhere(name, sourceFile, pos)) {
        unused.push({ file: sourceFile.getFilePath(), name: `#${name}`, kind: 'export' });
      }
    }
  });
}


if (outputJson) {
  // Output as JSON for CI
  console.log(JSON.stringify(unused, null, 2));
  process.exit(unused.length === 0 ? 0 : 1);
} else {
  console.log('=== Unused Functions, Classes, and Exports (ts-morph) ===');
  if (unused.length === 0) {
    console.log('No unused code found by ts-morph.');
  } else {
    unused.forEach(u => {
      console.log(`[${u.kind}] ${u.name} in ${u.file}`);
    });
  }
  console.log('\n=== ESLint Dead Code Check (run manually for more details) ===');
  console.log('npx eslint . --ext .ts,.tsx,.js,.jsx --rule "no-unused-vars: error" --rule "no-unused-private-class-members: error" --rule "@typescript-eslint/no-unused-vars: error"');
}
