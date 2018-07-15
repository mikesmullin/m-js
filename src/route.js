import m from './m.js';

const _routes = {};

const _routeMatches = uri => {
	let match;
	for (const key in _routes) {
		const registration = _routes[key];
		if (null != (match = uri.match(registration.rx))) {
			if (!m.Component.isComponent(registration.vnode)) continue;
			return { route: registration, params: match.slice(1) };
		}
	}
};

const isAbsoluteURI = uri => !/^(?:\w{1,99}:)?\/\//.test(uri);

const _router = uri => {
	// find matching route
	let route;
	const match = _routeMatches(uri);	
	if (null != match) {
		route = match.route;
		Route.params = match.params;
	}
	// default to built-in 404 error page
	else route = _routes['404'];

	// apply changes
	document.title = Route.titleFormat(uri, route.title || '');
	document.body.setAttribute('class', 'route-'+route.uri.toLowerCase().replace(/[^a-z0-9]/ig, '-'));
	m.root = route.vnode;
	m.redraw();
};

let _inited = false;
const Route = {
	// fn determines what the current page title should be
	titleFormat: (uri,s) => s, // identity function; no-op

	// remembers to automatically redirect from one uri to another,
	// if it is ever visited
	rewrite: (from, to) => Route.register(from, '', { oninit: v =>
		Route.redirect(to), view: v => {} }),

	// register a given component with the router
	register(uri, title, component) {
		_routes[uri] = { // overwrite
			uri: uri,
			title: title,
			rx: new RegExp('^'+uri+'$'),
			vnode: { $: component }
		};
	},

	init() {
		// only on first page load
		if (!_inited) {
			// bind callback for event fired when document.location is changed
			window.addEventListener('hashchange', () => _router(Route.uri));
			_inited = true;
		}

		// kick-start
		if ('' === document.location.hash.trim()) {
			// set default route (also triggers onnavigate)
			Route.redirect('/');
		}
		else {
			// trigger router on existing location
			_router(Route.uri); 
		}
	},

	// component helper;
	// meant to be set like { a: { $onclick: Route.link } }
	// causes the link to be carefully routed without a page refresh,
	// when possible. also supports opening dynamic locations into a new tab.
	link: e => {
		const anchor = e.currentTarget || e.target;
		if (null == anchor) return;
		const href = anchor.getAttribute('href');
		if (!isAbsoluteURI(href)) return; // redirect browser
		else {
			e.preventDefault();
			e.stopPropagation();
			if (e.ctrlKey) window.open(document.location.origin + 
				document.location.pathname +'#'+ href);
			else Route.redirect(href); // redraw page
			return false;
		}
	},

	redirect(uri) {
		if (isAbsoluteURI(uri)) document.location.hash = uri; // triggers onnavigate
		else document.location.href = uri; // off-site
	},

	// read-only
	get uri() {	return document.location.hash.substr(1).split('?')[0]; },

	// fetch the title of a given uri
	getTitleByURI: uri =>	'object' === typeof _routes[uri] ? _routes[uri].title : undefined,	
};

// register a default route
Route.register('404', 'Not found', {
	view: v=>({ 'h1': 'Error 404 Page not found' }) });

export default Route;