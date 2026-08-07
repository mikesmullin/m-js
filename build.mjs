#!/usr/bin/env bun
/**
 * m.js build tool
 *
 * Subcommands:
 *   package  Bundle src/ → dist/ (unminified, minified, minified+gzip)
 *   release  package + GitHub Release + publish dist/ to the docs (GH Pages) branch
 *   help     Show usage
 *
 * Examples:
 *   bun build.mjs package
 *   bun build.mjs release
 *   bun build.mjs release 3.0.1
 */
import { gzipSync } from 'node:zlib';
import {
  readdir,
  mkdir,
  writeFile,
  readFile,
  rm,
  cp,
  mkdtemp,
  access,
} from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = join(ROOT, 'dist');
const DOCS_SRC = join(ROOT, 'docs');
const ENTRY = join(ROOT, 'src', 'browser.js');
const PKG_PATH = join(ROOT, 'package.json');

/** GitHub Pages branch (repo setting: docs @ /) */
const DOCS_BRANCH = 'docs';
/** Remote name */
const REMOTE = 'origin';
/** CDN base shown in docs examples */
const CDN_BASE = 'https://mikesmullin.github.io/m-js';

const DIST_FILES = {
  raw: 'm.js',
  min: 'm.min.js',
  gz: 'm.min.js.gz',
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function log(...args) {
  console.log('[build]', ...args);
}

function die(msg, code = 1) {
  console.error('[build]', msg);
  process.exit(code);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    encoding: 'utf8',
    stdio: opts.stdio ?? 'pipe',
    env: { ...process.env, ...opts.env },
  });
  if (r.status !== 0 && !opts.allowFail) {
    const detail = [r.stderr, r.stdout].filter(Boolean).join('\n').trim();
    die(`${cmd} ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`);
  }
  return r;
}

function runOut(cmd, args, opts = {}) {
  return (run(cmd, args, opts).stdout || '').trim();
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readPkg() {
  return JSON.parse(await readFile(PKG_PATH, 'utf8'));
}

async function writePkg(pkg) {
  await writeFile(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

function banner(version) {
  return `/*! m.js v${version} | MIT | ${CDN_BASE}/ */\n`;
}

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(2)} KB`;
}

// ---------------------------------------------------------------------------
// package
// ---------------------------------------------------------------------------

/**
 * Bundle the browser entry into:
 *   dist/m.js          — all-in-one, not minified
 *   dist/m.min.js      — minified
 *   dist/m.min.js.gz   — minified + gzip
 */
/**
 * Keep the VERSION constant in src/m.js in step with package.json, so
 * M.version never drifts from the published build.
 */
async function syncSourceVersion(version) {
  const path = join(ROOT, 'src', 'm.js');
  const src = await readFile(path, 'utf8');
  const next = src.replace(
    /^const VERSION = '[^']*';$/m,
    `const VERSION = '${version}';`,
  );
  if (!/^const VERSION = '/m.test(src)) die('src/m.js: VERSION constant not found');
  if (next !== src) {
    await writeFile(path, next, 'utf8');
    log(`synced src/m.js VERSION → ${version}`);
  }
}

async function cmdPackage() {
  const pkg = await readPkg();
  const version = pkg.version;
  const head = banner(version);

  log(`packaging m.js v${version}`);
  await syncSourceVersion(version);
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // --- unminified bundle ---
  {
    const result = await Bun.build({
      entrypoints: [ENTRY],
      outdir: DIST,
      target: 'browser',
      format: 'esm',
      minify: false,
      naming: DIST_FILES.raw,
      banner: head.trimEnd(),
    });
    if (!result.success) {
      console.error(result.logs);
      die('unminified bundle failed');
    }
  }

  // --- minified bundle ---
  {
    const result = await Bun.build({
      entrypoints: [ENTRY],
      outdir: DIST,
      target: 'browser',
      format: 'esm',
      minify: true,
      naming: DIST_FILES.min,
      banner: head.trimEnd(),
    });
    if (!result.success) {
      console.error(result.logs);
      die('minified bundle failed');
    }
  }

  // --- gzip the minified file ---
  const minPath = join(DIST, DIST_FILES.min);
  const minBuf = await readFile(minPath);
  const gzBuf = gzipSync(minBuf, { level: 9 });
  const gzPath = join(DIST, DIST_FILES.gz);
  await writeFile(gzPath, gzBuf);

  const rawStat = (await readFile(join(DIST, DIST_FILES.raw))).byteLength;
  const minStat = minBuf.byteLength;
  const gzStat = gzBuf.byteLength;

  log('wrote:');
  log(`  dist/${DIST_FILES.raw}        ${fmtSize(rawStat)}`);
  log(`  dist/${DIST_FILES.min}    ${fmtSize(minStat)}`);
  log(`  dist/${DIST_FILES.gz} ${fmtSize(gzStat)}`);
  log(`CDN: ${CDN_BASE}/dist/${DIST_FILES.min}`);

  return { version, rawStat, minStat, gzStat };
}

// ---------------------------------------------------------------------------
// docs branch publish helpers
// ---------------------------------------------------------------------------

/**
 * Assemble the published site from docs/ + dist/.
 *
 * docs/index.html ships with `__MJS_RUNTIME__` and `__MJS_VERSION__`
 * placeholders so the source stays readable; the runtime is inlined here so
 * every live example in the docs runs offline and instantly, with no CDN
 * round-trip per iframe.
 */
async function assembleDocs(docsRoot, version) {
  const runtime = await readFile(join(DIST, DIST_FILES.raw), 'utf8');
  if (runtime.includes('</scr' + 'ipt>')) {
    die('bundle contains a closing script tag — it cannot be inlined');
  }

  // The docs branch is fully generated: drop everything but .git, then copy.
  for (const name of await readdir(docsRoot)) {
    if (name === '.git') continue;
    await rm(join(docsRoot, name), { recursive: true, force: true });
  }
  await cp(DOCS_SRC, docsRoot, { recursive: true });
  await cp(DIST, join(docsRoot, 'dist'), { recursive: true });

  let stamped = 0;
  for (const rel of await listHtml(docsRoot)) {
    const file = join(docsRoot, rel);
    const before = await readFile(file, 'utf8');
    const after = before
      .split('__MJS_RUNTIME__').join(runtime)
      .split('__MJS_VERSION__').join(version);
    if (after !== before) {
      await writeFile(file, after, 'utf8');
      stamped++;
    }
  }
  log(`docs: ${stamped} page(s) stamped with v${version} (runtime ${fmtSize(runtime.length)})`);
}

/** Every .html under a directory, as paths relative to it. */
async function listHtml(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'dist') continue;
      out.push(...(await listHtml(dir, rel)));
    } else if (entry.name.endsWith('.html')) {
      out.push(rel);
    }
  }
  return out;
}

async function publishDocs(version) {
  log(`publishing dist/ + docs updates → ${REMOTE}/${DOCS_BRANCH}`);

  // Ensure we can fetch the docs branch
  run('git', ['fetch', REMOTE, DOCS_BRANCH]);

  const work = await mkdtemp(join(tmpdir(), 'm-js-docs-'));
  try {
    // Shallow worktree of docs branch
    run('git', ['worktree', 'add', '--force', work, `${REMOTE}/${DOCS_BRANCH}`]);

    // Regenerate the whole site from docs/ + dist/
    await assembleDocs(work, version);

    // Commit if there are changes
    run('git', ['add', '-A'], { cwd: work });
    const status = runOut('git', ['status', '--porcelain'], { cwd: work });
    if (!status) {
      log('docs branch already up to date');
    } else {
      run(
        'git',
        [
          'commit',
          '-m',
          `Publish m.js v${version} (dist + docs)`,
        ],
        { cwd: work },
      );
      run('git', ['push', REMOTE, `HEAD:${DOCS_BRANCH}`], { cwd: work });
      log(`pushed ${REMOTE}/${DOCS_BRANCH}`);
    }
  } finally {
    // Detach worktree
    run('git', ['worktree', 'remove', '--force', work], { allowFail: true });
    await rm(work, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// release
// ---------------------------------------------------------------------------

/**
 * package → optional version bump → git tag → GitHub Release (with assets)
 * → push dist/ onto the docs (GH Pages) branch and point docs at the min bundle.
 *
 * Usage:
 *   bun build.mjs release           # use package.json version
 *   bun build.mjs release 3.0.1     # set version first
 *   bun build.mjs release --dry-run # package + patch preview only (no push/tag)
 */
async function cmdRelease(args) {
  const dryRun = args.includes('--dry-run');
  const versionArg = args.find((a) => a !== '--dry-run' && !a.startsWith('-'));

  let pkg = await readPkg();
  if (versionArg) {
    if (!/^\d+\.\d+\.\d+/.test(versionArg)) {
      die(`invalid version: ${versionArg} (expected semver like 3.0.1)`);
    }
    pkg.version = versionArg;
    // Keep VERSION constant in m.js in sync when present
    const mPath = join(ROOT, 'src', 'm.js');
    let mSrc = await readFile(mPath, 'utf8');
    if (/const VERSION = '[^']+'/.test(mSrc)) {
      mSrc = mSrc.replace(/const VERSION = '[^']+'/, `const VERSION = '${versionArg}'`);
      await writeFile(mPath, mSrc, 'utf8');
    }
    await writePkg(pkg);
    log(`version set to ${versionArg}`);
  }

  const { version, minStat, gzStat } = await cmdPackage();
  const tag = `v${version}`;

  if (dryRun) {
    // Exercise docs patching against a temp worktree, then tear it down.
    log('dry-run: validating docs tree patch (no push, no release)');
    run('git', ['fetch', REMOTE, DOCS_BRANCH]);
    const work = await mkdtemp(join(tmpdir(), 'm-js-docs-dry-'));
    try {
      run('git', ['worktree', 'add', '--force', work, `${REMOTE}/${DOCS_BRANCH}`]);
      await assembleDocs(work, version);
      const page = await readFile(join(work, 'index.html'), 'utf8');
      if (page.includes('__MJS_RUNTIME__') || page.includes('__MJS_VERSION__')) {
        die('dry-run: index.html still has unresolved placeholders');
      }
      if (!page.includes('m.js v3')) die('dry-run: index.html looks wrong');
      for (const f of ['demos/router-hash.html', 'demos/router-path.html', '404.html', 'dist/m.min.js']) {
        if (!(await exists(join(work, f)))) die(`dry-run: missing ${f}`);
      }
      log('dry-run docs assembly OK');
      log('dry-run complete — dist/ is ready; re-run without --dry-run to publish');
    } catch (e) {
      console.error(e);
      die('dry-run docs preview failed');
    } finally {
      run('git', ['worktree', 'remove', '--force', work], { allowFail: true });
      await rm(work, { recursive: true, force: true });
    }
    return;
  }

  // Working tree should be on the mainline branch (v3)
  const branch = runOut('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  log(`releasing ${tag} from branch ${branch}`);

  const dirty = runOut('git', ['status', '--porcelain']);
  if (dirty) {
    log('warning: working tree has uncommitted changes; tag will point at current HEAD');
    log('         commit version bumps first if you want them included in the release');
  }

  // Create annotated tag if missing
  const existingTag = runOut('git', ['tag', '-l', tag]);
  if (existingTag === tag) {
    log(`tag ${tag} already exists`);
  } else {
    run('git', ['tag', '-a', tag, '-m', `m.js ${tag}`]);
    log(`created tag ${tag}`);
  }

  // Push branch + tag
  run('git', ['push', REMOTE, branch]);
  const tagPush = run('git', ['push', REMOTE, tag], { allowFail: true });
  if (tagPush.status !== 0) {
    log(`note: tag push returned ${tagPush.status} (may already exist on remote)`);
  }

  // GitHub Release with dist assets
  const notes = [
    `## m.js ${tag}`,
    '',
    '### CDN',
    '',
    '```html',
    `<script type="module">`,
    `  import M, { Router } from '${CDN_BASE}/dist/${DIST_FILES.min}'`,
    `</script>`,
    '```',
    '',
    '### Dist sizes',
    '',
    `| File | Size |`,
    `|------|------|`,
    `| \`${DIST_FILES.min}\` | ${fmtSize(minStat)} |`,
    `| \`${DIST_FILES.gz}\` | ${fmtSize(gzStat)} |`,
    '',
    '### Assets',
    '',
    `- \`${DIST_FILES.raw}\` — concatenated ESM bundle`,
    `- \`${DIST_FILES.min}\` — minified ESM`,
    `- \`${DIST_FILES.gz}\` — minified + gzip`,
  ].join('\n');

  // Keep release notes outside dist/ so they are not published to GH Pages
  const notesFile = join(ROOT, '.release-notes.md');
  await writeFile(notesFile, notes, 'utf8');

  try {
    const releaseView = run('gh', ['release', 'view', tag], { allowFail: true });
    if (releaseView.status === 0) {
      log(`GitHub release ${tag} already exists — uploading assets`);
      run(
        'gh',
        [
          'release',
          'upload',
          tag,
          join(DIST, DIST_FILES.raw),
          join(DIST, DIST_FILES.min),
          join(DIST, DIST_FILES.gz),
          '--clobber',
        ],
      );
    } else {
      run(
        'gh',
        [
          'release',
          'create',
          tag,
          join(DIST, DIST_FILES.raw),
          join(DIST, DIST_FILES.min),
          join(DIST, DIST_FILES.gz),
          '--title',
          `m.js ${tag}`,
          '--notes-file',
          notesFile,
        ],
      );
      log(`created GitHub release ${tag}`);
    }
  } finally {
    await rm(notesFile, { force: true });
  }

  // Publish to GH Pages (docs branch)
  await publishDocs(version);

  log('release complete');
  log(`  release: https://github.com/mikesmullin/m-js/releases/tag/${tag}`);
  log(`  pages:   ${CDN_BASE}/`);
  log(`  CDN:     ${CDN_BASE}/dist/${DIST_FILES.min}`);
}

// ---------------------------------------------------------------------------
// help / main
// ---------------------------------------------------------------------------

function cmdHelp() {
  console.log(`
m.js build tool

Usage:
  bun build.mjs <command> [args]

Commands:
  package              Bundle src/browser.js → dist/
                         dist/m.js          all-in-one ESM (not minified)
                         dist/m.min.js      minified ESM
                         dist/m.min.js.gz   minified + gzip

  release [version]    package, tag, GitHub Release, and publish dist/ to
                       the '${DOCS_BRANCH}' branch (GitHub Pages), updating the
                       static docs to import dist/m.min.js.
                         release            use version in package.json
                         release 3.0.1      set version then release
                         release --dry-run  package + docs preview only

  help                 Show this message

npm scripts:
  bun run build        → package
  bun run release      → release
`.trim());
}

const [, , command = 'help', ...rest] = process.argv;

const commands = {
  package: () => cmdPackage(),
  build: () => cmdPackage(), // alias
  release: () => cmdRelease(rest),
  help: () => cmdHelp(),
  '--help': () => cmdHelp(),
  '-h': () => cmdHelp(),
};

if (!commands[command]) {
  console.error(`Unknown command: ${command}\n`);
  cmdHelp();
  process.exit(1);
}

await commands[command]();
