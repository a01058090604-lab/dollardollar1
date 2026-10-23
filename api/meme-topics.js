import { requireAdmin } from "./_admin-auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  // 기존 관리자 로그인 유지
  if (!requireAdmin(req, res)) return;

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GROQ_API_KEY 환경변수를 설정해 주세요."
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

    const theme =
      typeof body?.theme === "string"
        ? body.theme.trim().slice(0, 100)
        : "";

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model:"openai/gpt-oss-120b",
          temperature: 0.9,
          max_completion_tokens: 1600,
          response_format: {
            type: "json_object"
          },
          messages: [
            {
              role: "system",
              content:
                "너는 한국 SNS 밈 콘텐츠 기획자다. 친구를 태그하고 싶어지는 현실적인 일상 유머를 만든다. 가짜 뉴스, 혐오 표현, 특정 개인 공격은 만들지 않는다. 반드시 유효한 JSON 객체로만 응답한다."
            },
            {
              role: "user",
              content: `한국어 밈 아이디어 6개를 만들어 줘.

주제: ${
                theme || "친구를 태그하고 싶은 일상 공감 밈"
              }

각 아이디어는 짧고 재치 있게 만들어 줘.
실제 SNS 게시물로 활용할 수 있어야 해.

반드시 다음 JSON 형식으로 출력해:
{
  "topics": [
    {
      "title": "짧은 제목",
      "description": "밈 상황 설명 한 문장",
      "caption": "SNS에 올릴 문구",
      "hashtags": ["해시태그1", "해시태그2"]
    }
  ]
}`
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Groq API error:",
        data?.error?.message || response.status
      );

      return res.status(502).json({
        error:
          "Groq 요청에 실패했습니다. API 키, 모델, 사용 한도를 확인해 주세요."
      });
    }

    const content =
      data?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      return res.status(502).json({
        error: "Groq에서 비어 있는 응답을 받았습니다."
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(502).json({
        error: "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요."
      });
    }

    const topics = Array.isArray(parsed.topics)
      ? parsed.topics.slice(0, 6).map((item, index) => ({
          id: String(index + 1),
          title: String(item.title || "밈 아이디어")
            .slice(0, 100),
          description: String(item.description || "")
            .slice(0, 300),
          caption: String(item.caption || "")
            .slice(0, 500),
          hashtags: Array.isArray(item.hashtags)
            ? item.hashtags
                .slice(0, 8)
                .map(tag =>
                  String(tag)
                    .replace(/^#/, "")
                    .replace(/[^\p{L}\p{N}_]/gu, "")
                    .slice(0, 30)
                )
                .filter(Boolean)
            : []
        }))
      : [];

    return res.status(200).json({ topics });
  } catch (error) {
    console.error("meme-topics error:", error);

    return res.status(500).json({
      error: "밈 아이디어 생성 중 서버 오류가 발생했습니다."
    });
  }
}
