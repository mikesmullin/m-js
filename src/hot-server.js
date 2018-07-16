//
// Quick-Start Template
//
// for usage and examples, see:
//
//   https://mikesmullin.github.io/m-js/#/api/hot/reloader
//

const debug = require('debug')('m-js:hot-server');
const chokidar = require('chokidar');
const { relative, join } = require('path');
const fs = require('fs');
const delay = ms => new Promise(ok=>setTimeout(ok, ms));
const RX_STYLUS_EXT = /\.styl$/;
const stylus = require('stylus');

const waitForDiskWrites = async path => {
	// retry loop, cuz prior write to disk can be slow
	let input = '', tries = 8; // waits up to 2 sec for non-empty file
	while ('' === input && tries-- > 0) {
		input = fs.readFileSync(path).toString();
		await delay(250);
	}
	return input;
};

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
					const input = await waitForDiskWrites(join(cwd, path));
					const css = await stylus.render(input, { filename: cssFileName });
					fs.writeFileSync(join(cwd, cssFileName), css);
					changedFile = cssFileName;
				}
				catch(e) {
					console.error(e.message);
					return;
				}
			}
			else {
				changedFile = path;
			}

			await waitForDiskWrites(join(cwd, changedFile));

			// if you don't want to use this template, or you want to customize it,
			// the important thing is that you broadcast this event to socket.io clients
			// when the files you want to reload have changed and are ready to reload.
			io.sockets.emit('fs.change', relative(process.cwd(), join(cwd, changedFile)));
		});

		return server;
};