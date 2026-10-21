
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const adminId = process.env.TELEGRAM_ADMIN_ID;

  if (!token || !adminId) {
    return res.status(500).json({
      error: "Server environment variables are missing"
    });
  }

  // Telegram webhook secret 검증
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const receivedSecret = req.headers["x-telegram-bot-api-secret-token"];

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const update = req.body;
  const message = update?.message;
  const chatId = String(message?.chat?.id ?? "");

  // 관리자 본인의 메시지만 허용
  if (chatId !== adminId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const text = message?.text ?? "";

  const responseText = text === "/start"
    ? "안녕! 밈 자동화 봇이 연결될 준비가 됐어."
    : "메시지를 받았어. 게시 기능은 다음 단계에서 연결할게.";

  const result = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: responseText
      })
    }
  );

  if (!result.ok) {
    return res.status(502).json({ error: "Telegram API failed" });
  }

  return res.status(200).json({ ok: true });
}
