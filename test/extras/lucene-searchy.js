const assert = require('chai').assert;
require('babel-register');
const { lucene, searchy, tolucene } = require('../../src/extras/lucene-searchy');

describe('lucene-searchy.js', () => {
	describe('lucene()', () => {
		const test = (input, expected) => {
			let ast, luceneString, _e;
			try {
				try {
					ast = lucene(input);
					luceneString = tolucene(ast);
					assert.equal(luceneString, expected);
				}
				catch(e) {
					_e = e;
					assert.equal(e.message, 'Lucene syntax error: '+expected);
				}
			}
			catch (e) { // AssertionError
				console.log('input\n '+ input +'\n');
				if (null != ast) console.log('ast [ \n ' + ast.map(v=>JSON.stringify(v)).join('\n ') +'\n]\n');
				console.log('tolucene\n '+ luceneString +'\n');
				if (_e) console.log(_e.stack);
				throw e;
			}
		};

		it('01', () => test('((((((a:c AND b)))) NOT b))', '(a:c AND b) NOT b'));
		it('02', () => test('((((((a))))b))', 'a b'));
		it('03', () => test('(((tuna:a OR fat:b)))(NOT k:c)', '(tuna:a OR fat:b) NOT k:c'));
		it('04', () => test('(a b)(c)', '(a b) c'));
		it('05', () => test('(((a)', 'Forgot closing paren )'));
		it('06', () => test('(a(b c)d)', 'a (b c) d'));
		it('07', () => test('(e(f)(g)h)', 'e f g h'));
		it('08', () => test('()', 'Incorrect grammar.'));
		it('09', () => test('i', 'i'));
		it('10', () => test('()j','j'));
		it('11', () => test('(k)','k'));
		it('12', () => test('((l))','l'));
		it('13', () => test('((m n))','m n'));
		it('14', () => test('((o)(p q))','o (p q)'));
		it('15', () => test('(r)(s)','r s'));
		it('16', () => test('(t u)(v w)','(t u) (v w)'));
		it('17', () => test('(x(y z))','x y z'));
		it('18', () => test('(((()())()a))','a'));
		it('19', () => test('()b','b'));
		it('20', () => test('(c)','c'));
		it('21', () => test('((d))','d'));
		it('22', () => test('((e))','e'));
		it('23', () => test('(f(g h))','f g h'));
		it('24', () => test('(l)(m)','l m'));
		it('25', () => test('((n o)(p q))','(n o) (p q)'));
		it('26', () => test('(v(w))(x y)','(v w) (x y)'));
		it('27', () => test('(((z', 'Forgot closing paren )'));
		it('28', () => test('b)))', 'Forgot opening paren ('));
		it('29', () => test('(c)))', 'Forgot opening paren ('));
		it('30', () => test('(a:b) or (c:d e f)', 'a:b or (c:d e f)'));
		it('31', () => test('"a"', 'a'));
		it('32', () => test(' "" ', '""'));
		it('33', () => test('a:', 'Keys must precede a value.'));
		it('34', () => test('NOT (1 OR 2)', 'NOT must appear before values. ie. NOT (a AND b) == (NOT a OR NOT b)'));
		it('35', () => test('(1 OR 2 NOT)', 'NOT must appear before values. ie. NOT (a AND b) == (NOT a OR NOT b)'));
		it('36', () => test('2 NOT', 'NOT must appear before values. ie. NOT (a AND b) == (NOT a OR NOT b)'));
		it('37', () => test('AND b', 'Logical operators (AND OR) must appear between values.'));
		it('38', () => test('(AND b)', 'Logical operators (AND OR) must appear between values.'));
		it('39', () => test('(b AND)', 'Logical operators (AND OR) must appear between values.'));
		it('40', () => test('b AND', 'Logical operators (AND OR) must appear between values.'));
		it('41', () => test('a:b OR NOT @timestamp:d', 'a:b OR NOT @timestamp:d'));
		it('42', () => test('"service":"ec2.amazonaws.com" "region":"us-east-1"', 'service:ec2.amazonaws.com region:us-east-1'));
	});

	describe('searchy()', () => {
		const record = {
			A: 'hAMStAr', // (sic)
			'b.C': 'CacTuS', // assume already JSON.flatten()
			F: 'ElePHanT',
		};

		const test = (input, expected) => {
			let query, ast, output;
			try {
				query = searchy(input);
				output = query.matchObject(record);
				assert.equal(output, !!expected);
			}
			catch(e) {
				console.log('input\n '+ input +'\n');
				ast = lucene(input);
				console.log('ast [ \n ' + ast.map(v=>JSON.stringify(v)).join('\n ') +'\n]\n');
				throw e;
			}
		};

		it('01', () => test('B.c:cACt', 1));
		it('02', () => test('c:caCt', 1));
		it('03', () => test('caCt', 1));
		it('04', () => test('B.c:cACti', 0));
		it('05', () => test('c:caCti', 0));
		it('06', () => test('caCti', 0));
		it('07', () => test('NOT caCti', 1));
		it('08', () => test('NOT caCti AND NOT phantom', 1));
		it('09', () => test('NOT caCti AND ele', 1));
		it('10', () => test('star AND cactus AND NOT caCti AND ele', 1));
		it('11', () => test('bud', 0));
		it('12', () => test('bud OR cact', 1));
		it('13', () => test('NOT bud AND cact', 1));
		it('14', () => test('(b.c:hamster OR a:hamstar) AND f:phant', 1));
	});
});