
import { requireAdmin } from "./_admin-auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (!requireAdmin(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "POST 요청만 허용됩니다."
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Vercel 환경변수 OPENAI_API_KEY를 설정해 주세요."
    });
  }

  try {
    let body = req.body;

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const title =
      typeof body?.title === "string"
        ? body.title.trim().slice(0, 180)
        : "";

    const description =
      typeof body?.description === "string"
        ? body.description.trim().slice(0, 700)
        : "";

    if (!title) {
      return res.status(400).json({
        error: "이미지를 만들 주제가 없습니다."
      });
    }

    const prompt = [
      "Create one photorealistic editorial photograph for a Korean social media story.",
      "Depict a believable scene based on the topic and context.",
      "Use realistic lighting, natural colors, detailed surroundings,",
      "and convincing human expressions and body language.",
      "Use a vertical 2:3 portrait composition suitable for Instagram.",
      "Keep the main subject clear and leave some space for text overlay.",
      "Do not include text, letters, logos, watermarks, or collages.",
      "If the story is fictional or unverified, make it an illustrative scene,",
      "not evidence that a real event occurred.",
      "Do not depict identifiable real people.",
      "Topic: " + title,
      "Context: " + description
    ].join("\n");

    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt,
          size: "1024x1536",
          quality: "low",
          output_format: "jpeg"
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        "OpenAI image error:",
        data?.error?.message || response.status
      );

      return res.status(502).json({
        error:
          "이미지 생성 실패: API 키, 모델 접근 권한 또는 사용 한도를 확인해 주세요."
      });
    }

    const encoded = data?.data?.[0]?.b64_json;

    if (typeof encoded !== "string" || !encoded) {
      return res.status(502).json({
        error: "이미지 데이터를 받지 못했습니다."
      });
    }

    return res.status(200).json({
      image: "data:image/jpeg;base64," + encoded
    });
  } catch (error) {
    console.error("generate-image error:", error);

    return res.status(500).json({
      error: "이미지 생성 중 서버 오류가 발생했습니다."
    });
  }
}
