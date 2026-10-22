
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // 관리자 세션 쿠키 삭제
  res.setHeader(
    "Set-Cookie",
    "dd_admin=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0"
  );

  return res.status(200).json({
    success: true,
    message: "로그아웃 완료"
  });
}
