import * as Utils from './utils.js';
import Loader from './loader.js';

// hot reload

Loader.loadJs('/socket.io/socket.io.js', 'text/javascript', false).then(() => {
	const socket = window.io();
	socket.on('fs.change', filename => {
		console.info('fs.change', filename);
		if (/\.js$/.test(filename)) {
			Loader.loadJs(filename, 'module', true);
		}
		else if (/\.css$/.test(filename)) {
			Loader.loadCss(filename, true);
		}
	});
});

const memory = {};

export default {
	reloader: App => () => {
		if (null == memory.App) memory.App = App; else App = memory.App;

		if (null != App.db) {
			App.db.applyDefaults();
			App.db.reloadState();
		}

		Utils.data.flush();

		App.init();
	}
};