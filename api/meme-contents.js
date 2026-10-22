
import { createHmac, timingSafeEqual } from "node:crypto";

function authorized(req, secret) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)dd_admin=([0-9]+\.[a-f0-9]{64})(?:;|$)/);

  if (match) {
    const [expiresText, signature] = match[1].split(".");
    const expires = Number(expiresText);
    const expectedSignature = createHmac("sha256", secret)
      .update(expiresText)
      .digest("hex");

    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSignature);

    if (
      Number.isSafeInteger(expires) &&
      expires > Math.floor(Date.now() / 1000) &&
      a.length === b.length &&
      timingSafeEqual(a, b)
    ) return true;
  }

  const token = req.headers["x-admin-token"];
  const a = typeof token === "string" ? Buffer.from(token) : Buffer.alloc(0);
  const b = Buffer.from(secret);

  return a.length === b.length && timingSafeEqual(a, b);
}

function parseBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body);
  return req.body || {};
}

function validId(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const methods = ["GET", "POST", "PATCH", "DELETE"];

  if (!methods.includes(req.method)) {
    res.setHeader("Allow", methods.join(", "));
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.ADMIN_TOKEN;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!secret || !url || !key) {
    return res.status(500).json({ error: "Server configuration is incomplete" });
  }

  if (!authorized(req, secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let body;
  try {
    body = parseBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const endpoint = `${url.replace(/\/+$/, "")}/rest/v1/meme_contents`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  try {
    if (req.method === "GET") {
      const response = await fetch(
        `${endpoint}?select=*&order=created_at.desc`,
        { headers }
      );

      if (!response.ok) {
        return res.status(502).json({ error: "Failed to load contents" });
      }

      return res.status(200).json({ items: await response.json() });
    }

    if (req.method === "POST") {
      if (
        typeof body.title !== "string" || !body.title.trim() ||
        typeof body.source_url !== "string" || !body.source_url.trim()
      ) {
        return res.status(400).json({
          error: "title and source_url are required"
        });
      }

      let source;
      try {
        source = new URL(body.source_url);
        if (!["http:", "https:"].includes(source.protocol)) throw new Error();
      } catch {
        return res.status(400).json({ error: "Invalid source URL" });
      }

      for (const field of ["rights_evidence_url"]) {
        if (body[field]) {
          try {
            const evidence = new URL(body[field]);
            if (!["http:", "https:"].includes(evidence.protocol)) throw new Error();
          } catch {
            return res.status(400).json({ error: "Invalid evidence URL" });
          }
        }
      }

      let expiresAt = null;
      if (body.expires_at) {
        const date = new Date(body.expires_at);
        if (Number.isNaN(date.getTime())) {
          return res.status(400).json({ error: "Invalid expiration date" });
        }
        expiresAt = date.toISOString();
      }

      const item = {
        title: body.title.trim().slice(0, 200),
        source_url: source.href,
        license_type: typeof body.license_type === "string" ? body.license_type.trim().slice(0, 200) || null : null,
        rights_evidence_url: typeof body.rights_evidence_url === "string" ? body.rights_evidence_url.trim() || null : null,
        rights_evidence_notes: typeof body.rights_evidence_notes === "string" ? body.rights_evidence_notes.trim().slice(0, 3000) || null : null,
        review_status: "pending",
        review_reason: "권리 증빙 검토 필요",
        rights_checked_at: null,
        approved_by: null,
        approved_at: null,
        expires_at: expiresAt
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(item)
      });

      if (!response.ok) {
        return res.status(502).json({ error: "Failed to save contents" });
      }

      return res.status(201).json({ items: await response.json() });
    }

    if (!validId(body.id)) {
      return res.status(400).json({ error: "A valid content id is required" });
    }

    if (req.method === "PATCH") {
      const allowed = ["approve", "hold"];
      if (!allowed.includes(body.action)) {
        return res.status(400).json({ error: "Unsupported action" });
      }

      const lookup = await fetch(
        `${endpoint}?id=eq.${encodeURIComponent(body.id)}&select=id,title,license_type,rights_evidence_url,rights_evidence_notes,expires_at`,
        { headers }
      );

      if (!lookup.ok) {
        return res.status(502).json({ error: "Failed to check content" });
      }

      const rows = await lookup.json();
      const item = rows[0];

      if (!item) return res.status(404).json({ error: "Content not found" });

      if (body.action === "approve") {
        if (
          !item.license_type ||
          !item.rights_evidence_url ||
          !item.rights_evidence_notes
        ) {
          return res.status(409).json({
            error: "License type, evidence URL and evidence notes are required before approval"
          });
        }

        if (item.expires_at && new Date(item.expires_at).getTime() <= Date.now()) {
          return res.status(409).json({ error: "Expired content cannot be approved" });
        }

        const response = await fetch(
          `${endpoint}?id=eq.${encodeURIComponent(body.id)}`,
          {
            method: "PATCH",
            headers: { ...headers, Prefer: "return=representation" },
            body: JSON.stringify({
              review_status: "approved",
              review_reason: "증빙 정보 입력 완료. 실제 권리 확인은 별도로 필요",
              approved_by: "admin",
              approved_at: new Date().toISOString()
            })
          }
        );

        if (!response.ok) {
          return res.status(502).json({ error: "Failed to update status" });
        }

        return res.status(200).json({ items: await response.json() });
      }

      const response = await fetch(
        `${endpoint}?id=eq.${encodeURIComponent(body.id)}`,
        {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify({
            review_status: "hold",
            review_reason: typeof body.reason === "string"
              ? body.reason.trim().slice(0, 1000) || "관리자 보류"
              : "관리자 보류",
            approved_by: null,
            approved_at: null
          })
        }
      );

      if (!response.ok) {
        return res.status(502).json({ error: "Failed to update status" });
      }

      return res.status(200).json({ items: await response.json() });
    }

    const deleted = await fetch(
      `${endpoint}?id=eq.${encodeURIComponent(body.id)}`,
      {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=representation" }
      }
    );

    if (!deleted.ok) {
      return res.status(502).json({ error: "Failed to delete content" });
    }

    return res.status(200).json({
      items: await deleted.json()
    });
  } catch {
    return res.status(502).json({ error: "Database request failed" });
  }
}
