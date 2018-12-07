import * as Utils from './utils.js';
import Loader from './loader.js';

// hot reload client

Loader.loadJs('/socket.io/socket.io.js', 'text/javascript', false).then(() => {
	const socket = window.io();
	socket.on('fs.change', filename => {
		console.debug('fs.change', filename);
		if (/\.js$/.test(filename)) {
			Loader.loadJs(filename, 'module', true);
		}
		else if (/\.css$/.test(filename)) {
			Loader.loadCss(filename, true);
		}
	});
});

// example:
// you will probably want a lot of control over how to customize this
// from within your app.
//
// const memory = { App: {} };
// export default {
// 	reloader: App => () => {
// 		Object.assign(memory.App, App);
//
// 		if (null != App.db) {
// 			App.db.applyDefaults();
// 			App.db.reloadState();
// 		}
//
// 		Utils.data.flush();
//
// 		App.init();
// 	}
// };