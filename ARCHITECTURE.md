# Architecture

Browser/PWA
  |
  | multipart images
  v
Express backend
  |
  +--> OpenAI Responses API (vision)
  |
  +--> Discogs API search + release lookup
  |
  +--> OpenAI Responses API + web search (optional hashtag research)
  |
  v
Structured identification result
  |
  +--> Collection (browser localStorage in V1)
  +--> Instagram caption
  +--> JSON/CSV export

## Evidence hierarchy

matrix/runout > catalog number > barcode > label > country > year > format > variant/color > artwork

A result can be "likely" without being "verified". The UI separates confidence from verified fields.

## Pressing quantity

Never infer "copies pressed" from:
- Discogs "in collection"
- Discogs wantlist counts
- marketplace inventory
- popularity

Only accept an actual pressing quantity when explicitly documented by a reliable source / release note / numbered edition evidence. Otherwise return null / "not verified".

## Future production upgrades

- Postgres/Supabase
- user authentication
- cloud collection
- background job queue
- image retention policy
- barcode decoder
- dedicated matrix OCR / image enhancement
- exact Instagram profile lookup/verification
- richer analytics and rarity score
