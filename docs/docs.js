import Route from '../src/route.js';
import * as Utils from '../src/utils.js';
import markdown from './markdown-jxml.js';

const _integrate_md = vnode => {
	if (Utils.has(vnode, 'a', '$href')) { // intercept links
		vnode.a.$onclick = Route.link;
		return vnode;
	}
	if (Utils.has(vnode, 'pre', 'code')) { // highlight code
		return {
			$: Components.Code,
			$lang: Utils.get(null, vnode, 'pre', 'code', '$class'),
			_: Utils.get(null, vnode, 'pre', 'code', '_'),
		};
	}
	if ('CAUTION' === Utils.get(null, vnode, 'p', 0, 'strong')) {
		vnode.p.$class = 'warning';
		return vnode;
	}
	return vnode;
};

const doc = (uri, title, md) => {
	Route.register(uri, title, {
		view: v => ({ $: Pages.Layout, _: markdown(md, _integrate_md) }),
	});
};


const Components = {};

Components.Code = {
	oncreate: v => window.Prism.highlightAllUnder(v.dom),
	view: v => ({ pre: { code: { $class: 'language-'+v.attrs.lang, _: v.children }}}),
};

Components.Link = {
	view(v) {
		return { 'li.list-item': {
			$class: Route.uri === v.attrs.href ?
				Utils.joinStringIfNotEmpty(v.attrs.class, ' ',  'active') :
				v.attrs.class,
			'a.link': {
				$target: v.attrs.target,
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
					{ $: Components.Link, $href: 'https://www.github.com/mikesmullin/m-js', $target: '_blank', _: 'GitHub' },
				],
				'nav.toc': 
				/^\/guide/.test(Route.uri) ?
					{
						ul: [
							{
								li: {
									a: 'Getting Started',
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
					} :
					{
						ul: [
							{ li: {
								a: 'm',
								ul: [
									{ $: Components.Link, $href: '/api/m/root', _: '.root' },
									{ $: Components.Link, $href: '/api/m/redraw', _: '.redraw()' },
									{ $: Components.Link, $href: '/api/m/instance', _: '.instance()' },
								]
							}},
							{ li: {
								a: 'db',
								ul: [
									{ $: Components.Link, $href: '/api/db/state', _: '.state' },
									{ $: Components.Link, $href: '/api/db/saveState', _: '.saveState()' },
									{ $: Components.Link, $href: '/api/db/reloadState', _: '.reloadState()' },
									{ $: Components.Link, $href: '/api/db/defaults', _: '.defaults' },
									{ $: Components.Link, $href: '/api/db/applyDefaults', _: '.applyDefaults()' },
									{ $: Components.Link, $href: '/api/db/resetState', _: '.resetState()' },
									{ $: Components.Link, $href: '/api/db/actions', _: '.actions' },
									{ $: Components.Link, $href: '/api/db/history', _: '.history' },
									{ $: Components.Link, $href: '/api/db/saveHistory', _: '.saveHistory()' },
									{ $: Components.Link, $href: '/api/db/reloadHistory', _: '.reloadHistory()' },
									{ $: Components.Link, $href: '/api/db/replayHistory', _: '.replayHistory()' },
									{ $: Components.Link, $href: '/api/db/undoHistory', _: '.undoHistory()' },
									{ $: Components.Link, $href: '/api/db/resetHistory', _: '.resetHistory()' },
								]
							}},
							{ li: {
								a: 'Hot',
								ul: [
									{ $: Components.Link, $href: '/api/hot/reloader', _: '.reloader()' },
								]
							}},
							{ li: {
								a: 'Route',
								ul: [
									{ $: Components.Link, $href: '/api/route/init', _: '.init()' },
									{ $: Components.Link, $href: '/api/route/register', _: '.register()' },
									{ $: Components.Link, $href: '/api/route/redirect', _: '.redirect()' },
									{ $: Components.Link, $href: '/api/route/rewrite', _: '.rewrite()' },
									{ $: Components.Link, $href: '/api/route/onnavigate', _: '.onnavigate()' },
									{ $: Components.Link, $href: '/api/route/link', _: '.link()' },
									{ $: Components.Link, $href: '/api/route/uri', _: '.uri' },
									{ $: Components.Link, $href: '/api/route/formatTitle', _: '.formatTitle' },
									{ $: Components.Link, $href: '/api/route/title', _: '.title' },
									{ $: Components.Link, $href: '/api/route/titleOf', _: '.titleOf()' },
								]
							}},
							{ li: {
								a: 'Utils',
								ul: [
									{ $: Components.Link, $href: '/api/utils/request', _: '.request()' },
								]
							}},
						]
					}
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

doc('/api', 'API', `
# API

## Cheatsheet
`);

doc('/api/m/root', 'm.root() | API', `
# m.root()

## Description
			
Holds the root component later used by [m.redraw()](/api/m/redraw).

~~~js
m.root = { p: 'Hello world!' };
~~~
`);

doc('/api/m/redraw', 'm.redraw() | API', `
# m.redraw()

## Description

Applies shortest-path transforms for DOM to match state of Virtual DOM,
beginning at the component specified by [m.root](/api/m/root).

~~~js
m.redraw();
~~~
`);

doc('/api/m/instance', 'm.instance() | API', `
# m.instance(component)

## Description

Instantiates what would otherwise be a static component.

All components
are effectively static singletons until they are wrapped by this function.
In many cases such as pages or layouts you will never have more than a single
instance on screen, so static is fine. In still other cases, you may
want multiple buttons or list items on the screen but they are stateless,
so static is fine.

Of course there are definitely cases where you want each component to have
a separate state. Still, you should consider whether global or local storage
state would be better, because component instance state gets discarded
as soon as it is removed from the Virtual DOM tree. If you want the state
to survive a page refresh or be serialized in a permalink, consider storing
and referencing it outside of the component.

~~~js
// crappy example; will do better later
const Components = {};
Components.Button = {
	view: () => ({ button: v.attrs.label }) };

m.root = {
	$: m.instance(Components.Button),
	$label: 'What up?' };

m.render();
~~~
`);

doc('/api/db/state', 'db.state() | API', `
# db.state()

## Description

Controlled global state, optionally used by and shared between components.

Analogous in spirit to the
[root reducer](https://redux.js.org/recipes/structuring-reducers/splitting-reducer-logic)
from Redux; the biggest difference being an ordinary top-level
[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)
holding your application's entire scope is now conveniently exposed. Use it with the
[Reducer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce)
pattern, or manipulate it how you like.

Components should use ~db.state~ if they wish to:
1. Persist state beyond the Virtual DOM lifecycle, or;
2. Share state with other components in a publish-subscribe model.

*CAUTION*: Care must be taken to avoid namespace collisions when components share this global scope.

~~~js
import db from 'm-js/db.js';

Components.RememberedInput = {
	oncreate(v) {
		// restore value from global / local storage on first render.
		// we do it here so it happens only once,
		// rather than during subsequent renders,
		// to avoid interrupting the user's typing...
		v.dom.value = db.state.searchValue;
	},

	onkeyup(v) {
		// as user types, update in-memory global state
		db.state.searchValue = v.dom.value;
		// persist global state to browser local storage
		db.saveState();
	},

	view(v) {
		return { 'input[type=text]': {
			$onkeyup: Components.RememberedInput.onkeyup.bind(null,v),
		}};
	}
};
~~~
`);

doc('/api/db/saveState', 'db.saveState() | API', `
# db.saveState()

## Description

Serialize a snapshot of current in-memory [db.state](/api/db/state) to
[localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage) for persistence.

~~~js
db.state.hello = 'world';
db.saveState(); // above data is now retained by browser between sessions
~~~
`);

doc('/api/db/reloadState', 'db.reloadState() | API', `
# db.reloadState()

## Description

Fetch and deserialize a snapshot of prior [db.state](/api/db/state) into memory from
[localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage).

~~~js
db.reloadState(); // below data was created during a prior browser session
console.log(db.state.hello); // 'world'
~~~
`);

doc('/api/db/defaults', 'db.defaults | API', `
# db.defaults

## Description

The object merged into [db.state](/api/db/state) by
[db.applyDefaults()](/api/db/applyDefaults).

Expects you to invoke if/when you want to use, typically from
[document.onready](https://developer.mozilla.org/en-US/docs/Web/API/Document/readyState).

~~~js
Utils.onReady(()=> {
	db.defaults.hello = 'Waldo';
	db.applyDefaults();
	console.log('Waldo' === db.state.hello); // true
	// remains true until, some time later...
	db.state.hello = 'world'; // set state, or
	db.reloadState(); // load from persistent storage
	// assuming nothing changes it again, some time later...
	console.log('world' === db.state.hello); // true
});
~~~
`);

doc('/api/db/applyDefaults', 'db.applyDefaults() | API', `
# db.applyDefaults()

## Description

See [db.defaults](/api/db/defaults) for details and example usage.
`);

doc('/api/db/resetState', 'db.resetState() | API', `
# db.resetState()

## Description

The object merged into [db.state](/api/db/state) by
[db.applyDefaults()](/api/db/applyDefaults).

Expects you to invoke if/when you want to use, typically from
[document.onready](https://developer.mozilla.org/en-US/docs/Web/API/Document/readyState).

~~~js
Utils.onReady(()=> {
	db.defaults.hello = 'Waldo';
	db.applyDefaults();
	console.log('Waldo' === db.state.hello); // true
	// remains true until, some time later...
	db.state.hello = 'world'; // set state, or
	db.reloadState(); // load from persistent storage
	// assuming nothing changes it again, some time later...
	console.log('world' === db.state.hello); // true
});
~~~
`);

doc('/api/db/actions', 'db.actions | API', `
# db.actions

## Description

A [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
for the collection of named ~Action~ functions, which you define,
and which will log to [db.history](/api/db/history) whenever subsequently invoked.

Use globally or within a component when:
1. You want to capture, stream, or serialize user action events, or;
2. You want to deserialize and replay user actions

Use cases include:
- User Behavior Analytics
- Time-Travel Debugging
- Demo Recording and Playback

*CAUTION*: Care must be taken to avoid namespace collisions when components share this global scope.

~~~js
// on startup...
const Components = {};
Components.BeanInput = {
	oninit(v) {
		v.state.beanCount = 0;
	},

	oncreate(v) {
		v.state.input = v.dom.querySelector('input');
	},

	// TODO: the only tricky part to be resolved
	//   is re-appropriating valid vnode state after a possible
	//   serialize/deserialize or browser refresh event

	more: db.actions.MOAR_BEANS = qty => {
		console.log(\`The boss wants \${qty} more legumes.\`);
		v.state.beanCount += qty;
	},

	view: v => ({
		h1: \`You haz \${v.state.beanCount} beans.\`,
		'input[type=text]': { $placeholder: 'Qty' },
		button: {
			$onclick: e => Components.BeanInput.more(v.state.input.value),
			_: 'MOAR!'
		}
	}),
};


// sometime later...
db.actions.MOAR_BEANS(10);
console.log(db.history); // [ ['MOAR_BEANS', 10] ]

// sometime later...
db.actions.MOAR_BEANS(100);
console.log(db.history); // [ ['MOAR_BEANS', 10], ['MOAR_BEANS', 100] ]

// etc.
~~~
`);

doc('/api/db/history', 'db.history | API', `
# db.history

## Description

A serializable list of user ~Action~ events.

~~~js
console.log(db.history); // e.g.
// [[ 'WEST', 3 ], [ 'SOUTH', 2 ], /*...*/ [ 'DIG', 10 ]]
~~~
`);

doc('/api/db/saveHistory', 'db.saveHistory() | API', `
# db.saveHistory()

## Description

Serialize a snapshot of current in-memory [db.history](/api/db/history) to
[localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage) for persistence.

~~~js
db.saveHistory();
~~~
`);

doc('/api/db/reloadHistory', 'db.reloadHistory() | API', `
# db.reloadHistory()

## Description

Fetch and deserialize a snapshot of prior [db.history](/api/db/history) into memory from
[localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage).

~~~js
db.reloadHistory();
~~~
`);

doc('/api/db/replayHistory', 'db.replayHistory() | API', `
# db.replayHistory()

## Description

Iterate [db.history](/api/db/history), invoking every ~Action~ in the list.

~~~js
db.replayHistory();
~~~
`);

doc('/api/db/undoHistory', 'db.undoHistory() | API', `
# db.undoHistory()

## Description

Remove the last ~Action~ event from [db.history](/api/db/history),
then [db.resetState()](/api/db/resetState) and [db.replayHistory()](/api/db/replayHistory).

This only has the effect of undoing the last ~Action~ when:
1. Your application is written
[deterministically](https://en.wikipedia.org/wiki/Deterministic_algorithm), and;
2. The [db.history](/api/db/history) queue contains only
[re-entrant](https://en.wikipedia.org/wiki/Reentrancy_(computing))
~Action~ events.

For example, an ~Action~ performing an HTTP POST may not be something you
can safely repeat because it may be represent an irrevocable change,
and therefore it is not a re-entrant function.

Useful for events such as a series of client-side UI navigational steps,
when they are not already serialized into the
[document.location](https://developer.mozilla.org/en-US/docs/Web/API/Document/location).

~~~js
console.log(db.history) // [ [ 'DRINK' ], [ 'PEE' ] ]
console.log(db.state.bladder); // 'empty'
db.undoHistory();
console.log(db.history) // [ [ 'DRINK' ] ]
console.log(db.state.bladder); // 'full'
~~~
`);

doc('/api/db/resetHistory', 'db.resetHistory() | API', `
# db.resetHistory()

## Description

Empty all ~Action~ events from the [db.history](/api/db/history) list.

Same as reloading the page without calling [db.reloadHistory()](/api/db/reloadHistory).

~~~js
console.log(db.history) // [ [ 'DO_SOMETHING' ] ]
db.resetHistory();
console.log(db.history) // []
~~~
`);

doc('/api/hot/reloader', 'Hot.reloader() | API', `
# Hot.reloader(app)

## Description

Hot reloading exchanges, adds, or removes modules while an application is running, without a full reload.

A typical web developer's iteration cycle is:
1. **Edit** code and save.
2. Focus the browser and click **refresh**.
3. **Wait** for the page to finish loading.
4. **Get back** into the state where you were before the refresh.
5. Finally, **test** the change that was just made on the first step above.

This loop happens thousands of times a day. You don't even need to add up the time
spent to realize why eliminating some of those steps could **save valuable time,
money, and mental energy.**

Hot reloading helps in a few *simple*, but *hugely impactful*, ways:

- *No click necessary*—saving code triggers it. (~Ctl+S~ or ~⌘+S~)
- Application *state is retained*. (e.g., deeply nested dialogs and form input survive refresh)
- *Tweak CSS in real-time*. It's even faster than using browser devtools.
- *Only changed assets reload*—you will not even see a flash of white!

Analogous to [Hot Module Replacement (HMR)](https://webpack.js.org/concepts/hot-module-replacement/) by Webpack.

## Example Instrumentation

~~~js
// client-side
const App = {
	init() {
		// ...
	}	
};
import HotClient from 'm-js/hot-client.js';
Utils.onReady(HotClient.reloader(App));
~~~

The ~app~ argument should be an ~Object~ containing an ~init()~ method which is re-entrant
and will successfully bootstrap or re-bootstrap your application any time
its ~.js~ file is loaded or re-loaded.

Returns a ~Function~ which will merge the new ~app~ methods over the existing
running ~app~ instance, and reset [db.state](/api/db/state).

~~~js
// server-side

const app = require('express')();
const server = require('m-js/hot-server')({
	app: app,
	cwd: __dirname,
	watch: '**/*.{js,styl}',
});

server.listen(3000, () =>
	console.log('Listening...'));
~~~

File [hot-server.js](https://github.com/mikesmullin/m-js/blob/master/src/hot-server.js)
is a simple quick-start template to get you up and running
long enough to trial the feature, decide if its right for you, and determine 
how it works.

While most hot loaders don't recommend production deployments, we anticipate
if you need a more robust implementation you can simply copy and improve the
example provided, as needed.
`);

// doc('/api/db/state', 'db.state() | API', `
// # db.state()

// ## Description

// This is a template

// ~~~js
// hello world;
// ~~~
// `);




const App = {
	init() {
		Route.formatTitle = s => `${s} | M.js Documentation`;
		Route.rewrite('/', '/guide');
		Route.register('/guide', 'Guide', Pages.Guide);
		Route.init();
	}	
};
export default App;
import HotClient from '../src/hot-client.js';
Utils.onReady(HotClient.reloader(App));