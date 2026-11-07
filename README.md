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
  - Die maximale Anzahl der Fragen pro Übung (Quiz) lässt sich in den **Einstellungen** frei festlegen (Standard: 20 Fragen).
  - Fragen und Antwortoptionen werden bei jedem Durchgang automatisch gemischt (optional in den Einstellungen umschaltbar).
  - Jede Frage merkt sich die Serie richtiger Antworten in Folge (`streak`) sowie Fehlversuche (`wrong`).
  - **Gemeistert-Schwelle frei wählbar (`✓ Gemeistert`):** Ab wie vielen richtigen Antworten in Folge (1× bis 5×, Standard: 3×) eine Frage als gemeistert gilt und ob gemeisterte Fragen im Quiz ausgeblendet werden, ist in den Einstellungen einstellbar.
  - **Intelligente Gewichtung & Kurs-Fokus:** Zuletzt falsch beantwortete und noch unbekannte Fragen werden bei der Quiz-Zusammenstellung bevorzugt gezogen; für Quiz und Prüfung sind immer nur Kapitel eines einzelnen Kurses gleichzeitig auswählbar (kein Vermischen mehrerer Kurse).
  - Der Lernstand lässt sich jederzeit pro Frage per Klick umschalten sowie pro Kapitel, pro Kurs oder global zurücksetzen.
- **Einstellungsseite & Kursübersicht:**
  - Eigener Reiter **Einstellungen** zum Festlegen von Quiz-Fragenanzahl, Gemeistert-Schwelle, Ausblenden gemeisterter Fragen, Antwort-Mischung, Erscheinungsbild (*System / Hell / Dunkel*) und **Cloud-Sync**.
  - Kompakte Übersicht aller vorhandenen Kurse (ohne Kapitel und Einzelfragen) inklusive direkter Bearbeitung aller Kurseinstellungen, Export, Lernstand-Reset und Löschen.
- **Prüfungsmodus & Notenschemata:**
  - **Fragenanzahl & Countdown-Timer pro Kurs:** Anzahl der Prüfungsfragen und Prüfungszeit in Minuten lassen sich pro Kurs individuell einstellen; mit visueller Warnung (ab 5 Min. gelb, ab 1 Min. rot), Schutzabfrage gegen versehentliches Abbrechen und automatischer Abgabe bei Zeitablauf.
  - **Prüfungsnahe Fragenauswahl:** Zieht proportional aus allen ausgewählten Kapiteln (inklusive bereits gemeisterter Fragen) ohne sofortiges Feedback während der Bearbeitung; unbeantwortete Prüfungsfragen setzen den bestehenden Lernstand nicht zurück.
  - **Fragen-Navigator:** Freies Springen zwischen allen Prüfungsfragen, Statusanzeige (beantwortet / offen) und **„⚑ Später prüfen“**-Lesezeichen (Taste `L`).
  - **Flexible Multiple-Choice-Wertung & Minuspunkte pro Kurs (MC-Optionen nur bei Kursen mit MC-Fragen sichtbar):**
    - **MC-Wertungsmodi:** *Gesamtfrage (Alles-oder-nichts)*, *Einzelantworten (inkl. richtig Nicht-Angekreuzter)*, *Einzelantworten (nur richtige Kreuze)* oder *Teilpunkte (normiert auf 1 Punkt pro Frage)*.
    - **Minuspunkte-Modi:** *Keine Minuspunkte*, *Minuspunkte bis minimal 0 Punkte pro Frage* (kein Abzug von anderen Fragen) oder *Gesamtabzug auch unter 0 Punkte pro Frage* (unbeantwortete Fragen = 0 Punkte).
  - **Kursabhängige Benotung (Noten 1 bis 5):** Pro Kurs kann zwischen drei Notenschemata gewählt werden (*Sehr gut, Gut, Befriedigend, Genügend, Nicht genügend*):
    - **Positiv ab 50 %** (1: ≥ 87,5 % · 2: ≥ 75 % · 3: ≥ 62,5 % · 4: ≥ 50 % · 5: < 50 %)
    - **Positiv ab 60 %** (1: ≥ 90 % · 2: ≥ 80 % · 3: ≥ 70 % · 4: ≥ 60 % · 5: < 60 %)
    - **Positiv ab 70 %** (1: ≥ 92,5 % · 2: ≥ 85 % · 3: ≥ 77,5 % · 4: ≥ 70 % · 5: < 70 %)
  - **Detaillierte Klausureinsicht & Auswertung:** Aufschlüsselung der erreichten Punkte nach Kapiteln, Live-Umschaltung der Wertungs- und Notenschemata sowie aufklappbare Übersicht aller Fragen inklusive Punkteaufschlüsselung pro Antwortoption, Einzelbegründungen, Gesamt-Begründung und erkannter Glossarbegriffe.
- **Integriertes Glossar pro Kurs:**
  - Fachbegriffe (inkl. Alias-Schreibweisen) werden analog zu den Fragen **aufklappbar pro Kurs** verwaltet, durchsucht, importiert und exportiert.
  - Beim Prüfen einer Antwort sowie in der Ergebnis-/Klausureinsicht werden passende Begriffe aus dem Glossar des jeweiligen Kurses automatisch erkannt, nach Relevanz sortiert (Treffer in Frage & Antwortoptionen vor bloßen Erwähnungen in der Begründung) und als kompakte **Begriffs-Pills** dargestellt – der relevanteste Begriff ist direkt geöffnet, weitere Begriffe lassen sich per Antippen umschalten oder schließen.
- **Direktes Erstellen, Bearbeiten, Markieren & Verwalten:**
  - Neue Fragen (`+ Neue Frage hinzufügen`) und neue Glossarbegriffe (`+ Begriff hinzufügen` – global oder direkt am jeweiligen Kurs) lassen sich direkt im Browser anlegen.
  - Kurse (inkl. Notenschema, MC-Wertung, Minuspunkte, Prüfungszeit & Fragenanzahl für Prüfungen), Kapitel/Themen, einzelne Fragen (inkl. Fragetyp, Antwortoptionen, Begründungen und Erklärung) sowie Kurs-Glossare und einzelne Glossareinträge lassen sich direkt im Browser bearbeiten oder mit Sicherheitsabfrage löschen.
  - Fragen können während des Quiz/der Prüfung oder in der Auswertung mit einem Fähnchen (Taste `M`) zum späteren Überarbeiten markiert werden.
- **Import & Export (inkl. Duplikatschutz, Lernstand & Kurseinstellungen):**
  - Fragen und Kurs-Glossare können per JSON-Text, Dateiauswahl oder Drag & Drop importiert werden.
  - Bereits vorhandene Kurse, Kapitel, Fragen und Glossarbegriffe werden beim Import kursbezogen zusammengeführt (keine doppelten Fragen/Begriffe pro Kurs), wobei der höhere Lernstand erhalten bleibt.
  - Export aller Fragen, einzelner Kurse (inkl. Kurs-Glossar), aller Glossare oder einzelner Kurs-Glossare als `.json`-Datei (inkl. aktuellem Lernstand `streak` / `wrong` / `flagged` sowie den Kurseinstellungen `einstellungen`).
- **Automatischer Cloud-Sync (GitHub):**
  - Direkt in den **Einstellungen** kann ein GitHub Personal Access Token (`repo`-Berechtigung) hinterlegt werden.
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

Importiert werden kann entweder ein einzelnes Kurs-Glossar (`{ ... }`) oder eine Liste mehrerer Kurs-Glossare (`[ { ... }, { ... } ]`).

```json
{
  "kurs": "Name des Kurses",
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

Alle Fragen, Kurse, Glossareinträge, UI-Zustände und Lernstände werden ausschließlich lokal im `localStorage` des jeweiligen Browsers gespeichert (`pt:sets`, `pt:courses`, `pt:gloss`, `pt:col`, `pt:gcol`, `pt:sel`, `pt:exp`, `pt:opts`). Es werden keine Daten an externe Server übertragen (außer bei freiwillig aktiviertem privaten GitHub-Cloud-Sync).
