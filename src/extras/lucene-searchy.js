import { is, NA, upper, lower, sum, chunker as t } from '../utils.js';

export class LuceneSyntaxError extends Error {
	constructor(msg) {
		super(`Lucene syntax error: ${msg}`);
	}
}
const err = s => { throw new LuceneSyntaxError(s) };

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
 *     {String} k = (optional) Key name.
 *     {String} u = Binary infix comparison operator. (ie. "!=", "==") Default is "==".
 *     {String} v = Value.
 *     {String} b = Binary infix logical operator. (ie. "AND", "OR") Default is "AND".
 *                  This is assumed to be used by joining with the the next token.
 *                  If it is the last token, it is ignored.
 *     {String} p = Surrounding parentheses, delimited by comma. (ie. "(((,))")
 */
export const lucene = str => {
	// multi-pass tokenizer
	// pass 1: building blocks
	let chunks = t([str], NA,
		/(?:(NOT)|(AND|OR)|"(?:"|(.{0,}[^\\])")|([a-z0-9_]{1}[a-z0-9_\-\.]{0,99})|(:)|([()]))/ig, m =>
		is(m[1]) ? [ 'U', upper(m[1]) ] : // unary operator
		is(m[2]) ? [ 'B', upper(m[2]) ] : // binary operator
		is(m[3]) ? [ 'S', m[3].replace(/\\"/g, '"') ] : // escaped string
		is(m[4]) ? [ 'I', m[4]] : // identifier
		is(m[5]) ? [ 'D' ] : // colon key-value delimiter
		is(m[6]) ? [ 'P', m[6] ] : // opening or closing parenthesis
		NA),
		symbols =()=> chunks.map(c=>c[0]).join(''),
		bal = 0, P, l;

	// pass 2: reduce tokens 7:5 UBSIDOC>UBKOC
	t(chunks, symbols(),
		/(?:U|B|P|(?:(S|I)D)?(S|I))/g, (m,idx) =>
		is(m[1]) ? [ 'K', chunks[idx(1)][1], chunks[idx(1)+2][1] ] : // key:val
		is(m[2]) ? [ 'K', NA, chunks[idx(2)][1] ] : // val
		chunks[m.index]);

	// pass 3: semantic grammar check
	if (/UP/g.test(symbols())) err("NOT must appear right of parentheses. ie. !(a AND b) == (!a OR !b)");
	// TODO: fix grammar starting with AND
	if (!/(?:^$|^(?!B)(?:B?P{0,99}U?K{1,}P{0,99}){1,999}$)/g.test(symbols())) err('Incorrect grammar.');
	// console.log('tokens\n', chunks);

	// compiler to JSON intermediate representation
	// pass 4: hierarchy and balanced parens; final reduce of tokens 5:1 UBKOC>X
	// scan to K, eating everything around it, map to X token
	t(chunks, symbols(), /(P{1,99})?(U)?(K)(P{1,99})?(B)?/g, (m, idx) => (
		// parenthesis-gathering helper function [used twice below]
		P=i=>
			// when parentheses are captured
			is(m[i]) ? (
				// take the list of P tokens in the zero-or-more match
				l = chunks.slice(idx(i), idx(i)+m[i].length),
				// apply the sum of the matched parentheses to the total balance
				bal += l.map(c=>'('===c[1]?1:-1).reduce(sum,0),
				// join the list of original parenthesis characters and return the result. ie. "((()("
				l.map(c=>c[1]).join('')
			) : // else, no parens were captured
			'', // return an empty string (safe for concatenation)

		// return an X token
		{
			// lookbehind 1 for U, if found then not equal, otherwise default to is equal
			k: chunks[idx(3)][1], // key
			u: is(m[2]) ? '!=' : '==', // unary operator
			v: chunks[idx(3)][2], // value
			// lookahead  1 for B, splice into X.b, or default to AND
			b: is(m[5]) ? chunks[idx(5)][1] : 'AND', // binary operator
			// all parentheses surrounding K
			p: P(1) +','+ P(4)
		}));

	// grouping parentheses must balance
	bal < 0 ? err('Forgot opening paren (') :
	bal > 0 ? err('Forgot closing paren )') : NA;
	// console.log('final json\n'+JSON.stringify(chunks, null, 2));

	return chunks;
};

/**
 * Client-side JSON object search,
 * using Lucene-inspired syntax.
 *
 * example invocation:
 *   const query = searchy(q);
 *   records.filter(query.test);
 */
export const searchy = q => {
	const ast = lucene(q),
		reverseIf = (a,cond) => ((cond && a.reverse()), a),
		toString = s => is(s) ? ''+s : '';
	return { test(record) {
		// NOTICE: assumes user is passing result of `JSON.flatten(record)`.
		// build index and search functions
		let keys = [],
			values = [],
			index = Object.keys(record).reduce((acc,K)=>{
				// NOTICE: keys always match case-insensitive.
				let k = lower(K),
					// NOTICE: record values are always cast to string,
					//   [and object keys are already strings by necessity].
					V = toString(record[K]),
					// NOTICE: values always match case-insensitive.
					v = lower(V);
				// NOTICE: only string and number values are searchable,
				//   but its fine since record is result of `JSON.flatten()`.
				keys.push(k); // index of keys for key comparison
				acc[k] = v; // index of key:values for key:value comparison
				values.push(v); // index of values for value comparison
				return acc;
			}, {}),
			// NOTICE: key:values always match wildcard like *KEY*:*VALUE*
			matchValue = (haystack,needle)/*:bool*/ => -1!==haystack.search(needle),
			matchAnyValue = (v) => values.some(haystack=>matchValue(haystack,v)),
			matchKeyValue = (K, cmp, V)/*:bool*/ => {
				let v = lower(''+V);
				if (!is(K)) return cmp(matchAnyValue(v));
				let k = lower(K);
				// NOTICE: search key may match more than one record key,
				//   in which case first matching value wins
				let foundKey = keys.find(haystack=>-1!==haystack.search(k));
				return is(foundKey) && cmp(matchValue(index[foundKey], v));
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
					(i===(ast.length-1) ? '' : ('OR'===x.b?'||':'&&')), // logical operator
				], 1 === x.p.length).join('')).join('') +')';

		// console.debug('record', JSON.stringify(record, null, 2));
		// console.debug('Lucene query AST', JSON.stringify(ast, null, 2));
		// console.log('result', eval(logic));
		return eval(logic); // not evil logic
	}};
};

// function to convert lucene AST back into lucene string
export const tolucene = ast => {
	const reverseIf = (a,cond) => ((cond && a.reverse()), a);
	const toString = s => /^[a-z0-9_]{1}[a-z0-9_\-\.]{0,99}$/i.test(s) ? s : `"${s.replace(/"/g,'\\"')}"`;
	return ast.map((x,i)=>''+
		x.p.split(',')[0] + // prefix parens
		// K:V resolved to safe-to-eval boolean literals
		('!='===x.u ? 'NOT ' : '') +
		(is(x.k) ? (toString(x.k) +':') : '') +
		toString(x.v) +
		reverseIf([
			x.p.split(',')[1], // suffix parens
			(i===(ast.length-1) ? '' : ' '+ x.b +' '), // logical operator
		], 1 === x.p.length).join('')).join('');
};