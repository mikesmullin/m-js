const assert = require('chai').assert;
const { markdown } = require('../../src/extras/markdown-jxml');

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

this has _emphasis_ *of* **various** __kinds__ ~inline code~

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
	it.only('specific input', () => {
		const output = markdown(SPECIFIC_INPUT);
		console.log('output', JSON.stringify(output, null, 2));
	});

	it('markdown', () => {
		const output = markdown(SAMPLE_INPUT);
		assert.deepEqual(output, [
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
				"p": "this would be a paragraph\nmade of multiple lines\nbut which turns into just one line.\n"
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
					"in it\n"
				]
			},
			"",
			{
				"p": "\n"
			},
			{
				"p": [
					{
						"strong": "emphasis"
					},
					" ",
					{
						"strong": "of"
					},
					" ",
					{
						"em": "various"
					},
					" ",
					{
						"em": "kinds"
					},
					" ",
					{
						"code": "inline code"
					},
					"\n"
				]
			},
			{
				"h1": {
					"$id": "h1",
					"_": "h1"
				}
			},
			{
				"h2": {
					"$id": "h2",
					"_": "h2"
				}
			},
			{
				"h3": {
					"$id": "h3",
					"_": "h3"
				}
			},
			{
				"h4": {
					"$id": "h4",
					"_": "h4"
				}
			},
			{
				"h5": {
					"$id": "h5",
					"_": "h5"
				}
			},
			{
				"h6": {
					"$id": "h6",
					"_": "h6"
				}
			},
			{
				"ul": [
					{
						"li": {
							"p": "ordered\n  multiline"
						}
					},
					{
						"li": {
							"p": "list\n"
						}
					}
				]
			},
			{
				"ol": [
					{
						"li": {
							"p": "numbered\n   multiline"
						}
					},
					{
						"li": {
							"p": "list\n"
						}
					}
				]
			}
		]);
	});
});