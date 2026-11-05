# Quizomat

Interaktiver Prüfungs- und Vorlesungstrainer zum Üben, Auswerten und Verwalten von Prüfungsfragen und Fachbegriffen – komplett in einer einzigen HTML-Datei ohne externe Abhängigkeiten oder Server.

🌐 **Live-Version:** [https://mtt66wbfw5-sys.github.io/quizomat/](https://mtt66wbfw5-sys.github.io/quizomat/)

---

## ✨ Funktionen

- **Drei Fragetypen:**
  - **Single Choice** (`single`) – genau eine richtige Antwort
  - **Multiple Choice** (`multi`) – mehrere richtige Antworten möglich
  - **Wahr / Falsch** (`tf`) – Aussagen bewerten
- **Adaptives Lernsystem:**
  - Jede Frage merkt sich die Serie richtiger Antworten in Folge (`streak`) sowie Fehlversuche (`wrong`).
  - **Gemeistert ab 3× richtig in Folge (`✓ Gemeistert`):** Gemeisterte Fragen können im Quiz automatisch ausgeblendet werden.
  - **Intelligente Gewichtung:** Zuletzt falsch beantwortete und noch unbekannte Fragen werden bei der Quiz-Zusammenstellung bevorzugt gezogen.
  - Der Lernstand lässt sich pro Frage per Klick umschalten sowie pro Kapitel oder global zurücksetzen.
- **Integriertes Glossar:**
  - Fachbegriffe (inkl. Alias-Schreibweisen) werden beim Prüfen einer Antwort automatisch im Fragetext, den Optionen und der Erklärung erkannt und direkt neben bzw. unter der Frage erläutert.
- **Direktes Bearbeiten (Inline-Editor):**
  - Kurse, Kapitel/Themen, einzelne Fragen (inkl. Fragetyp, Antwortoptionen, Begründungen und Erklärung) sowie Glossareinträge lassen sich direkt im Browser bearbeiten.
- **Import & Export (inkl. Duplikatschutz & Lernstand):**
  - Fragen und Glossare können per JSON-Text, Dateiauswahl oder Drag & Drop importiert werden.
  - Bereits vorhandene Kurse, Kapitel und Fragen werden beim Import automatisch zusammengeführt (keine doppelten Fragen), wobei der höhere Lernstand erhalten bleibt.
  - Export aller Fragen, einzelner Kurse oder des Glossars als `.json`-Datei (inkl. aktuellem Lernstand `streak` / `wrong`).
- **Automatischer Cloud-Sync (GitHub):**
  - Über das Wolken-Symbol in der oberen Navigationsleiste kann ein GitHub Personal Access Token (`repo`-Berechtigung) hinterlegt werden.
  - Quizomat legt automatisch ein privates Repository (`quizomat-sync`) an und synchronisiert Fragen, Lernstand und Glossar im Hintergrund zwischen Mac und iPhone.
- **Optimiert für Mac & iPhone:**
  - **Mac / Desktop:** Zweispaltiges Quiz-Layout und vollständige Tastatursteuerung (`1`–`9` zur Antwortauswahl, `Enter` / `Leertaste` zum Prüfen & Weiterblättern, `Esc` zum Abbrechen).
  - **iPhone / Mobil:** Einhand-optimierte Sticky-Buttons am unteren Bildschirmrand, Safe-Area-Unterstützung und als Vollbild-Web-App über *„Teilen → Zum Home-Bildschirm“* installierbar.
  - Automatischer **Hell-/Dunkelmodus** passend zur Systemeinstellung.

---

## 📄 JSON-Format für Fragen

```json
{
  "kurs": "Name des Kurses",
  "titel": "Thema / Vorlesung",
  "fragen": [
    {
      "typ": "single",
      "frage": "Welche Aussage trifft zu?",
      "optionen": ["Option A", "Option B", "Option C", "Option D"],
      "richtig": [1],
      "erklaerung": "Erklärung zur richtigen Antwort.",
      "begruendungen": ["Warum A falsch ist", "Warum B stimmt", "", ""]
    },
    {
      "typ": "multi",
      "frage": "Welche Aussagen sind richtig?",
      "optionen": ["Aussage 1", "Aussage 2", "Aussage 3"],
      "richtig": [0, 2],
      "erklaerung": "Aussage 1 und 3 treffen zu."
    },
    {
      "typ": "tf",
      "frage": "Diese Aussage ist wahr.",
      "richtig": true,
      "erklaerung": "Begründung zur Aussage."
    }
  ]
}
```

## 📖 JSON-Format für das Glossar

```json
{
  "glossar": [
    {
      "begriff": "Fachbegriff",
      "info": "Erklärung des Begriffs in ca. 100 Worten.",
      "alias": ["Pluralform", "Abkürzung"]
    }
  ]
}
```

---

## 🔒 Datenschutz & Speicherung

Alle Fragen, Kurse, Glossareinträge und Lernstände werden ausschließlich lokal im `localStorage` des jeweiligen Browsers gespeichert (`pt:sets`, `pt:courses`, `pt:gloss`, `pt:col`, `pt:opts`). Es werden keine Daten an externe Server übertragen.
