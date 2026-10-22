
import { createHmac, timingSafeEqual } from "node:crypto";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    return res.status(500).json({
      error: "ADMIN_TOKEN 환경변수가 설정되지 않았어."
    });
  }

  try {
    let body = req.body;

    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const token = typeof body?.token === "string"
      ? body.token
      : "";

    const supplied = Buffer.from(token);
    const expected = Buffer.from(adminToken);

    const valid =
      supplied.length === expected.length &&
      timingSafeEqual(supplied, expected);

    if (!valid) {
      return res.status(401).json({
        error: "비밀번호가 올바르지 않아."
      });
    }

    const expires = String(
      Math.floor(Date.now() / 1000) + 8 * 60 * 60
    );

    const signature = createHmac("sha256", adminToken)
      .update(expires)
      .digest("hex");

    res.setHeader("Set-Cookie",
      `dd_admin=${expires}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=28800`
    );

    return res.status(200).json({
      success: true
    });
  } catch {
    return res.status(400).json({
      error: "로그인 요청을 처리할 수 없어."
    });
  }
}
