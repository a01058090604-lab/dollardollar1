
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
          model: "openai/gpt-oss-120b",
          temperature: 0.9,
          max_completion_tokens: 2500,
          response_format: {
            type: "json_object"
          },
          messages: [
            {
              role: "system",
              content: `너는 한국 인터넷 커뮤니티 감성을 이해하는 인스타그램 밈 콘텐츠 기획자다.

목표는 사람들이 웃고, 놀라고, 공감하고, 댓글을 달고, 친구에게 공유하고 싶어지는 독창적인 콘텐츠를 만드는 것이다.

콘텐츠 유형을 골고루 섞어 정확히 6개를 만들어라.

1. 웃긴 썰과 황당한 상황
직장, 학교, 가족, 친구, 연애에서 벌어질 법한 어이없는 상황과 반전.

2. 의견이 갈리는 주제
음식 취향, 소비 습관, 인간관계, 연애 방식, 직장 문화 등 실제로 다양한 의견이 나올 주제.

3. 신기하고 의외인 이야기
일상에서 발견하는 특이한 상황이나 의외의 정보. 사실을 지어내지 말 것.

4. 인터넷 밈과 관찰형 유머
친구들 사이에서 꼭 한 명은 하는 행동, 현실과 이상의 차이, 과장된 상황과 재치 있는 표현.

5. 커뮤니티식 질문과 상황극
사람들이 자기 경험과 의견을 이야기하고 싶어지는 구체적인 상황.

6. 공유하고 싶은 공감 콘텐츠
혼자만 겪는 줄 알았던 일, 예상 밖의 현실, 웃픈 상황 등.

작성 규칙:
- 반드시 서로 다른 소재의 콘텐츠 6개를 생성한다.
- 제목은 짧고 호기심을 유발하게 작성한다.
- 설명은 실제 콘텐츠로 발전시킬 수 있을 만큼 구체적으로 작성한다.
- 게시 문구는 댓글이나 친구 공유를 자연스럽게 유도한다.
- 뻔한 일상 공감 문구만 반복하지 않는다.
- 한국 인터넷에서 자연스럽게 쓰는 말투를 사용한다.
- 타인의 게시물을 그대로 복사하지 않는다.
- 허위 사실, 가짜 뉴스, 실명 폭로, 혐오 및 괴롭힘 콘텐츠를 만들지 않는다.
- 실제 커뮤니티를 확인하지 않았다면 현재 인기글이나 실시간 화제라고 주장하지 않는다.
- 해시태그는 관련된 한국어 중심으로 3~6개 작성한다.
- 결과는 반드시 JSON 객체로만 출력한다.

출력 구조:
{
  "topics": [
    {
      "title": "콘텐츠 제목",
      "description": "구체적인 상황과 핵심 내용",
      "caption": "SNS 게시 문구",
      "hashtags": ["해시태그1", "해시태그2", "해시태그3"]
    }
  ]
}`
            },
            {
              role: "user",
              content: `한국 인터넷 이용자가 흥미를 느낄 만한 독창적인 SNS 밈 콘텐츠 6개를 만들어 줘.

관심 주제:
${
  theme ||
  "웃긴 썰, 황당한 상황, 반전, 의견 대립, 신기한 이야기, 인터넷 밈, 현실 공감"
}

각 콘텐츠는 서로 다른 소재를 사용해라.
제목과 설명은 구체적으로 작성하고, 게시 문구는 댓글과 공유를 유도해라.

반드시 다음 JSON 구조를 지켜라.
{
  "topics": [
    {
      "title": "",
      "description": "",
      "caption": "",
      "hashtags": []
    }
  ]
}

topics 배열에는 정확히 6개를 넣어라.`
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
          "AI 요청에 실패했습니다. API 키, 모델 또는 사용 한도를 확인해 주세요."
      });
    }

    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      return res.status(502).json({
        error: "AI에서 빈 응답을 받았습니다."
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Groq returned invalid JSON");

      return res.status(502).json({
        error: "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요."
      });
    }

    if (!Array.isArray(parsed.topics)) {
      return res.status(502).json({
        error: "AI 응답에 topics 목록이 없습니다."
      });
    }

    if (parsed.topics.length < 6) {
      return res.status(502).json({
        error: "AI가 콘텐츠 6개를 생성하지 못했습니다. 다시 시도해 주세요."
      });
    }

    const topics = parsed.topics.slice(0, 6).map((item, index) => ({
      id: String(index + 1),

      title: String(item?.title || "콘텐츠 아이디어")
        .slice(0, 100),

      description: String(item?.description || "")
        .slice(0, 500),

      caption: String(item?.caption || "")
        .slice(0, 700),

      hashtags: Array.isArray(item?.hashtags)
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
    }));

    return res.status(200).json({ topics });
  } catch (error) {
    console.error("meme-topics error:", error);

    return res.status(500).json({
      error: "밈 아이디어 생성 중 서버 오류가 발생했습니다."
    });
  }
}
