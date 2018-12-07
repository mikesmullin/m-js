export default m => {
	const globals = window;
	let _routes = {};

	const _routeMatches = uri => {
		let match;
		for (const key in _routes) {
			const registration = _routes[key];
			if (null != (match = uri.match(registration.rx))) {
				if ('object' !== typeof registration.vnode) continue;
				return { route: registration, params: match.slice(1) };
			}
		}
	};

	const isAbsoluteURI = uri => !/^(?:\w{1,99}:)?\/\//.test(uri);

	let currentRoute;
	const _router = uri => {
		// find matching route
		const match = _routeMatches(uri);
		if (null != match) {
			currentRoute = match.route;
			Route.params = match.params;
		}
		// default to built-in 404 error page
		else currentRoute = _routes['404'];

		// apply changes
		document.title = Route.titleFormat(uri, currentRoute.title || '');
		document.body.setAttribute('class', 'route-'+currentRoute.uri.toLowerCase().replace(/[^a-z0-9]/ig, '-'));
		Route.disabled = false;
		Route.redraw();
	};

	let _inited = false;
	let _throttle = false;
	let _redrawing = false;
	const Route = {
		reset: () => {
			_routes = {};
		},

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
				vnode: component,
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
					document.location.pathname +'#!'+ href);
				else Route.redirect(href); // redraw page
				return false;
			}
		},

		redirect(uri) {
			if (isAbsoluteURI(uri)) document.location.hash = '!'+ uri; // triggers onnavigate
			else document.location.href = uri; // off-site
		},

		/**
		 * Redraw the screen. [asynchronous; no choice]
		 *
		 * @param {int} ms - Milliseconds to delay (for animation timing, etc.)
		 * @param {object} vnode - (optional) Component to render.
		 * @param {boolean} disable - (optional) Disable subsequent calls to render. (ie. to keep error on screen)
		 */
		redraw(ms=16, vnode, disable=false) {
			// reject various rendering error cases
			if (_redrawing) { // recursive
				console.error('ignored pointless redraw inside redraw. you should stop doing that.');
				return false;
			}
			if (_throttle) { // too fast
				console.error('throttled redraw');
				return false;
			}
			if (true === Route.disabled) { // error occurred; stop drawing
				_throttle = false;
				return false;
			}
			_throttle = true;
			// prevent users from calling this inside component oninit() etc.
			// by delaying it until end of event loop;
			// this is fine because m.render() is not blocking, anyway.
			globals.redrawCount++;
			// call it out here so we can see stack that invoked redraw()
			console.error('redraw', globals.redrawCount);
			return new Promise(ok => setTimeout(() => {
				if (true===disable) Route.disabled = true;
				_throttle = false;
				_redrawing = true;
				m.render(document.body, m(null != vnode ? vnode : currentRoute.vnode));
				_redrawing = false;
				ok();
			}, ms));
		},

		// read-only
		get uri() {
			return document.location.hash.substr(2).split('?')[0]; },

		// fetch the title of a given uri
		getTitleByURI: uri =>
			'object' === typeof _routes[uri] ? _routes[uri].title : undefined,
	};

	if (null != globals && null == globals.redrawCount) globals.redrawCount = 0;

	// example:
	// // register a default route
	// Route.register('404', 'Not found', {
	// 	view: v=>({ 'h1': 'Error 404 Page not found' }) });

	return Route;
};