export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    return res.status(500).json({
      error: "Supabase environment variables are missing",
    });
  }

  try {
    const baseUrl = url.replace(/\/+$/, "");
    const endpoint = `${baseUrl}/rest/v1/meme_contents`;

    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (req.method === "GET") {
      const response = await fetch(
        `${endpoint}?select=*&order=created_at.desc`,
        { headers }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: "Failed to load contents",
          details: data,
        });
      }

      return res.status(200).json({ items: data });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    if (
      !body ||
      typeof body.title !== "string" ||
      !body.title.trim() ||
      typeof body.source_url !== "string" ||
      !body.source_url.trim()
    ) {
      return res.status(400).json({
        error: "title and source_url are required",
      });
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
      expires_at: body.expires_at || null,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "return=representation",
      },
      body: JSON.stringify(item),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to save content",
        details: data,
      });
    }

    return res.status(201).json({ items: data });
  } catch {
    return res.status(500).json({
      error: "Server error while contacting Supabase",
    });
  }
}
