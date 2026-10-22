import { requireAdmin } from "./_admin-auth.js";

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    )
    .trim();
}

function getTag(xml, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<${escaped}\\b[^>]*>([\\s\\S]*?)</${escaped}>`,
    "i"
  );
  const match = xml.match(regex);
  return match ? decodeXml(match[1]) : "";
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    const rawQuery =
      typeof req.body?.query === "string"
        ? req.body.query.trim()
        : "";

    const query = (rawQuery || "대한민국 주요 뉴스").slice(0, 80);

    const url = new URL("https://news.google.com/rss/search");
    url.searchParams.set("q", `${query} when:7d`);
    url.searchParams.set("hl", "ko");
    url.searchParams.set("gl", "KR");
    url.searchParams.set("ceid", "KR:ko");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "DollarDollarStudio/1.0"
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "뉴스 제공처에 연결하지 못했어요."
      });
    }

    const xml = await response.text();
    const matches = [
      ...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)
    ];

    const items = matches.slice(0, 12).map(match => {
      const block = match[1];

      return {
        title: getTag(block, "title"),
        link: getTag(block, "link"),
        pubDate: getTag(block, "pubDate"),
        source: getTag(block, "source") || "Google News"
      };
    }).filter(item => {
      if (!item.title || !item.link) return false;

      try {
        const parsedUrl = new URL(item.link);
        return parsedUrl.protocol === "https:" ||
               parsedUrl.protocol === "http:";
      } catch {
        return false;
      }
    });

    return res.status(200).json({
      query,
      items,
      notice:
        "검색 결과는 실제 뉴스 RSS에서 가져왔습니다. " +
        "기사의 세부 내용과 정확한 발행 시각은 원문에서 확인하세요."
    });
  } catch (error) {
    console.error("News RSS error:", error.message);
    return res.status(500).json({
      error: "뉴스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
    });
  }
}
