# Auto Interiore – Website & Werkstatt-Admin (Pitch-Demo)

Proaktive Demo für [@autointeriore](https://www.instagram.com/autointeriore/), eine Sattlerei in Tbilisi, die Armaturenbretter (ტორპედო) und Lenkräder mit Leder neu bezieht.

Alle Daten sind Beispieldaten und liegen im Browser (localStorage). Nichts wird verschickt oder gepostet.

## Starten

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # statischer Build in dist/ (läuft auf jedem Static Host)
```

## Öffentliche Website (`/`)

- **Leder-Konfigurator** im Hero: Leder (6 Farben), Oberfläche (Nappa/Alcantara/Perforiert), Faden und Einfach-/Doppelnaht live auf einem gezeichneten Armaturenbrett. Die Naht wird bei jeder Änderung neu „genäht“.
- **Arbeiten**: Galerie nach Marke filterbar.
- **Teile nach Modell**: Splash-Auswahl Marke → Modell → verfügbare Teile, die man in die Anfrage legen kann.
- **Auftrags-Funnel**: 5 Schritte (Auto, Arbeit + gewählter Look + Teile, Fotos, Termin, Kontakt) mit grober Preisschätzung. Blockierte Tage aus dem Admin-Kalender sind gesperrt. Danach geht es optional per WhatsApp weiter.
- Sprachen: **Georgisch** (Standard), Englisch, Russisch.

## Admin (`/#/admin`)

| Bereich | Funktion |
|---|---|
| Overview | Neue Anfragen, Tagesplan, Werkstatt-Pipeline, offene Punkte |
| Orders | Kanban (Drag & Drop) von Anfrage bis Übergabe; Detail mit Look, Fotos, Termin buchen, WhatsApp-Antwort |
| Calendar | Monatsansicht, Termine, Lieferungen, Blocktage |
| Calculator | Material + Stunden + Marge + 18 % MwSt → Angebot; speichert ins Auftragsdetail, erzeugt Bestellung |
| Purchase orders | Bestellungen an Lieferanten per E-Mail/WhatsApp, Status bis Wareneingang |
| Suppliers & dealers | Lieferanten, Teilehändler, Partner-Werkstätten |
| Parts shop | Bestand, Preis, Sichtbarkeit auf der Website |
| Social content | Post-Entwürfe in KA/EN/RU, Freigabe, Metricool-Payload |

Details zur Social-Pipeline: [docs/content-pipeline.md](docs/content-pipeline.md)

## Vor einem echten Einsatz

- Galeriebilder sind Ausschnitte aus seinem Instagram-Grid (mit Text-Overlays) → durch Originalfotos ersetzen.
- Georgische und russische Texte von Muttersprachlern prüfen lassen.
- Preise im Konfigurator, Funnel und Kalkulator sind Platzhalter.
- Logo: aktuell Wortmarke; sein Monogramm-Logo als SVG einsetzen.
- Backend (Supabase o. ä.) für Aufträge, Login fürs Admin, Bild-Upload, Metricool-Versand.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS 4 · Zustand · React Router (Hash) · Lucide
