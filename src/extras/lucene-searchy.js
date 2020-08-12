import { is, NA, upper, lower } from '../utils.js';
import { chunker } from './chunker.js';

export class LuceneSyntaxError extends Error {
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
export const lucene = str => {
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

export const escapeLucene = s =>
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
export const searchy = q => {
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
export const tolucene = (ast, last) => {
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