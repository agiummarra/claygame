# ClayGame (versione web)

Gioco per bambini (8–12 anni) sulle fasi di produzione della ceramica: **impastatura, modellazione al tornio, cottura, decorazione**.
È la riscrittura in HTML5 del gioco Flash originale (sorgenti in `Riferimenti/`), di Andrea Giummarra.

Funziona in qualsiasi browser moderno: PC/Mac, LIM, tablet e smartphone (mouse, dito o penna). Nessun plugin, nessuna dipendenza, nessuna compilazione.

## Contenuti didattici (aggiunti alla versione originale)

- schede **"Lo sapevi?"** dopo impastatura, tornio e cottura, con pulsante **🔊 Leggi** (sintesi vocale del dispositivo);
- due fasi in più, come nel processo reale: **essiccazione** (tra tornio e forno) e **smaltatura + seconda cottura** (dopo la decorazione);
- **quiz finale** di 7 domande con spiegazioni;
- **attestato** con nome, vaso decorato e punteggio, da stampare (A4 orizzontale) o salvare come immagine;
- [**guida per l'insegnante**](guida-insegnante.html), stampabile, raggiungibile anche dalla schermata iniziale.

I testi sono in [js/edu.js](js/edu.js) (costanti `FACTS`, `DRY_MSG`, `GLAZE_PRE`, `GLAZE_POST`, `QUIZ`) e si possono modificare facilmente.

## Come si gioca in locale

```bash
python3 -m http.server 8765
```

poi aprire <http://localhost:8765>. In alternativa basta un doppio clic su `index.html`
(da `file://` non sono disponibili l'installazione come app e l'uso offline).

## Pubblicazione

La cartella è un sito statico: basta copiare su un qualsiasi hosting (GitHub Pages, Netlify, un server della scuola…)
`index.html`, `guida-insegnante.html`, `manifest.webmanifest`, `sw.js`, `css/`, `js/`, `assets/`. Le cartelle `Riferimenti/` e `tools/` non servono online.
Se servito in HTTPS il gioco è una PWA: si può "Aggiungere alla schermata Home" / installare, e poi funziona anche offline.

## Struttura

| Percorso | Contenuto |
|---|---|
| `index.html`, `css/style.css` | pagina, schermata iniziale, stile |
| `js/engine.js` | motore: stage 1280×1024 scalato, sprite, tween (stile Tweener), audio, input |
| `js/game.js` | logica: menu + 4 fasi (conversione degli script ActionScript originali) |
| `js/edu.js` | schede didattiche, essiccazione, seconda cottura, quiz, attestato |
| `guida-insegnante.html` | guida stampabile per l'insegnante |
| `js/app.js` | avvio, audio on/off, schermo intero, service worker |
| `assets/img`, `assets/audio` | grafica (WebP) e suoni (MP3) estratti dagli SWF originali |
| `assets/scenes.js` | posizione e ordine di ogni oggetto in ciascuna scena |
| `tools/` | script Python usati per estrarre grafica e suoni da `Riferimenti/Sorgenti/*.swf` |

## Rigenerare gli asset

`python3 tools/extract.py` (richiede Pillow, numpy, `cwebp` e chrome-headless-shell di Playwright; vedi `CHROME` in `tools/render.py`).

## Differenze rispetto all'originale

- Se nella cottura si manca il riquadro giallo si ripete solo la fase di cottura (l'originale ricaricava tutto il gioco).
- "Esci" dal menu torna alla schermata iniziale (in un browser non si può chiudere l'applicazione).
- Il pannello delle istruzioni blocca i clic sugli oggetti che copre; aggiunti i pulsanti audio on/off e schermo intero.
- Il passaggio tra le fasi è uno scorrimento laterale semplificato.
