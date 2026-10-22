import { createHmac, timingSafeEqual } from "node:crypto";

function isAuthorized(req, secret) {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/(?:^|;\s*)dd_admin=([0-9]+\.[a-f0-9]{64})(?:;|$)/);

  if (match) {
    const [expiresText, signature] = match[1].split(".");
    const expires = Number(expiresText);

    if (Number.isSafeInteger(expires) && expires > Math.floor(Date.now() / 1000)) {
      const expectedSignature = createHmac("sha256", secret)
        .update(expiresText)
        .digest("hex");

      const supplied = Buffer.from(signature);
      const expected = Buffer.from(expectedSignature);

      if (
        supplied.length === expected.length &&
        timingSafeEqual(supplied, expected)
      ) {
        return true;
      }
    }
  }

  const suppliedToken = req.headers["x-admin-token"];
  const supplied = typeof suppliedToken === "string"
    ? Buffer.from(suppliedToken)
    : Buffer.alloc(0);
  const expected = Buffer.from(secret);

  return supplied.length === expected.length &&
    timingSafeEqual(supplied, expected);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    return res.status(500).json({
      error: "Admin authentication is not configured"
    });
  }

  if (!isAuthorized(req, adminToken)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "Supabase environment variables are missing"
    });
  }

  try {
    const endpoint =
      `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/meme_contents`;

    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    if (req.method === "GET") {
      const response = await fetch(
        `${endpoint}?select=*&order=created_at.desc`,
        { headers }
      );

      if (!response.ok) {
        return res.status(502).json({
          error: "Failed to load contents"
        });
      }

      return res.status(200).json({
        items: await response.json()
      });
    }

    let body = req.body;

    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    if (
      !body ||
      typeof body.title !== "string" ||
      !body.title.trim() ||
      typeof body.source_url !== "string" ||
      !body.source_url.trim()
    ) {
      return res.status(400).json({
        error: "title and source_url are required"
      });
    }

    let expiresAt = null;

    if (body.expires_at) {
      const date = new Date(body.expires_at);

      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({
          error: "Invalid expiration date"
        });
      }

      expiresAt = date.toISOString();
    }

    const item = {
      title: body.title.trim(),
      source_url: body.source_url.trim(),
      license_type: body.license_type || null,
      rights_evidence_url: body.rights_evidence_url || null,
      rights_evidence_notes: body.rights_evidence_notes || null,
      review_status: "pending",
      review_reason: null,
      rights_checked_at: null,
      approved_by: null,
      approved_at: null,
      expires_at: expiresAt
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "return=representation"
      },
      body: JSON.stringify(item)
    });

    if (!response.ok) {
      return res.status(502).json({
        error: "Failed to save contents"
      });
    }

    return res.status(201).json({
      items: await response.json()
    });
  } catch {
    return res.status(400).json({
      error: "Invalid request or database connection error"
    });
  }
}
