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
 * Rewrite docs site sources so the framework is loaded from ./dist/m.min.js
 * (the published GH Pages copy), not vendored ./m/* modules.
 */
async function patchDocsTree(docsRoot, version) {
  // app.js
  const cdnUrl = `${CDN_BASE}/dist/${DIST_FILES.min}`;
  await writeFile(
    join(docsRoot, 'app.js'),
    `/**
 * m.js docs site (orphan \`${DOCS_BRANCH}\` branch)
 * Framework documentation only — UI storybook lives at m-js-components.
 *
 * Runtime is the cloud-hosted CDN bundle (same URL any site can copy-paste):
 *   ${cdnUrl}
 */
import M, { Router } from '${cdnUrl}';

window.__M__ = { M, m: M, Router };

/**
 * @param {number} [bust]
 */
async function boot(bust = 0) {
  const q = bust ? \`?t=\${bust}\` : '';

  const [
    { default: Layout },
    { default: Home },
    { default: Guide },
    { default: Api },
    { default: HmrDemo },
  ] = await Promise.all([
    import(\`./components/layout.js\${q}\`),
    import(\`./pages/home.js\${q}\`),
    import(\`./pages/guide.js\${q}\`),
    import(\`./pages/api.js\${q}\`),
    import(\`./pages/hmr.js\${q}\`),
  ]);

  Router.reset();
  Router.detectBase();
  Router.setTitleFormat((t) => (t ? \`\${t} · m.js\` : 'm.js v${version.split('.')[0]}'));

  const page = (factory) => () => Layout({ page: factory() });

  Router.register('/', 'Home', page(Home));
  Router.register('/guide', 'Guide', page(Guide));
  Router.register('/api', 'API', page(Api));
  Router.register('/hmr', 'HMR Demo', page(HmrDemo));
  Router.rewrite('/index.html', '/');

  if (!window.__M_APP_MOUNTED__) {
    window.__M_APP_MOUNTED__ = true;
    M.mount('#app');
    console.info('[docs] m.js v${version} mounted', M.version, 'base=', Router.base || '(root)');
  } else {
    M.invalidate();
    Router.detectBase();
    Router.syncFromLocation();
    M.deferredBatchRedraw();
    console.info('[docs] m.js hot reloaded', bust);
  }
}

await boot(0);
window.__M_BOOT__ = boot;
export { boot };
export default { boot };
`,
    'utf8',
  );

  // Rewrite page/component imports: ../m/router.js | ../m/m.js → ../dist/m.min.js
  const rewriteTargets = [
    'components/layout.js',
    'pages/home.js',
    'pages/guide.js',
    'pages/api.js',
    'pages/hmr.js',
  ];

  for (const rel of rewriteTargets) {
    const abs = join(docsRoot, rel);
    if (!(await exists(abs))) continue;
    let src = await readFile(abs, 'utf8');
    src = src.replace(
      /from\s+['"]\.\.\/m\/(?:m|router|index)\.js['"]/g,
      `from '../dist/${DIST_FILES.min}'`,
    );
    src = src.replace(
      /from\s+['"]\.\/m\/(?:m|router|index)\.js['"]/g,
      `from './dist/${DIST_FILES.min}'`,
    );
    // Keep named Router import working when files only imported Router before
    // e.g. `import { Router } from '...'` — already fine with ESM bundle.
    // Files that did `import M from '../m/m.js'` stay valid as default import.
    await writeFile(abs, src, 'utf8');
  }

  // CDN playground lives on the home page (pages/home.js) — do not re-inject into guide.

  // layout version badge
  {
    const layoutPath = join(docsRoot, 'components/layout.js');
    if (await exists(layoutPath)) {
      let layout = await readFile(layoutPath, 'utf8');
      layout = layout.replace(
        /v\d+\.\d+\.\d+/g,
        `v${version}`,
      );
      await writeFile(layoutPath, layout, 'utf8');
    }
  }

  // index.html — framework loads via app.js → dist/m.min.js.
  // Do not auto-start the HMR WebSocket client on GitHub Pages (no dev server).
  {
    const indexPath = join(docsRoot, 'index.html');
    if (await exists(indexPath)) {
      let html = await readFile(indexPath, 'utf8');
      html = html.replace(
        /\n?\s*<script type="module" src="\.\/(?:m\/)?hot-client\.js"><\/script>/,
        '',
      );
      await writeFile(indexPath, html, 'utf8');
    }
  }

  // Drop outdated vendored framework modules under m/ (keep README note)
  const vendored = ['m/m.js', 'm/router.js', 'm/store.js', 'm/index.js'];
  for (const rel of vendored) {
    const abs = join(docsRoot, rel);
    if (await exists(abs)) await rm(abs);
  }

  await mkdir(join(docsRoot, 'm'), { recursive: true });
  await writeFile(
    join(docsRoot, 'm', 'README.md'),
    [
      '# Runtime location',
      '',
      'The docs site loads the **published** m.js bundle from `../dist/`.',
      '',
      `| File | Purpose |`,
      `|------|---------|`,
      `| \`dist/${DIST_FILES.raw}\` | All-in-one ESM, not minified |`,
      `| \`dist/${DIST_FILES.min}\` | Minified ESM (what the docs import) |`,
      `| \`dist/${DIST_FILES.gz}\` | Minified + gzip (download / size) |`,
      '',
      `CDN: ${CDN_BASE}/dist/${DIST_FILES.min}`,
      '',
      `Canonical source: https://github.com/mikesmullin/m-js (v3 branch, \`src/\`)`,
      `Built with: \`bun build.mjs package\` / published via \`bun build.mjs release\``,
      '',
    ].join('\n'),
    'utf8',
  );

  // Sync hot-client from main source for the HMR demo page
  const hotSrc = join(ROOT, 'src', 'hot-client.js');
  if (await exists(hotSrc)) {
    await cp(hotSrc, join(docsRoot, 'hot-client.js'));
    // keep legacy path working if index still points at m/hot-client.js
    await cp(hotSrc, join(docsRoot, 'm', 'hot-client.js'));
  }
}

async function publishDocs(version) {
  log(`publishing dist/ + docs updates → ${REMOTE}/${DOCS_BRANCH}`);

  // Ensure we can fetch the docs branch
  run('git', ['fetch', REMOTE, DOCS_BRANCH]);

  const work = await mkdtemp(join(tmpdir(), 'm-js-docs-'));
  try {
    // Shallow worktree of docs branch
    run('git', ['worktree', 'add', '--force', work, `${REMOTE}/${DOCS_BRANCH}`]);

    // Copy fresh dist into the docs tree
    const docsDist = join(work, 'dist');
    await rm(docsDist, { recursive: true, force: true });
    await cp(DIST, docsDist, { recursive: true });

    // Patch HTML/JS to use dist bundle
    await patchDocsTree(work, version);

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
      const docsDist = join(work, 'dist');
      await rm(docsDist, { recursive: true, force: true });
      await cp(DIST, docsDist, { recursive: true });
      await patchDocsTree(work, version);
      const sample = await readFile(join(work, 'app.js'), 'utf8');
      const expectedCdn = `${CDN_BASE}/dist/${DIST_FILES.min}`;
      if (!sample.includes(expectedCdn)) {
        die(`dry-run: app.js was not patched to import CDN URL (${expectedCdn})`);
      }
      log('dry-run docs patch OK');
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
