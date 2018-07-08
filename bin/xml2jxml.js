#!/usr/bin/env node

/**
 * This dev tool converts XML to JXML.
 * 
 * usage:
 * 
 * 	sh xml2jxml.js <infile> <indent> > <outfile>
 */

const fs = require('fs'),
	xml2js = require('xml2js'),
	stringify = require('javascript-stringify'),
	{ promisify } = require('util');

const reformatAttrs = (o,tag,parent) => {
	if (Array.isArray(o) && null != tag && 'object' === typeof parent && null != parent) {
		for (var i=o.length-1; i>=0; i--) {
			o[i] = { [tag]: o[i] };
			reformatAttrs(o[i][tag]);
		}
		if (o.length < 2) {
			o = parent[tag] = o[0][tag]; // object key
		}
		else {
			delete parent[tag]; // move key into array
			if (null == parent._) parent._ = o; // this array becomes parent.children list
			else {
				if (!Array.isArray(parent._)) parent._ = [parent._]; // existing parent.child becomes part of a list
				parent._.splice(-1, 0, ...o); // append to existing parent.children list
			}
		}
	}
	if (!Array.isArray(o) && null != o && 'object' === typeof o) {
		for (const k in o) {
			if ('$' === k) {
				for (const attr in o.$) {
					o['$'+attr] = o.$[attr];
				}
				delete o.$;
			}
			else {
				if (null != o[k] && 'object' === typeof o[k]) {
					reformatAttrs(o[k], k, o);
				}
				// keep keys in original order
				const v = o[k];
				delete o[k];
				if (undefined !== v) o[k] = v;
			}
		}
	}
};

(async()=>{
	const parser = new xml2js.Parser();
	const data = await promisify(fs.readFile)(process.argv[2])
	const result = await promisify(parser.parseString)(data);
	reformatAttrs(result);
	console.log('exports='+stringify(result, null, process.argv[3])+';');
})();