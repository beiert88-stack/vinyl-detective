require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20mb" }));

// Die App liegt im Ordner public
app.use(express.static(path.join(__dirname, "public")));

/*
 * Discogs API
 *
 * Die Suche bekommt Matrix/Runout A und B.
 * Wir verwenden die Angaben exakt so, wie sie eingegeben wurden.
 * Es werden keine Zeichen ergänzt oder verändert.
 */
app.post("/api/search", async (req, res) => {
  try {
    const { matrixA = "", matrixB = "" } = req.body || {};

    const a = String(matrixA).trim();
    const b = String(matrixB).trim();

    if (!a && !b) {
      return res.status(400).json({
        error: "Bitte Runout A oder Runout B eingeben."
      });
    }

    const token = process.env.DISCOGS_TOKEN;

    if (!token) {
      return res.status(500).json({
        error: "DISCOGS_TOKEN fehlt in der .env-Datei."
      });
    }

    const userAgent =
      process.env.DISCOGS_USER_AGENT ||
      "VinylDetective/1.0";

    /*
     * Wir suchen zunächst mit den vorhandenen Matrix-Angaben.
     *
     * Wichtig:
     * Discogs entscheidet, welche Releases zur Suchanfrage passen.
     * Deshalb behandeln wir die Ergebnisse zunächst als KANDIDATEN
     * und behaupten nicht automatisch, dass ein Treffer die exakte
     * Pressung ist.
     */
    const searchTerms = [];

    if (a) searchTerms.push(a);
    if (b) searchTerms.push(b);

    const candidates = new Map();

    for (const term of searchTerms) {
      const url =
        "https://api.discogs.com/database/search?" +
        new URLSearchParams({
          q: term,
          type: "release",
          per_page: "10"
        }).toString();

      const response = await fetch(url, {
        headers: {
          "Authorization": `Discogs token=${token}`,
          "User-Agent": userAgent,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        const text = await response.text();

        return res.status(response.status).json({
          error: "Discogs-Suche fehlgeschlagen.",
          details: text
        });
      }

      const data = await response.json();

      for (const item of data.results || []) {
        if (!item.id) continue;

        if (!candidates.has(item.id)) {
          candidates.set(item.id, {
            id: item.id,
            title: item.title || "",
            country: item.country || "",
            year: item.year || "",
            format: Array.isArray(item.format)
              ? item.format.join(", ")
              : item.format || "",
            label: Array.isArray(item.label)
              ? item.label.join(", ")
              : item.label || "",
            catalogNumber: Array.isArray(item.catno)
              ? item.catno.join(", ")
              : item.catno || "",
            resourceUrl:
              item.resource_url ||
              `https://www.discogs.com/release/${item.id}`,
            score: 0
          });
        }

        /*
         * Ein Release, das sowohl über A als auch B gefunden wurde,
         * bekommt einen höheren Kandidaten-Score.
         */
        candidates.get(item.id).score += 1;
      }
    }

    /*
     * Höchstens drei Kandidaten zurückgeben.
     */
    const results = Array.from(candidates.values())
      .sort((x, y) => y.score - x.score)
      .slice(0, 3)
      .map(item => ({
        releaseId: item.id,
        title: item.title,
        country: item.country,
        year: item.year,
        format: item.format,
        label: item.label,
        catalogNumber: item.catalogNumber,
        url: item.resourceUrl,

        /*
         * Noch KEIN echter Confidence Score.
         * Wir wollen nicht so tun, als wäre eine normale
         * Discogs-Suche bereits eine sichere Pressungsidentifikation.
         */
        confidence:
          item.score >= 2
            ? "Kandidat – A und B gefunden"
            : "Kandidat – nur eine Matrixangabe gefunden"
      }));

    res.json({
      results,
      searched: {
        matrixA: a,
        matrixB: b
      }
    });

  } catch (error) {
    console.error("Discogs error:", error);

    res.status(500).json({
      error: "Fehler bei der Discogs-Suche.",
      details: error.message
    });
  }
});


/*
 * Frontend ausliefern
 */
app.get("/{*splat}", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});


app.listen(PORT, () => {
  console.log(`Vinyl Detective on ${PORT}`);
});
