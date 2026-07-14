# String parser for JSON, via multi-pass chunker reductions.
# Same shape as lucene-searchy / markdown-jxml: lex → symbol string → fold.
#
#   import {json} from './json.coffee'   # or compiled sibling
#   json '{"a":[1,true,null]}'  # => { a: [1, true, null] }

import {is as exists, NA} from '../utils.js'
import {chunker} from './chunker.js'

export class JsonSyntaxError extends Error
  constructor: (msg) -> super "JSON syntax error: #{msg}"

err = (s) -> throw new JsonSyntaxError s

# Unescape a JSON string token (including surrounding quotes).
unquote = (q) -> JSON.parse q

###
@param {String} str
@return {*} — native JS value
###
export json = (str) ->
  # ── pass 1: tokenize ──────────────────────────────────────────────
  # Symbols: V value · punct as themselves ({ } [ ] , :)
  chunks = chunker [str], NA,
    ///
      [ \t\r\n]+
    | ("(?:[^"\\]|\\.)*")
    | (-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)
    | true | false | null
    | [{}\[\],:]
    ///g
    (m) ->
      return NA if /^[ \t\r\n]+$/.test m[0]          # discard whitespace
      if exists m[1] then ['V', unquote m[1]]
      else if exists m[2] then ['V', +m[2]]
      else if m[0] is 'true'  then ['V', true]
      else if m[0] is 'false' then ['V', false]
      else if m[0] is 'null'  then ['V', null]
      else [m[0]]  # single-char punct: { } [ ] , :
    (gap) -> err "unexpected #{JSON.stringify gap}" if gap.trim().length

  # ── pass 2..n: fold flat arrays / objects on the symbol string ────
  # Only matches containers whose *interior* is already values (no nest),
  # so each pass peels one layer — the classic chunker multi-pass move.
  #
  # Mode B drops unmatched symbols unless betweenCb re-emits them
  # (indices into the symbols string == token indices).
  fold = ///
    \[ (?: V (?: , V )* )? \]
  | \{ (?: V : V (?: , V : V )* )? \}
  ///g

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
            key = body[i][1]
            err 'object key must be string' unless typeof key is 'string'
            o[key] = body[i + 2][1]          # V : V
            i += 4                           # V : V ,
          ['V', o]
      (text, from, to) -> snap.slice from, to

    err 'stuck reducing' if chunks.length is before or ++guard > 9999

  err 'expected a single value' unless chunks.length is 1 and chunks[0][0] is 'V'
  chunks[0][1]
