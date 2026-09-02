# 🎵 Vinyl Detective

A mobile-friendly vinyl identification app that combines:

- 📷 multi-photo vinyl scanning
- 🧠 AI image analysis / OCR
- 🔎 Discogs release matching
- 💿 pressing / variant identification
- 🧬 matrix / runout evidence
- 📦 documented pressing quantity handling
- 🎯 confidence scoring
- 📚 local collection management
- 📤 JSON/CSV export + JSON import
- 📸 Instagram caption generation
- #️⃣ dynamically researched hashtag suggestions
- 🏷️ editable Instagram handles
- 📱 PWA install support

## Important

This repository is **GitHub-ready**, but live AI and Discogs access require your own API credentials in `.env`.

The app deliberately does **not** scrape Discogs pages. It uses the Discogs API from the server and keeps the token out of the browser.

Discogs attribution required by its API terms is built into the UI. Review the current Discogs API Terms before deployment.

## Run locally

```bash
npm install
cp .env.example .env
# edit .env
npm start
```

Open `http://localhost:3000`.

## Environment

- `OPENAI_API_KEY` – image analysis and optional hashtag research
- `OPENAI_VISION_MODEL` – vision-capable model available to your OpenAI project
- `DISCOGS_TOKEN` – Discogs API token
- `DISCOGS_USER_AGENT` – descriptive HTTP User-Agent

## How identification works

1. User uploads up to six photos.
2. Vision extracts observable evidence: artist, title, catalog number, barcode, label, matrix/runout, color, format, country, year and notes.
3. The backend searches Discogs using the strongest identifiers.
4. Candidate releases are fetched and scored.
5. Matrix/catalog/barcode/label/format/color/country/year evidence is compared.
6. The app returns the best candidate plus alternatives.
7. Pressing quantity is only reported when explicitly documented; Discogs collection counts are never treated as the number pressed.
8. The Instagram tab creates a caption in the configured collector style.

## GitHub

```bash
git init
git add .
git commit -m "Initial Vinyl Detective app"
git branch -M main
git remote add origin https://github.com/YOUR_USER/vinyl-detective.git
git push -u origin main
```

Never commit `.env`.

## Deployment

Any Node 20+ host that supports environment variables can run the server. For a production deployment add HTTPS, authentication/rate limiting, persistent storage, image retention/deletion rules and monitoring.

## Discogs compliance

Discogs requires a prominent non-affiliation notice and "Data provided by Discogs" next to API-derived data with a link to the relevant Discogs page. The app includes the notice and release links. Do not imply endorsement by Discogs.

See:
- https://support.discogs.com/hc/de/articles/360009334593-API-Nutzungsbedingungen
- https://support.discogs.com/hc/de/articles/360005055493-Datenbank-Richtlinien-16-Master-Release


## Instagram output policy

Instagram functionality is **text-only**:
- generates a copy-ready caption
- keeps the user's exact separator/asterisk structure
- generates relevant hashtags
- optionally researches current hashtag/topic signals
- allows manual artist/label handles
- provides a one-click copy action
- does NOT generate Instagram images
- does NOT publish or post to Instagram
