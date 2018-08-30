import {is, isA, isS, NA, sum} from "../utils";

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
export const chunker = (chunks, symbols, rx, matchCb, betweenCb) => {
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