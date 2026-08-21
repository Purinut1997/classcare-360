import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const root = process.cwd();
const protectedRoots = [
  join(root, 'src', 'pages', 'app'),
  join(root, 'src', 'pages', 'superadmin'),
  join(root, 'src', 'components', 'dashboard'),
];

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

const files = protectedRoots.flatMap(sourceFiles);
const violations = [];

for (const path of files) {
  const source = readFileSync(path, 'utf8');
  if (/<a\b[^>]*\bhref=["']\/app\b/.test(source)) {
    violations.push(`${path}: raw /app anchor must use ContextLink`);
  }
  const importsRouterLink = /import\s*\{[^}]*\bLink\b[^}]*\}\s*from\s*["']react-router-dom["']/.test(source);
  const hasInternalLink = /\bto=\{?["'`]\/app\b/.test(source);
  const preservesContext = source.includes('ContextLink') || source.includes('withDemoContext');
  if (importsRouterLink && hasInternalLink && !preservesContext) {
    violations.push(`${path}: internal React Router Link does not preserve demo/workspace context`);
  }
}

const helpCenterSource = readFileSync(join(root, 'src', 'pages', 'app', 'HelpCenterPage.tsx'), 'utf8');
if (!helpCenterSource.includes('allowedRoles') || !helpCenterSource.includes('canUseModule')) {
  violations.push('HelpCenterPage.tsx: role and plan filtering is required');
}

const globalSearchSource = readFileSync(join(root, 'src', 'components', 'dashboard', 'GlobalSearch.tsx'), 'utf8');
if (!globalSearchSource.includes('isDemoSession') || !globalSearchSource.includes('withDemoContext')) {
  violations.push('GlobalSearch.tsx: demo-safe data and navigation handling is required');
}

if (violations.length > 0) {
  console.error('Navigation context regression check failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Navigation context regression check passed (${files.length} protected source files scanned).`);
