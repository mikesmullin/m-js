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
export const markdown = (str, integrate=o=>o, inlineOnly=false) => {
	// multi-pass tokenizer
	// pass 1: chunks (becomes p tag if any leftover text)
	let chunks = t([str], NA,
		/^~~~(\w{1,99})?(?:\r?\n|$)([\s\S]{1,9999}?)(?:\r?\n|$)~~~(?:\r?\n|$)/gm, m =>
		is(m[2]) ? [ 'C', m[1], m[2] ] : // [ C = code block, 1 lang, 2 text ]
		NA, I);

	// pass 2: block elements (header, list item, otherwise p)
	if (!inlineOnly)
		t(chunks, NA,
			/(?:^(#{1,6})[ \t]{0,99}(.{1,999})(?:\r?\n|$)|^([ ]{0,99})([-*]|\d{1,3}\.)[ \t]{1,99}((?:.{1,9999}(?:\r?\n|$)(?!\1[-*]|\1\d{1,3}\.)){1,9999})(?:\r?\n|$))/gm, m =>
			is(m[2]) ? [ 'H', m[1].length, m[2] ] : // H = heading, 1 lvl, 2 text
			is(m[5]) ? [ 'L', m[4], // L = list item, 1 style, 2 text
				m[5].replace(new RegExp('^'+m[3],'gm'), '') ] :
			NA, I);

	// pass 3: inline/atomic elements (br, link, em)
	t(chunks, NA,
		/(?:(  $)|\[(.{1,999}?)\]\(((?:\w{1,99}:)?\/?\/?[-A-Za-z0-9+&@#/%?=~_()|!:,.;]{0,2083}[-A-Za-z0-9+&@#/%=~_()|])\)|([*_~]{1,2})([\s\S]{1,999}?)\4|((?:\r?\n){2}))/gm, m =>
		is(m[1]) ? [ 'R' ] : // R = line-bReak
		is(m[2]) ? [ 'A', m[3], m[2] ] : // A = hyperlink, 1 href, 2 anchor
		is(m[5]) ? [ 'E', m[4], m[5] ] : // E = emphasis, 1 type, 2 text
		is(m[6]) ? [ 'S' ] : // double CR LF is paragraph delimiter
		NA, t=>''===t.trim() ? NA : [ 'P', t ]);

	// pass 4: lexer + compiler (to JXML)
	return S(t(chunks, chunks.map(c=>c[0]).join(''),
		/(?:(S)|(H)|(L{1,999})|(C)|([PEAR]{1,999}))/g, m => {
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

			is(m[5]) ? integrate(W(!inlineOnly, 'p', F(m =>
				'P'===m[0] ? m[1] : // paragraph
				'E'===m[0] ? { [ // emphasis
					/^[*_]$/.test(m[1]) ? 'strong' : // bold
					'~' === m[1] ? 'code' : // monospace
					'~~' === m[1] ? 's' : // strikethrough
					'em']: markdown(m[2], integrate, true) } : // italics
				'A'===m[0] ? integrate({ a: { $href: m[1], _: m[2] }}) : // hyperlink
				'R'===m[0] ? { br: {} } : // line-break
				NA))) :
			NA;
		}));
};