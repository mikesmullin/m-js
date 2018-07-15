const chunker = (chunks, rx, cb, replaceText=t=>null) => { // tokenizer + lexer + compiler in one
	let m, lastIndex, chunk, token, i=0;
	const push = v => chunks.splice(i++, 0, v);
	// debugger;
	while (i<chunks.length) {
		if ('string' !== typeof chunks[i] || // already tokenized, skip
			0 === (chunk = chunks.splice(i,1)[0]).length // empty, discard
		) { i++; continue; }
		lastIndex = 0;
		while (null != (m = rx.exec(chunk))) {
			token = cb(m.index, m[0].length, m.slice(0));
			if (lastIndex < m.index) push(replaceText(chunk.substring(lastIndex, m.index)));
			if (null != token) push(token);
			lastIndex = m.index + m[0].length;
		}
		if (lastIndex < chunk.length) push(replaceText(chunk.substr(lastIndex)));
	}
	// console.log('chunks', chunks);
	return chunks;
};
const is = v => null != v, NA = undefined, wrap = (cond,k,o) => cond ? { [k]: o } : o,
	allOrOne = a => 1 === a.length ? a[0] : a;
const markdown = (str, integrate=o=>o, inlineOnly=false) => { // parser + compiler
	// chunks (becomes p tag if any leftover text)
	const RX_CHUNKS = /(?:^~~~(\w{1,99})?(?:\r\n|\n|$)([\s\S]{1,9999}?)(?:\r\n|\n|$)~~~(?:\r\n|\n|$)|((?:.{1,9999}(?:\r\n|\n|$)){1,99}))/gm;
	// block elements (header, list item, otherwise p)
	const RX_BLOCK_ELEMENTS = /(?:^(#{1,6})[ \t]{0,99}(.{1,999})(?:\r\n|\n|$)|^([ ]{0,99})([-*]|\d{1,3}\.)[ \t]{1,99}((?:.{1,9999}(?:\r\n|\n|$)(?!\1[-*]|\1\d{1,3}\.)){1,9999})(?:\r\n|\n|$))/gm;
	// inline/atomic elements (br, link, em)
	const RX_INLINE_ATOMIC_ELEMENTS = /(?:(  )(?:\r\n|\n|$)|\[(.{1,999}?)\]\(((?:\w{1,99}:)?\/?\/?[-A-Za-z0-9+&@#/%?=~_()|!:,.;]{0,2083}[-A-Za-z0-9+&@#/%=~_()|])\)|([*_~]{1,2})([\s\S]{1,999}?)\4)/gm;
	const RX_HIERARCHAL_ELEMENTS = /(?:(␠)|(␁)|(•{1,999})|(✎)|([¶⏎⇒/]{1,999}))/g;
	// 3-pass tokenizer
	const chunks = chunker([str], RX_CHUNKS, (i,l,[,lang,code,chunk])=> // pass 1
		is(code) ? { ϵ: '✎', code: code, lang: lang } :
		is(chunk) ? chunk :
		NA, ()=>({ ϵ: '␠', space: true }));
	chunker(chunks, RX_BLOCK_ELEMENTS, (i,l,[,headingLvl,heading,listIndent,listStyle,listItem]) => // pass 2
		is(heading) ? { ϵ: '␁', heading: heading, lvl: headingLvl.length } :
		is(listItem) ? { ϵ: '•',
			listItem: listItem.replace(new RegExp('^'+listIndent,'gm'), ''),
			listStyle: listStyle } :
		NA, t=>t);
	chunker(chunks, RX_INLINE_ATOMIC_ELEMENTS, (i,l,[,br,anchor,href,emType,emText]) => // pass 3
		is(br) ? { ϵ: '⏎', br: true } :
		is(anchor) ? { ϵ: '⇒', anchor: anchor, href: href } :
		is(emText) ? { ϵ: '/', em: emType, emText: emText } :
		NA, t=>({ ϵ: '¶', text: t }));
	// lexer + compiler (to JXML)
	return allOrOne(chunker([chunks.map(c=>c.ϵ).join('')], RX_HIERARCHAL_ELEMENTS, (i,l,[,space,heading,list,code,p]) => {
		const singleOrFlatMap = cb => allOrOne(chunks.slice(i,i+l).map(cb).reduce((acc,v)=>acc.concat(v),[]));
		return is(space) ? null : // discard
			is(heading) ? integrate({ ['h'+chunks[i].lvl]: {
				$id: chunks[i].heading.toLowerCase().replace(/[^a-z0-9]/ig, '-'),
				_: chunks[i].heading }}) :
			is(list) ? { [/[*-]/.test(chunks[i].listStyle) ? 'ul' : 'ol']:
				singleOrFlatMap(item=>({ li: markdown(item.listItem, integrate) })) } :
			is(code) ? integrate({ pre: { code: { $class: chunks[i].lang, _: chunks[i].code }}}) :
			is(p) ? integrate(wrap(!inlineOnly, 'p', singleOrFlatMap(atom=>
				atom.text ? atom.text :
				atom.em ? { [
					/^[*_]$/.test(atom.em) ? 'strong' : // bold
					'~' === atom.em ? 'code' : // monospace
					'~~' === atom.em ? 's' : // strikethrough
					'em']: markdown(atom.emText, integrate, true) } : // italics
				atom.br ? { br: {} } :
				atom.anchor ? integrate({ a: { $href: atom.href, _: atom.anchor }}) :
				NA))) :
			NA;
	}, t=>''));
};
export default markdown;