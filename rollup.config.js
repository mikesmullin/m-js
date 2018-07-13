import uglify from 'rollup-plugin-uglify-es';

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
				uglify()
		]
	},	
];