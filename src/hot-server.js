//
// Quick-Start Template
//
// usage example:
//
//	const server = require('../src/hot-server')({
//		app: app,
//		cwd: __dirname,
//		watch: '**/*.{js,styl}',
//		ignored: /^docs\/server\.js$/,
//	});
//

const debug = require('debug')('m-js:hot-server');
const chokidar = require('chokidar');
const { relative, join } = require('path');
const fs = require('fs');
const delay = ms => new Promise(ok=>setTimeout(ok, ms));
const RX_STYLUS_EXT = /\.styl$/;
const stylus = require('stylus');

module.exports = ({ cwd, watch, ignored, app }) => {
	const server = require('http').createServer(app);
	const io = require('socket.io')(server);
	
	const watcher = chokidar.watch(watch, {
		cwd: cwd,
		ignored: ignored,
		persistent: true,
	});
	watcher
		.on('change', async path => {
			debug(`fs.change ${path}`);
			let changedFile;
			if (RX_STYLUS_EXT.test(path)) {
				try {
					const cssFileName = path.replace(RX_STYLUS_EXT, '.css');
					let tries = 3, input = '';
					// retry cuz prior write to disk can be slow
					while ('' === input && tries-- > 0) {
						input = fs.readFileSync(join(cwd,path)).toString();
						await delay(250);
					}
					stylus.render(input, { filename: cssFileName }, (err, css) => {
						if (err) throw err;
						fs.writeFileSync(join(cwd,cssFileName), css);
						changedFile = cssFileName;
					});
				} catch(e) {
					console.error(e.message);
					return;
				}
			}
			else {
				changedFile = path;
			}

			// if you don't want to use this template, or you want to customize it,
			// the important thing is that you broadcast this event to socket.io clients
			// when the files you want to reload have changed and are ready to reload.
			io.sockets.emit('fs.change', relative(process.cwd(), join(cwd,changedFile)));
		});

		return server;
};