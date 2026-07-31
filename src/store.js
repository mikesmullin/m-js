/**
 * Zustand-inspired store — one small file, zero TypeScript.
 * Survives HMR via window.__M_STORES__.
 */

const HMR_KEY = '__M_STORES__';

function getHmrBucket() {
  if (typeof window === 'undefined') return null;
  if (!window[HMR_KEY]) window[HMR_KEY] = new Map();
  return window[HMR_KEY];
}

/**
 * @template T
 * @param {(set: Function, get: Function, api: object) => T} createState
 * @param {{ name?: string }} [opts]
 */
export function createStore(createState, opts = {}) {
  const name = opts.name || null;
  const bucket = getHmrBucket();

  // Reuse existing store across HMR when a stable name is given
  if (name && bucket?.has(name)) {
    return bucket.get(name);
  }

  /** @type {Set<(state: any, prev: any) => void>} */
  const listeners = new Set();
  /** @type {any} */
  let state;
  /** @type {any} */
  let initialState;

  const getState = () => state;
  const getInitialState = () => initialState;

  const setState = (partial, replace) => {
    const next =
      typeof partial === 'function' ? partial(state) : partial;
    if (Object.is(next, state)) return;
    const prev = state;
    state =
      replace === true || typeof next !== 'object' || next === null
        ? next
        : Object.assign({}, state, next);
    for (const listener of listeners) listener(state, prev);
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const api = { setState, getState, getInitialState, subscribe };
  initialState = state = createState(setState, getState, api);

  if (name && bucket) bucket.set(name, api);
  return api;
}

/**
 * Clear a named store from the HMR bucket (useful in tests).
 * @param {string} name
 */
export function clearStore(name) {
  getHmrBucket()?.delete(name);
}

export default createStore;
