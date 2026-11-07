# Quizomat

Interaktiver Prüfungs- und Vorlesungstrainer zum Üben, Auswerten und Verwalten von Prüfungsfragen und Fachbegriffen – komplett in einer einzigen HTML-Datei ohne externe Abhängigkeiten oder Server.

🌐 **Live-Version:** [https://mtt66wbfw5-sys.github.io/quizomat/](https://mtt66wbfw5-sys.github.io/quizomat/)

---

## ✨ Funktionen

- **Drei Fragetypen:**
  - **Single Choice** (`single`) – genau eine richtige Antwort
  - **Multiple Choice** (`multi`) – mehrere richtige Antworten möglich
  - **Wahr / Falsch** (`tf`) – Aussagen bewerten
- **Übungsmodus (Adaptives Lernsystem):**
  - Alle verfügbaren Fragen der ausgewählten Kapitel werden im Quiz gestellt; der Durchgang läuft kontinuierlich, bis man über „Zurück zur Übersicht“ zurückkehrt.
  - Fragen und Antwortoptionen werden bei jedem Durchgang automatisch gemischt.
  - Jede Frage merkt sich die Serie richtiger Antworten in Folge (`streak`) sowie Fehlversuche (`wrong`).
  - **Gemeistert ab 3× richtig in Folge (`✓ Gemeistert`):** Gemeisterte Fragen werden beim Üben automatisch ausgeblendet, damit der Fokus auf noch offenen Fragen liegt.
  - **Intelligente Gewichtung:** Zuletzt falsch beantwortete und noch unbekannte Fragen werden bei der Quiz-Zusammenstellung bevorzugt gezogen.
  - Der Lernstand lässt sich jederzeit pro Frage per Klick umschalten sowie pro Kapitel, pro Kurs oder global zurücksetzen.
- **Prüfungsmodus & Notenschemata:**
  - **Fragenanzahl & Countdown-Timer pro Kurs:** Anzahl der Prüfungsfragen und Prüfungszeit in Minuten lassen sich pro Kurs individuell einstellen; mit visueller Warnung (ab 5 Min. gelb, ab 1 Min. rot) und automatischer Abgabe bei Zeitablauf.
  - **Prüfungsnahe Fragenauswahl:** Zieht proportional aus allen ausgewählten Kapiteln (inklusive bereits gemeisterter Fragen) ohne sofortiges Feedback während der Bearbeitung.
  - **Fragen-Navigator:** Freies Springen zwischen allen Prüfungsfragen, Statusanzeige (beantwortet / offen) und **„⚑ Später prüfen“**-Lesezeichen (Taste `L`).
  - **Flexible Multiple-Choice-Wertung & Minuspunkte pro Kurs:**
    - **MC-Wertungsmodi:** *Gesamtfrage (Alles-oder-nichts)*, *Einzelantworten (inkl. richtig Nicht-Angekreuzter)*, *Einzelantworten (nur richtige Kreuze)* oder *Teilpunkte (normiert auf 1 Punkt pro Frage)*.
    - **Minuspunkte-Modi:** *Keine Minuspunkte*, *Minuspunkte bis minimal 0 Punkte pro Frage* (kein Abzug von anderen Fragen) oder *Gesamtabzug auch unter 0 Punkte pro Frage* (unbeantwortete Fragen = 0 Punkte).
  - **Kursabhängige Benotung (Noten 1 bis 5):** Pro Kurs kann zwischen drei Notenschemata gewählt werden (*Sehr gut, Gut, Befriedigend, Genügend, Nicht genügend*):
    - **Positiv ab 50 %** (1: ≥ 87,5 % · 2: ≥ 75 % · 3: ≥ 62,5 % · 4: ≥ 50 % · 5: < 50 %)
    - **Positiv ab 60 %** (1: ≥ 90 % · 2: ≥ 80 % · 3: ≥ 70 % · 4: ≥ 60 % · 5: < 60 %)
    - **Positiv ab 70 %** (1: ≥ 92,5 % · 2: ≥ 85 % · 3: ≥ 77,5 % · 4: ≥ 70 % · 5: < 70 %)
  - **Detaillierte Klausureinsicht & Auswertung:** Aufschlüsselung der erreichten Punkte nach Kapiteln, Live-Umschaltung der Wertungs- und Notenschemata sowie aufklappbare Übersicht aller Fragen inklusive Punkteaufschlüsselung pro Antwortoption, Einzelbegründungen und Gesamt-Begründung.
- **Integriertes Glossar:**
  - Fachbegriffe (inkl. Alias-Schreibweisen) werden beim Prüfen einer Antwort automatisch im Fragetext, den Optionen und der Erklärung erkannt und direkt neben der Frage erläutert.
- **Direktes Bearbeiten, Markieren & Verwalten:**
  - Kurse (inkl. Notenschema, MC-Wertung, Minuspunkte, Prüfungszeit & Fragenanzahl für Prüfungen), Kapitel/Themen, einzelne Fragen (inkl. Fragetyp, Antwortoptionen, Begründungen und Erklärung) sowie Glossareinträge lassen sich direkt im Browser bearbeiten oder mit Sicherheitsabfrage löschen.
  - Fragen können während des Quiz/der Prüfung oder in der Auswertung mit einem Fähnchen (Taste `M`) zum späteren Überarbeiten markiert werden.
- **Import & Export (inkl. Duplikatschutz & Lernstand):**
  - Fragen und Glossare können per JSON-Text, Dateiauswahl oder Drag & Drop importiert werden.
  - Bereits vorhandene Kurse, Kapitel und Fragen werden beim Import automatisch zusammengeführt (keine doppelten Fragen), wobei der höhere Lernstand erhalten bleibt.
  - Export aller Fragen, einzelner Kurse oder des Glossars als `.json`-Datei (inkl. aktuellem Lernstand `streak` / `wrong` / `flagged`).
- **Automatischer Cloud-Sync (GitHub):**
  - Über das Wolken-Symbol in der oberen Navigationsleiste kann ein GitHub Personal Access Token (`repo`-Berechtigung) hinterlegt werden.
  - Quizomat legt automatisch ein privates Repository (`quizomat-sync`) an und synchronisiert Fragen, Kurseinstellungen, Lernstand und Glossar im Hintergrund zwischen Mac, iPad und iPhone.
- **Optimiert für Mac, iPad & iPhone:**
  - **Mac / Desktop:** Zweispaltiges Layout mit untereinanderstehenden Antworten und vollständiger Tastatursteuerung (`1`–`9` zur Antwortauswahl, `Enter` / `Leertaste` zum Prüfen & Weiterblättern, `←` / `→` und `L` im Prüfungsmodus, `M` zum Markieren, `Esc` für „Zurück zur Übersicht“).
  - **iPad / Tablet:** Übersichtliches 2×2-Kachel-Layout für kurze Antwortoptionen, vergrößerte Touch-Ziele und eine fixierte untere Aktionsleiste für bequemes Tippen im Hoch- und Querformat.
  - **iPhone / Mobil:** Einhand-optimierte untere Navigations- und Aktionsleiste, Safe-Area-Unterstützung und als Vollbild-Web-App über *„Teilen → Zum Home-Bildschirm“* installierbar.
  - Automatischer **Hell-/Dunkelmodus** passend zur Systemeinstellung.

---

## 📄 JSON-Format für Fragen

Importiert werden kann entweder ein einzelnes Themen-Set (`{ ... }`) oder eine Liste mehrerer Sets (`[ { ... }, { ... } ]`). Der Export erzeugt automatisch das Listenformat.

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
      "erklaerung": "Gesamterklärung zur Frage und warum Option B richtig ist.",
      "begruendungen": [
        "Warum Option A falsch ist",
        "Warum Option B stimmt",
        "Warum Option C falsch ist",
        "Warum Option D falsch ist"
      ]
    },
    {
      "typ": "multi",
      "frage": "Welche Aussagen sind richtig?",
      "optionen": ["Aussage 1", "Aussage 2", "Aussage 3", "Aussage 4"],
      "richtig": [0, 2],
      "erklaerung": "Gesamterklärung zur Frage (Aussage 1 und 3 treffen zu).",
      "begruendungen": [
        "Warum Aussage 1 richtig ist",
        "Warum Aussage 2 falsch ist",
        "Warum Aussage 3 richtig ist",
        "Warum Aussage 4 falsch ist"
      ]
    },
    {
      "typ": "tf",
      "frage": "Diese Aussage ist wahr.",
      "richtig": true,
      "erklaerung": "Gesamterklärung, warum diese Aussage wahr ist.",
      "begruendungen": [
        "Warum Wahr hier zutrifft",
        "Warum Falsch hier nicht zutrifft"
      ]
    }
  ]
}
```

> **Hinweise:**
> - `richtig`: 0-basierte Indizes der richtigen Optionen als Array (z. B. `[1]` oder `[0, 2]`) bzw. bei `tf` ein boolescher Wert (`true` / `false`).
> - `erklaerung`: Übergreifende Erklärung / Gesamtbegründung zur jeweiligen Frage (für alle drei Fragetypen `single`, `multi` und `tf`).
> - `begruendungen`: Array mit einer kurzen Einzelbegründung zu jeder Antwortoption (bei `single` und `multi` passend zu `optionen`, bei `tf` mit 2 Einträgen für `["Wahr", "Falsch"]`).
> - **Lernstand beim Export:** Beim Exportieren werden optional auch `streak` (Serie richtiger Antworten), `wrong` (zuletzt falsch) und `flagged` (Markierung) mitgespeichert und beim Re-Import nahtlos übernommen.

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

Alle Fragen, Kurse, Glossareinträge, UI-Zustände und Lernstände werden ausschließlich lokal im `localStorage` des jeweiligen Browsers gespeichert (`pt:sets`, `pt:courses`, `pt:gloss`, `pt:col`, `pt:sel`, `pt:exp`, `pt:opts`). Es werden keine Daten an externe Server übertragen (außer bei freiwillig aktiviertem privaten GitHub-Cloud-Sync).
