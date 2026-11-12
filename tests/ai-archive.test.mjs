import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../ai-worker/archive.js', import.meta.url), 'utf8');
const { ChatArchive, validateUpload } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const records = new Map();
const storage = {
	async get(key) { return records.get(key); },
	async put(key, value) { if (typeof key === 'string') records.set(key, value); else for (const entry of Object.entries(key)) records.set(...entry); },
	async transaction(fn) { return fn(storage); },
	async list(options) { return new Map([...records.entries()].sort(([a], [b]) => a.localeCompare(b)).filter(([key]) => key.startsWith(options.prefix) && (!options.start || key >= options.start) && (!options.startAfter || key > options.startAfter)).slice(0, options.limit)); }
};
const archive = new ChatArchive({ storage });
async function call(action, body) {
	const response = await archive.fetch(new Request('https://test/archive/' + action, { method: 'POST', body: JSON.stringify(body) }));
	return { status: response.status, data: await response.json() };
}
const browser = crypto.randomUUID() + crypto.randomUUID();
const upload = { browser, consent: 'owner-review-v1', id: crypto.randomUUID(), offset: 0, name: '<img onerror=alert(1)>', messages: [{ role: 'user', content: 'test' }] };
assert.throws(() => validateUpload({ ...upload, consent: undefined }));
assert.throws(() => validateUpload({ ...upload, offset: -1 }));
assert.throws(() => validateUpload({ ...upload, messages: [{ role: 'system', content: 'test' }] }));
assert.throws(() => validateUpload({ ...upload, messages: [{ role: 'user', content: 'x'.repeat(12001) }] }));
assert.equal((await call('list', {})).status, 403);
assert.equal((await call('upload', upload)).status, 200);
assert.equal((await call('upload', upload)).status, 200);
const session = crypto.randomUUID() + crypto.randomUUID();
await storage.put('session:' + session, Date.now() + 60000);
const listing = await call('list', { session });
assert.equal(listing.data.chats.length, 1);
assert.equal(listing.data.chats[0].count, 1);
const key = listing.data.chats[0].key;
assert.equal((await call('read', { key, offset: 0 })).status, 403);
assert.equal((await call('read', { session: browser, key, offset: 0 })).status, 403);
await call('upload', { ...upload, offset: 1, messages: [{ role: 'assistant', content: 'answer', image: 'not stored' }] });
const chat = await call('read', { session, key, offset: 0 });
assert.deepEqual(chat.data.messages, [{ role: 'user', content: 'test' }, { role: 'assistant', content: 'answer' }]);
assert.equal(chat.data.chat.count, 2);
assert.equal((await call('read', { session, key: '../session', offset: 0 })).status, 400);
await storage.put('session:' + session, Date.now() - 1);
assert.equal((await call('list', { session })).status, 403);
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => ({ webSocket: {
	accept() {}, close() {}, addEventListener(type, fn) { if (type === 'message') this.message = fn; },
	send(raw) { const data = JSON.parse(raw); queueMicrotask(() => this.message({ data: JSON.stringify(data.type === 'hello' ? { type: 'ban-state' } : { type: 'named', owner: false }) })); }
} });
assert.equal((await call('login', { password: 'wrong' })).status, 403);
globalThis.fetch = async () => ({ webSocket: {
	accept() {}, close() {}, addEventListener(type, fn) { if (type === 'message') this.message = fn; },
	send(raw) { const data = JSON.parse(raw); queueMicrotask(() => this.message({ data: JSON.stringify(data.type === 'hello' ? { type: 'ban-state' } : { type: 'named', owner: true }) })); }
} });
const login = await call('login', { password: 'test-only' });
assert.equal(login.status, 200);
assert.equal((await call('list', { session: login.data.session })).status, 200);
globalThis.fetch = originalFetch;
console.log('archive consent, auth, upsert and storage checks passed');
