import Route from '../src/route.js';
import * as Utils from '../src/utils.js';

const Components = {};
Components.Link = {
	view(v) {
		return { 'li.list-item': {
			$class: Route.uri === v.attrs.href ?
				Utils.joinStringIfNotEmpty(v.attrs.class, ' ',  'active') :
				v.attrs.class,
			'a.link': {
				$href: v.attrs.href,
				$onclick: Route.link,
				_: v.children,
			}
		}};
	}
};

const Pages = {};
Pages.Layout = {
	view(v) {
		return { '.left-sidebar': {
				header: {
					'.logomark': '',
					'.logo': 'M.js',
					'.version': '1.0.0',
				},
				'ul.link-list': [
					{ $: Components.Link, $href: '/guide', _: 'Guide' },
					{ $: Components.Link, $href: '/api', _: 'API' },
					{ $: Components.Link, $href: 'https://www.github.com/mikesmullin/m-js', _: 'GitHub' },
				],
				'nav.toc': {
					ul: [
						{
							li: {
								'a': 'Getting Started',
								ul: [
									{ 'li.active': { 'a.link': 'Introduction', ul: [
										{ li: { 'a.link': 'Tutorial' } },
										{ li: { 'a.link': 'Learning Resources' } },
										{ li: { 'a.link': 'Getting Help' } },
									]}},
								]
							}
						}
					]
				},
			},
			'main.right': v.children,
		};
	}
};

Pages.Guide = {
	view(v) {
		return { $: Pages.Layout, _: [
			{ 'h1.title': 'Introduction' },

			{ 'h3.subtitle': [ `“M.js is a minimalist, modernist, UI component framework for the web.”` ]},
			
			{ h2: 'What is a web component?' },
			
			{ p: [
				`An encapsulated, reusable, and composable element which—in aggregate—make up the user interface on a web application. `+
				`They are the modular equivalent of bricks which you can use to build your website's look and feel. `+
				`Examples of web components include buttons, links, forms, menus, loading spinners, etc. `+
				`More than just HTML, they are stateful, defined primarily in Javascript, and may contain data which persists beyond the usual DOM lifecycle. ` ]},

			{ p: [
				`Components are typically bundled so that all dependencies (`,
				{ code: '.css' },
				`, images, `,
				{ code: '.js' },
				`, `,
				{ code: '.html' },
				`, and any other assets) are in a single file or folder for easy import and removal from a project. `+
				`Sometimes exchange markets are made to redistribute and sell above-average components.` ]},
			
			{ h2: 'What is a component framework?' },
			
			{ p: `The central idea is reusability across devices and platforms—desktop and mobile—`+
				`via a transparent browser, or a native analog, bundled and shipped with your distribution. `+
				`Your application can now provide the same experience, no matter how users prefer to interface with it, `+
				`but you have to follow a set of guidelines, and sometimes install dependencies—both of which are the framework.` },

			{ p: [
				{ strong: 'WARNING: ' }, `Our mobile support is limited to the mobile browser only. We don't compile native. `+
				`You could still bundle and ship with `,
				{ a: { $href: 'https://electronjs.org/', _: 'Electron' }},
				` or `,
				{ a: { $href: 'https://cordova.apache.org/', _: 'Apache Cordova' }},
				` if you need, but you'd be on your own.` ]},
			
			{ h2: 'What is the Virtual DOM?' },
			
			{ p: `The Virtual DOM holds a minimalist duplicate of the tag hierarchy, attributes, inner text, and state of all components entirely in `+
				`Javascript memory at runtime. This is the authoritative copy; when changes are made to the tree, they happen `+
				`virtually first, and are buffered until it is time to render the next frame, where a single-pass render is performed, `+
				`which then finally applies the shortest-path transformations to the DOM tree.` },
			
			{ p: [
				{ strong: 'NOTE: ' }, `The DOM is a form of `, 
				{ a: { $href: 'https://en.wikipedia.org/wiki/Directed_acyclic_graph', _: 'directed acyclic graph' }},
				`, and therefore `,
				{ a: { $href: 'https://en.wikipedia.org/wiki/Graph_theory', _: 'Graph Theory' }},
				` can be `,
				{ a: { $href: 'https://www.youtube.com/watch?v=Ce3RNfRbdZ0', _: 'applied' }},
				,` to further reduce CPU cycles per frame.` ]},
			
			{ p: [ { strong : 'RANT: ' }, `Frameworks like `, 
				{ a: { $href: 'https://reactjs.org/', _: 'React' } }, 
				` `, 
				{ a: { $href: 'https://reactjs.org/docs/reconciliation.html', _: 'claim' }}, 
				` they are performing `,
				{ a: { $href: 'https://grfia.dlsi.ua.es/ml/algorithms/references/editsurvey_bille.pdf', _: 'advanced hueristics' } },
				` on top of this to reduce CPU cycles. But those are magic-laden unicorn farts designed `+
				`to keep you dependent. The two most complex transformations that happen in DOM trees are `+
				`a) moving a child between siblings, and b) moving a child between parents. In practice, these happen infrequently, such as the `+
				`drag-and-drop-to-reorder-list, and the rarer drag-from-list-to-other-list. When such cases occur, benchmarks have shown it to be both faster and easier to simply write your code `+
				`for this case explicitly, by changing the child's parent node on a successful drag operation, akin to a linked list reordering operation, `+
				`rather than challenging the VDOM to figure it out in constant time on every frame with an N-deep tree. `+
				`This is why component key properties are only useful among siblings.` ]},
			
			{ h2: 'What is JXML?' },
			
			{ p: [ `A minimalist lossless JSON representation of XML. Differing slightly from the deprecated `,
				{ a: { $href: 'https://developer.mozilla.org/en-US/docs/Archive/JXON', _: 'Mozilla' }}, ' ',
				{ a: { $href: 'https://github.com/tyrasd/jxon', _: 'JXON' }},
				`, and the common `,
				{ a: { $href: 'https://www.npmjs.com/package/xml2json', _: 'xml2json' }},
				` output. Designed to be both easier to read and write than alternatives such as React's `,
				{ a: { $href: 'https://reactjs.org/docs/introducing-jsx.html', _: 'JSX' }},
				` and the `,
				{ code: { a: { $href: 'https://mithril.js.org/hyperscript.html', _: 'm()' }}}, ` function from `,
				{ a: { $href: 'https://mithril.js.org/', _: 'Mithril.js' }},
				`, with the additional benefits of fastest runtime format, lowest memory footprint, `+
				`and no `, 
				{ a: { $href: 'https://babeljs.io/', _: 'Babel' }},
				` transpiler/preprocessor required.` ]},
			
			{ p: `In this framework, JXML is the data structure used to describe your components.` },
			
			{ p: [ {strong: 'BACKGROUND: ' }, `For a component to work the same in different places, it needs a way to be described in a neutral form `+
				`that is eventually compatible with both targets. In the case of a web browser, the target is the Document `+
				`Object Model (or DOM) which, for the purposes of backward compatibility, tends to yield very low performance. `+
				`Today, our users are conditioned to expect low latency, hyper responsive animations, transitions, and `+
				`even the use of physics with spring dynamics, collision, and layering effects.` ]},
			
			{ p: `JXML + VDOM help us meet modern user demands at high FPS.` },
			
			{ h2: `Why distribute ES6? Why not support older browsers?` },
			
			{ p: `This is not a general purpose framework. Its specific purposes are low memory footprint, and high performance. `+
				`We test for and support latest Firefox and Chrome for desktop and mobile, `+
				`but latest Edge, Safari, and Opera are believed to work, as well. ` },
			{ p: [
				`Also, its ${new Date().getFullYear()}—everyone is staying `,
				{ a: { $href: 'https://en.wikipedia.org/wiki/Usage_share_of_web_browsers', _: 'current' }},
				` due to rampant exploitation of security vulnerabilities. Friends don't let friends use non-free, privacy violating, insecure browsers.` ]},

			{ footer: {
				p: 'License MIT © Mike Smullin',
			}},
		]};
	}
};

Pages.Api = {
	view(v) {
		return { $: Pages.Layout, _: [
			{ 'h1.title': 'Introduction' },

			{ 'h3.subtitle': [ `“M.js is a minimalist, modernist, UI component framework for the web.”` ]},
			
			{ h2: 'What is a web component?' },
			
			{ p: [
				`An encapsulated, reusable, and composable element which—in aggregate—make up the user interface on a web application. `+
				`They are the modular equivalent of bricks which you can use to build your website's look and feel. `+
				`Examples of web components include buttons, links, forms, menus, loading spinners, etc. `+
				`More than just HTML, they are stateful, defined primarily in Javascript, and may contain data which persists beyond the usual DOM lifecycle. ` ]},
		]};
	}
};

const App = {
	init() {
		Route.formatTitle = s => `${s} | M.js Documentation`;
		Route.rewrite('/', '/guide');
		Route.register('/guide', 'Guide', Pages.Guide);
		Route.register('/api', 'API', Pages.Api);
		Route.init();
	}	
};
export default App;
import Hot from '../src/hot.js';
Utils.onReady(Hot.reloader(App));