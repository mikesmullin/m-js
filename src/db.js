import * as Utils from './utils.js';

let db = {};
if (null == window.db) window.db = db; else db = window.db; // hot load

// NOTE: limited localStore capacity; if you conserve, you can save.
db.state =         db.state || {};
db.saveState =     () => { Utils.saveLocal('db.flux.state', db.state); };
db.reloadState =   () => { db.resetState(); Object.assign(db.state, Utils.fetchLocal('db.flux.state', {})); };

db.defaults =      db.defaults || {};
db.applyDefaults = () => { Object.assign(db.state, db.defaults, db.state); };
db.resetState =    () => { Object.keys(db.state).forEach(k=>delete db.state[k]); db.applyDefaults(); };

// WARN: do not to modify history or action arguments after they have happened, or you'll rip a hole in the space-time continuum;
db.actions =       new Proxy({}, { set: (o,name,cb) => o[name] = (...args) => { db.history.push([name, ...args]); cb(...args); }});

db.history =       db.history || [];
db.saveHistory =   () => { Utils.saveLocal('db.flux.history', db.history); };
db.reloadHistory = () => { db.resetHistory(); db.history.splice(-1, 0, ...Utils.fetchLocal('db.flux.history', [])); };
db.replayHistory = () => { for (const [name, ...args] of db.history) { db.actions[name](...args); db.history.pop(); } };
db.undoHistory =   () => { db.history.pop(); db.resetState(); db.replayHistory(); };
db.resetHistory =  () => { db.history.splice(0); };

export default db;