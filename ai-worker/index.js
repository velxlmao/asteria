const headers = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST,OPTIONS", "access-control-allow-headers": "content-type", "content-type": "application/json" };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers });
export default {
	async fetch(request, env) {
		if (request.method === "OPTIONS") return new Response(null, { headers });
		if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
		const limit = await env.AI_LIMIT.limit({ key: request.headers.get("cf-connecting-ip") || "unknown" });
		if (!limit.success) return json({ error: "too many messages, try again in a minute" }, 429);
		try {
			const raw = await request.text();
			if (raw.length > 1800000) return json({ error: "request too large" }, 413);
			const body = JSON.parse(raw);
			if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 40) return json({ error: "invalid messages" }, 400);
			const messages = body.messages.map(({ role, content }) => {
				if (!["user", "assistant"].includes(role) || typeof content !== "string" || content.length > 12000) throw new Error("invalid message");
				return { role, content };
			});
			if (body.image !== undefined) {
				if (typeof body.image !== "string" || body.image.length > 1700000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(body.image) || messages.at(-1).role !== "user") return json({ error: "invalid screenshot" }, 400);
				messages.at(-1).content = [{ type: "text", text: messages.at(-1).content }, { type: "image_url", image_url: { url: body.image } }];
			}
			const response = await fetch("https://api.dawvq.com/v1/chat/completions", {
				method: "POST", headers: { authorization: "Bearer " + env.AI_KEY, "content-type": "application/json" },
				body: JSON.stringify({ model: "deepseek-v4-pro", messages, max_tokens: 2048 }), signal: AbortSignal.timeout(90000),
			});
			if (!response.ok) return json({ error: "ai provider unavailable, try again" }, 502);
			const data = await response.json();
			const content = data.choices?.[0]?.message?.content;
			if (!content) return json({ error: "empty response, try again" }, 502);
			return json({ content });
		} catch { return json({ error: "could not complete request" }, 400); }
	},
};
