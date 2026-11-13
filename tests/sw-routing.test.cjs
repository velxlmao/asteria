const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('sw.js', 'utf8');
const handler = source.slice(source.indexOf('async function handleRequest('), source.indexOf('self.addEventListener("fetch"'));
let routed = 0, plain = 0;
const scope = '/repo/version/';
const context = vm.createContext({ URL, Response, Headers, SCOPE: scope, PROXY_PREFIX: scope + 'view/', self: { location: new URL('https://example.test' + scope + 'sw.js') }, withTimeout: promise => promise, withCOI: response => response,
	fetch: async () => { plain++; return new Response('raw'); },
	scramjetPromise: Promise.resolve({ loadConfig: async () => {}, route: () => true, fetch: async () => { routed++; return new Response('self.WASM = "test";', { headers: { 'content-type': 'text/javascript' } }); } })
});
vm.runInContext(handler, context);
(async () => {
	const loader = await context.handleRequest({ request: { url: 'https://example.test' + scope + 'lib/s/reader.wasm', destination: 'script', mode: 'no-cors' } });
	assert.equal(routed, 1);
	assert.equal(loader.headers.get('content-type'), 'text/javascript');
	assert.match(await loader.text(), /self.WASM/);
	await context.handleRequest({ request: { url: 'https://example.test' + scope + 'lib/e/http1.wasm', destination: '', mode: 'cors' } });
	assert.equal(plain, 1);
	assert.equal(routed, 1);
	await context.handleRequest({ request: { url: 'https://example.test' + scope + 'view/encoded', destination: 'iframe', mode: 'navigate' } });
	assert.equal(routed, 2);
	console.log('rewriter loader, proxy navigation and ordinary wasm routing checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
