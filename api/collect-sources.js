
import { createHmac, timingSafeEqual } from "node:crypto";

function isAdmin(req) {
  const secret = process.env.ADMIN_TOKEN;
  const cookie = req.headers.cookie || "";

  if (!secret) return false;

  const match = cookie.match(
    /(?:^|;\s*)dd_admin=([0-9]+\.[a-f0-9]{64})(?:;|$)/
  );

  if (!match) return false;

  const [expiresText, signature] = match[1].split(".");
  const expected = createHmac("sha256", secret)
    .update(expiresText)
    .digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  return (
    Number(expiresText) > Math.floor(Date.now() / 1000) &&
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

function clean(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "GET 요청만 허용됩니다."
    });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({
      error: "관리자 로그인이 필요합니다."
    });
  }

  const q = typeof req.query?.q === "string"
    ? req.query.q.trim().slice(0, 100)
    : "";

  if (q.length < 2) {
    return res.status(400).json({
      error: "검색어를 두 글자 이상 입력해 주세요."
    });
  }

  const endpoint = new URL(
    "https://commons.wikimedia.org/w/api.php"
  );

  endpoint.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: q,
    gsrlimit: "15",
    prop: "imageinfo",
    iiprop: "url|mime|mediatype|extmetadata",
    iiextmetadatalanguage: "en"
  }).toString();

  try {
    const response = await fetch(endpoint, {
      headers: {
        "User-Agent": "DollarDollarContentAdmin/1.0"
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "이미지 검색 서비스에 연결하지 못했습니다."
      });
    }

    const data = await response.json();
    const pages = Object.values(data.query?.pages || {});

    const candidates = pages.map((page) => {
      const info = page.imageinfo?.[0];
      if (!info) return null;

      const meta = info.extmetadata || {};
      const license = clean(
        meta.LicenseShortName?.value ||
        meta.License?.value
      );

      const licenseUrl = clean(meta.LicenseUrl?.value);
      const mediaType = info.mediatype || "";
      const mime = info.mime || "";

      const licenseCandidate =
        /^(CC0|Public domain|CC BY(?:-[A-Z]+)?(?: [0-9.]+)?|CC BY-SA(?:-[A-Z]+)?(?: [0-9.]+)?)$/i
          .test(license) &&
        Boolean(licenseUrl) &&
        (mediaType === "BITMAP" ||
          mediaType === "DRAWING" ||
          mime.startsWith("image/"));

      return {
        title: page.title || "",
        source_url: info.descriptionurl || "",
        media_url: info.url || "",
        license_type: license,
        license_url: licenseUrl,
        author: clean(
          meta.Artist?.value || meta.Credit?.value
        ),
        description: clean(
          meta.ImageDescription?.value
        ),
        license_candidate: licenseCandidate,
        review_status: "pending"
      };
    }).filter((item) => item?.source_url && item?.media_url);

    return res.status(200).json({
      source: "Wikimedia Commons",
      query: q,
      candidates,
      note:
        "검색 결과는 후보입니다. 원본 페이지와 라이선스 조건을 직접 확인하고 권리 승인 전에는 게시하지 마세요."
    });
  } catch {
    return res.status(502).json({
      error: "검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
    });
  }
}
