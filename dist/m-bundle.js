(function () {
	'use strict';

	// m, etc.
	const isObject = o => null != o && 'object' === typeof o; // null is #NotOurObject
	const objectKeys = o => isObject(o) ? Object.keys(o) : [];
	const resolve = (o, ...path) => {
		// TODO: could optimize this to generate less GC with pattern matching
		// TODO: remove anything that creates unnecessary arrays, especially use pattern matching,
		// TODO: and stop returning empty {} or [] for convenience sake. check it on iterate, instead.
		if (!isObject(o) || path.length < 1)
			return { has: isObject(o) && path.length < 1, o: o, key: path[0] };
		else if (1 === path.length)
			return { has: Object.hasOwnProperty.call(o, path[0]), o: o, key: path[0] };
		else return resolve(o[path.shift()], ...path);
	};
	const get = (alt, o, ...path) => {
		const r = resolve(o, ...path);
		return r.o && r.o[r.key] || alt;
	};
	const isStringEmpty = s => null == s || '' === s;
	const joinUnlessEmpty = (delim, ...args) => args.filter(not(isStringEmpty)).join(delim);
	const isFunction = (fn,paramCount) => 'function' === typeof fn && (null == paramCount || fn.length === paramCount);
	const not = b => isFunction(b) ? (...args)=>!b(...args) : !b;

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
	const call = (fn, ...args) => { if ( isFunction(fn)) return fn(...args) };
	const notNullOrEmptyElse = (v, defaultValue) => null != v && '' !== v ? v : defaultValue;
	const prop = function(el, ns, k, v) {
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
	Array.prototype.flat || Object.defineProperty(Array.prototype, 'flat', { // es6 shim
		enumerable: false,
		value: function() { return this.reduce((a,v)=>a.concat(v),[]); },
	});

	// VNode is basically composable branches and traversal
	const eachTag = function*(o) {
		if (!isObject(o)) return;
		for (let k in o)
			if ('$'===k && 'object' !== typeof o.$) yield o.$;
			else if (!('$'===k[0] || '_'===k[0])) yield k;
	};
	let VNode = class VNode {
		constructor(tag, attrs, ...children) {
			let o;
			if (isFunction(get(null, tag, 'view'))) { this.$ = tag; o = this; }
			else { this[tag] = {}; o = this[tag]; }
			Object.assign(o, objectKeys(attrs).reduce((acc,k)=>{acc[k.replace(/^\$?/, '$')]=attrs[k];return acc;},{}));
			o._ = children;
		}
	};
	if (null == window.VNode) window.VNode = VNode; else VNode = window.VNode; // hot load (mostly)

	VNode.tag = o => {
		const itr = eachTag(o), first = itr.next(), second = itr.next();
		if (second.done) return first.value;
	};
	// match group:          [1] id           [2] class           [3] attrName                        [5] attrValue
	const RX_ATTRS = /\s*(?:#([^\s#\.[\]]+)|\.([^\s#\.[\]]+)|\[\s*([\w:]+[^\s=[\]]*)?(?:\s*=\s*(['"])?(.*?)\4)?\s*\])\s*/ig;
	VNode.attrs = function*(tag, o) {
		const attrs = {};
		tag = tag.replace(RX_ATTRS, (...args) => {
			const [/*match*/, id$$1, cls, attrName, /*quot*/, attrValue, /*offset*/, /*str*/] = args;
			if (null != id$$1)
				attrs.id = id$$1; // last wins
			else if ('string' === typeof cls && '' !== cls.trim()) {
				attrs.class = joinUnlessEmpty(' ', attrs.class, cls); // append space-delimited
			}
			else if (null != attrName)
				attrs[attrName] = undefined === attrValue ? null : attrValue; // merge object
			return '';
		});
		if ('' === tag) tag = 'div'; // default
		yield tag; // first result is always the tag name
		if (isObject(o)) {
			for (let k in o)
				if ('$class' === k) {
					if ('string' === typeof o.$class && '' !== o.$class.trim()) {
						attrs.class = joinUnlessEmpty(' ', attrs.class, o.$class);
					}
				} else if ('$'===k[0] && k.length > 1)
					attrs[k.substr(1)] = o[k];
		}
		for (let k in attrs)
			yield {
				k: k,
				ev: 'on'===k.substr(0,2) ? k.substr(2) : undefined,
				v: attrs[k]
			};
	};
	VNode.children = function*(o) {
		if (null == o) return;
		if (Array.isArray(o)) {
			for (const child of o)
				if (m.Component.isComponent(child)) yield child;
				else for (const _child of VNode.children(child))
					yield _child;
		}
		else if (isObject(o)) {
			for (const tag of eachTag(o))
				yield Object.freeze({ [tag] : o[tag] });
			for (const child of VNode.children(o._))
				yield child;
		}
		else if ('string' === typeof o || 'number' === typeof o)
			yield o;
	};

	// m() is basically reduced to an (optional) string parser
	// use it if it want, or just write the JXML directly to save cycles. your choice.
	let m = (tag, ...args) => {
		const attrs = {}, children = [];
		for (let i=0,arg; args.length>0; i++) {
			arg = args.shift();
			if (0 === i && isObject(arg) && !Array.isArray(arg) && !(arg instanceof VNode)) {
				Object.assign(attrs, arg); // attrs; merge
			}
			else if (Array.isArray(arg)) {
				children.splice(-1, 0, ...arg); // children; append
			}
			else {
				children.push(arg); // child; append
			}
		}
		return new VNode(tag, attrs, ...children);
	};
	if (null == window.m) window.m = m; else m = window.m; // hot load (mostly)

	m.Component = class {
		constructor(_static, attrs, ...children) {
			this.dom = null;
			this.static = _static;
			this.attrs = attrs || {};
			this.children = children || [];
		}
	};
	m.Component.isComponent = o =>  isFunction(get(null, o, '$', 'view'));
	m.instance = (state, o) => { // wrap component in state
		return {
			state: state,
			oninit(v) {
				if (true === state.inited) return;
				state.inited = true;
				v.state = state;
				return call(o.oninit, v);
			},
			oncreate(v) {
				if (true === state.created) return;
				state.created = true;
				v.state = state;
				return call(o.oncreate, v);
			},
			onbeforeupdate(v) {
				v.state = state;
				return call(o.onbeforeupdate, v);
			},
			onupdate(v) {
				v.state = state;
				return call(o.onupdate, v);
			},
			view(v) {
				v.state = state;
				return call(o.view, v);
			},
			onbeforeremove(v) {
				v.state = state;
				return call(o.onbeforeremove, v);
			},			
			onremove(v) {
				v.state = state;
				const r = call(o.onremove, v);
				for (const key in state) {
					delete state[key];
				}
				return r;
			},
		};
	};
	// lifecycle methods
	for (name of [
		'oninit', // on insert, append, or replace (instantiation), before dom element exists
		'view', // every render
		'oncreate', // just after init() is complete; dom element now exists
		'onbeforeupdate', // before diff happens on a node. return false to avoid checking (like manual dirty: false)
		'onupdate', // for pre-existing dom element, post-diff on each m.render() cycle
		'onbeforeremove', // before removeChild is invoked
		'onremove' // after removeChild is invoked
	]) {
		const copyOfName = name;
		m.Component[copyOfName] = (inst, dom) => {
			if (!isFunction(inst.static[copyOfName])) return;
			if (null != dom) inst.dom = dom;
			return inst.static[copyOfName](inst);
		};
	}m.root = null;
	const internalAttrs = ['', 'key', 'dirty'];
	const makeEl = (ns, vTag, v=null) =>
		null == vTag ? document.createTextNode(v) :
		null != ns[''] ? document.createElementNS(ns[''], vTag) :
		document.createElement(vTag);
	const setEventListener = (el, event, cb) => {
		if (cb === data(el)[event]) return;
		// note: anon functions may have the same code, but will fail above check.
		//   therefore we re-bind because is no faster way to resolve the matter.
		el.removeEventListener(event, data(el)[event], true);
		el.addEventListener(event, data(el)[event] = cb, true);
	};
	const xforms = { insertBefore: 0, appendChild:  1, recycleChild: 2, removeChild: 3 };
	let abortRedraw;
	// basically graph theory: walk tree, apply graph transforms, where DOM == DAG
	m.render = (domParent, vnode/* a.k.a. fragment*/, ns/*, cb*/) => {
		let el, v, _v, vKey, vTag, attrsItr, attr, componentInstStack = [],
		siblingIndex, changeIndex, foundKey, passover = new Set([]), i = -1;
		abortRedraw = false;
		const applyComponentLifeCycle = (method, dom) => {
			if (null == componentInstStack || componentInstStack.length < 1) return;
			let p = [];
			for (const componentInst of componentInstStack) { // child-most first
				p.push(method(componentInst, dom));
				// notice: component lifecycle methods may return undefined or a Promise,
				//   which will stall the update but only for a particular component branch.
				//   its like dirty = false, but it can apply to indexed siblings too,
				//   as long as they don't move.
			}
			return p; // array of return values
		};
		const unwrapInitComponentStack = v => {
			while (m.Component.isComponent(v)) {
				const attrs = {}, children = [],
					itr = VNode.attrs('', v);
				itr.next().value; // discard tag
				for (const attr of itr) {
					attrs[attr.k] = attr.v;
				}
				for (const child of VNode.children(v)) {
					children.push(child);
				}
				const componentInst = new m.Component(v.$, attrs, ...children);
				componentInstStack.unshift(componentInst); // child-most first
				if (applyComponentLifeCycle(m.Component.oninit).some(v=>false===v)) {
					abortRedraw = true;
					v = null;
				}
				else {
					v = m.Component.view(componentInst); // may return another component
				}
			}
			return v;
		};
		const despawn = (stack,cb) => {
			const old = componentInstStack;
			componentInstStack = stack;
			applyComponentLifeCycle(m.Component.onbeforeremove);
			componentInstStack = old;
			cb();
			componentInstStack = stack;
			applyComponentLifeCycle(m.Component.onremove);
			componentInstStack = old;
		};
		const replaceChild = (fn, el) => {
			fn(xforms.insertBefore, el);
			// TODO: if el has children, move them to new parent before removing el?
			//  preserves a parent whose tag changed but children did not
			//  ie. test with ul -> ol and same li children
			fn(xforms.removeChild, el);
		};
		const applyXform = (xform, otherEl) => {
			switch (xform) {
				case xforms.insertBefore:
				case xforms.appendChild:
					el = xforms.insertBefore === xform ? // either case will create empty tag
						domParent.insertBefore(makeEl(ns, vTag, v), otherEl) :
						domParent.appendChild (makeEl(ns, vTag, v));
					break;

				case xforms.recycleChild:
					if (null != vTag) {
						if (el instanceof Text || (el.tagName||'').toUpperCase() !== vTag.toUpperCase()) // node type / tag name differ
							replaceChild(applyXform, el);
						const existingAttrKeys = new Set([]);
						for (attr of el.getAttributeNames()) {
							existingAttrKeys.add(attr);
						}
						for (attr of attrsItr) {
							if (!internalAttrs.includes(attr.k)) { // skip internal-only attrs
								existingAttrKeys.delete(attr.k.split(':').pop());
								if (null != attr.ev) setEventListener(el, attr.ev, attr.v);
								else if (prop(el, ns, attr.k) !== attr.v) // attr value differs
									prop(el, ns, attr.k, attr.v); // overwrite it
							}
						}
						for (attr of existingAttrKeys) {
							prop(el, ns, attr, undefined); // delete
						}
					}
					else { // vnode is string
						if (el instanceof Text) {
							if (el.data !== _v) // text node differs
								el.data = _v; // replace text
						} else replaceChild(applyXform, el); // replace node
					}
					break;

				case xforms.removeChild:
					domParent.removeChild(otherEl);
					break;
			}
		};

		// --- BEGIN LOOP ---
		vnode = unwrapInitComponentStack(vnode);
		let componentInstStackOuterMarker = componentInstStack.length;
		if (abortRedraw) return;
		for (v of VNode.children(vnode)) { // single-pass dom tree mutation to target vnode state
			componentInstStack.splice(componentInstStackOuterMarker);
			i++;
			while (passover.has(i)) i++; // skip out-of-order dom nodes with keys, modified previously
			v = unwrapInitComponentStack(v);
			if (abortRedraw) return;
			if (isObject(v)) { vTag = VNode.tag(v); _v = v[vTag]; }
			else { vTag = null; _v = v; } // literal
			if (null != vTag) {
				attrsItr = VNode.attrs(vTag, _v); // pull attrs from tag string, if any
				ns = Object.assign({}, ns);
				for (const k in _v) {
					if ('$xmlns' === k)
					ns[''] = _v[k];
					else if (/^\$xmlns:/.test(k))
					ns[k.substr(7)] = _v[k];
				}
				vTag = attrsItr.next().value; // post-processed tag name
			} else attrsItr = undefined;
			vKey = null != vTag ? get(null, _v, '$key') : null;
			changeIndex = i; // unless we find an out-of-order key
			foundKey = false;
			
			if (null != vKey) { // vnode has key; find its match among dom siblings
				if (data(domParent.childNodes[i]).key === vKey) foundKey = true; // current is matching
				else {
					siblingIndex = domParent.childNodes.length;
					while (!foundKey && siblingIndex-- > 0) {
						if (data(domParent.childNodes[siblingIndex]).key === vKey) {
							changeIndex = siblingIndex;
							foundKey = true;
							i--; // rewind for future vnode consideration, since no match here
						}
					}
				}
				if (!foundKey) { // no matching key among siblings
					applyXform(xforms.insertBefore, domParent.childNodes[i]);
					data(domParent.childNodes[changeIndex]).key = vKey;
				}
			}
			else if (null == domParent.childNodes[changeIndex]) {
				applyXform(xforms.appendChild);
			}
			passover.add(changeIndex); // mark node to avoid deletion
			if (foundKey && false === get(null, _v, '$dirty')) continue; // manual dirty; avoid node + descendant mutation
			// WARNING: manual dirty requires key. replacement of node or parent will delete key.
			
			el = domParent.childNodes[changeIndex];
			if (false === applyComponentLifeCycle(m.Component.onbeforeupdate)) continue;
			if (null == data(el).removing) { // target node is waiting for mutation

				let differentComponentInst = [];
				const existingStack = data(el).componentInstStack;
				if (null != existingStack) {
					for (let i=existingStack.length-1; i>=0; i--) {
						if (null == componentInstStack[i] || existingStack[i].state !== componentInstStack[i].state) { // not the same component instance
							differentComponentInst.push(existingStack[i]);
							break;
						}
					}	
				}	
				if (differentComponentInst.length>0) {
					despawn(differentComponentInst, () => {
						applyXform(xforms.recycleChild);
					});
				}
				else {
					applyXform(xforms.recycleChild);
				}
				
				data(el).componentInstStack = componentInstStack;
				
				if (isObject(v)) {
					m.render(el, _v, ns/*, cb*/); // recurse (depth-first traversal)
					if (abortRedraw) return;
				}
				applyComponentLifeCycle(m.Component.oncreate, el);
				applyComponentLifeCycle(m.Component.onupdate, el);
			}
		}
		siblingIndex = domParent.childNodes.length;
		while (siblingIndex-- > 0) { // purge nodes w/o the mark
			el = domParent.childNodes[siblingIndex];
			componentInstStack = data(el).componentInstStack;
			if (!passover.has(siblingIndex) && null == data(el).removing)
				despawn(componentInstStack, () => {
					applyXform(xforms.removeChild, el);
				});
		}
	};
	let timer, start, end;
	m.lastRenderTime = 0; // warn: browser limits reliability to +/-2ms
	const _redraw = now => {
		m.renderCount++;
		start = performance.now();
		try {
			m.render(document.body, m.root);
		}
		catch(e) {
			throw e;
		}
		finally {
			end = performance.now();
			m.lastRenderTime = end - start;
			timer = null;
		}
	};
	m.renderCount = 0;
	m.redraw = () => {
		if (null != timer) return;
		timer = 1;
		_redraw();
	};

	m.untrusted = v => {
		if ('string' === typeof v) return v;
		else if ('number' === typeof v) return ''+v;
		else {
			console.error('Malicious value', v);
			return '';
		}
	};

}());
