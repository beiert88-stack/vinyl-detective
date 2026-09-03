# Vinyl Detective 2.0

Bunte statische GitHub-Pages-App.

## Enthalten
- Multi-Foto-Auswahl und Vorschau
- lokale OCR mit Tesseract.js
- optionaler lokaler KI-Modus über Ollama
- Vinyl-Felder inkl. Matrix/Runout und Pressungsmenge nur als manuelles, belegbares Feld
- Discogs-Websuche
- Sammlung mit Duplikat-Warnung
- JSON/CSV Export und JSON Import
- Instagram-Caption-Generator
- PWA-Grundgerüst

## Lokale KI
Die App kann, wenn Ollama auf dem eigenen Rechner läuft, dessen lokale API verwenden. Standardmodell ist `qwen3-vl:4b`.
Die App funktioniert auch ohne Ollama.

Wichtig: Diese statische Version gibt keine unbelegten Pressungszahlen als Fakten aus und erfindet keine Matrix-Zeichen.
