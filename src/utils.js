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
export const getm = (o, ...path) => get(`MISSING_${path[path.length-1]}`, o, ...path);
export const set = (val, o, ...path) => {
	if (path.filter(is).length < 1) return o; // no-op
	let key = path.pop(), c = o, part, i = 0, len = path.length;
	for (;i<len;i++) {
		part = path[i];
		if (null == c[part]) c[part] = 'number' === typeof path[i+1] ? [] : {};
		c = c[part];
	}
	return c[key] = val;
};
export const change = (alt, cb, o, ...path) =>
	set(cb(get(alt, o, ...path)), o, ...path);
export const isString = s => 'string' === typeof s;
export const isStringEmpty = s => null == s || '' === s;
export const joinStringIfNotEmpty = (a,delim,b) => isStringEmpty(a) ? b : isStringEmpty(b) ? a : a + delim + b;
export const isFunction = (fn,paramCount) => 'function' === typeof fn && (null == paramCount || fn.length === paramCount);
export const not = b => isFunction(b) ? (...args)=>!b(...args) : !b;
export const map = (a,cb) => {
	let t;
	return null == a ? undefined :
		Array.isArray(a) ? (a.map((v,i) => cb(v,i,i,a.length))) :
		isObject(a) ? (t=Object.keys(a),t.map((k,i)=>cb(a[k],k,i,t.length))) :
		a;
};

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
export const oneOf = (v,a,b,c,d,e) => v === a || v === b || v === c || v === d || v === e;

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
export const tr = (k, o) => has(o, k) ? o[k] : o._;
export const nextTick = cb => setTimeout(cb, 0);
export const filter = (collection, test) =>
	Array.isArray(collection) ? collection.filter(test) :
	isObject(collection) ? Object.keys(collection)
		.reduce((o,k)=>{ if (test(collection[k])) o[k] = collection[k]; return o; },{}) :
	test(collection) ? collection :
	undefined;

export const serializeForm = form =>
	reduce({}, selectorAll('[name]', form), (acc,input) =>
		acc[prop(input, null, 'name')] = val(input));

export const request = (state, progressKey, method, url, data, redraw=false) => {
	set('load', state, progressKey);
	if (redraw) m.redraw();
	let ok, fail;
	const p = new Promise((res,rej)=>{
		ok = value => {
			set('ok', state, progressKey);
			fire(res, value);
			if (redraw) nextTick(m.redraw);
		};
		fail = err => {
			set('fail', state, progressKey);
			fire(rej, err);
			if (redraw) nextTick(m.redraw);
		};
	});
	try {
		const xhr = new XMLHttpRequest();
		xhr.open(method, url, true);
		xhr.overrideMimeType('text/plain'); // avoid auto-parsing as xml
		xhr.onreadystatechange = () => {
			if (4 !== xhr.readyState) return; // only proceed when request is complete
			const data = JSON.parse(xhr.responseText);
			if (200 === xhr.status) ok(data);
			else fail(data);
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

// ex: sortByCols(['name', 'createdAt'], 1);
export const sortByCols = (k, dir=-1) => (a,b) => (k=> (null==k || get(null,a,k)===get(null,b,k)) ? 0 : get(null,a,k)<=get(null,b,k) ? dir : (dir*-1) )(k.find(_k=>get(null,a,_k)!==get(null,b,_k)));
export const clamp = (n,min,max) => Math.max(Math.min(n, max), min);
export const count = o => 'object' === typeof o ? Object.values(o).length : Array.isArray(o) ? o.length : 0;
export const fire = (fn, ...args) => { if (isFunction(fn)) return fn(...args); };

// parsers
export const is = v => null != v;
export const NA = void 0;
export const upper = s => s.toUpperCase();
export const lower = s => s.toLowerCase();
export const sum = (sum, i) => sum+i;
export const isS = isString;
export const isA = a => Array.isArray(a);
Array.prototype.flat || Object.defineProperty(Array.prototype, 'flat', { // es6 shim
	enumerable: false,
	value: function() { return this.reduce((a,v)=>a.concat(v),[]); },
});