let Utils = {};
if (null == window.Utils) window.Utils = Utils; else Utils = window.Utils; // hot load

// m, etc.
Utils.isEmptyArray = a => Array.isArray(a) && a.length < 1;
Utils.isObject = o => null != o && 'object' === typeof o; // null is #NotOurObject
Utils.isEmptyObject = o => Utils.isEmptyArray(Object.keys(o));
Utils.toArray = a => Utils.isObject(a) && a.length >= 0 ? Array.from(a) : [];
Utils.reduce = (initial, a, cb) => Utils.toArray(a).reduce((acc,x)=>{ cb(acc,x); return acc; }, initial);
Utils.objectKeys = o => Utils.isObject(o) ? Object.keys(o) : [];
Utils.pick = (o, ...keys) => Utils.reduce({}, Utils.objectKeys(o).filter(k=> keys.includes(k)), (acc,k)=>acc[k]=o[k]);
Utils.omit = (o, ...keys) => Utils.reduce({}, Utils.objectKeys(o).filter(k=>!keys.includes(k)), (acc,k)=>acc[k]=o[k]);
Utils.setAdd = (s, ...vals) => vals.forEach(v=>s.add(v));
Utils.resolve = (o, ...path) => {
	// TODO: could optimize this to generate less GC with pattern matching
	// TODO: remove anything that creates unnecessary arrays, especially use pattern matching,
	// TODO: and stop returning empty {} or [] for convenience sake. check it on iterate, instead.
	if (!Utils.isObject(o) || path.length < 1)
		return { has: Utils.isObject(o) && path.length < 1, o: o, key: path[0] };
	else if (1 === path.length)
		return { has: Object.hasOwnProperty.call(o, path[0]), o: o, key: path[0] };
	else return Utils.resolve(o[path.shift()], ...path);
};
Utils.has = (o, ...path) => undefined === path[0] ? false : Utils.resolve(o, ...path).has;
Utils.get = (alt, o, ...path) => {
	const r = Utils.resolve(o, ...path);
	return r.o && r.o[r.key] || alt;
};
Utils.set = (val, o, ...path) => {
	const key = path.pop(), r = Utils.resolve(o, ...path);
	if (r.has) return (undefined === r.key ? r.o : r.o[r.key])[key] = val;
};
Utils.isString = s => 'string' === typeof s;
Utils.isStringEmpty = s => null == s || '' === s;
Utils.joinStringIfNotEmpty = (a,delim,b) => Utils.isStringEmpty(a) ? b : a + delim + b;
Utils.isFunction = (fn,paramCount) => 'function' === typeof fn && (null == paramCount || fn.length === paramCount);
Utils.map = (a,cb) => null == a ? undefined : Array.isArray(a) ? a.map(cb) : Utils.isObject(a) ? Object.keys(a).map(k=>cb(a[k],k)) : a;
Utils.data = (()=>{
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
Utils.finally = (p,cb) => p.then(v=>cb(null, v), e=>cb(e));
Utils.call = (fn, ...args) => { if (Utils.isFunction(fn)) return fn(...args) };
Utils.toStringValue = v => null == v ? '' : Utils.isObject(v) ? JSON.stringify(v) : v;
Utils.notNullOrEmptyElse = (v, defaultValue) => null != v && '' !== v ? v : defaultValue;
Utils.prop = function(el, ns, k, v) {
	if (null == el || arguments.length < 3) return;
	const [key,prefix] = k.split(':').reverse();
	if (3 === arguments.length) {
		if (null == prefix) return Utils.notNullOrEmptyElse(el.getAttribute(key), undefined);
		else return Utils.notNullOrEmptyElse(el.getAttributeNS(ns[key], key), undefined);
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
Utils.getUid = () => Math.round(performance.now()*100).toString(16);

// db
Utils.rescue = (cb,alt) => { try { return cb(); } catch(e) { Utils.rescue.lastError = e; return alt; } };
Utils.fetchLocal = (k,alt) => Utils.rescue(()=>JSON.parse(localStorage.getItem(k))) || alt;
// Utils.ifChange = (testCb,onChangeCb) => { let state; return (...args) => { const v = testCb(...args); if (v !== state) { onChangeCb(v); state = v; } return v; }; };
Utils.saveLocal = (k,v) => { localStorage.setItem(k, JSON.stringify(v)); };

// app
Utils.hyphenate = s => null == s ? s : s.replace(/[^a-z0-9-]+/ig, '-').replace(/-*([A-Z])-*/g, (_,s)=>'-'+s.toLowerCase()).replace(/(^-+|-+$)/g, '');
Utils.selector = (query,parent=document.body) => parent instanceof Node ? parent.querySelector(query) : undefined;
Utils.selectorAll = (query,parent=document.body) => parent instanceof Node ? Array.from(parent.querySelectorAll(query)||[]) : [];
Utils.orEquals = (a,b,c,d,e) => null != a ? a : null != b ? b : null != c ? c : null != d ? d : null != e ? e : null;
Utils.val = function(input, value) {
	if (null == input) return;
	const hasOptions = !!Utils.selector(input, 'option');
	if (1 === arguments.length) {
		return hasOptions ?
			Utils.prop(Utils.selector('option[selected]', input), null, 'value') : // select > option[selected]
			Utils.get(undefined, input, 'value'); // input[password].value
	}
	else {
		if (hasOptions) {
			Utils.prop(Utils.selector('option[selected]', input), null, 'selected', undefined); // delete
			Utils.prop(Utils.selectorAll(`option[value]`, input)
				.find(option=>option.value===value), null, 'selected', 'selected');
		}
		else Utils.set(value, input, 'value');
	}
}
Utils.serializeForm = form =>
	Utils.reduce({}, Utils.selectorAll('[name]', form), (acc,input) =>
		acc[Utils.prop(input, null, 'name')] = Utils.val(input));
Utils.request = (method, url, data) => {
	let ok, fail;
	const p = new Promise((a,b)=>{ok=a;fail=b});
	try {
		const xhr = new XMLHttpRequest();
		xhr.open(method, url, true);
		xhr.onreadystatechange = () => {
			if (4 !== xhr.readyState) return; // only proceed when request is complete
			const data = Utils.rescue(()=>JSON.parse(xhr.responseText));
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
Utils.rand = (min,max) => Math.floor(Math.random() * (max - min + 1) ) + min;
Utils.select = a => a[Utils.rand(0, a.length-1)];
Utils.delay = ms => new Promise(ok=>setTimeout(ok, ms));
Utils.trapEvent = cb => (...args) => {
	const e = args.pop();
	e.preventDefault();
	e.stopPropagation();
	cb(...args, e);
	return false;
}
Utils.throttle = (ms,cb) => { // leading: false, trailing: true
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
Utils.trigger = (el, event, args) => { el.dispatchEvent(new Event(event, args)); };
Utils.activeIf = test => test ? '.active' : '';
Utils.onReady = cb => {
	const fn = () => {
		if ('complete' === document.readyState) cb();
	};
	document.onreadystatechange = fn;
	fn(); // kick-start for hot-loading cases
};

export default Utils;