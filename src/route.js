import * as Utils from './utils.js';
import m from './m.js';

const routes = {};

const Route = {
	init() {
		const router = uri => {
			let registration = routes['404'];
			for (const key in routes) {
				const route = routes[key];
				let match;
				if (null != (match = uri.match(route.rx))) {
					match.shift();
					if (
						null == route ||
						(Utils.has(route, 'vnode', '$') &&
						!m.Component.isComponent(route.vnode))
					) {
					} else {
						registration = route;
						Route.params = match;
					}
				}
			}
			Route.title = registration.title || '';
			m.root = registration.vnode;
			m.redraw();
		};
		Route.onnavigate(router);
		if ('' === document.location.hash) Route.uri = '/';
		else router(Route.uri);
	},

	register(uri, title, component) {
		routes[uri] = {
			title: Route.formatTitle(title),
			rx: new RegExp('^'+uri+'$'),
			vnode: { $: component }
		};
	},

	redirect(to) {
		Route.uri = to;
	},

	link: Utils.trapEvent(e => {
		const link = e.currentTarget || e.target;
		if (null == link) return;
		Route.redirect(link.getAttribute('href'));
	}),

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
		return { 'h1': `Error 404: Page not found.` };
	}
});

export default Route;