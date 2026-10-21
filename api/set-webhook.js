export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST 요청만 허용됩니다."
    });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const setupKey = process.env.WEBHOOK_SETUP_KEY;

  if (!token || !secret || !setupKey) {
    return res.status(500).json({
      error: "Vercel 환경변수를 확인하세요."
    });
  }

  const providedKey = req.headers["x-setup-key"];

  if (providedKey !== setupKey) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  const webhookUrl =
    "https://dollardollar1.vercel.app/api/telegram";

  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ["message"]
      })
    }
  );

  const result = await response.json();

  return res.status(response.ok ? 200 : 502).json({
    ok: response.ok && result.ok === true,
    description: result.description || ""
  });
}
