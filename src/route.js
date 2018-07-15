import * as Utils from './utils.js';
import m from './m.js';

const routes = {};

const Route = {
	init() {
		const router = uri => {
			let route = routes['404'];
			for (const key in routes) {
				const _route = routes[key];
				let match;
				if (null != (match = uri.match(_route.rx))) {
					match.shift();
					if (!(
						null == _route ||
						(Utils.has(_route, 'vnode', '$') &&
						!m.Component.isComponent(_route.vnode))
					)) {
						route = _route;
						Route.params = match;
					}
				}
			}
			Route.title = route.title || '';
			document.body.setAttribute('class', Utils.hyphenate('route-'+route.uri));
			m.root = route.vnode;
			m.redraw();
		};
		Route.onnavigate(router);
		if ('' === document.location.hash) Route.uri = '/';
		else router(Route.uri);
	},

	register(uri, title, component) {
		routes[uri] = {
			uri: uri,
			title: Route.formatTitle(title),
			rx: new RegExp('^'+uri+'$'),
			vnode: { $: component }
		};
	},

	redirect(to) {
		Route.uri = to;
	},

	link: e => {
		const anchor = e.currentTarget || e.target;
		if (null == anchor) return;
		const href = anchor.getAttribute('href');
		if (/^(?:\w{1,99}:)?\/\//.test(href)) return; // redirect browser
		else {
			e.preventDefault();
			e.stopPropagation();
			if (e.ctrlKey) window.open(document.location.origin + 
				document.location.pathname +'#'+ href);
			else Route.redirect(href); // redraw page
			return false;
		}
	},

	rewrite(from, to) {
		Route.register(from, '', {
			oninit(v) {
				Route.redirect(to);
			},
			view(v) {
			}
		});
	},

	formatTitle: s => s,

	titleOf(uri) {
		return 'object' === typeof routes[uri] ? routes[uri].title : undefined;
	},

	get title() {
		return document.title;
	},

	set title(title) {
		document.title = title;
	},

	get uri() {
		return document.location.hash.substr(1).split('?')[0];
	},

	set uri(uri) {
		document.location.hash = uri;
	},

	onnavigate(cb) {
		window.addEventListener('hashchange', () => {
			cb(Route.uri);
		});
	},
};

Route.register('404', 'Not found', {
	view(v) {
		return { 'h1': `Error 404 Page not found` };
	}
});

export default Route;