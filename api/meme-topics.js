import { requireAdmin } from "./_admin-auth.js";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY 환경변수를 확인해 주세요."
    });
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5.5",
          instructions: [
            "너는 한국 인스타그램 밈 콘텐츠 기획자다.",
            "친구에게 공유하거나 친구를 태그하고 싶은 재미있는 주제를 만든다.",
            "일상 공감, 학교, 직장, 친구 관계, 답장, 약속, 월급, 주말 등을 활용한다.",
            "억지 유행어보다 자연스럽고 짧은 한국어를 사용한다.",
            "뉴스, 통계, 실제 사건을 지어내지 않는다.",
            "혐오, 괴롭힘, 개인 비방은 피한다.",
            "반드시 JSON 객체만 출력한다."
          ].join(" "),
          input: [
            {
              role: "user",
              content:
                "서로 다른 주제 6개를 생성해. " +
                '형식: {"topics":[{"category":"분류",' +
                '"title":"짧은 제목","desc":"공감 상황 설명",' +
                '"caption":"게시물 본문"}]}. ' +
                "친구를 태그하고 싶어지는 가벼운 주제로 만들어."
            }
          ],
          text: {
            format: { type: "json_object" }
          },
          max_output_tokens: 1500,
          store: false
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data.error?.message);
      return res.status(502).json({
        error: "AI 주제 생성에 실패했어요. API 키와 사용량을 확인해 주세요."
      });
    }

    const output = (data.output || [])
      .flatMap(item => item.content || [])
      .find(item => item.type === "output_text")?.text;

    const parsed = JSON.parse(output || "{}");

    const topics = (Array.isArray(parsed.topics) ? parsed.topics : [])
      .filter(item =>
        item &&
        typeof item.title === "string" &&
        typeof item.desc === "string"
      )
      .slice(0, 6)
      .map(item => ({
        category: String(item.category || "재미 · 공감").slice(0, 30),
        title: String(item.title).slice(0, 100),
        desc: String(item.desc).slice(0, 180),
        caption: String(item.caption || item.desc).slice(0, 500)
      }));

    return res.status(200).json({ topics });
  } catch (error) {
    console.error("Meme topic error:", error.message);
    return res.status(500).json({
      error: "주제를 만들지 못했어요. 잠시 후 다시 시도해 주세요."
    });
  }
}
