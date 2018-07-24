// const assert = require('chai').assert;
// const { lucene, searchy, tolucene } = require('../../src/extras/lucene-searchy');
//
// const SAMPLE_INPUTS =
// `
// a
// b:a
// b:a c
// b:a OR c
// b:a d:c
// b:a OR d:c
// ()
// (a)
// (b:a d:c)
// (b:a OR d:c) e
// (b:a OR d:c) OR e
// (b:a OR d:c) OR f:e
// OR a
// OR
// OR OR
// NOT
// NOT ()
// NOT OR
// NOT a
// NOT (NOT b:a OR NOT d:c h:g) OR NOT f:e
// (NOT b:a OR NOT d:c h:g) OR NOT f:e
// (NOT ((NOT b:a) OR (NOT d:c)) OR (NOT f:e))
// (((NOT b:a) OR (NOT d:c)) OR (NOT f:e))
// (stack_id:amc_zozo AND Instance.Type:t2.medium) AND b:2
// (stack_id:amc_zozo AND Instance.Type:"t2.medium") AND b:2
// (stack_id:amc_zozo AND Instance.Type:"t2 dot medium") AND b:2
// (stack_id:amc_zozo AND Instance.Type:"t2 \\"medium\\"") AND b:2
// a OR
// a OR OR b
// (((a)
// (()((k:a b))())()c`;
// const SPECIFIC_INPUTS = `(NOT b:a OR NOT d:c h:g) OR NOT f:e`;
//
// describe('lucene-searchy.js', () => {
//     it('lucene', () => {
//         for (const input of SAMPLE_INPUTS.split(/[\r\n]+/g)) {
//         // for (const input of SPECIFIC_INPUTS.split(/[\r\n]+/g)) {
//             try {
// 								console.log('input', input);
// 								const output = lucene(input);
//                 console.log('output', output);
//             } catch(e) {
//                 console.log(e.message/*e.stack*/);
//             }
//         }
//     });
//
//     it('searchy', () => {
//         const record = {
//             A: 'hAMStAr', // (sic)
//             'b.C': 'CacTuS',
//             F: 'ElePHanT',
//         };
// 				// const INPUT = JSON.flatten(record);
// 				const INPUT = record; // NOTICE: manually flattening for now
//         const test = q => {
//             console.log('input', q);
//             return searchy(q).test(INPUT);
//         }
//         try {
//             assert.isTrue( test('B.c:cACt'));
//             assert.isTrue( test('c:caCt'));
//             assert.isTrue( test('caCt'));
//             assert.isFalse(test('B.c:cACti'));
//             assert.isFalse(test('c:caCti'));
//             assert.isFalse(test('caCti'));
//             assert.isTrue( test('NOT caCti'));
//             assert.isTrue( test('NOT caCti AND NOT phantom'));
//             assert.isTrue( test('NOT caCti AND ele'));
//             assert.isTrue( test('star AND cactus AND NOT caCti AND ele'));
//             assert.isFalse(test('bud'));
//             assert.isTrue( test('bud OR cact'));
//             assert.isTrue( test('NOT bud AND cact'));
//             assert.isTrue( test('(b.c:hamster OR a:hamstar) AND f:phant'));
//         } catch(e) {
//             console.log(e.stack);
//         }
//     });
//
//     it('tolucene', () => {
//         for (const input of SAMPLE_INPUTS.split(/[\r\n]+/g)) {
//             // for (const input of SPECIFIC_INPUTS.split(/[\r\n]+/g)) {
//             try {
//                 console.log('input', input);
//                 console.log('output', tolucene(lucene(input)));
//             } catch(e) {
//                 console.log(e.message);
//             }
//         }
//     });
// });