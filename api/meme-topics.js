
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
              content: `너는 한국 인터넷 이용자가 흥미를 느낄 만한 사건형 인스타그램 콘텐츠를 기획하는 에디터다.

목표:
제목만 읽어도 누가, 무슨 일을 겪었는지, 왜 그런 일이 생겼는지 또는 어떤 결과가 나왔는지 이해할 수 있는 콘텐츠를 만들어라.
단순한 밈이나 추상적인 주제 대신, 구체적인 사건을 중심으로 제목을 작성한다.

서로 다른 소재의 콘텐츠를 정확히 6개 만들어라.

주요 소재:
1. 황당한 사건과 예상 밖의 행동
2. 일상에서 벌어진 특이한 실수
3. 원인과 결과가 분명한 사건
4. 뜻밖의 반전이나 놀라운 결말
5. 구조, 분실, 착각 등 구체적인 상황
6. 주변 사람들의 반응을 부르는 특이한 사례

[제목 작성 규칙]

- 기본 구조는 '누가 + 무슨 일을 겪었는지 + 결과'다.
- 제목만 읽어도 사건의 핵심을 이해할 수 있어야 한다.
- 가능하면 사건이 벌어진 이유를 제목에 명확히 포함한다.
- 이유가 확인되지 않았다면 이유를 임의로 만들어 내지 않는다.
- 이유를 알 수 없다면 실제로 확인된 행동이나 결과를 제목에 포함한다.
- '충격적인 사건', '모두가 놀랐다', '황당한 일이 벌어졌다'처럼 핵심 내용을 숨기는 제목은 금지한다.
- 구체적인 인물의 행동, 사건의 원인, 결과 중 최소 두 가지가 제목에 드러나도록 한다.
- 제목은 자연스러운 한국어로 작성하며 지나치게 길게 늘이지 않는다.
- 같은 문장 구조와 소재를 반복하지 않는다.

[제목 예시]

좋은 형식:
- 엘리베이터에 갇힌 남성, 구조를 기다리며 노래를 불러 버텨
- 우산을 두고 나온 직장인, 비를 피하려다 번개 맞아
- 택배를 못 받은 주민, 상자에 적힌 주소를 화성으로 적어

위 예시들은 제목 형식을 보여 주기 위한 예시이며 실제 사건이라고 주장하지 않는다.

[사실성 규칙]

- 너에게 실시간 검색 기능이 주어지지 않았다면 실제 사건이나 최신 뉴스라고 주장하지 않는다.
- 실제 사건이라고 확인할 수 있는 출처가 없다면 창작 상황 또는 아이디어임을 description에 명확히 표시한다.
- 창작한 사건을 실제 뉴스처럼 꾸며 사실인 것처럼 속이지 않는다.
- 실제 사건의 원인, 인명 피해, 범죄, 구조 상황 등을 근거 없이 만들어 내지 않는다.
- 실제 인물의 실명 폭로, 허위 사실, 혐오 및 괴롭힘 콘텐츠를 생성하지 않는다.
- 실제 사건과 창작 상황을 설명에서 명확히 구분한다.

[설명 작성 규칙]

- description에는 사건이 어떻게 진행되는지 구체적으로 쓴다.
- 원인이 확인된 내용인지, 창작한 설정인지 명확하게 밝힌다.
- 이미지 제작에 활용할 수 있도록 인물의 행동, 장소, 상황을 구체적으로 설명한다.
- 설명은 2~4문장 정도로 작성한다.
- 창작 상황이라면 '창작 상황입니다'라는 취지를 명시한다.

[게시 문구 및 해시태그]

- caption은 사건에 대한 의견이나 경험을 댓글로 나누도록 자연스럽게 유도한다.
- 해시태그는 한국어 중심으로 3~6개 작성한다.
- 다른 사람의 게시물을 그대로 복사하지 않는다.
- 선정적인 표현만으로 관심을 유도하지 않는다.

[출력 규칙]

반드시 JSON 객체로만 출력한다.
설명이나 마크다운을 JSON 바깥에 추가하지 않는다.

출력 구조:
{
  "topics": [
    {
      "title": "사건과 이유 또는 결과가 드러나는 제목",
      "description": "구체적인 사건 전개와 사실 확인 상태",
      "caption": "SNS 게시 문구",
      "hashtags": [
        "해시태그1",
        "해시태그2",
        "해시태그3"
      ]
    }
  ]
}

topics 배열에는 서로 다른 콘텐츠를 정확히 6개 넣어라.`
            },
            {
              role: "user",
              content: `한국 인터넷 이용자가 흥미를 느낄 만한 사건형 SNS 콘텐츠 6개를 만들어 줘.

관심 주제:
${
  theme ||
  "황당한 사건, 특이한 행동, 뜻밖의 실수, 원인과 결과가 분명한 상황, 예상 밖의 반전, 주변 사람들의 반응"
}

각 콘텐츠는 서로 다른 사건을 소재로 사용해라.

제목 작성 시:
- 누가 무슨 일을 겪었는지 구체적으로 밝혀라.
- 확인된 이유 또는 결과를 제목에 넣어라.
- 이유가 확인되지 않았다면 지어내지 말고 확인된 행동이나 결과를 사용해라.
- 막연한 호기심 유발 문구로 사건의 핵심을 숨기지 마라.

설명에는 사건의 전개와 사실 확인 상태를 포함해라.
출처가 확인되지 않은 소재는 창작 상황임을 명시해라.
게시 문구는 댓글과 공유를 자연스럽게 유도해라.

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

      title: String(item?.title || "사건형 콘텐츠 아이디어")
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
