const assert = require('chai').assert;
require('babel-register');
const markdown = require('../../src/extras/markdown-jxml').default;

const SAMPLE_INPUT =
`
~~~js
if (true) {
	alert('hello world');
}
~~~

~~~
random
   code
~~~

this would be a paragraph
made of multiple lines
but which turns into just one line.

this would be a paragraph  
with line breaks  
in it

this has a [link](http://www.google.com/)

this has emphasis of various kinds *bold* __italics__ ~~strike~~ ~mono~

> # blockquote
> can have  
> normal formatting

# h1
## h2
### h3
#### h4
##### h5
###### h6

- ordered  
  multiline
- list

1. numbered  
   multiline
2. list

`;

const SPECIFIC_INPUT =
`
# Releases

Browse the Releases section of the Github repository.

[https://github.com/mikesmullin/m-js/releases](https://github.com/mikesmullin/m-js/releases)
`;

describe('markdown-jxml.js', () => {
	it.skip('specific input', () => {
		const output = markdown(SPECIFIC_INPUT);
		console.log('output', JSON.stringify(output, null, 2));
	});

	it('markdown', () => {
		const output = markdown(SAMPLE_INPUT);
		// console.log(JSON.stringify(output, null, '\t'));
		assert.deepEqual(output, [
			{
				"p": "\n"
			},
			{
				"pre": {
					"code": {
						"$class": "js",
						"_": "if (true) {\n\talert('hello world');\n}"
					}
				}
			},
			{
				"pre": {
					"code": {
						"$class": undefined,
						"_": "random\n   code"
					}
				}
			},
			{
				"p": "this would be a paragraph\nmade of multiple lines\nbut which turns into just one line."
			},
			{
				"p": [
					"this would be a paragraph",
					{
						"br": {}
					},
					"with line breaks",
					{
						"br": {}
					},
					"in it"
				]
			},
			{
				"p": [
					"this has a ",
					{
						"a": {
							"$href": "http://www.google.com/",
							"_": "link"
						}
					}
				]
			},
			{
				"p": [
					"this has emphasis of various kinds ",
					{
						"strong": "bold"
					},
					" ",
					{
						"em": "italics"
					},
					" ",
					{
						"s": "strike"
					},
					" ",
					{
						"code": "mono"
					},
				]
			},
			{
				"blockquote": [
					{
						"h1": {
							"_": "blockquote"
						}
					},
					{
						"p": [
							"can have",
							{
								"br": {}
							},
							"normal formatting"
						]
					}
				]
			},
			{
				"h1": {
					"_": "h1"
				}
			},
			{
				"h2": {
					"_": "h2"
				}
			},
			{
				"h3": {
					"_": "h3"
				}
			},
			{
				"h4": {
					"_": "h4"
				}
			},
			{
				"h5": {
					"_": "h5"
				}
			},
			{
				"h6": {
					"_": "h6"
				}
			},
			{
				"ul": [
					{
						"li": {
							"p": [
								"ordered",
								{
									"br": {}
								},
								"  multiline"
							]
						}
					},
					{
						"li": {
							"p": "list"
						}
					}
				]
			},
			{
				"ol": [
					{
						"li": {
							"p": [
								"numbered",
								{
									"br": {}
								},
								"   multiline"
							]
						}
					},
					{
						"li": {
							"p": "list"
						}
					}
				]
			}
		]);
	});
});