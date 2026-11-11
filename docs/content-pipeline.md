# Content-Pipeline: Auto Interiore → Metricool

Ziel: Jeder fertige Auftrag und jedes neue Teil wird automatisch zu einem Social-Post in **Georgisch, Englisch und Russisch** und geht nach einer Freigabe über Metricool auf alle Kanäle raus. Der Besitzer muss nichts schreiben, nur freigeben.

## Ablauf

```
Auftrag im Admin auf "Ready"        Neues Teil im Parts-Shop
           │                                   │
           └──────────────┬────────────────────┘
                          ▼
           Post-Entwurf (Bild + 3 Sprachen + Hashtags)
                          │
                          ▼
           Freigabe im Admin  (Social content → Approve)
                          │
                          ▼
           Metricool createScheduledPost
             • Zeitpunkt: getBestTimeToPostByNetwork
             • Kanäle: Instagram, Facebook, TikTok, Threads,
               Google Business Profile, YouTube Shorts (nur mit Video)
                          │
                          ▼
           Veröffentlicht + Statistik zurück ins Admin
```

## Was in der Demo schon da ist

- **Entwurfsgenerator**: `makePost()` / `makePartPost()` in `src/store.ts` erzeugen Captions aus Auto, Leder, Faden und Naht – in KA/EN/RU.
- **Freigabe-Queue**: `src/admin/Content.tsx` mit Kanalwahl, Zeitpunkt, Sprache, Status `draft → approved → scheduled`.
- **Metricool-Payload**: `metricoolPayload()` baut exakt das `info`-Objekt für `createScheduledPost` (providers, `instagramData`, `gmbData`, `publicationDate` mit `Asia/Tbilisi` usw.). In der Demo wird es nur angezeigt, nicht gesendet.

## Was für den Livebetrieb fehlt

1. **Eigene Metricool-Brand** für Auto Interiore anlegen und seine Kanäle verbinden (Instagram @autointeriore, Facebook, TikTok, Google Business Profile). Im aktuellen Metricool-Account existiert nur die Brand „Luxusaholic“.
2. **Backend** (z. B. Supabase): Aufträge, Teile und Posts in einer Datenbank statt localStorage; Bilder in einem öffentlichen Storage-Bucket, weil Metricool Medien per öffentlicher URL abholt.
3. **Serverseitiger Versand**: Eine Edge Function ruft beim Klick auf „Send to Metricool“ die Metricool-API auf (Token bleibt auf dem Server). Alternativ `createScheduledPostForReview`, falls der Besitzer zusätzlich in Metricool freigeben soll.
4. **Video**: Seine besten Inhalte sind Reels. Für Reels/TikTok/Shorts das Video aus dem Auftrag hochladen und `instagramData.type = "REEL"` setzen.
5. **Beste Zeiten**: `getBestTimeToPostByNetwork` pro Kanal wöchentlich abfragen und die Slots im Admin vorschlagen (aktuell Beispielwerte).
6. **Sprachstrategie**: Haupttext Georgisch, englische Version als erster Kommentar (ist im Payload schon so vorbereitet). Russisch als eigener Post für Facebook-Gruppen testen.

## Posting-Rhythmus (Vorschlag)

| Tag | Inhalt |
|-----|--------|
| Di 19:30 | Fertiger Auftrag (Vorher/Nachher-Reel) |
| Do 19:30 | Prozess-Clip aus der Werkstatt (Zuschnitt, Nähen) |
| Sa 13:00 | Teil im Verkauf / Angebot |
