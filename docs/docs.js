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
	if (['CAUTION','WARNING','NOTE','TODO'].includes(Utils.get(null, vnode, 'p', 0, 'strong'))) {
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
			$class: (v.attrs.relative ?
				-1 !== Route.uri.search(v.attrs.href) :
				Route.uri === v.attrs.href) ?
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
					'a.logo': { $href: '/', $onclick: Route.link, _: 'M.js' },
					'.version': '1.0.0',
				},
				'ul.link-list': [
					{ $: Components.Link, $relative: true, $href: '/guide', _: 'Guide' },
					{ $: Components.Link, $relative: true, $href: '/api', _: 'API' },
					{ $: Components.Link, $relative: true, $href: 'https://www.github.com/mikesmullin/m-js', $target: '_blank', _: 'GitHub' },
				],
				'nav.toc': 
				/^\/guide/.test(Route.uri) ?
					{
						ul: [
							{ li: {
								a: 'Quick Start',
								ul: [
									{ $: Components.Link, $href: '/guide/welcome/featureset', _: 'Featureset' },
									// { $: Components.Link, $href: '/guide/welcome/examples', _: 'Examples' },
									{ $: Components.Link, $href: '/guide/welcome/releases', _: 'Releases' },
									{ $: Components.Link, $href: '/guide/welcome/support', _: 'Support' },
									{ $: Components.Link, $href: '/guide/welcome/alternatives', _: 'Alternatives' },
								]
							}},
							{ li: {
								a: 'VNode',
								ul: [
									{ $: Components.Link, $href: '/guide/vnode/jxml/introduction', _: 'Why JXML?' },
									{ $: Components.Link, $href: '/guide/vnode/tags', _: 'Tags' },
									{ $: Components.Link, $href: '/guide/vnode/attributes', _: 'Attributes' },
									{ $: Components.Link, $href: '/guide/vnode/hierarchy', _: 'Hierarchy' },
									{ $: Components.Link, $href: '/guide/vnode/security', _: 'Security' },
								]
							}},
							{ li: {
								a: 'Virtual DOM',
								ul: [
									{ $: Components.Link, $href: '/guide/virtual-dom/introduction', _: 'What is it?' },
									// { $: Components.Link, $href: '/guide/virtual-dom/rendering', _: 'Rendering' },
									{ $: Components.Link, $href: '/guide/virtual-dom/keys', _: 'Keys' },
								]
							}},
							{ li: {
								a: 'Components',
								ul: [
									{ $: Components.Link, $href: '/guide/components/introduction', _: 'What are they?' },
									{ $: Components.Link, $href: '/guide/components/lifecycle', _: 'Lifecycle' },
									{ $: Components.Link, $href: '/guide/components/opinions', _: 'Opinions' },
								]
							}},
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
									{ $: Components.Link, $href: '/api/route/titleFormat', _: '.titleFormat' },
									{ $: Components.Link, $href: '/api/route/rewrite', _: '.rewrite()' },
									{ $: Components.Link, $href: '/api/route/register', _: '.register()' },
									{ $: Components.Link, $href: '/api/route/init', _: '.init()' },
									{ $: Components.Link, $href: '/api/route/link', _: '.link' },
									{ $: Components.Link, $href: '/api/route/redirect', _: '.redirect()' },
									{ $: Components.Link, $href: '/api/route/uri', _: '.uri' },
									{ $: Components.Link, $href: '/api/route/params', _: '.params' },
									{ $: Components.Link, $href: '/api/route/getTitleByURI', _: '.getTitleByURI()' },
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
			'main.right': [
				...v.children,

				{ footer: {
					p: 'License MIT © Mike Smullin',
				}},
			],
		};
	}
};

doc('/guide/welcome/examples', 'Examples', `
# Examples

*TODO*: A small todolist app will appear here. Will use CodePen.io.

~~~js
"hello world";
~~~
`);

doc('/guide/welcome/releases', 'Releases', `
# Releases

Browse the Releases section of the Github repository.

[https://github.com/mikesmullin/m-js/releases](https://github.com/mikesmullin/m-js/releases)
`);

doc('/guide/welcome/support', 'Support', `
# Support

Open a new Issue on Github.

[https://github.com/mikesmullin/m-js/issues](https://github.com/mikesmullin/m-js/issues)
`);

doc('/guide/welcome/alternatives', 'Alternatives', `
# Alternatives

Hyperlinks and citations have been littered throughout this documentation to
give credit to the frameworks and libraries which have inspired this effort.

In particular:

- [Mithril](https://mithril.js.org/)
- [Redux](https://redux.js.org/)
- [Webpack](https://webpack.js.org/)
`);

doc('/guide/vnode/jxml/introduction', 'JXML', `
# JXML

In this framework, JXML is the data structure used to describe a ~VNode~,
and the return type of all
[component.view()](/guide/components/introduction) methods.

## Why JXML?

Designed to be:

- easier to read and write than alternatives 
	a) [React](https://reactjs.org/) [JSX](https://reactjs.org/docs/introducing-jsx.html), and
	b) [Mithril.js](https://mithril.js.org/) [m()](https://mithril.js.org/hyperscript.html)
- not dependent on any extra IDE or transpiler/preprocessor support. ie. [Babel.js](https://babeljs.io/)
- debuggable; can set a breakpoint on every part of the template in your code.
- smallest footprint in-memory and on-disk.
- the fastest runtime format.

## What is JXML?
A minimalist lossless JSON representation of XML. 

Forked from the old and deprecated
[Mozilla](https://developer.mozilla.org/en-US/docs/Archive/JXON)
[JXON](https://github.com/tyrasd/jxon)
and common [xml2json](https://www.npmjs.com/package/xml2json) output.

Main differences include:

- Support for
	[tags](/guide/vnode/tags) that include CSS classes, ID, and other
	[attributes](/guide/vnode/attributes).
- Support for [components](/guide/components/introduction) using the dollar ~$~
	[attribute](/guide/vnode/attributes).
- Support for many variations of [nested children](/guide/vnode/hierarchy).

*NOTE*: The original JXON child hierachy is not supported. Only the above syntax.

## Background

For a component to work the same in different places, it needs a way to be described in a neutral form
that is eventually compatible with both targets. In the case of a web browser, the target is the Document
Object Model (or DOM) which, for the purposes of backward compatibility, tends to yield very low performance.
Today, our users are conditioned to expect low latency, hyper responsive animations, transitions, and
even the use of physics with spring dynamics, collision, and layering effects.

JXML and the Virtual DOM wed perfectly to help us meet modern user demands at high FPS.

Continue reading the next chapter to learn more about our version of JXML.
`);

doc('/guide/vnode/tags', 'Tags', `
# Tags

The tag names can be formatted like CSS selectors, as a convenience.

You can include:

- One HTML tag name e.g., ~div~
- Multiple CSS classes e.g., ~.one.two.three~
- Multiple id attributes (semantically, only one is meaningful) e.g., ~#id~
- Multiple other attributes e.g., ~[key=value][data-toggle="smurfy boi"]~

This helps distinguish children with similar tag names in an ~Object~.

It also helps reduce boilerplate throughout intricate markup structure.

Of course, you can always set them the verbose way:

~~~js
{ div: {
	$class: 'one two three',
	$id: 'id',
	$key: 'value',
	'$data-toggle': 'smurfy boi'
}}
~~~
`);

doc('/guide/vnode/attributes', 'Attributes', `
# Attributes

Any key name that is prefixed by a dollar ~$~ symbol will be set as an
attribute on the final value.

## Magic Values

If an existing DOM element already has an attribute key by the same name,
defining a value of:

- ~null~ will cause the existing value to be preserved.
- ~undefined~ will cause it to be removed.
- any other value will replace the existing value. 

## Reserved Attributes

- The [$key](/guide/virtual-dom/keys) attribute is reserved for internal use
when used with the [Virtual DOM](/guide/virtual-dom/introduction).
- The dollar attribute (~$~) is reserved for referencing a
[component](/guide/components/introduction).
- The underscore attribute (~_~) is reserved for holding a
[collection of children](/guide/vnode/hierarchy).

## Example

~~~js
{ 'div#patient-1023.patient[prognosis=terminal]': {
		label: "Freddie's Balance Due",
		{ $: Components.TextInput, $name: 'cash', $defaultValue: 1000000.00 }
}}
~~~
`);

doc('/guide/vnode/hierarchy', 'Hierarchy', `
# Hierarchy

~VNode~ children exist within collections. Collections can be:

- an ~Object~, in which case each key is a child.

*CAUTION*: Defining children within an ~Object~ means each child tag must be
unique. Otherwise the latter definition will override all previous children with
the same tag name.

- an ~Array~, in which case each list item is a child.

- a single ~String~ or ~Number~ literal, in which case there is only one child
in the collection, and it is a ~Text~ node.

## Examples

~~~js
[
	{ ul: [
		{ li: 'one' },
		{ li: { _: 'two' } },
		{ li: { _: [ 'three' ] }}
	]},
	{ ol: {
		'li.four': 'four',
		'li.five': { _: 'five' },
		'li.six': { _: [ 'six' ] } },
	}},
]
~~~

`);

doc('/guide/vnode/security', 'Security', `
# Security Threat Models

## HTML Entities & Special Characters

It is not possible to provide entities like ~&lt;~, 
~&#169;~, or ~&#x000AB;~ even if you wanted to. Characters like ~<~, ~>~, ~&~,
etc. are escaped by being inside of a ~String~ while in JSON format.

If you want to provide a symbol do so using a UTF-8 or UTF-16 encoded source
document, and then you can just paste the symbol directly into the text, rather
expecting the library to parse and translate an ASCII-encoded entity sequence.

## Cross-site Scripting (XSS) Injection

Since a ~VNode~ is encoded using JSON format, and no string-to-HTML conversion 
logic is present anywhere in the runtime, we enjoy an initial defense
against both stored and reflected types of injection attacks, because we skip
the HTML parsing step altogether.

Only ~String~ data is injected into the DOM by [m.redraw()](/api/m/redraw)
either as an attribute or a ~#Text~ node ~.data~ value, which is treated as
displayable text.

However the DOM-based attacks are still a concern. Therefore, when attaching 
user input to a ~VNode~, always:

- cast it to a ~String~ first.

*WARNING*: You must manually validate against script injection when
user input is a ~String~ but you are passing it into an HTML attribute that
supports Javascript code subcontexts such as ~$href~ or any of the event 
handlers like ~$onsubmit~ or ~$onclick~. Or when passing it through a function
like
[JSON.parse](https://medium.com/intrinsic/javascript-prototype-poisoning-vulnerabilities-in-the-wild-7bc15347c96)
or [new RegExp()](https://stackoverflow.com/questions/17116675/why-does-this-regex-make-chrome-hang)
or [eval()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval).

- avoid using the value in place of ~VNode~ attributes or tags.

*WARNING*: User input that is NOT a ~String~ or ~Number~ should not be appended
to a ~VNode~. Otherwise attackers will pass a JXML ~Object~ to successfully
inject without limitation.

Recommended reading:

- [OWASP XSS](https://www.owasp.org/index.php/Cross-site_Scripting_(XSS))
- [OWASP DOM-based XSS Prevention Cheat Sheet](https://www.owasp.org/index.php/DOM_based_XSS_Prevention_Cheat_Sheet)
`);

doc('/guide/virtual-dom/introduction', 'Virtual DOM', `
# The Virtual DOM

## What is it?
			
The Virtual DOM holds a minimalist duplicate of the tag hierarchy, attributes, inner text, and state of all components entirely in
Javascript memory at runtime. This is the authoritative copy; when changes are made to the tree, they happen
virtually first, and are buffered until it is time to render the next frame, where a single-pass render is performed,
which then finally applies the shortest-path transformations to the DOM tree.

*NOTE*: The DOM is a form of
[directed acyclic graph](https://en.wikipedia.org/wiki/Directed_acyclic_graph),
and therefore
[Graph Theory](https://en.wikipedia.org/wiki/Graph_theory)
can be
[applied](https://www.youtube.com/watch?v=Ce3RNfRbdZ0)
to further reduce CPU cycles per frame.

## Background

Frameworks like
[React](https://reactjs.org/)
[claim](https://reactjs.org/docs/reconciliation.html)
they are performing
[advanced hueristics](https://grfia.dlsi.ua.es/ml/algorithms/references/editsurvey_bille.pdf)
on top of this to reduce CPU cycles. But those are magic-laden unicorn farts designed
to keep you dependent.

The two most complex transformations that happen in DOM trees are
a) moving a child between siblings, and b) moving a child between parents. In practice, these happen infrequently, such as the
drag-and-drop-to-reorder-list, and the rarer drag-from-list-to-other-list. When such cases occur, benchmarks have shown it to be both faster and easier to simply write your code
for this case explicitly, by changing the child's parent node on a successful drag operation, akin to a linked list reordering operation,
rather than challenging the VDOM to figure it out in constant time on every frame with an N-deep tree.
This is why component key properties are only useful among siblings.
`);

doc('/guide/virtual-dom/rendering', 'Rendering', `
# Rendering

Happens using [m.redraw()](/api/m/redraw).
`);

doc('/guide/virtual-dom/keys', 'Keys', `
# Keys

Defining a ~$key~ [attribute](/guide/vnode/attributes) on a ~VNode~ enables the 
[Virtual DOM](/guide/virtual-dom/introduction) to determine whether the target
DOM node still exists, even if it has been reordered among its siblings, or
modified by something external. It does this by matching the value on the DOM
node to the value on the ~VNode~. The value is expected to be a ~String~.

This attribute is stored internally using ~Utils.data()~ which holds a 
[WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)
pure-Javascript in-memory reference. As long as the DOM node is not deleted,
its ~Object~ instance will forever tie it to the ~$key~ attribute, if one was
defined.

If no ~$key~ is not defined, the [m.redraw()](/api/m/redraw) method may choose
to delete the prior instance of your element just because it is easier than 
finding it again after it has moved or been significantly altered.
That can be a problem if external scripts such as jQuery or Bootstrap have
attached state to the DOM element, since it will be lost.

*WARNING*: Keys are only used among sibling nodes. If your DOM node needs to
survive moving outside of its parent, you should plan to re-parent it manually.
`);

doc('/guide/components/introduction', 'Components', `
# Components

## What is a web component?

An encapsulated, reusable, and composable element which—in aggregate—make up the user interface on a web application.
They are the modular equivalent of bricks which you can use to build your website's look and feel.
Examples of web components include buttons, links, forms, menus, loading spinners, etc.
More than just HTML, they are stateful, defined primarily in Javascript, and may contain data which persists beyond the usual DOM lifecycle.

Components are typically bundled so that all dependencies (~.css~, images, ~.js~, ~.html~,
and any other assets) are in a single file or folder for easy import and removal from a project.
Sometimes exchange markets are made to redistribute and sell above-average components.

## What is a component framework?

The central idea is reusability across devices and platforms—desktop and mobile—
via a transparent browser, or a native analog, bundled and shipped with your distribution.
Your application can now provide the same experience, no matter how users prefer to interface with it,
but you have to follow a set of guidelines, and sometimes install dependencies—both of which are the framework.

*WARNING*: Our mobile support is limited to the mobile browser only. We don't compile native.
You could still bundle and ship with [Electron](https://electronjs.org/) or
[Apache Cordova](https://cordova.apache.org/) if you need, but you'd be on your own.
`);

doc('/guide/components/lifecycle', 'Lifecycle', `
# Lifecycle

All components have optional events callbacks you can define.

## Component Methods

If defined, the following methods will be called:

- ~oninit(v)~: on insert, append, or replace (instantiation), before dom element exists
- ~view(v)~: on every render (the only required function)
- ~oncreate(v)~: just after ~init()~ is complete; dom element now exists
- ~onbeforeupdate(v)~: before diff happens on a node. return false to avoid checking (like manual ~$dirty: false~)
- ~onupdate(v)~: for pre-existing dom element, post-diff on each [m.render()](/api/m/render) cycle
- ~onbeforeremove(v)~: before removeChild is invoked
- ~onremove(v)~: after removeChild is invoked

Where

- The ~v~ parameter is an ~Object~ containing the following properties:

- ~dom~ is a reference to the DOM element.
- ~attrs~ is an ~Object~ holding any
[attributes](/guide/vnode/attributes)
passed to the 
[component](/guide/components/introduction).  
These do not have the dollar ~$~
prefix.
- ~children~ is an ~Array~ of child ~VNode~ objects.
- ~state~ is an ~Object~ but only when instantiated using
  [m.instance()](/api/m/instance).
`);

doc('/guide/components/opinions', 'Opinions', `
# Opinions

## No heavy compute in the view() method

Its [bad practice](/api/m/redraw).

## Stateless is best

Its rare that a component will hold state that you wouldn't want to store
beyond its [lifecycle](/guide/components/lifecycle).

Most components benefit from having no state, 
[static state](/api/m/instance)
or [global state](/api/db/state).

## Delaying create and removal for animation

Its better not to block the redraw loop. Just delete your ~VNode~ once its time.



`);

doc('/api/m/root', 'm.root()', `
# m.root()

## Description
			
Holds the root component later used by [m.redraw()](/api/m/redraw).

You will only have to set this if you choose handle routing manually instead
of using [Route.init()](/api/route/init).

## Example

~~~js
m.root = { p: 'Hello world!' };
~~~
`);

doc('/guide/welcome/featureset', 'Featureset', `
# Featureset

### “M.js is a minimalist, modernist, UI component framework for the web.”

- Web component framework
- Small. 6.3KB minified (2.7KB gzipped)
- High frame rate (fast render)
- Written in ES6 with ECMAScript Modules
- Redux-like state and history features
`);

doc('/api/m/root', 'm.root()', `
# m.root()

## Description
			
Holds the root component later used by [m.redraw()](/api/m/redraw).

You will only have to set this if you choose handle routing manually instead
of using [Route.init()](/api/route/init).

## Example

~~~js
m.root = { p: 'Hello world!' };
~~~
`);

doc('/api/m/redraw', 'm.redraw()', `
# m.redraw()

## Description

Applies shortest-path transforms for DOM to match state of Virtual DOM,
beginning at the component specified by [m.root](/api/m/root).

In a normal application, this method will be invoked a lot.

*NOTE*: The library will never call this function; we expect you to do it. We
believe this is less confusing for beginners, as it promotes both efficiency
and control.

If you wanted, you could call it a lot—even from inside a
[requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
loop (ie. for WebGL animation) because by itself, it is a highly scalable function.
Still, you should be cognizant of the factors that affect its performance, which include:
- *Number of nodes present in both the DOM and the Virtual DOM.*  
	If you are trying to render 1 million nodes, you'll need a good strategy to
	ensure you only need to apply a handful of changes per frame. Still some browsers
	and devices will choke on a large number of nodes even if they are not changing
	per frame.
- *Whether any ~Component.view()~ is performing expensive computation.*  
	__This is never true in the correctly written application.__
	It is considered bad practice to compute from the ~.view()~ method. That 
	should instead be happening in one of the other component lifecycle methods,
	and the ~.view(v)~ function itself should just be rendering pre-computed
	~v.state~ and ~v.attrs~.

## Example

~~~js
m.redraw();
~~~
`);

doc('/api/m/instance', 'm.instance()', `
# m.instance(component)

Where

- The ~component~ parameter is an ~Object~ with a defined ~view(v)~ method which
will return a ~VNode~ when invoked by [m.redraw()](/api/m/redraw).

## Description

Instantiates what would otherwise be a static [stateless] component.

*CAUTION*: Instantiating a component is optional, and in most cases you won't need to.

All components
are effectively static singletons until they are wrapped by this function.
In many cases such as pages or layouts you will never have more than a single
instance on screen, so static is fine. In still other cases, you may
want multiple buttons or list items on the screen but they are stateless,
so static is fine.

Of course there are definitely cases where you want each component to have
a separate instance state. Still, you should consider whether global or
[localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage)
state would be better, because component instance state gets discarded
as soon as it is removed from the Virtual DOM tree. If you want the state
to survive a page refresh or be serialized in a permalink, consider storing
and referencing it outside of the component.

## Example

~~~js
// crappy example; there are better scenarios
// but they require more detail and explanation.
const Components = {};
Components.Button = {
	view: () => ({ button: v.attrs.label }) };

m.root = {
	$: m.instance(Components.Button),
	$label: 'What up?' };

m.render();
~~~
`);

doc('/api/db/state', 'db.state()', `
# db.state()

Returns an ~Object~ holding values of any type.

## Description

Controlled global state, optionally used by and shared between components.

Analogous in spirit to the
[root reducer](https://redux.js.org/recipes/structuring-reducers/splitting-reducer-logic)
from Redux; the biggest difference being an ordinary top-level
[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)
holding your application's entire scope is now conveniently exposed. Use it with the
[Reducer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce)
pattern, or manipulate it how you like.

*NOTE*: Use of the db module is entirely optional. You can download a release
without it.

Components may choose to use ~db.state~ if they wish to:
1. Persist state beyond the Virtual DOM lifecycle, or;
2. Share state with other components in a publish-subscribe model.

*CAUTION*: Care must be taken to avoid namespace collisions when components share this global scope.

## Example

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

doc('/api/db/saveState', 'db.saveState()', `
# db.saveState()

## Description

Serialize a snapshot of current in-memory [db.state](/api/db/state) to
[localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage) for persistence.

## Example

~~~js
db.state.hello = 'world';
db.saveState(); // above data is now retained by browser between sessions
~~~
`);

doc('/api/db/reloadState', 'db.reloadState()', `
# db.reloadState()

## Description

Fetch and deserialize a snapshot of prior [db.state](/api/db/state) into memory from
[localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage).

## Example

~~~js
db.reloadState(); // below data was created during a prior browser session
console.log(db.state.hello); // 'world'
~~~
`);

doc('/api/db/defaults', 'db.defaults', `
# db.defaults

Returns an ~Object~ holding default values of any type.

## Description

The object merged into [db.state](/api/db/state) by
[db.applyDefaults()](/api/db/applyDefaults).

Expects you to invoke if/when you want to use, typically from
[document.onready](https://developer.mozilla.org/en-US/docs/Web/API/Document/readyState).

## Example

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

doc('/api/db/applyDefaults', 'db.applyDefaults()', `
# db.applyDefaults()

## Description

See [db.defaults](/api/db/defaults) for details and example usage.
`);

doc('/api/db/resetState', 'db.resetState()', `
# db.resetState()

## Description

Removes all keys defined in [db.state](/api/db/state).

## Example

~~~js
db.state.a = 1;
console.log(db.state); // { a: 1 }
db.resetState();
console.log(db.state); // {}
~~~
`);

doc('/api/db/actions', 'db.actions', `
# db.actions

Returns a
[Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
for named ~Action~ functions.

## Description

A collection of named ~Action~ functions, which you define,
and which will log to [db.history](/api/db/history) whenever subsequently invoked.

Use globally or within a component when:
1. You want to capture, stream, or serialize user action events, or;
2. You want to deserialize and replay user actions

Use cases include:
- User Behavior Analytics
- Time-Travel Debugging
- Demo Recording and Playback

*CAUTION*: Care must be taken to avoid namespace collisions when components share this global scope.

## Example

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

doc('/api/db/history', 'db.history', `
# db.history

Returns a serializable ~Array~ of ~Action~ events.

## Description

An in-memory store holding a list of events.

## Example

~~~js
console.log(db.history); // e.g.
// [[ 'WEST', 3 ], [ 'SOUTH', 2 ], /*...*/ [ 'DIG', 10 ]]
~~~
`);

doc('/api/db/saveHistory', 'db.saveHistory()', `
# db.saveHistory()

## Description

Serialize a snapshot of current in-memory [db.history](/api/db/history) to
[localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage) for persistence.

## Example

~~~js
db.saveHistory();
~~~
`);

doc('/api/db/reloadHistory', 'db.reloadHistory()', `
# db.reloadHistory()

## Description

Fetch and deserialize a snapshot of prior [db.history](/api/db/history) into memory from
[localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Storage/LocalStorage).

## Example

~~~js
db.reloadHistory();
~~~
`);

doc('/api/db/replayHistory', 'db.replayHistory()', `
# db.replayHistory()

## Description

Iterate [db.history](/api/db/history), invoking every ~Action~ in the list.

## Example

~~~js
db.replayHistory();
~~~
`);

doc('/api/db/undoHistory', 'db.undoHistory()', `
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

## Example

~~~js
console.log(db.history) // [ [ 'DRINK' ], [ 'PEE' ] ]
console.log(db.state.bladder); // 'empty'
db.undoHistory();
console.log(db.history) // [ [ 'DRINK' ] ]
console.log(db.state.bladder); // 'full'
~~~
`);

doc('/api/db/resetHistory', 'db.resetHistory()', `
# db.resetHistory()

## Description

Empty all ~Action~ events from the [db.history](/api/db/history) list.

Same as reloading the page without calling [db.reloadHistory()](/api/db/reloadHistory).

## Example

~~~js
console.log(db.history) // [ [ 'DO_SOMETHING' ] ]
db.resetHistory();
console.log(db.history) // []
~~~
`);

doc('/api/hot/reloader', 'Hot.reloader()', `
# Hot.reloader(app)

Where

- The ~app~ parameter is an ~Object~ holding an ~init()~ method, which is re-entrant
and will successfully bootstrap or re-bootstrap your application any time
its ~.js~ file is loaded or re-loaded.

Returns a ~Function~ which will merge the new ~app~ methods over the existing
running ~app~ instance, and reset [db.state](/api/db/state).

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

*NOTE*: Use of the hot module is entirely optional. You can download a release
without it.

## Example Instrumentation

~~~js
// client-side
const App = {
	init() {
		App.id = Utils.uid();
		console.debug(\`Initializing App \${App.id}\`);
		// ...
	}	
};
import HotClient from 'm-js/hot-client.js';
Utils.onReady(HotClient.reloader(App));
~~~

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

doc('/api/route/titleFormat', 'Route.titleFormat', `
# Route.titleFormat

Returns a ~Function~ of signature ~(uri:string, title:string) => title:string~
which uses its input to inform what the current page's title should be.

Where

- The ~uri~ parameter is the result of [Route.uri](/api/route/uri).

- The ~title~ parameter is the ~String~ passed with the component when
[Route.register()](/api/route/register) was called.

## Description

Determines what the current page title should be.

The default value is an identity function ~(_,title)=>title~ which simply sets the title
to exactly what was given when [Route.register()](/api/route/register) was called.

If you want to change how title strings are formatted, you are expected to
overwrite this function at runtime.

## Example

~~~js
Route.titleFormat = (uri,s) => s + (
	'/api/' === uri.substr(0,5) ? ' | API' :
	'/guide/' === uri.substr(0,7) ? ' | Guide' :
	'') + ' | M.js Documentation';
~~~
`);

doc('/api/route/rewrite', 'Route.rewrite()', `
# Route.rewrite(from,to)

Where

- The ~from~ parameter is a ~String~ that should match the expected result of
[Route.uri](/api/route/uri).

- The ~to~ parameter is a ~String~ that will be passed to
[Route.redirect()](/api/route/redirect).

## Description

Registers a route that will trigger an automatic
[Route.redirect()](/api/route/redirect) if the ~from~ URI is ever visited.

## Example

~~~js
Route.rewrite('/', '/guide');
Route.register('/guide', 'Guide', Pages.Guide);
// ...
Route.init();
~~~
`);

doc('/api/route/register', 'Route.register()', `
# Route.register(uri, title, component)

Where

- The ~uri~ parameter is a 
[RegExp](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp)
~String~ pattern, implicitly enclosed within ~^~ and ~$~.
You can include capturing groups if you wish, and any values captured will be 
available from [Route.params](/api/route/params) for your component to interact with.

- The ~title~ parameter is a ~String~ which will be used by
[Route.titleFormat()](/api/route/titleFormat)
to compose the final
[document.title](https://developer.mozilla.org/en-US/docs/Web/API/Document/title).

- The ~component~ parameter is an ~Object~ with a defined ~view(v)~ method which
will return a ~VNode~ when invoked by [m.redraw()](/api/m/redraw).

## Description

Register a given ~component~ with the router.

When
[document.location](https://developer.mozilla.org/en-US/docs/Web/API/Document/location)
changes, the 
[window.onhashchange](https://developer.mozilla.org/en-US/docs/Web/Events/hashchange)
event is fired. The router is bound and listening for this event. When fired,
router logic finds the first registered component whose ~uri~ pattern matches
the destination [Route.uri](/api/route/uri). If a match is found, router will
modify [m.root](/api/m/root) to point at the pattern's associated ~component~.

It will also set the
[document.title](https://developer.mozilla.org/en-US/docs/Web/API/Document/title)
to the result of
[Route.titleFormat](/api/route/titleFormat)( [Route.uri](/api/route/uri) , ~title~ ).

## Example

~~~js
const Pages = {};
Pages.Api = {
	view(v) {
		return { p: { 'Hello world!' }};
	},
};
Route.register('/api', 'API', Pages.Api);
Route.init();
~~~

*NOTE*: Use of the Route module is entirely optional. You can download a release
without it.

Should you choose to use it, here are its few opinionated restrictions:

- You can register any number of routes.
- You are expected to define at least one route.
- Only one route can match, so the earliest registered route wins.
- If you register two components under the same ~uri~ pattern, the latter will
  override the former.

When no routes are defined, or no routes are matched, a default route is
provided under the URI ~404~ which will display a *[404 Not Found](/404)* error. You
can override this registration, but you don't have to.

## Example

~~~js
Route.register('404', 'Not found', {
	view: v=>({ 'h1': 'Error 404 Page not found' }) });
~~~
`);

doc('/api/route/init', 'Route.init()', `
# Route.init()

## Description

Binds the
[window.onhashchange](https://developer.mozilla.org/en-US/docs/Web/Events/hashchange)
event, and sets [m.root](/api/m/root) to the component matching the current
[document.location](https://developer.mozilla.org/en-US/docs/Web/API/Document/location).

Assumes you have already called [Route.register()](/api/route/register),
[Route.rewrite()](/api/route/rewrite), and overwritten [Route.titleFormat](/api/route/titleFormat), if you were going to.

## Example

~~~js
Route.init();
~~~
`);

doc('/api/route/link', 'Route.link', `
# Route.link

Returns a ~Function~ with the signature ~(e:MouseEvent)=>Boolean~.

Where

- The ~e~ parameter is a
[MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent)
resulting from the
[onclick](https://developer.mozilla.org/en-US/docs/Web/API/GlobalEventHandlers/onclick)
event firing on some ~HTMLElement~ with a non-empty
[href](https://developer.mozilla.org/en-US/docs/Web/API/HTMLHyperlinkElementUtils/href)
attribute value.

## Description

An optional component helper for use with clickable elements.

If the ~href~ attribute of the
[e.currentTarget](https://developer.mozilla.org/en-US/docs/Web/API/Event/currentTarget)
is a non-relative URI,
the click event will be allowed to proceed as normal, triggering a page
navigation away from the single-page application.

Otherwise, the click event will be intercepted, and the page will not be refreshed.
Instead, [m.redraw()](/api/m/redraw) will be invoked to rearrange the screen
to match the new target state of the destination route registered and matching
the ~href~ value.

In the latter case, when ~ctrlKey~ is held down,
[window.open()](https://developer.mozilla.org/en-US/docs/Web/API/Window/open)
will be used to load the new state in a new tab.

## Example

~~~js
m.root = { a: {
	$href: '/api/m/redraw',
	$onclick: Route.link,
	_: 'm.redraw()' }};
m.render(); // would render the 404 page if this was the entire application
~~~
`);

doc('/api/route/redirect', 'Route.redirect()', `
# Route.redirect(uri)

Where

- The ~uri~ parameter is a ~String~ URI value.

## Description

Navigates to the given ~uri~.

If ~uri~ is an absolute URI beginning with ~http://~ or ~https://~ or ~//~ then
it is considered an external link, and 
[document.location.href](https://developer.mozilla.org/en-US/docs/Web/API/Document/location)
will be updated to point at it, resulting in the browser navigating away from the
current single page application.

Otherwise, the ~uri~ is considered a relative or local link, and the normal
logic within [Route.register()](/api/route/register) applies, aborting the page
refresh, and instead updating [m.root](/api/m/root) to point at a component
whose pattern is matched, followed by a call to [m.redraw()](/api/m/redraw).

## Example

~~~js
const Pages = {};
Pages.Layout = {
	oninit(v) {
		if (null == window.user && !/^\/users\/login/.test(Route.uri)) {
			Route.redirect('/users/login?returnTo='+Route.uri);
			return false;
		}
	},
};
~~~
`);

doc('/api/route/uri', 'Route.uri', `
# Route.uri

Returns a ~String~ URI value.

## Description

Parses the the current
[document.location](https://developer.mozilla.org/en-US/docs/Web/API/Document/location),
1. discarding any
	[query string](https://developer.mozilla.org/en-US/docs/Web/API/HTMLHyperlinkElementUtils/search)
	values, and;
2. normalizing URI schemes including,  
	clean (~/user/1~) vs.  
	hashed (~/#/user/1~), and;
3. returning a simplified result.

## Example

~~~js
document.location.href = '/#/user/1?pine=cone';
console.log(Route.uri); // "/user/1"
~~~
`);

doc('/api/route/params', 'Route.params', `
# Route.params

Returns an ~Array~ of ~String~ captured group values.

## Description

Holds any group values captured by the router's call to
[String.prototype.match](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match)
using the
[RegExp](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp)
pattern from the ~uri~ of
[Route.register()](/api/route/register)
during the last 
[window.onhashchange](https://developer.mozilla.org/en-US/docs/Web/Events/hashchange)
event.

## Example

~~~js
Route.register('/user/(\\d+)', 'User Profile', {
	view(v) {
		const [id] = Route.params;
		const user = db.state.Users.find(u=>id===u.id);
		return { h1: { \`Profile of \${user.name}!\` }};
	}
});
~~~
`);

doc('/api/route/getTitleByURI', 'Route.getTitleByURI()', `
# Route.getTitleByURI(uri)

Where
- The ~uri~ parameter is a ~String~ literal matching the pattern given to the ~uri~ in a prior
call to [Route.register()](/api/route/register).

Returns a ~String~ title value.

## Description

A kind of reverse-lookup function which will find the title previously 
registered to a given URI.

Useful for hyperlink components to automatically determine the anchor
text for an in-app href.

## Example

~~~js
const Components = {};
Components.Link = {
	view(v) {
		return {
			'a': {
				$class: Route.uri === v.attrs.href ?
					Utils.joinStringIfNotEmpty(v.attrs.class, ' ',  'active') :
					v.attrs.class,
				$href: v.attrs.href,
				$title: Route.getTitleByURI(v.attrs.href),
				$onclick: Route.link,
				_: v.children,
			}
		};
	}
};
~~~
`);

doc('/api/utils/request', 'Utils.request()', `
# Utils.request(method, url, data)

Where

- The ~method~ parameter is a ~String~ value being one of ~GET~, ~POST~, ~PUT~, ~DELETE~, etc.

- The ~url~ parameter is a ~String~ with value of any valid URL.

- The ~data~ parameter is an optional ~Object~ with value containing any valid JSON.

Returns a
[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).
Will
[.resolve()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve)
if HTTP response is ~Status: 200~, otherwise
[.reject()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/reject).
In either case, the value passed to 
[.then()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then)
will be the
[JSON.parse()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
of ~xhr.responseText~.

## Description

Performs an asynchronous HTTP(S) request using an
[XMLHttpRequest (XHR)](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest)
object.

Always sends ~Content-Type: application/json~ request header, with any HTTP body
data in JSON, and expects the server to respond with the same.

*NOTE*: Use of the Utils module is partially optional. You can download a release
with only the specific methods used by m-js, which does not include this one.

After the HTTP request is complete and the Promise resolves, and
presumably some application state has changed as a result—then you may want to 
update the view.

*NOTE*: This method will *not* trigger a redraw for you. Read more about [m.redraw()](/api/m/redraw) for details.  

## Example

~~~js
Pages.Ideas.New = {
	async onsubmit(v,e) {
		const form = e.currentTarget;
		const data = Utils.serializeForm(form);
		console.log('Pages.Ideas.New.onsubmit()', data);
		const resp = await Utils.request('post', Utils.prop(form, null, 'action'), data);
		console.log('resp', resp);
		Route.redirect('/ideas/explore');
	},

	view(v) {
		return { $: Pages.Layout, _: {
			'.scroll.container-fluid': {
				'.row': {
					'.col.p-4': {
						'h1.text-bold.text-3x': 'New Idea',
						form: {
							$method: 'post', $action: '/api/1/crud/Idea',
							$onsubmit: Utils.trapEvent(Pages.Ideas.New.onsubmit.bind(null, v)), _:[
							{ $: Components.TextInput, $name: 'summary', $label: 'Summary', $help: '140 chars max' },
							{ $: Components.TextArea, $name: 'detail', $label: 'Detail', $help: 'Put everything here. Assume readers will look nowhere else.', $rows: 6 },
							{ $: Components.TextInput, $name: 'tags', $label: 'Tags', $help: 'comma-delimited list' },
							{ $: Components.SubmitButtonInput, $label: 'Submit' },
						]}
				}}}
		}};
	}
};
~~~
`);

const App = {
	init() {
		Route.titleFormat = (uri,s) => s + (
			'/api/' === uri.substr(0,5) ? ' | API' :
			'/guide/' === uri.substr(0,7) ? ' | Guide' :
			'') + ' | M.js Documentation';
		Route.rewrite('/', '/guide/welcome/featureset');
		Route.rewrite('/guide', '/guide/welcome/featureset');
		Route.rewrite('/api', '/api/m/root');
		Route.init();
	}	
};
export default App;
import HotClient from '../src/hot-client.js';
Utils.onReady(HotClient.reloader(App));