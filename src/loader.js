import * as Utils from './utils.js';

const Loader = {
	async loadCss(url, nocache=false, styleCheckEl, styleCheckAttr, styleCheckVal) {
		const link = document.createElement('link');
		link.setAttribute('rel', 'stylesheet');
		link.setAttribute('href', `${url}?${nocache ? Utils.getUid() : ''}`);
		// swap prior to next paint event to avoid a brief white flash of no styles
		const existing = document.head.querySelector(`link[rel=stylesheet][href^="${url}"]`);
		document.head.appendChild(link);
		
		if (null != styleCheckEl) {
			let tries = 30;
			await Utils.delay(24);
			while (tries > 0 && styleCheckVal !== window.getComputedStyle(styleCheckEl)
				.getPropertyValue(styleCheckAttr).trim()
			) {
				tries--;
				await Utils.delay(250);
			}
			if (0 === tries) console.warn(`timed out loading ${url}`);
		} else await Utils.delay(250);
		if (null != existing) try { document.head.removeChild(existing) } catch(e) {}
	},

	// note: to unload js, stop referencing it, and it will GC
	loadJs(url, type='text/javascript', nocache=false) {
		let ok;
		const script = document.createElement('script');
		if (type) script.setAttribute('type', type);
		script.setAttribute('src', `${url}?${nocache ? Utils.getUid() : ''}`);
		script.addEventListener('load', () => {
			try {
				document.body.removeChild(script); // once js is in memory, dom tag serves no purpose
			} catch(e) {}
			ok();
		});
		document.body.appendChild(script);
		return new Promise(a=>ok=a);
	},
};
export default Loader;