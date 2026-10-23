import { requireAdmin } from "./_admin-auth.js";

const SOURCES = [
  {
    name: "커뮤랭크",
    url: "https://commurank.kr/?period=daily"
  },
  {
    name: "커뮤랭크 급상승",
    url: "https://commurank.kr/"
  }
];

function decodeHtml(value = "") {
  return value
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

function stripTags(value = "") {
  return decodeHtml(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  );
}

function extractPosts(html, sourceUrl) {
  const posts = [];
  const seen = new Set();

  /*
   * 페이지 HTML에서 게시글로 연결되는 링크를 추출합니다.
   * 실제 게시글 링크만 통과시키고, 출처 사이트 링크는 제외합니다.
   */
  const linkPattern =
    /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = decodeHtml(match[2]);
    const title = stripTags(match[4]);

    if (!title || title.length < 5 || title.length > 200) {
      continue;
    }

    let url;

    try {
      url = new URL(href, sourceUrl);
    } catch {
      continue;
    }

    if (url.protocol !== "https:") continue;

    if (
      url.hostname !== "commurank.kr" &&
      !url.hostname.endsWith(".commurank.kr")
    ) {
      continue;
    }

    if (
      url.pathname === "/" ||
      /about|editorial|sitemap|briefing|policy|terms/i.test(url.pathname)
    ) {
      continue;
    }

    const key = url.href;

    if (seen.has(key)) continue;
    seen.add(key);

    posts.push({
      title,
      community: "커뮤랭크",
      url: url.href,
      metrics: "",
      updatedAt: ""
    });

    if (posts.length >= 30) break;
  }

  return posts;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (!requireAdmin(req, res)) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      error: "GET 요청만 허용됩니다."
    });
  }

  try {
    let posts = [];
    let lastError = null;

    for (const source of SOURCES) {
      try {
        const response = await fetch(source.url, {
          method: "GET",
          headers: {
            "User-Agent": "DollarDollarStudio/1.0",
            "Accept": "text/html"
          },
          signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) {
          throw new Error(
            source.name + " 응답 오류: HTTP " + response.status
          );
        }

        const html = await response.text();
        const found = extractPosts(html, source.url);

        posts.push(...found);
      } catch (error) {
        lastError = error;
      }
    }

    const uniquePosts = [];
    const seenTitles = new Set();

    for (const post of posts) {
      const key = post.title.toLowerCase();

      if (seenTitles.has(key)) continue;

      seenTitles.add(key);
      uniquePosts.push(post);
    }

    if (!uniquePosts.length) {
      return res.status(502).json({
        error:
          "커뮤니티 데이터가 확인되지 않았습니다. " +
          "원본 서비스의 HTML 구조나 수집 상태를 확인해야 합니다.",
        source: "https://commurank.kr/",
        detail: lastError ? lastError.message : undefined,
        posts: []
      });
    }

    return res.status(200).json({
      source: "https://commurank.kr/",
      updatedAt: new Date().toISOString(),
      posts: uniquePosts.slice(0, 30)
    });
  } catch (error) {
    return res.status(500).json({
      error: "커뮤니티 데이터를 처리하지 못했습니다."
    });
  }
}
