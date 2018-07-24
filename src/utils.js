// m, etc.
export const isEmptyArray = a => Array.isArray(a) && a.length < 1;
export const isObject = o => null != o && 'object' === typeof o; // null is #NotOurObject
export const isEmptyObject = o => isEmptyArray(Object.keys(o));
export const toArray = a => isObject(a) && a.length >= 0 ? Array.from(a) : [];
export const reduce = (initial, a, cb) => toArray(a).reduce((acc,x)=>{ cb(acc,x); return acc; }, initial);
export const objectKeys = o => isObject(o) ? Object.keys(o) : [];
export const pick = (o, ...keys) => reduce({}, objectKeys(o).filter(k=> keys.includes(k)), (acc,k)=>acc[k]=o[k]);
export const omit = (o, ...keys) => reduce({}, objectKeys(o).filter(k=>!keys.includes(k)), (acc,k)=>acc[k]=o[k]);
export const setAdd = (s, ...vals) => vals.forEach(v=>s.add(v));
export const resolve = (o, ...path) => {
	// TODO: could optimize this to generate less GC with pattern matching
	// TODO: remove anything that creates unnecessary arrays, especially use pattern matching,
	// TODO: and stop returning empty {} or [] for convenience sake. check it on iterate, instead.
	if (!isObject(o) || path.length < 1)
		return { has: isObject(o) && path.length < 1, o: o, key: path[0] };
	else if (1 === path.length)
		return { has: Object.hasOwnProperty.call(o, path[0]), o: o, key: path[0] };
	else return resolve(o[path.shift()], ...path);
};
export const has = (o, ...path) => undefined === path[0] ? false : resolve(o, ...path).has;
export const get = (alt, o, ...path) => {
	const r = resolve(o, ...path);
	return r.o && r.o[r.key] || alt;
};
export const set = (val, o, ...path) => {
	const key = path.pop(), r = resolve(o, ...path);
	if (r.has) return (undefined === r.key ? r.o : r.o[r.key])[key] = val;
};
export const isString = s => 'string' === typeof s;
export const isStringEmpty = s => null == s || '' === s;
export const joinStringIfNotEmpty = (a,delim,b) => isStringEmpty(a) ? b : a + delim + b;
export const isFunction = (fn,paramCount) => 'function' === typeof fn && (null == paramCount || fn.length === paramCount);
export const map = (a,cb) => null == a ? undefined : Array.isArray(a) ? a.map(cb) : isObject(a) ? Object.keys(a).map(k=>cb(a[k],k)) : a;
export const data = (()=>{
	let l, s;
	const r = el => new Proxy(
		null != el && (s.has(el) ? s.get(el) : (l={},s.set(el,l),l)), {
		get: (o,k) => o ? o[k] : undefined,
		set: (o,k,v) => o ? (o[k] = v) : undefined,
	})
	r.flush = () => { s = new WeakMap() };
	r.flush();
	return r;
})();
export const then2 = (p,cb) => p.then(v=>cb(null, v), e=>cb(e));
export const call = (fn, ...args) => { if ( isFunction(fn)) return fn(...args) };
export const toStringValue = v => null == v ? '' : isObject(v) ? JSON.stringify(v) : v;
export const notNullOrEmptyElse = (v, defaultValue) => null != v && '' !== v ? v : defaultValue;
export const prop = function(el, ns, k, v) {
	if (null == el || arguments.length < 3) return;
	const [key,prefix] = k.split(':').reverse();
	if (3 === arguments.length) {
		if (null == prefix) return notNullOrEmptyElse(el.getAttribute(key), undefined);
		else return notNullOrEmptyElse(el.getAttributeNS(ns[key], key), undefined);
	}
	else if (undefined === v) {
		if (null == prefix) el.removeAttribute(key);
		else el.removeAttributeNS(ns[key], key);
	}
	else {
		if (null == prefix) el.setAttribute(key, null == v ? '' : v);
		else {
			el.setAttributeNS(ns[key], key, null == v ? '' : v);
		}
	}
};

// loader
export const uid = () => Math.round(performance.now()*100).toString(16);

// db
export const rescue = (cb,alt) => { try { return cb(); } catch(e) { rescue.lastError = e; return alt; } };
export const fetchLocal = (k,alt) => rescue(()=>JSON.parse(localStorage.getItem(k))) || alt;
// ifChange = (testCb,onChangeCb) => { let state; return (...args) => { const v = testCb(...args); if (v !== state) { onChangeCb(v); state = v; } return v; }; };
export const saveLocal = (k,v) => { localStorage.setItem(k, JSON.stringify(v)); };

// app
export const hyphenate = s => null == s ? s : s.replace(/[^a-z0-9-]+/ig, '-').replace(/-*([A-Z])-*/g, (_,s)=>'-'+s.toLowerCase()).replace(/(^-+|-+$)/g, '');
export const selector = (query,parent=document.body) => parent instanceof Node ? parent.querySelector(query) : undefined;
export const selectorAll = (query,parent=document.body) => parent instanceof Node ? Array.from(parent.querySelectorAll(query)||[]) : [];
export const orEquals = (a,b,c,d,e) => null != a ? a : null != b ? b : null != c ? c : null != d ? d : null != e ? e : null;
export const val = function(input, value) {
	if (null == input) return;
	const hasOptions = !!selector(input, 'option');
	if (1 === arguments.length) {
		return hasOptions ?
			prop(selector('option[selected]', input), null, 'value') : // select > option[selected]
			get(undefined, input, 'value'); // input[password].value
	}
	else {
		if (hasOptions) {
			prop(selector('option[selected]', input), null, 'selected', undefined); // delete
			prop(selectorAll(`option[value]`, input)
				.find(option=>option.value===value), null, 'selected', 'selected');
		}
		else set(value, input, 'value');
	}
}
export const serializeForm = form =>
	reduce({}, selectorAll('[name]', form), (acc,input) =>
		acc[prop(input, null, 'name')] = val(input));
export const request = (method, url, data) => {
	let ok, fail;
	const p = new Promise((a,b)=>{ok=a;fail=b});
	try {
		const xhr = new XMLHttpRequest();
		xhr.open(method, url, true);
		xhr.onreadystatechange = () => {
			if (4 !== xhr.readyState) return; // only proceed when request is complete
			const data = rescue(()=>JSON.parse(xhr.responseText));
			if (200 === xhr.status) ok(data); else fail(data);
		};
		xhr.setRequestHeader('Content-Type', 'application/json');
		xhr.send(JSON.stringify(data));
	}
	catch(e) {
		fail(e);
	}
	return p;
};
export const rand = (min,max) => Math.floor(Math.random() * (max - min + 1) ) + min;
export const select = a => a[rand(0, a.length-1)];
export const delay = ms => new Promise(ok=>setTimeout(ok, ms));
export const trapEvent = cb => (...args) => {
	const e = args.pop();
	e.preventDefault();
	e.stopPropagation();
	cb(...args, e);
	return false;
}
export const throttle = (ms,cb) => { // leading: false, trailing: true
	let timer;
	return (...args) => {
		if (null != timer) {
			timer = clearTimeout(timer);
		}
		timer = setTimeout(() => {
			cb(...args);
			timer = null;
		}, ms);
	};
};
export const trigger = (el, event, args) => { el.dispatchEvent(new Event(event, args)); };
export const activeIf = test => test ? '.active' : '';
export const onReady = cb => {
	const fn = () => {
		if ('complete' === document.readyState) cb();
	};
	document.onreadystatechange = fn;
	fn(); // kick-start for hot-loading cases
};



// misc

export const is = v => null != v;
export const NA = void 0;
export const upper = s => s.toUpperCase();
export const lower = s => s.toLowerCase();
export const sum = (sum, i) => sum+i;

/**
 * Chunker: A pattern-matcher and map-reducer.
 *
 * Super powerful! ie. Tokenizer, Lexer, and Semantic Analyzer in one reusable function.
 *
 *     “Think of a unique 1-byte¹ symbol to represent each of your token types.
 *      Once everything is a string, you can use a RegExp hammer!”
 *       –Author of something
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
 * @param {Fn(matches:String[], mapSymbolIndexToTokenIndex:Fn(i:int)=>index:int)=>token:mixed, symbolIndex:int} cb -
 *   Callback fired per-chunk. Receives arguments providing context of match and, in mode (b), a mapping function
 *   which translates a symbol index to a token index in the chunks list.
 *   Expected to return a token for the given match.
 * @param {Fn(s:String)=>token:mixed} xtraCb - (optional) Callback fired in-between matches. This is for any
 *   before-or-after characters within the subject string which fall outside of RegExp match. Similar to the effect
 *   of `"HERPderpGIGGITYderpDURR".split(/derp/g)`, this function would be invoked once for "HERP", once for "GIGGITY",
 *   and once for "DURR". The default value will discard this valuable data.
 *   If specified, expected to return a token for the given non-match.
 * @return mixed[] - An ordered list of tokens resulting from each match of given pattern in given string.
*/
export const chunker = (chunks, symbols, rx, cb, xtraCb) => {
    const r = [], _chunks = is(symbols) ? [symbols] : chunks;
    // debugger;
    for (let i=0,last,chunk,m,token,push,insX,s; i<_chunks.length; i++) {
        chunk = _chunks[i];
        if ('string' !== typeof chunk) { // non-string chunks are not matchable by RegExp;
            is(chunk) && r.push(chunk); // forward token to output as-is, and in same position
            // otherwise, discard null and undefined values
        }
        else {
            push = v =>
                is(v) &&
                r.push(v);

            insX = (a,b) =>
                is(xtraCb) &&
                last<a &&
                '' !== (s = chunk.substring(last, b)) &&
                s.length>0 &&
                is((s = xtraCb(s))) &&
                push(s);

            last = 0;

            while (is(m = rx.exec(chunk))) {
                token = cb(m, is(symbols) && (i => // map symbol index => chunk index
                    // TODO: could further simplify this to return an array instead of fn
                    m.index + m.slice(1,Math.max(1,i)).map(v=>is(v) ? v.length : 0).reduce(sum,0)));
                insX(m.index, m.index); // text before match [last..m.index]
                push(token); // matched text
                last = m.index + m[0].length;
            }
            insX(chunk.length); // text after match [last..]
        }
    }
    chunks.splice(0); chunks.push(...r); // mutate input for convenience
    // console.log('chunks', JSON.stringify(r,null,2));
    return r;
};