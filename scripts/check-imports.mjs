import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');

const FORBIDDEN_IMPORTS = [
  {
    from: /^features\//,
    pattern: /from ['"]@\/repositories\//,
    message: 'features/ must not import repositories/ directly — use domain/',
  },
  {
    from: /^domain\//,
    pattern: /from ['"]@\/features\//,
    message: 'domain/ must not import features/',
  },
  {
    from: /^repositories\//,
    pattern: /from ['"]@\/(domain|features)\//,
    message: 'repositories/ must not import domain/ or features/',
  },
  {
    from: /^shared\//,
    pattern: /from ['"]@\/(domain|features|repositories)\//,
    message: 'shared/ must not import domain/, features/, or repositories/',
  },
  {
    from: /^infrastructure\//,
    pattern: /from ['"]@\/(domain|features|repositories)\//,
    message: 'infrastructure/ must not import domain/, features/, or repositories/',
  },
];

const LEGACY_PATTERNS = [
  { pattern: /@\/internal\//, message: 'legacy @/internal/ import' },
  { pattern: /@\/integrations\//, message: 'legacy @/integrations/ import' },
  { pattern: /@\/shared\/outbox\//, message: 'legacy @/shared/outbox/ import — use @/domain/notification/outbox/' },
];

const collectTsFiles = (dir) => {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
      continue;
    }

    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
};

const violations = [];

for (const file of collectTsFiles(SRC)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf8');

  for (const { pattern, message } of LEGACY_PATTERNS) {
    if (pattern.test(content)) {
      violations.push(`${rel}: ${message}`);
    }
  }

  for (const rule of FORBIDDEN_IMPORTS) {
    if (!rule.from.test(rel)) {
      continue;
    }

    if (rule.pattern.test(content)) {
      violations.push(`${rel}: ${rule.message}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Import boundary violations:\n');
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log('Import boundary check passed.');
