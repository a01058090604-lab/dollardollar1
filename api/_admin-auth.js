import { createHmac, timingSafeEqual } from "node:crypto";

export function requireAdmin(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "POST 요청만 허용됩니다." });
    return false;
  }

  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    res.status(500).json({
      error: "관리자 환경변수가 설정되지 않았습니다."
    });
    return false;
  }

  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)dd_admin=([^;]+)/);

  if (!match) {
    res.status(401).json({
      error: "로그인이 필요합니다."
    });
    return false;
  }

  try {
    const value = decodeURIComponent(match[1]);
    const separator = value.indexOf(".");
    if (separator < 1) throw new Error("Invalid session");

    const expires = value.slice(0, separator);
    const signature = value.slice(separator + 1);

    if (
      !/^\d+$/.test(expires) ||
      Number(expires) < Math.floor(Date.now() / 1000)
    ) {
      throw new Error("Expired session");
    }

    const expected = createHmac("sha256", adminToken)
      .update(expires)
      .digest("hex");

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Invalid signature");
    }

    return true;
  } catch {
    res.status(401).json({
      error: "로그인이 만료됐어요. 다시 로그인해 주세요."
    });
    return false;
  }
}
