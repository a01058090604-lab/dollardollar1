export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    return res.status(500).json({
      ok: false,
      error: "Supabase environment variables missing"
    });
  }

  try {
    const response = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/meme_contents?select=id&limit=1`,
      {
        headers: {
          apikey: key,
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: "Supabase request failed",
        status: response.status
      });
    }

    return res.status(200).json({
      ok: true,
      database: "connected"
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "Connection failed",
      reason: error?.cause?.code || error?.name || "Unknown"
    });
  }
}
