const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const chokidar = require('chokidar');
const stylus = require('stylus');
const { relative, join } = require('path');
const fs = require('fs');
const RX_STYLUS_EXT = /\.styl$/;
const DIST_DIR = join(__dirname, 'dist');
const delay = ms => new Promise(ok=>setTimeout(ok, ms));

app.use('/', express.static(join(__dirname, 'dist')));
app.use('/dist', express.static(join(__dirname, '..', 'src')));
app.use('/dist', express.static(join(__dirname, 'dist')));
app.use('/dist', express.static(join(__dirname, '..', 'dist')));
app.use('/dist', express.static(join(__dirname, '..', 'node_modules', 'socket.io-client', 'dist')));

const watcher = chokidar.watch('dist/**/*.{js,styl}', {
	cwd: __dirname,
  persistent: true
});
watcher
  .on('change', async path => {
		console.log(`fs.change ${path}`);
		let changedFile;
		if (RX_STYLUS_EXT.test(path)) {
			try {
				const cssFileName = path.replace(RX_STYLUS_EXT, '.css');
				let tries = 3, input = '';
				// retry cuz prior write to disk can be slow
				while ('' === input && tries-- > 0) {
					input = fs.readFileSync(join(__dirname,path)).toString();
					await delay(250);
				}
				stylus.render(input, { filename: cssFileName }, (err, css) => {
					if (err) throw err;
					fs.writeFileSync(join(__dirname,cssFileName), css);
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
		io.sockets.emit('fs.change', relative(DIST_DIR, changedFile));
	});

process.env.PORT = process.env.PORT || 3001;
server.listen(process.env.PORT, () =>
	console.log(`Listening on port ${process.env.PORT}`));