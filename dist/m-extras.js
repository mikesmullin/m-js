(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.extras = {})));
}(this, (function (exports) { 'use strict';

	// m, etc.
	const isString = s => 'string' === typeof s;

	const data = (()=>{
		let l, s;
		const r = el => new Proxy(
			null != el && (s.has(el) ? s.get(el) : (l={},s.set(el,l),l)), {
			get: (o,k) => o ? o[k] : undefined,
			set: (o,k,v) => o ? (o[k] = v) : undefined,
		});
		r.flush = () => { s = new WeakMap(); };
		r.flush();
		return r;
	})();

	// parsers
	const is = v => null != v;
	const NA = void 0;
	const upper = s => s.toUpperCase();
	const lower = s => s.toLowerCase();
	const sum = (sum, i) => sum+i;
	const isS = isString;
	const isA = a => Array.isArray(a);
	Array.prototype.flat || Object.defineProperty(Array.prototype, 'flat', { // es6 shim
		enumerable: false,
		value: function() { return this.reduce((a,v)=>a.concat(v),[]); },
	});

	/**
	 * Chunker: A pattern-matcher and map-reducer.
	 *
	 * Super powerful! ie. Tokenizer, Lexer, and Semantic Analyzer in one reusable function.
	 *
	 *	 “Think of a unique 1-byte¹ symbol to represent each of your token types.
	 *	  Once everything is a string, you can use a RegExp hammer!”
	 *	   –Author of something
	 *
	 * ¹ Technically, you can use up to 3-byte UTF-8 Unicode characters–even emoji. 😂
	 *   CAUTION: That may lead to undefined behavior and vulnerabilities within the RegExp engine.
	 *
	 * Operates in one of two modes:
	 *   a) Subject-string, pattern matcher, and a token mapper, or;
	 *   b) Corresponding tokens from the output of (a) or (b), symbol-string, pattern matcher, and a token reducer.
	 *
	 * @param {mixed[]} chunks - An ordered list of either all (a) subject strings, or (b) tokens of mixed type.
	 *   This input is considered pass-by-reference, and will be overridden with the return type, for your convenience.
	 * @param {String} symbols - (optional) A String of character symbols corresponding to the order and type of
	 *   tokens provided in prior parameter. Ignored in mode (a), required in mode (b).
	 * @param {RegExp} rx - Regular Expression designed to match a pattern found in one of (a) each subject string
	 *   in the chunks list, or (b) the symbol string.
	 * @param {Fn(matches:String[], slice:Fn(i:int)=>chunks:mixed[])=>token:mixed} matchCb -
	 *   Callback fired per-chunk.
	 *   Receives arguments providing context of match and, in mode (b), a mapping function which translates a symbol index
	 *   to a token index in the chunks list.
	 *   Expected to return a single token, or a list of multiple tokens which will be flattened, for the given match.
	 * @param {Fn(s:String, slicedFrom:int, slicedUntil:int)=>token:mixed} betweenCb -
	 *   (optional) Provides an opportunity to capture text found in-between patterns, which is discarded by default.
	 *   Similar to the effect of `"HERPderpGIGGITYderpDURR".split(/derp/g)`, would invoke once each for "HERP", "GIGGITY",
	 *   and "DURR", none of which were matched by the given RegExp pattern.
	 *   Expected to return a single token, or a list of multiple tokens which will be flattened, for the given non-match.
	 * @return mixed[] - An ordered list of tokens returned by `matchCb` and `betweenCb`.
	 */
	const chunker = (chunks, symbols, rx, matchCb, betweenCb) => {
		const r = [], _chunks = is(symbols) ? [symbols] : chunks;
		let i=0,
			chunk,
			lastSlice,
			match,
			token,

			pushToken = t => t ?
				(isA(t) && !isS(t[0])) ?
					t.forEach(t=>t && r.push(t)) :
					r.push(t) :
				NA,

			textSlice,
			pushExtra = i =>
				is(betweenCb) && // if cb defined
				(textSlice = chunk.substring(lastSlice, i)) && // perform slice from last slice to given index
				textSlice.length > 0 && // if text slice is not empty
				pushToken( // push it as a new token
					betweenCb(textSlice, lastSlice, i)), // but first give betweenCb a chance to format it

			mapSymbolIdxChunkIdx,
			sliceChunks;
		for (;
			i < _chunks.length;
			i++
		) {
			if (!isS(chunk = _chunks[i])) { // non-string chunks are not matchable by RegExp;
				is(chunk) && r.push(chunk); // forward token to output as-is, and in same position
				continue; // otherwise, discard null and undefined values
			}

			// perform Regular Expression pattern matching
			lastSlice = 0;
			while (is(match = rx.exec(chunk))) { // for each match
				// internally-used contextual helper function
				mapSymbolIdxChunkIdx = i =>
					match.index + match.slice(1,Math.max(1,i))
						.map(v=>is(v) ? v.length : 0)
						.reduce(sum,0);

				// exposed contextual helper function
				sliceChunks = (symbolIndex, chunkOffset=0, chunkSliceLen) =>
					!is(match[symbolIndex]) ? [] :
						chunks.slice(
							mapSymbolIdxChunkIdx(symbolIndex) + chunkOffset,
							mapSymbolIdxChunkIdx(symbolIndex) + chunkOffset + (is(chunkSliceLen) ?
							chunkSliceLen :
							is(match[symbolIndex]) ?
								match[symbolIndex].length :
								1));

				// invoke callback to map match => token
				token = matchCb(match, is(symbols) && sliceChunks);

				// invoke between callback on any text preceding the match
				pushExtra(match.index); // leading [last..m.index]

				pushToken(token);

				lastSlice = match.index + match[0].length;
			}

			// invoke between callback on any text following the match
			pushExtra(); // trailing [last..]
		}

		// output chunks:
		// 1. by mutating input, for convenience; but also,
		// 2. by returning it
		chunks.splice(0);
		chunks.push(...r);
		// console.log('chunks', JSON.stringify(r,null,2));
		return r;
	};

	class LuceneSyntaxError extends Error {
		constructor(msg) {
			super(`Lucene syntax error: ${msg}`);
		}
	}
	const err =s=> { throw new LuceneSyntaxError(s); };

	/**
	 * String parser for Apache Lucene syntax,
	 * and compiler to JSON-based intermediate language.
	 *
	 * DISCLAIMER: Only implements a subset of the full syntax.
	 * Namely, the parts we need:
	 *
	 *   a) keys
	 *   b) values
	 *   c) double-quoted strings w/ backslash-escaping double-quotation mark
	 *   e) grouping parentheses
	 *   f) boolean logic (ie. AND, OR, NOT¹)
	 *
	 *   ¹ NOT must appear to the right of parentheses, for simplification.
	 *
	 * @param {String} str - Lucene syntax input
	 * @return {Object[]} - Flattened AST tokens in the form `{ u, k, v, b, p } = token;`
	 *   where:
	 *	 {String} k = (optional) Key name.
	 *	 {String} u = Binary infix comparison operator. (ie. "!=", "==") Default is "==".
	 *	 {String} v = Value.
	 *	 {String} b = Binary infix logical operator. (ie. "AND", "OR") Default is "AND".
	 *				  This is assumed to be used by joining with the the next token.
	 *				  If it is the last token, it is ignored.
	 *	 {String} p = Surrounding parentheses, delimited by comma. (ie. "(((,))")
	 */
	const lucene = str => {
		// semantic grammar check
		if (/^(?:AND|OR)|[(](?:AND|OR)|(?:AND|OR)[)]|(?:AND|OR)$/.test(str))
			err("Logical operators (AND OR) must appear between values.");

		// begin multi-pass tokenizer
		// pass 1: building blocks
		let chunks = chunker([str], NA,
			/(NOT)\s{1,99}|\s{1,99}(AND|OR)\s{1,99}|"(?:()"|(.{0,999}?[^\\])")|([a-z0-9_@{][a-z0-9_.@{}]{0,999})|(:)|([()])|(\[(now(?:[+-]\d{0,9}[dhms])?) TO (now(?:[+-]\d{0,9}[dhms])?)\])/ig, m =>
			is(m[1]) ? [ 'U', m[1] ] : // unary operator
			is(m[2]) ? [ 'B', m[2] ] : // binary operator
			is(m[3]) ? [ 'S', '' ] : // empty string
			is(m[4]) ? [ 'S', m[4].replace(/\\"/g, '"') ] : // escaped string
			is(m[5]) ? [ ('NOT' === m[5] ? 'U' : ['AND','OR'].includes(m[5]) ? 'B' : 'I'), m[5] ] : // identifier
			is(m[6]) ? [ 'D' ] : // colon key-value delimiter
			is(m[7]) ? [ {'(':'O',')':'C'}[m[7]], m[7] ] : // opening or closing parenthesis
			is(m[8]) ? [ 'R', m[9], m[10] ] : // range
			NA),
			symbols =()=> chunks.map(c=>c[0]).join('');

		// semantic grammar check
		if (/([SI])D(?:[OC]|$)/.test(symbols())) err("Keys must precede a value.");

		// pass 2: merge identifier and strings into key-value pairs. reduce tokens 6:4 UBSIDP>UBKP
		chunker(chunks, symbols(),
			/U|B|O|C|(?:([SI])D)?([SIR])/g, (m,sl) =>
			is(m[1]) ? [ 'K', sl(1)[0][1], ...sl(1,+2,1)[0].slice(1) ] : // key:val
			is(m[2]) ? [ 'K', NA, ...sl(2)[0].slice(1) ] : // val
			chunks[m.index]);

		// semantic grammar check
		if (!/^$|^(?!B)(?:B?[OC]{0,99}U?K{1,}[OC]{0,99}){1,999}$/g.test(symbols())) {
			err('Incorrect grammar.');
		}

		// compiler to JSON intermediate representation
		// pass 3: merge UKB into expressions. reduce tokens 4:3 UBKP>OXC
		// scan to K, eating everything around it, map to X token
		chunker(chunks, symbols(),
			/([OC]{1,99})?(U)?(K)([OC]{1,99})?(B)?/g, (m, sl) => [
				sl(1),
				[['X', {
					k: sl(3)[0][1], // key
					// lookbehind 1 for U, if found then not equal, otherwise default to is equal
					u: is(m[2]) ? '!=' : '==', // unary operator
					r: (null != sl(3)[0][3]) ? [ sl(3)[0][2], sl(3)[0][3] ] : undefined, // range
					v: (null == sl(3)[0][3]) ? sl(3)[0][2] : undefined, // value
					// lookahead  1 for B, splice into X.b, or default to AND
					b: is(m[5]) ? sl(5)[0][1] : '', // binary operator. "" means implicit AND
					p: ',',
				}]],
				sl(4),
			].flat());

		// pass 4: simplify unnecessary grouping + check parentheses balance. reduce tokens 3:1 OXC>X
		let out = [], lastC = null, P = t => /[OC]/g.test(t[0]) ? t[1] : 0;
		for (let i=0,
			balance,
			// given the index for an occurrence of O, find index of corresponding C
			findC = i => ( balance = 0,
				chunks.findIndex((t,s)=>
					s<i ? 0 : 0===( balance += {'(':1,')':-1,'0':0}[P(t)] ))),
			chunk,
			c,
			stack = out;
			i < chunks.length;
			i++
		) {
			chunk = chunks[i];

			if ('('===P(chunk)) {
				c = findC(i);
				if ((0===i && c===chunks.length-1) || (is(lastC) && c === lastC-1)) {
					chunks.splice(c,1);
					chunks.splice(i,1);
					lastC = c - 1;
					i--;
				}
				else {
					stack.push(stack = Object.assign([], { p: stack }));
					lastC = c;
				}
			}
			else if ('X'===chunk[0]) stack.push(chunk[1]);
			else if (')'===P(chunk)) {
				if (is(stack.p) && stack.length>1) {
					stack[0].p = '('+ stack[0].p;
					stack[stack.length-1].p += ')';
				}
				if (!is(stack.p)) err('Forgot opening paren (');
				stack.p.splice(-1, 1, ...stack);
				stack = stack.p;
			}
			if (i===chunks.length-1 && is(stack.p)) err('Forgot closing paren )');
		}
		return out;
	};

	const escapeLucene = s =>
		(null == s) ? '' :

		// if double-quotes or wildcard are used, we assume the user knows what they are doing,
		// and no attempt will be made to escape it further; the user must escape it themselves.
		/["*]/.test(s) ? s :

		// identifiers return unquoted string as-is
		/^[a-z0-9_@{][a-z0-9_\.@{}]{0,99}$/i.test(s) ? s :

		// string containing special characters gets quoted and escaped
		`"${s.replace(/"/g,'\\"')}"`;

	/**
	 * Client-side JSON object search,
	 * using Lucene-inspired syntax.
	 *
	 * example invocation:
	 *   const query = searchy(q);
	 *   records.filter(query.test);
	 */
	const searchy = q => {
		const ast = lucene(q),
			reverseIf = (a,cond) => ((cond && a.reverse()), a);

		return { matchObject(record) {
			// build index and search functions
			const keys = [],
				values = [],
				flatIndex = {},
				toVisit = [[[],record]],
				pop = (path,v) => {
					// NOTICE: keys always match case-insensitive.
					const key = path.join('.').toLowerCase();
					// NOTICE: record values are always cast to string,
					//   [and object keys are already strings by necessity].
					// NOTICE: values always match case-insensitive.
					const value = (''+v).toLowerCase();
					// index of keys for key comparison
					keys.push(key);
					// index of values for value comparison
					values.push(value);
					// index of key:values for key=>value lookup
					flatIndex[key] = value;
				},
				push$$1 = (path,k,v) =>
					toVisit.push([[...path,k],v]);
				while (toVisit.length>0) {
					const [path,o] = toVisit.shift();
					if (Array.isArray(o)) {
						let allNonObjects = true;
						for (let i=0,len=o.length; i<len; i++) {
							if (null != o[i] && 'object' === typeof o[i]) {
								allNonObjects = false;
							}
						}
						// arrays of non-objects are searchable as a joined string
						if (allNonObjects) {
							pop(path,o.join(' '));
						}
						// all other arrays you must specify the key with index like a.0:value,
						// although you can still get lucky by partial matching on key or value like a:val
						else {
							for (let i=0,len=o.length; i<len; i++) {
								push$$1(path,i,o[i]);
							}
						}
					}
					else if (null != o && 'object' === typeof o) {
						for (const k of Object.keys(o)) {
							if (o.hasOwnProperty(k)) {
								push$$1(path,k,o[k]);
							}
						}
					}
					else pop(path,o);
				}
				// NOTICE: key:values always match wildcard like *KEY*:*VALUE*
				const matchValue = (haystack,needle)/*:bool*/ => -1!==haystack.indexOf(needle),
				matchAnyValue = (v) => values.some(haystack=>matchValue(haystack,v)),
				matchKeyValue = (K, cmp, V)/*:bool*/ => {
					let v = lower(''+V);
					if (!is(K)) return cmp(matchAnyValue(v));
					let k = lower(K);
					// NOTICE: search key may match more than one record key,
					//   in which case first matching value wins
					let foundKey = keys.find(haystack=>-1!==haystack.search(k));
					return is(foundKey) && cmp(matchValue(flatIndex[foundKey], v));
				},

				// NOTICE: Javascript is left-associative, like Lucene [and most other languages],
				//   therefore, we can rely solely on our users' grouping parentheses when evaluating.
				logic = '!!('+ast.map((x,i)=>''+
					x.p.split(',')[0] + // prefix parens
					// K:V resolved to safe-to-eval boolean literals
					(matchKeyValue(
						x.k,
						('!='===x.u ? s=>!s : s=>s),
						x.v) ? 1 : 0) +
					reverseIf([
						x.p.split(',')[1], // suffix parens
						(i===(ast.length-1) ? '' : ('OR'===upper(x.b)?'||':'&&')), // logical operator
					], 1 === x.p.length).join('')).join('') +')';

			// console.debug('record', JSON.stringify(record, null, 2));
			// console.debug('Lucene query AST', JSON.stringify(ast, null, 2));
			// console.log('result', eval(logic));
			return eval(logic); // not evil logic
		}};
	};

	/**
	 * Convert `lucene()` output
	 * back into a string compatible for input.
	 *
	 * @param {String[][]} ast - Abstract syntax tree structure (actually more of a flattened list in this case).
	 * @param {boolean} last - (optional) Set false to produce lucene syntax one-expression-at-a-time.
	 *   If not specified, the default is to omit the last boolean, which is normal.
	 *   This is for compliance with an external data structure requirement.
	 * @return String - Lucene-compatible syntax.
	 */
	const tolucene = (ast, last) => {
		const reverseIf = (a,cond) =>((cond && a.reverse()), a);
		const get$$1 = (alt,o,k) => (null != o && null != o[k]) ? o[k] : alt;
		return ast.map((x,i) => {
			if (null == x) return '';
			return get$$1('',x,'p').split(',')[0] + // prefix parens
				// K:V resolved to safe-to-eval boolean literals
				('!='===x.u ? 'NOT ' : '') +
				(is(x.k) ? (escapeLucene(x.k) +':') : '') +
				(null != x.r ? `[${x.r[0]} TO ${x.r[1]}]` :
					escapeLucene(x.v)) +
				// order of bool AND OR and parenthesis depends on its position
				reverseIf([
					get$$1([],x,'p').split(',')[1], // suffix parens
					// logical operator
					((false !== last && i===(ast.length-1)) ? '' : // last token in list omits its boolean
					''===get$$1('',x,'b').trim() ? ' ' : // implicit AND
					' '+ x.b +' '), // explicit
				], 1 === get$$1([], x, 'p').length).join('');
		}).join('');
	};

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
		let chunks = chunker([str], NA,
			/^~~~(\w{1,99})?(?:\r?\n)([\s\S]{1,9999}?)(?:\r?\n)~~~$|((?:\r?\n){2})/gm, m =>
			is(m[2]) ? [ 'C', m[1], m[2] ] : // [ C = code block, 1 lang, 2 text ]
			is(m[3]) ? [ 'S' ] : // S = double CR LF, paragraph delimiter
			NA, I);

		// pass 2: block elements (header, list item, blockquote)
		if (!inlineOnly)
			chunker(chunks, NA,
				/^(#{1,6})[ \t]{0,99}(.{1,999})(?:\r?\n|$)|^([ ]{0,99})([-*]|\d{1,3}\.)[ \t]{1,99}((?:.{1,999}(?:\r?\n|$)(?!\1[-*]|\1\d{1,3}\.)){1,999})(?:\r?\n|$)|^>[ \t]{1,99}(.{1,999})(?:\r?\n|$)/gm, m =>
				is(m[2]) ? [ 'H', m[1].length, m[2] ] : // H = heading, 1 lvl, 2 text
				is(m[5]) ? [ 'L', m[4], // L = list item, 1 style, 2 text
					m[5].replace(new RegExp('^'+m[3],'gm'), '') ] :
				is(m[6]) ? [ 'B', m[6] ] : // [ B = blockquote, 1 text ]
				NA, I);

		// pass 3: inline/atomic elements (br, link, em, otherwise P)
		chunker(chunks, NA,
			/(  (?:\r?\n|$))|\[(.{1,999}?)\]\(((?:\w{1,99}:)?\/?\/?[-A-Za-z0-9+&@#/%?=~_()|!:,.;]{0,2083}[-A-Za-z0-9+&@#/%=~_()|])\)|([*_~]{1,2})([\s\S]{1,999}?)\4/gm, m =>
			is(m[1]) ? [ 'R' ] : // R = 2-space line-bReak
			is(m[2]) ? [ 'A', m[3], m[2] ] : // A = hyperlink, 1 href, 2 anchor
			is(m[5]) ? [ 'E', m[4], m[5] ] : // E = emphasis, 1 type, 2 text
			NA, t=>[ 'T', t ]); // T = text node

		// pass 4: lexer + compiler (to JXML)
		return S(chunker(chunks, chunks.map(c=>c[0]).join(''),
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

	exports.LuceneSyntaxError = LuceneSyntaxError;
	exports.lucene = lucene;
	exports.escapeLucene = escapeLucene;
	exports.searchy = searchy;
	exports.tolucene = tolucene;
	exports.markdown = markdown;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
