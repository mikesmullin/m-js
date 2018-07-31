import uglify from 'rollup-plugin-uglify-es';
import gzip from 'rollup-plugin-gzip';

export default [
	{
		input: 'src/bundle.js',
		output: {
			file: 'dist/m-bundle.js',
			format: 'iife'
		},
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
	{
		input: 'src/extras/index.js',
		output: {
			name: 'm.extras',
			file: 'dist/m-extras.js',
			format: 'iife'
		},
	},
];