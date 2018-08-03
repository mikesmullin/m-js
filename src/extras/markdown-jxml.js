import { is, NA, chunker as t } from '../utils.js';

const W = (cond,k,o) => cond ? { [k]: o } : o, // wrap
	S = a => 1 === a.length ? a[0] : a, // simplify
	I = t => t; // identity / pass-through / no-op / preserve as-is

/**
 * String parser for Markdown syntax,
 * and compiler to JXML.
 * 
 * WARNING: It doesn't parse all Markdown syntax, just the parts we need.
 * 
 *   a) ~~~\n code block \n~~~
 *   b) paragraph\n\n
 *   c) # headings, levels 1 - 6
 *   d) - unordered list (though hierarchy is a WIP)
 *   e) 1. ordered list (though hierarchy is a WIP)
 *   f) line breaks  
 *   g) [hyper](links)
 *   h) **emphasis** or __emphasis__
 *   g) *strong* or _strong_
 *   i) ~inline code~
 * 
 * We use tilde (~) character for (a) code blocks and (i) inline code in order
 * to make it convenient within multi-line ES6 backtick strings. This eliminates
 * need for double-escaping.
 * 
 * Support for more cases is trivial, but will happen on an as-needed basis.
 * 
 * @param {String} str - Markdown syntax to parse.
 * @param {Function} integrate - Intercept and transform tokens.
 * @param {Boolean} inlineOnly - If true, won't parse block elements. 
 *   Primarily used internally by recursion.
 * @return {Object} - JXML.
 */
const markdown = (str, integrate=o=>o, inlineOnly=false) => {
	// multi-pass tokenizer
	// pass 1: inline-block elements (code, paragraph delim)
	let chunks = t([str], NA,
		/^~~~(\w{1,99})?(?:\r?\n)([\s\S]{1,9999}?)(?:\r?\n)~~~$|((?:\r?\n){2})/gm, m =>
		is(m[2]) ? [ 'C', m[1], m[2] ] : // [ C = code block, 1 lang, 2 text ]
		is(m[3]) ? [ 'S' ] : // S = double CR LF, paragraph delimiter
		NA, I);

	// pass 2: block elements (header, list item, blockquote)
	if (!inlineOnly)
		t(chunks, NA,
			/^(#{1,6})[ \t]{0,99}(.{1,999})(?:\r?\n|$)|^([ ]{0,99})([-*]|\d{1,3}\.)[ \t]{1,99}((?:.{1,999}(?:\r?\n|$)(?!\1[-*]|\1\d{1,3}\.)){1,999})(?:\r?\n|$)|^>[ \t]{1,99}(.{1,999})(?:\r?\n|$)/gm, m =>
			is(m[2]) ? [ 'H', m[1].length, m[2] ] : // H = heading, 1 lvl, 2 text
			is(m[5]) ? [ 'L', m[4], // L = list item, 1 style, 2 text
				m[5].replace(new RegExp('^'+m[3],'gm'), '') ] :
			is(m[6]) ? [ 'B', m[6] ] : // [ B = blockquote, 1 text ]
			NA, I);

	// pass 3: inline/atomic elements (br, link, em, otherwise P)
	t(chunks, NA,
		/(  (?:\r?\n|$))|\[(.{1,999}?)\]\(((?:\w{1,99}:)?\/?\/?[-A-Za-z0-9+&@#/%?=~_()|!:,.;]{0,2083}[-A-Za-z0-9+&@#/%=~_()|])\)|([*_~]{1,2})([\s\S]{1,999}?)\4/gm, m =>
		is(m[1]) ? [ 'R' ] : // R = 2-space line-bReak
		is(m[2]) ? [ 'A', m[3], m[2] ] : // A = hyperlink, 1 href, 2 anchor
		is(m[5]) ? [ 'E', m[4], m[5] ] : // E = emphasis, 1 type, 2 text
		NA, t=>[ 'T', t ]); // T = text node

	// pass 4: lexer + compiler (to JXML)
	return S(t(chunks, chunks.map(c=>c[0]).join(''),
		/(S)|(H)|(L{1,999})|(C)|(B{1,99})|([EATR]{1,999})/g, m => {
		const i = m.index,
			F = cb => // single or flat map
				S(chunks.slice(i, i + m[0].length)
					.map(cb).reduce((acc,v)=>acc.concat(v),[]));

		return is(m[1]) ? NA : // discard whitespace

			is(m[2]) ? integrate({ ['h'+chunks[i][1]]: { // heading
				_: chunks[i][2] }}) :

			is(m[3]) ? { [/[*-]/.test(chunks[i][1]) ? 'ul' : 'ol']: // list
				F(item => ({ li: markdown(item[2], integrate) })) } :

			is(m[4]) ? integrate({ pre: { code: { // code
				$class: chunks[i][1],
				_: chunks[i][2] }}}) :

			is(m[5]) ? { blockquote:
				markdown(F(m=>m[1]).join('\n'), integrate) } :

			is(m[6]) ? integrate(W(!inlineOnly, 'p', F(m =>
				'E'===m[0] ? { [ // emphasis
					/^[*_]$/.test(m[1]) ? 'strong' : // bold
					'~' === m[1] ? 'code' : // monospace
					'~~' === m[1] ? 's' : // strikethrough
					'em']: markdown(m[2], integrate, true) } : // italics
				'A'===m[0] ? integrate({ a: { $href: m[1], _: m[2] }}) : // hyperlink
				'T'===m[0] ? m[1] : // paragraph
				'R'===m[0] ? { br: {} } : // line-break
				NA))) :
			NA;
		}));
};

export default markdown;