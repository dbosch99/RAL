# RAL

Calcolatore del netto annuo da dipendente e da partita IVA forfettaria Inarcassa.

Sito: https://dbosch99.github.io/RAL/

## Modello

Trasposizione del file "Confronto dipendente e partita IVA.xlsx", fogli Confronto e Parametri. Anno fiscale 2026, domicilio fiscale a Riva del Garda (Trentino), anno intero, nessun altro reddito o detrazione personale. Il sito non costituisce un calcolo generalizzato per tutti i comuni, casse previdenziali o regimi IVA.

Le formule e gli arrotondamenti originali sono in `src/calculator.js`. Il 5% fiscale e la riduzione giovani Inarcassa sono distinti. Nei contributi deducibili, zero significa nessun versamento dedotto; vuoto usa i contributi annui stimati. I costi effettivi riducono il netto senza ulteriore deduzione analitica. Quota maternità/paternità 65,50 € provvisoria come nel modello. Tutti i parametri, i limiti e i riferimenti sono descritti in "Metodo e ipotesi".

Il 21/10/2026 è la data di verifica dichiarata nel foglio. Non viene presentata come nuova verifica normativa indipendente. La corrispondenza alle formule non certifica requisiti fiscali, contributivi o il cedolino effettivo.

## Uso e sviluppo locale

Sito statico HTML/CSS/JavaScript, senza dipendenze da installare né compilazione.

Avviare un server HTTP nella cartella del progetto, ad esempio `python3 -m http.server 8765 --bind 127.0.0.1`, e aprire http://127.0.0.1:8765. I moduli JavaScript richiedono HTTP: non aprire index.html direttamente come file.

Per le verifiche: `node --test tests/*.test.js` con Node.js 20 o successivo. I test pubblici verificano validazione degli input, deduzioni zero/vuote, indipendenza delle agevolazioni, costi, integrativo, bilanci e mensilità. Il confronto completo con 261 scenari delle formule Excel è conservato separatamente nella cartella di supporto locale; il relativo dataset non è pubblicato.

## Pubblicazione

GitHub Pages dal ramo `main`, cartella `/ (root)`. `.nojekyll` abilita la pubblicazione statica senza elaborazione Jekyll. Non serve alcun segreto, backend o servizio esterno.

## Dati

Il calcolo avviene nel browser. Le impostazioni sono memorizzate in localStorage e possono essere ripristinate all'esempio iniziale. Nessun servizio di analisi è integrato. L'esportazione CSV è generata sul dispositivo. Il file Excel originale e i suoi dati personali non sono inclusi nel progetto.

Autore: Davide Boschetti.
