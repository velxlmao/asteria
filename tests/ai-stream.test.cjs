const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const source = fs.readFileSync(path.join(__dirname, "../ai.js"), "utf8");
const parser = source.slice(source.indexOf("\tasync function readReply("), source.indexOf("\tfunction render()"));
const readReply = vm.runInNewContext("(" + parser.trim() + ")", { TextDecoder, Error, JSON });

function stream(text) {
	const bytes = new TextEncoder().encode(text);
	let offset = 0;
	return new Response(new ReadableStream({
		pull(controller) {
			if (offset === bytes.length) return controller.close();
			controller.enqueue(bytes.slice(offset, ++offset));
		},
	}), { headers: { "content-type": "text/event-stream" } });
}

async function test() {
	let text = "";
	await readReply(stream('data: {"choices":[{"delta":{"content":"hé"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"llo"}}]}\n\ndata: [DONE]\n\n'), chunk => text += chunk);
	assert.equal(text, "héllo");
	await assert.rejects(() => readReply(stream('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'), () => {}), /interrupted/);
	await assert.rejects(() => readReply(stream('data: {"error":{"message":"failed"}}\n\n'), () => {}), /interrupted/);
	text = "";
	await readReply(Response.json({ content: "fallback" }), chunk => text += chunk);
	assert.equal(text, "fallback");
	await assert.rejects(() => readReply(Response.json({ error: "limited" }, { status: 429 }), () => {}), /limited/);
	console.log("ai stream checks passed");
}

test().catch(error => { console.error(error); process.exitCode = 1; });
