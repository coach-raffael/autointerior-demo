# Auto Interiore – Backend, Admin-API und MCP-Server

Das Backend für Website und Werkstatt-Admin. Es stellt außerdem einen **MCP-Server** bereit, über den Claude (oder ein anderer MCP-Client) die Werkstatt bedienen kann: Fotos in die Galerie stellen, Teile pflegen, Aufträge kalkulieren und einbuchen, Lieferanten bestellen und Social-Posts an Metricool geben.

```
Browser ──► /            Website + Admin (Vite-Build, VITE_API_URL=/api)
        ──► /api/*       REST-API (öffentlich: Galerie, Teile, Buchung · Admin: alles, Session-Cookie)
        ──► /media/*     Bilder (WebP 400/800/1600)
Claude  ──► /mcp         MCP, Streamable HTTP, Bearer-Token
        ──► /.well-known/oauth-*, /authorize, /token, /register, /oauth/consent   OAuth 2.1
```

## Starten (lokal)

```bash
cd server && npm install
npm run dev                         # API auf :8787, PGlite in ./data, Demo-Daten, Login owner@autointeriore.demo / werkstatt-demo
cd .. && VITE_API_URL=/api npm run dev   # Website/Admin auf :5173, Proxy auf die API
```

Für den Proxy-Betrieb `PUBLIC_URL=http://localhost:5173 WEB_ORIGIN=http://localhost:5173` setzen, dann laufen Website, API, Bilder und MCP unter einem Origin – wie in Produktion.

Tests: `npm test` (API, kompletter OAuth-Ablauf, MCP-Richtlinien und Freigaben gegen eine In-Memory-Datenbank).

## Produktion

`docker compose up -d --build` im Repo-Root (Postgres, API, Web, Caddy mit HTTPS). Variablen siehe `server/.env.example`; mindestens `DOMAIN`, `POSTGRES_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

- **Datenbank:** PostgreSQL über `DATABASE_URL`, Migrationen laufen beim Start (`drizzle/`). Ohne `DATABASE_URL` läuft PGlite im Prozess – gut für Demo und kleine Einzelinstanz.
- **Bilder:** Dateisystem unter `DATA_DIR/media` (Volume). Für mehrere Instanzen `MediaStore` gegen S3 tauschen (zwei Methoden).
- **E-Mail:** `SMTP_URL` für Bestellungen an Lieferanten. Ohne: WhatsApp-Link oder „von Hand gesendet“.
- **Metricool:** `METRICOOL_TOKEN`, `METRICOOL_USER_ID`, `METRICOOL_BLOG_ID`. Ohne: „Einplanen“ liefert den fertigen Request zurück, statt ihn zu senden. Den Endpunkt (`/api/v2/scheduler/posts`) vor dem Go-live gegen die Metricool-API-Doku prüfen.
- `PUBLIC_URL` muss in Produktion `https://` sein – sie ist OAuth-Issuer und MCP-Ressource.

## Claude verbinden

1. Admin → **AI access** → MCP-Adresse kopieren (`https://<domain>/mcp`).
2. In Claude als Custom Connector hinzufügen.
3. Claude öffnet die Zustimmungsseite: mit dem Owner-Konto anmelden, „Allow access“.

Getrennt wird unter **AI access → Disconnect**; alle Tokens des Clients sind sofort ungültig.

## Richtlinien und Freigaben

Jedes Tool hat eine Richtlinie, im Admin pro Tool änderbar (**AI access**):

| Modus | Wirkung |
|---|---|
| `ALLOW` | läuft sofort |
| `APPROVAL` | legt eine Freigabe an; Antwort `status: pending_approval` + Link. Läuft, sobald der Besitzer unter **Approvals** zustimmt |
| `DENY` | gesperrt, Claude bekommt eine klare Meldung |

Standard: Lesen immer erlaubt. Alles, was die öffentliche Website ändert, Nachrichten nach außen schickt (Bestellung senden, Post einplanen) oder Daten löscht, steht auf `APPROVAL`. Teile, die Claude anlegt, sind zunächst unsichtbar. Inline-Bilder werden schon beim Antrag gespeichert – die Freigabe zeigt eine Vorschau und speichert nur die Bild-ID.

## Tools (41)

Allgemein: `get_overview`, `list_catalog`, `get_approval`, `get_mcp_policy` ·
Website: `upload_image`, `list_gallery`, `create_gallery_item`, `update_gallery_item`, `delete_gallery_item`, `list_parts`, `create_part`, `update_part`, `publish_part`, `delete_part` ·
Werkstatt: `list_orders`, `get_order`, `create_order`, `set_order_status`, `set_order_note`, `calculate_quote`, `save_quote`, `list_calendar`, `create_calendar_entry`, `delete_calendar_entry`, `book_order` ·
Einkauf: `list_contacts`, `save_contact`, `delete_contact`, `list_purchase_orders`, `create_purchase_order`, `update_purchase_order`, `send_purchase_order`, `mark_purchase_order`, `delete_purchase_order` ·
Social: `list_posts`, `generate_post_drafts`, `create_post`, `update_post`, `approve_post`, `schedule_post`, `delete_post`

## Sicherheit

- Passwörter mit scrypt; Sessions, OAuth-Codes und Tokens nur als SHA-256-Hash in der DB.
- OAuth 2.1 mit PKCE (S256), Dynamic Client Registration, Single-Use-Codes, rotierende Refresh-Tokens, Ressourcenbindung an `/mcp`.
- Zustimmungsseite: CSRF-Token, `frame-ancestors 'none'`; nur Owner dürfen verbinden.
- Cookie-API: Schreibzugriffe nur vom eigenen Web-Origin; einfache Rate-Limits auf Login und öffentliche Endpunkte.
- Bild-Uploads: Formatprüfung, 15 MB, EXIF/GPS entfernt; `image_url` nur https und keine internen Adressen.
- Jede Änderung landet im Audit-Log (`/api/admin/audit`) mit Akteur (Nutzer oder MCP-Client).
