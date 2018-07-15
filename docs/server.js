const express = require('express');
const app = express();
const server = require('../src/hot-server')({
	app: app,
	cwd: __dirname,
	watch: '**/*.{js,styl}',
	ignored: /^docs\/server\.js$/,
});

const { join } = require('path');
app.use('/', express.static(join(__dirname, '..')));

process.env.PORT = process.env.PORT || 3001;
server.listen(process.env.PORT, () =>
	console.log(`Listening on port ${process.env.PORT}`));