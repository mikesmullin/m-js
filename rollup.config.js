import uglify from 'rollup-plugin-uglify-es';
import gzip from 'rollup-plugin-gzip';
import copy from 'rollup-plugin-copy';

export default [
	{
		input: 'src/bundle.js',
		output: {
			file: 'dist/m-bundle.js',
			format: 'iife'
		},
		// plugins: [
		// 	copy({
		// 		'node_modules/highlight.js/lib/highlight.js': 'docs/highlight.js/highlight.js',
		// 		'node_modules/highlight.js/lib/languages/javascript.js': 'docs/highlight.js/languages/javascript.js',
		// 		'node_modules/highlight.js/styles/atom-one-dark.css': 'docs/highlight.js/styles/atom-one-dark.css', // or github is nice
		// 		verbose: true
		// 	}),
		// ]
	},
	{
		input: 'src/bundle.js',
		output: {
			file: 'dist/m-bundle.min.js',
			format: 'iife',
			sourcemap: true,
		},
		plugins: [
				uglify(),
				gzip(),
		]
	},
];