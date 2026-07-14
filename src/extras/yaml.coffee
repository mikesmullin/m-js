# String parser for a practical YAML subset, via multi-pass chunker.
# Same spirit as lucene-searchy / markdown-jxml: small passes, then a tight fold.
#
#   import {yaml} from './yaml.coffee'
#   yaml '''
#     name: ada
#     tags:
#       - ui
#       - zig
#   '''

import {is as exists, NA} from '../utils.js'
import {chunker} from './chunker.js'

export class YamlSyntaxError extends Error
  constructor: (msg) -> super "YAML syntax error: #{msg}"

err = (s) -> throw new YamlSyntaxError s

# ── atoms ─────────────────────────────────────────────────────────────
scalar = (s) ->
  return true  if /^(true|yes|on)$/i.test s
  return false if /^(false|no|off)$/i.test s
  return null  if /^(null|~)$/i.test s
  n = Number s
  return n if s isnt '' and not isNaN(n) and isFinite n
  s

unquote = (q) ->
  if q[0] is '"' then JSON.parse q
  else if q[0] is "'" then q[1...-1].replace /''/g, "'"
  else q

stripComment = (line) ->
  out = ''; mode = null; i = 0
  while i < line.length
    c = line[i]
    if mode is '"'
      out += c
      if c is '\\' and i + 1 < line.length then out += line[++i]
      else if c is '"' then mode = null
    else if mode is "'"
      out += c
      mode = null if c is "'"
    else if c is '#' then break
    else
      mode = c if c in ['"', "'"]
      out += c
    i++
  out.replace /[ \t]+$/, ''

# ── pass: flow collections with chunker (mode A → mode B fold) ────────
export flow = (str) ->
  chunks = chunker [str], NA,
    ///
      [ \t]+
    | ("(?:[^"\\]|\\.)*")
    | ('(?:[^']|'')*')
    | (-?(?:0|[1-9]\d*)(?:\.\d+)?)
    | true|false|null|~
    | [{}\[\],:]
    | ([^\s\[\]{},:]+)
    ///g
    (m) ->
      return NA if /^[ \t]+$/.test m[0]
      if exists m[1] then ['V', unquote m[1]]
      else if exists m[2] then ['V', unquote m[2]]
      else if exists m[3] then ['V', +m[3]]
      else if /^(true|false|null|~)$/i.test m[0] then ['V', scalar m[0]]
      else if exists m[4] then ['V', scalar m[4]]
      else [m[0]]
    (gap) -> err "bad flow #{JSON.stringify gap}" if gap.trim().length

  fold = /\[(?:V(?:,V)*)?\]|\{(?:V:V(?:,V:V)*)?\}/g
  guard = 0
  loop
    break if chunks.length is 1 and chunks[0][0] is 'V'
    before = chunks.length
    snap = chunks.slice()
    sym = (c[0] for c in snap).join ''
    fold.lastIndex = 0
    chunker chunks, sym, fold,
      (m) ->
        body = snap.slice m.index, m.index + m[0].length
        if body[0][0] is '['
          ['V', (t[1] for t in body when t[0] is 'V')]
        else
          o = {}; i = 1
          while i < body.length - 1
            o[body[i][1]] = body[i + 2][1]; i += 4
          ['V', o]
      (text, from, to) -> snap.slice from, to
    err 'bad flow' if chunks.length is before or ++guard > 999
  chunks[0][1]

# ── pass 1: lines (split — avoid zero-width /$/ traps under /g) ───────
linePass = (str) ->
  lines = []
  for raw in str.replace(/\r\n/g, '\n').split '\n'
    continue if /^(---|\.\.\.)\s*$/.test raw.trim()
    body = stripComment raw
    continue unless body.trim().length
    ind = body.match(/^ */)?[0].length ? 0
    text = body[ind..]
    continue unless text.trim().length
    lines.push [ind, text]
  lines

# ── pass 2: line → structural tokens [L|K|V] ──────────────────────────
#   L dash · K key · V scalar/flow value   (each carries indent)
pushLine = (tokens, ind, text) ->
  if m = text.match /^((?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^:]+?)):\s*(.*)$/
    key = m[1].trim()
    key = unquote key if key[0] in ['"', "'"]
    tokens.push ['K', ind, key]
    val = m[2]
    return unless val.length
    tokens.push ['V', ind,
      if val[0] in ['[', '{'] then flow val
      else if val[0] in ['"', "'"] then unquote val
      else scalar val]
  else
    tokens.push ['V', ind,
      if text[0] in ['[', '{'] then flow text
      else if text[0] in ['"', "'"] then unquote text
      else scalar text]

tokenize = (lines) ->
  tokens = []
  for [ind, text] in lines
    if text is '-' or /^-\s+/.test text
      tokens.push ['L', ind]
      rest = text.replace /^-\s?/, ''
      pushLine tokens, ind, rest if rest.length
    else
      pushLine tokens, ind, text
  tokens

# ── pass 3: indent tree (the "semantic analyzer") ─────────────────────
parseBlock = (tokens, i, minInd) ->
  return [null, i] if i >= tokens.length or tokens[i][1] < minInd
  switch tokens[i][0]
    when 'L' then parseSeq tokens, i, tokens[i][1]
    when 'K' then parseMap tokens, i, tokens[i][1]
    when 'V' then [tokens[i][2], i + 1]
    else err "token #{tokens[i][0]}"

parseSeq = (tokens, i, ind) ->
  out = []
  while i < tokens.length and tokens[i][0] is 'L' and tokens[i][1] is ind
    i++
    if i >= tokens.length or tokens[i][1] < ind
      out.push null
    else if tokens[i][0] is 'K'
      [item, i] = parseMapAfterDash tokens, i, ind
      out.push item
    else if tokens[i][1] > ind
      [item, i] = parseBlock tokens, i, ind + 1
      out.push item
    else if tokens[i][0] is 'V'
      out.push tokens[i++][2]
    else
      out.push null
  [out, i]

# `- key: val` then sibling keys indented past the dash
parseMapAfterDash = (tokens, i, dashInd) ->
  o = {}
  while i < tokens.length
    break if tokens[i][1] < dashInd
    break if tokens[i][0] is 'L' and tokens[i][1] is dashInd
    break unless tokens[i][0] is 'K'
    # first key may share dash indent; later keys must be deeper
    if Object.keys(o).length and tokens[i][1] <= dashInd
      break
    key = tokens[i++][2]
    if i < tokens.length and tokens[i][0] is 'V'
      o[key] = tokens[i++][2]
    else if i < tokens.length and tokens[i][1] > dashInd and tokens[i][0] isnt 'L'
      [o[key], i] = parseBlock tokens, i, dashInd + 1
    else
      o[key] = null
  [o, i]

parseMap = (tokens, i, ind) ->
  o = {}
  while i < tokens.length and tokens[i][1] is ind and tokens[i][0] is 'K'
    key = tokens[i++][2]
    if i < tokens.length and tokens[i][0] is 'V' and tokens[i][1] is ind
      o[key] = tokens[i++][2]
    else if i < tokens.length and tokens[i][1] > ind
      [o[key], i] = parseBlock tokens, i, ind + 1
    else
      o[key] = null
  [o, i]

# ── public ────────────────────────────────────────────────────────────
export yaml = (str) ->
  tokens = tokenize linePass str
  [val, i] = parseBlock tokens, 0, 0
  err 'trailing tokens' if i isnt tokens.length
  val

export {scalar}
