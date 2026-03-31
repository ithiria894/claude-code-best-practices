#!/usr/bin/env node
/**
 * generate-ai-index.mjs
 *
 * Deterministic AI_INDEX.md generator.
 * Scans a repo, finds domains/entries/exports/imports/tests,
 * outputs in routing manifest format.
 *
 * Usage:
 *   node scripts/generate-ai-index.mjs [srcDir] [testDir]
 *
 * Defaults:
 *   srcDir  = ./src
 *   testDir = ./tests
 *
 * Output: prints AI_INDEX.md to stdout. Redirect to file:
 *   node scripts/generate-ai-index.mjs > AI_INDEX.md
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const SRC_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "src");
const TEST_DIR = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(ROOT, "tests");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "__pycache__",
  ".venv",
  "venv",
  "coverage",
  ".cache",
]);

const CODE_EXTS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".go",
  ".rs",
  ".rb",
]);

// ---------------------------------------------------------------------------
// File walking
// ---------------------------------------------------------------------------

function walk(dir, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, results);
    } else if (entry.isFile() && CODE_EXTS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

// ---------------------------------------------------------------------------
// Domain detection
// ---------------------------------------------------------------------------

function detectDomains(srcFiles) {
  // Group files by their first directory under src/
  // Flat files (directly in src/) become their own domain by filename
  const domains = new Map();

  for (const file of srcFiles) {
    const relPath = path.relative(SRC_DIR, file);
    const parts = relPath.split(path.sep);

    let domainKey;
    if (parts.length === 1) {
      // Flat file in src/ root — domain = filename without extension
      domainKey = path.basename(parts[0], path.extname(parts[0]));
    } else {
      // Nested — domain = first directory
      domainKey = parts[0];
    }

    if (!domains.has(domainKey)) {
      domains.set(domainKey, { files: [], entry: null, exports: [], imports: [] });
    }
    domains.get(domainKey).files.push(file);
  }

  return domains;
}

// ---------------------------------------------------------------------------
// Entry file detection
// ---------------------------------------------------------------------------

function findEntry(domain) {
  const entryPatterns = [/^index\./, /^main\./, /^mod\./, /^__init__\./];

  // For single-file domains, the file IS the entry
  if (domain.files.length === 1) {
    return domain.files[0];
  }

  // Look for index/main files
  for (const file of domain.files) {
    const basename = path.basename(file);
    if (entryPatterns.some((p) => p.test(basename))) {
      return file;
    }
  }

  // Fallback: shortest filename (usually the primary file)
  return domain.files.sort((a, b) => path.basename(a).length - path.basename(b).length)[0];
}

// ---------------------------------------------------------------------------
// Export extraction (grep-level, not AST)
// ---------------------------------------------------------------------------

function extractExports(file) {
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }

  const symbols = new Set();
  const lines = content.split("\n");

  for (const line of lines) {
    // JS/TS: export function/class/const
    let m;
    m = line.match(/^export\s+(?:default\s+)?(?:function|class|const|let|var|async\s+function)\s+(\w+)/);
    if (m) { symbols.add(m[1]); continue; }

    // JS/TS: export { name }
    m = line.match(/^export\s*\{([^}]+)\}/);
    if (m) {
      m[1].split(",").forEach((s) => {
        const name = s.trim().split(/\s+as\s+/)[0].trim();
        if (name && /^\w+$/.test(name)) symbols.add(name);
      });
      continue;
    }

    // Python: def / class at module level
    m = line.match(/^(def|class)\s+(\w+)/);
    if (m && !m[2].startsWith("_")) { symbols.add(m[2]); continue; }

    // Go: func / type (exported = capitalized)
    m = line.match(/^func\s+(\w+)/);
    if (m && m[1][0] === m[1][0].toUpperCase()) { symbols.add(m[1]); continue; }
    m = line.match(/^type\s+(\w+)/);
    if (m && m[1][0] === m[1][0].toUpperCase()) { symbols.add(m[1]); continue; }

    // module.exports
    m = line.match(/module\.exports\s*=\s*\{([^}]+)\}/);
    if (m) {
      m[1].split(",").forEach((s) => {
        const name = s.trim().split(/\s*:/)[0].trim();
        if (name && /^\w+$/.test(name)) symbols.add(name);
      });
    }
  }

  // Return top 5 by name length (longer names are more specific/useful as search terms)
  return [...symbols].sort((a, b) => b.length - a.length).slice(0, 5);
}

// ---------------------------------------------------------------------------
// Import extraction — builds cross-domain connections
// ---------------------------------------------------------------------------

function extractImports(file, srcDir) {
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }

  const imports = [];
  const lines = content.split("\n");

  for (const line of lines) {
    let m;

    // JS/TS: import ... from './path'  or  import ... from '../path'
    m = line.match(/(?:import|from)\s+[^'"]*['"](\.[^'"]+)['"]/);
    if (m) {
      imports.push(m[1]);
      continue;
    }

    // JS: require('./path')
    m = line.match(/require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/);
    if (m) {
      imports.push(m[1]);
      continue;
    }

    // Python: from .module import ... or from app.module import ...
    m = line.match(/^from\s+([\w.]+)\s+import\s+(.+)/);
    if (m) {
      imports.push(m[1]);
      continue;
    }
  }

  return imports;
}

function resolveImportToDomain(importPath, fromFile, domains, srcDir) {
  // Try to resolve relative import to a domain
  const fromDir = path.dirname(fromFile);
  let resolved;

  if (importPath.startsWith(".")) {
    // Relative import
    resolved = path.resolve(fromDir, importPath);
  } else if (importPath.includes(".")) {
    // Python dotted import — convert dots to path
    resolved = path.join(srcDir, importPath.replace(/\./g, path.sep));
  } else {
    return null; // External package
  }

  // Try with common extensions
  const candidates = [
    resolved,
    resolved + ".js",
    resolved + ".mjs",
    resolved + ".ts",
    resolved + ".tsx",
    resolved + ".py",
    path.join(resolved, "index.js"),
    path.join(resolved, "index.ts"),
    path.join(resolved, "__init__.py"),
  ];

  for (const candidate of candidates) {
    for (const [domainName, domain] of domains) {
      if (domain.files.some((f) => f === candidate || f.startsWith(candidate))) {
        return domainName;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Test file matching
// ---------------------------------------------------------------------------

function findTests(domainName, domainFiles, testDir) {
  let testFiles;
  try {
    testFiles = walk(testDir);
  } catch {
    return [];
  }

  const matches = new Set();

  for (const testFile of testFiles) {
    const testBase = path.basename(testFile).toLowerCase();
    const domainLower = domainName.toLowerCase();

    // Match by domain name in test filename
    if (testBase.includes(domainLower)) {
      matches.add(testFile);
      continue;
    }

    // Match by domain entry filename
    for (const df of domainFiles) {
      const srcBase = path.basename(df, path.extname(df)).toLowerCase();
      if (testBase.includes(srcBase)) {
        matches.add(testFile);
      }
    }
  }

  return [...matches];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Source directory not found: ${SRC_DIR}`);
    console.error("Usage: node generate-ai-index.mjs [srcDir] [testDir]");
    process.exit(1);
  }

  const srcFiles = walk(SRC_DIR);
  const domains = detectDomains(srcFiles);

  // Step 1: Find entries and exports for each domain
  for (const [name, domain] of domains) {
    domain.entry = findEntry(domain);
    domain.exports = extractExports(domain.entry);

    // Also extract exports from other files in the domain
    for (const file of domain.files) {
      if (file !== domain.entry) {
        const moreExports = extractExports(file);
        for (const sym of moreExports) {
          if (!domain.exports.includes(sym) && domain.exports.length < 8) {
            domain.exports.push(sym);
          }
        }
      }
    }
  }

  // Step 2: Map cross-domain imports
  const connections = new Map(); // domain -> Set of { target, via }

  for (const [domainName, domain] of domains) {
    connections.set(domainName, new Set());

    for (const file of domain.files) {
      const imports = extractImports(file, SRC_DIR);
      for (const imp of imports) {
        const targetDomain = resolveImportToDomain(imp, file, domains, SRC_DIR);
        if (targetDomain && targetDomain !== domainName) {
          // Find which symbol is being imported
          const content = fs.readFileSync(file, "utf8");
          const importLine = content.split("\n").find((l) => l.includes(imp));
          let via = imp;
          if (importLine) {
            const m = importLine.match(/import\s+\{?\s*([^}'"]+?)\s*\}?\s+from/);
            if (m) via = m[1].trim().split(",")[0].trim();
          }
          connections.get(domainName).add(JSON.stringify({ target: targetDomain, via }));
        }
      }
    }
  }

  // Step 3: Find tests
  const domainTests = new Map();
  for (const [name, domain] of domains) {
    domainTests.set(name, findTests(name, domain.files, TEST_DIR));
  }

  // Step 4: Output
  const lines = [];
  lines.push("# AI_INDEX.md");
  lines.push("");
  lines.push("## How to use this file");
  lines.push("- Navigation only. Not source of truth.");
  lines.push("- Read actual source files before making any claim.");
  lines.push("");
  lines.push("---");

  // Sort domains: entry points first (files with "server", "app", "main", "cli" in name)
  const entryKeywords = ["cli", "main", "app", "server", "index"];
  const sorted = [...domains.entries()].sort((a, b) => {
    const aIsEntry = entryKeywords.some((k) => a[0].toLowerCase().includes(k));
    const bIsEntry = entryKeywords.some((k) => b[0].toLowerCase().includes(k));
    if (aIsEntry && !bIsEntry) return -1;
    if (!aIsEntry && bIsEntry) return 1;
    return a[0].localeCompare(b[0]);
  });

  for (const [name, domain] of sorted) {
    lines.push("");
    // Format domain name: kebab-case to Title Case
    const title = name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    lines.push(`### ${title}`);
    lines.push(`- Entry: \`${rel(domain.entry)}\``);

    if (domain.exports.length > 0) {
      lines.push(`- Search: ${domain.exports.join(", ")}`);
    }

    const tests = domainTests.get(name);
    if (tests && tests.length > 0) {
      lines.push(`- Tests: ${tests.map((t) => `\`${rel(t)}\``).join(", ")}`);
    }

    const conns = connections.get(name);
    if (conns && conns.size > 0) {
      lines.push("- Connects to:");
      for (const connJson of conns) {
        const conn = JSON.parse(connJson);
        const targetTitle = conn.target.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        lines.push(`  - ${targetTitle} — via ${conn.via}`);
      }
    }
  }

  lines.push("");
  console.log(lines.join("\n"));
}

main();
