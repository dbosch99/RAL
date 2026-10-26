# RAL

Calcolatore del netto annuo da dipendente e da partita IVA Inarcassa, forfettaria e ordinaria.

Sito: https://dbosch99.github.io/RAL/

## Modello

Trasposizione del file "Confronto dipendente e partita IVA.xlsx", fogli Confronto e Parametri. Anno fiscale 2026, domicilio fiscale a Riva del Garda (Trentino), anno intero, nessun altro reddito o detrazione personale. Il sito non costituisce un calcolo generalizzato per tutti i comuni, casse previdenziali o regimi IVA.

Le formule sono in `src/calculator.js`. Fino a 85.000 € inclusi si applica il forfettario, oltre il regime ordinario per un anno intero a regime. Non si simula l'anno di transizione. Non esiste un massimo applicativo del lordo. Nei contributi deducibili, zero significa nessun versamento dedotto; vuoto usa i contributi annui stimati. Nell'ordinario, i costi fiscalmente deducibili sono separati dalle spese effettive; vuoto assume deducibili tutte le spese. I costi vanno inseriti al netto dell'IVA recuperabile. L'IVA ipotizzata al 22% è mostrata separatamente e non riduce il netto. La quota maternità/paternità di 65,50 € resta provvisoria come nel modello.

La fascia di età e l'anzianità Inarcassa sono indipendenti dagli anni di attività fiscale. La riduzione richiede meno di 35 anni, primi cinque anni solari di iscrizione e reddito entro 49.907 €. La richiesta manuale non scavalca questi requisiti. Il modello non ripartisce l'anno del compimento dei 35 anni.

Il 21/10/2026 è la data di verifica dichiarata nel foglio. Non viene presentata come nuova verifica normativa indipendente. La corrispondenza alle formule non certifica requisiti fiscali, contributivi o il cedolino effettivo.

## Uso e sviluppo locale

Sito statico HTML/CSS/JavaScript, senza dipendenze da installare né compilazione.

Avviare un server HTTP nella cartella del progetto, ad esempio `python3 -m http.server 8765 --bind 127.0.0.1`, e aprire http://127.0.0.1:8765. I moduli JavaScript richiedono HTTP: non aprire index.html direttamente come file.

Per le verifiche: `node --test tests/*.test.js` con Node.js 20 o successivo. I test pubblici verificano regimi, deduzioni zero/vuote, età e anzianità, costi, massimali, bilanci e scala del grafico. Le verifiche con il file Excel sono conservate separatamente nella cartella di supporto locale; il relativo dataset non è pubblicato.

## Pubblicazione

GitHub Pages dal ramo `main`, cartella `/ (root)`. `.nojekyll` abilita la pubblicazione statica senza elaborazione Jekyll. Non serve alcun segreto, backend o servizio esterno.

## Dati

Il calcolo avviene nel browser. Le impostazioni sono memorizzate in localStorage e possono essere ripristinate all'esempio iniziale. Nessun servizio di analisi è integrato. L'esportazione CSV è generata sul dispositivo. Il file Excel originale e i suoi dati personali non sono inclusi nel progetto.

Autore: Davide Boschetti.

## Icone e PWA

Le icone si trovano in `Icone/`, nei formati 16, 32, 180, 192 e 512 px. Sono collegate ai favicon, all'icona Apple, all'intestazione e alle anteprime Open Graph. `manifest.json` definisce l'installazione standalone. Il service worker conserva le risorse per l'uso offline e gestisce soltanto le cache con prefisso `ral-pwa-`, preservando le altre PWA su GitHub Pages.

Dopo modifiche a codice o risorse incrementare la versione CACHE in `service-worker.js`.

## Previdenza e importi elevati

La voce PENSIONE indica i contributi pensionistici annui stimati, prima di rivalutazioni e integrazioni figurative, e resta distinta dal netto disponibile. Per il dipendente si applica un'aliquota complessiva iniziale del 33%; per Inarcassa si sommano soggettivo e quota dell'integrativo totale dovuto, inizialmente al 50%. Le due aliquote sono modificabili e corrispondono ai nuovi parametri del modello Excel.

L'opzione Prima iscrizione previdenziale dal 1996 applica il massimale INPS 2026 di 122.295 € a contributi e montante. Può essere disattivata quando non applicabile. Le contribuzioni minori sull'eccedenza non sono simulate separatamente. Inarcassa applica il massimale soggettivo di 147.300 € e il volume massimo pensionabile di 193.600 € alla quota integrativa retrocessa. I massimali non bloccano il calcolo del reddito superiore.

Il grafico in `src/chart.js` parte da zero, mostra i nomi degli assi e arriva a cinque volte il lordo inserito. Con lordo zero usa 50.000 €. Campionamento a dimensione limitata, soglie fiscali aggiunte e curve separate nel passaggio a ordinario. I netti negativi restano nelle tabelle. Lo slider mantiene un intervallo comodo e si espande quando si inserisce un lordo superiore; il campo testuale non ha un massimo prefissato.

Il service worker e le risorse con versione aggiornano le installazioni PWA esistenti. I salvataggi precedenti vengono migrati conservando importi e aliquote; il vecchio requisito giovani viene convertito in fascia di età e anzianità compatibili con la simulazione precedente.
