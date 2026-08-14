/**
 * m.js template parser — HTML string → static AST.
 *
 * The browser's own parser does the HTML work: the string is written into an
 * inert <template>, walked once into plain objects, and the DOM is dropped.
 * Parsing happens once per unique template string; rendering then walks the
 * AST, never the DOM.
 */

import { HTML_NS, SVG_NS, MATHML_NS } from './vdom.js';

// ---------------------------------------------------------------------------
// Directive grammar
// ---------------------------------------------------------------------------

const DIR_ORDER = [
  'ignore',
  'ref',
  'data',
  'init',
  'for',
  'if',
  'model',
  'bind',
  'text',
  'html',
  'show',
  'transition',
  'on',
  'effect',
  'cloak',
  'mount',
];

export function isDir(name) {
  return (
    name.startsWith('x-') ||
    name.startsWith('m-') ||
    name.startsWith('@') ||
    (name.startsWith(':') && name.length > 1 && !name.startsWith('::'))
  );
}

/**
 * Normalize an attribute name into { type, arg, modifiers }.
 * e.g. x-on:click.prevent → { type:'on', arg:'click', modifiers:['prevent'] }
 */
export function parseDirective(attrName) {
  let name = attrName;
  if (name.startsWith('@')) {
    const [, target, event] = name.match(/^@([^.]+)\.(.+)$/) || [];
    // Standard Alpine spelling is @resize.window. Accept @window.resize too
    // so existing shorthand examples keep working.
    if ((target === 'window' || target === 'document') && event) {
      const [eventName, ...modifiers] = event.split('.');
      return {
        type: 'on',
        arg: eventName,
        modifiers: [target, ...modifiers],
        raw: attrName,
      };
    }
    return {
      type: 'on',
      arg: name.slice(1).split('.')[0],
      modifiers: name.slice(1).split('.').slice(1),
      raw: attrName,
    };
  }
  if (name.startsWith(':') && !name.startsWith('::')) {
    return {
      type: 'bind',
      arg: name.slice(1).split('.')[0],
      modifiers: name.slice(1).split('.').slice(1),
      raw: attrName,
    };
  }
  if (name.startsWith('x-') || name.startsWith('m-')) name = name.slice(2);
  const [head, ...rest] = name.split(':');
  const type = head.split('.')[0];
  const typeMods = head.split('.').slice(1);
  const argPart = rest.join(':');
  const arg = argPart ? argPart.split('.')[0] : null;
  const argMods = argPart ? argPart.split('.').slice(1) : [];
  return { type, arg, modifiers: [...typeMods, ...argMods], raw: attrName };
}

function dirPriority(type) {
  const i = DIR_ORDER.indexOf(type);
  return i === -1 ? 100 : i;
}

// ---------------------------------------------------------------------------
// Whitespace policy
// ---------------------------------------------------------------------------

/**
 * Elements whose surrounding whitespace is visually significant. Between two
 * of these a whitespace-only text node collapses to a single space; anywhere
 * else it is dropped so pretty-printed templates do not generate junk nodes.
 */
const INLINE = new Set([
  'A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'BUTTON', 'CITE', 'CODE', 'DATA',
  'DEL', 'DFN', 'EM', 'I', 'IMG', 'INPUT', 'INS', 'KBD', 'LABEL', 'MARK',
  'Q', 'RUBY', 'S', 'SAMP', 'SELECT', 'SMALL', 'SPAN', 'STRONG', 'SUB',
  'SUP', 'TEXTAREA', 'TIME', 'U', 'VAR', 'WBR',
]);

/** Content model is raw text — whitespace is preserved verbatim. */
const PRESERVE_WS = new Set(['PRE', 'TEXTAREA']);

const isWhitespaceOnly = (s) => !/[^\t\n\f\r ]/.test(s);

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

const NS_BY_TAG = { svg: SVG_NS, math: MATHML_NS };

const cache = new Map();

/**
 * Parse an HTML template string into a static AST. Cached by string identity.
 */
export function parseTemplate(html) {
  const key = html ?? '';
  let ast = cache.get(key);
  if (ast) return ast;
  ast = parseFragment(key);
  cache.set(key, ast);
  return ast;
}

export function clearTemplateCache() {
  cache.clear();
}

/** Parse into a list of root AST nodes. */
export function parseFragment(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html ?? '';
  return walkChildren(tpl.content, HTML_NS, false);
}

/** Parse a live element (progressive enhancement) into AST nodes. */
export function parseElement(el) {
  return walkNode(el, el.namespaceURI || HTML_NS, false);
}

function childNodesOf(node) {
  // <template> children live in .content, not .childNodes. Missing this makes
  // every <template x-for> / <template x-if> look empty.
  if (node.tagName === 'TEMPLATE' && node.content) return node.content.childNodes;
  return node.childNodes;
}

function walkChildren(parent, ns, preserveWs) {
  const out = [];
  const nodes = [...childNodesOf(parent)];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.nodeType === 3) {
      const text = node.data;
      if (preserveWs) {
        out.push({ kind: 'text', text });
        continue;
      }
      if (isWhitespaceOnly(text)) {
        const prev = nodes[i - 1];
        const next = nodes[i + 1];
        const between =
          prev?.nodeType === 1 &&
          next?.nodeType === 1 &&
          INLINE.has(prev.tagName) &&
          INLINE.has(next.tagName);
        if (between) out.push({ kind: 'text', text: ' ' });
        continue;
      }
      out.push({ kind: 'text', text });
      continue;
    }
    if (node.nodeType !== 1) continue; // comments, CDATA, …
    const child = walkNode(node, ns, preserveWs);
    if (child) out.push(child);
  }
  return out;
}

function walkNode(el, parentNs, parentPreserveWs) {
  const tagName = el.tagName;
  // Scripts inside a <template> are inert, but building one into a fresh
  // element and inserting it would execute. Drop them.
  if (tagName === 'SCRIPT') return null;

  const lower = tagName.toLowerCase();
  const ns = el.namespaceURI || NS_BY_TAG[lower] || parentNs;

  const attrs = {};
  const dirs = [];
  for (const attr of [...el.attributes]) {
    if (isDir(attr.name)) {
      dirs.push({ ...parseDirective(attr.name), expression: attr.value });
    } else {
      attrs[attr.name] = attr.value;
    }
  }
  dirs.sort((a, b) => dirPriority(a.type) - dirPriority(b.type));

  const node = {
    kind: 'el',
    ns,
    tag: lower,
    isTemplate: tagName === 'TEMPLATE',
    attrs,
    dirs,
    children: [],
  };

  // Pull out the directives that change how the node is built, so the builder
  // does not have to re-scan the list on every render.
  for (const d of dirs) {
    switch (d.type) {
      case 'ignore': node.ignore = true; break;
      case 'ref': node.ref = d.expression; break;
      case 'data': node.data = d; break;
      case 'init': node.init = d; break;
      case 'for': node.for = parseForExpression(d.expression); break;
      case 'if': node.if = d; break;
      case 'text': node.text = d; break;
      case 'html': node.html = d; break;
      case 'show': node.show = d; break;
      case 'transition': node.transition = d; break;
      case 'model': node.model = d; break;
      case 'mount': node.mount = d; break;
      case 'cloak': node.cloak = true; break;
      case 'effect': (node.effects ??= []).push(d); break;
      case 'on': (node.on ??= []).push(d); break;
      case 'bind':
        if (d.arg === 'key') node.key = d;
        else (node.binds ??= []).push(d);
        break;
    }
  }

  if (node.ignore) {
    // x-ignore: capture the subtree verbatim; the diff never descends into it.
    node.raw = el.innerHTML;
    return node;
  }

  const preserveWs = parentPreserveWs || PRESERVE_WS.has(tagName);
  node.children = walkChildren(el, ns, preserveWs);
  return node;
}

/** `item in items` / `(item, i) in items` / `item, i in items` / `[a,b] in items` / `{a,b} in items` / `[a,b], i in items` */
export function parseForExpression(expression) {
  const raw = String(expression);
  // Try destructuring first: [a, b] in list, {a, b} in list, [a, b], i in list, etc.
  const destrMatch = raw.match(/^\s*(\[.*?\]|\{.*?\})\s*(?:,\s*([A-Za-z_$][\w$]*))?\s+(?:in|of)\s+(.+)$/s);
  if (destrMatch) {
    const [, destr, index, list] = destrMatch;
    const trimmed = destr.trim();
    let names;
    if (trimmed.startsWith('[')) {
      // Array destructuring: [a, b] or [a, b, ...rest]
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) {
        console.warn('[m] bad x-for', expression);
        return null;
      }
      names = inner.split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/^\.\.\./, ''));
      // Validate each name
      for (const n of names) {
        if (!/^[A-Za-z_$][\w$]*$/.test(n)) {
          console.warn('[m] bad x-for', expression);
          return null;
        }
      }
    } else {
      // Object destructuring: {a, b} or {a, b: c}
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) {
        console.warn('[m] bad x-for', expression);
        return null;
      }
      names = inner.split(',').map(s => s.trim()).filter(Boolean).map(s => {
        // Handle {a: b} -> take alias, {a} -> take a
        const colonIdx = s.indexOf(':');
        if (colonIdx !== -1) return s.slice(colonIdx + 1).trim().replace(/^\.\.\./, '');
        return s.replace(/^\.\.\./, '').trim();
      });
      for (const n of names) {
        if (!/^[A-Za-z_$][\w$]*$/.test(n)) {
          console.warn('[m] bad x-for', expression);
          return null;
        }
      }
    }
    return { item: names[0], index, list: list.trim(), raw, destr: names, destrRaw: trimmed };
  }
  const match = raw.match(
    /^\s*\(?\s*([A-Za-z_$][\w$]*)\s*(?:,\s*([A-Za-z_$][\w$]*))?\s*\)?\s+(?:in|of)\s+(.+)$/,
  );
  if (!match) {
    console.warn('[m] bad x-for', expression);
    return null;
  }
  const [, item, index, list] = match;
  return { item, index, list, raw: expression };
}
