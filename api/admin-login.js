import { createHmac, timingSafeEqual } from "node:crypto";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.ADMIN_TOKEN;

  if (!secret) {
    return res.status(500).json({
      error: "Admin authentication is not configured"
    });
  }

  let body = req.body;

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid request" });
    }
  }

  const supplied = typeof body?.token === "string"
    ? Buffer.from(body.token)
    : Buffer.alloc(0);

  const expected = Buffer.from(secret);

  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const expires = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
  const payload = String(expires);

  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  res.setHeader(
    "Set-Cookie",
    `dd_admin=${payload}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=28800`
  );

  return res.status(200).json({ ok: true });
}
