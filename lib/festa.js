// Riconoscimento a chi risolve un ticket: festoni e una frase (70, sempre diverse: tutte prima che una si ripeta).
// I festoni e la finestra sono gli stessi delle Classifiche To Smile (appgestione.it/classifiche/festa.js).
const FRASI = [
 "Problema risolto! Grazie per la rapidità e la precisione.",
 "Hai trasformato un problema in una soluzione. Ottimo lavoro!",
 "Grazie: chi ha aperto il ticket può tornare a lavorare sereno.",
 "Risolvere bene e in fretta è un talento. Complimenti!",
 "Un ticket chiuso è un collega aiutato. Grazie!",
 "Hai ascoltato, capito e risolto: perfetto.",
 "La tua disponibilità fa funzionare meglio tutte le sedi.",
 "Grazie per aver preso a cuore questo problema.",
 "Hai trovato la soluzione giusta. Applausi!",
 "Il tuo aiuto fa la differenza per tutta la squadra.",
 "Competenza e pazienza: la combinazione vincente.",
 "Un altro intoppo superato grazie a te.",
 "Grazie per la chiarezza con cui hai gestito la richiesta.",
 "Hai reso semplice una cosa complicata. Complimenti!",
 "La tua prontezza è una risorsa preziosa.",
 "Hai chiuso il cerchio: problema risolto, collega soddisfatto.",
 "Grazie per l'attenzione che metti in ogni richiesta.",
 "Lavoro di squadra al suo meglio: grazie!",
 "Hai risposto con professionalità e gentilezza.",
 "Ogni ticket risolto rende lo studio più efficiente.",
 "Grazie per non aver lasciato nessuno senza risposta.",
 "Hai fatto la cosa giusta, nel modo giusto.",
 "Il tuo impegno si vede: un altro ticket chiuso!",
 "Grazie per la tua affidabilità, sempre.",
 "Hai risolto con metodo e precisione. Ottimo!",
 "Le sedi possono contare su di te. Grazie!",
 "Un problema in meno, un sorriso in più.",
 "Grazie per la cura con cui segui ogni segnalazione.",
 "Hai sbloccato la situazione: complimenti!",
 "Il tuo supporto è il motore silenzioso dello studio.",
 "Grazie per la pazienza e la competenza.",
 "Hai fatto un lavoro rapido e ben fatto.",
 "La tua soluzione semplifica il lavoro di tutti.",
 "Grazie per esserci quando serve.",
 "Hai gestito la richiesta come un vero professionista.",
 "Ticket chiuso con stile. Applausi!",
 "Grazie per la tua capacità di trovare soluzioni.",
 "Hai aiutato un collega a lavorare meglio: grazie!",
 "Il tuo spirito di servizio è un esempio per tutti.",
 "Problema capito al volo e risolto. Complimenti!",
 "Grazie per la puntualità nelle risposte.",
 "Hai portato ordine dove c'era un problema.",
 "La tua competenza tecnica fa la differenza.",
 "Grazie: ogni ticket risolto è fiducia guadagnata.",
 "Hai fatto un ottimo lavoro di assistenza.",
 "Le tue risposte chiare fanno risparmiare tempo a tutti.",
 "Grazie per l'impegno e la costanza.",
 "Hai risolto anche questo: avanti così!",
 "Il tuo aiuto è stato prezioso. Grazie!",
 "Hai dato una risposta concreta e veloce. Ottimo!",
 "Grazie per prenderti cura dei problemi di tutti.",
 "Hai lavorato con attenzione e il risultato si vede.",
 "Un collega soddisfatto è il miglior riconoscimento.",
 "Grazie per la tua calma anche nelle urgenze.",
 "Hai trovato la strada più semplice: complimenti!",
 "Il tuo lavoro rende le sedi più serene.",
 "Grazie per la serietà con cui gestisci ogni ticket.",
 "Hai fatto un'altra cosa bella per la squadra.",
 "Risposta giusta, tempi giusti. Perfetto!",
 "Grazie per la tua disponibilità senza riserve.",
 "Hai chiuso il ticket con grande professionalità.",
 "Il supporto che dai è un valore per tutto To Smile.",
 "Merito tuo se il lavoro riparte. Complimenti!",
 "Hai fatto un lavoro preciso e risolutivo.",
 "La tua competenza è una garanzia per tutti.",
 "Grazie per la tua energia nel risolvere i problemi.",
 "Hai aiutato con il sorriso: complimenti!",
 "Un altro problema risolto grazie alla tua esperienza.",
 "Grazie per far funzionare tutto, ogni giorno.",
 "Hai chiuso il ticket e aperto una giornata migliore per qualcuno."
];

function prossimaFrase(chi) {
  const k = 'ts-frasi-ticket:' + chi;
  let m = null;
  try { m = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) {}
  if (!Array.isArray(m) || !m.length) { m = FRASI.map((_, i) => i); for (let i = m.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; } }
  const i = m.shift();
  try { localStorage.setItem(k, JSON.stringify(m)); } catch (e) {}
  return FRASI[i] || FRASI[0];
}
function caricaFesta() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.TSFesta) return Promise.resolve(window.TSFesta);
  return new Promise(ok => { const s = document.createElement('script'); s.src = 'https://appgestione.it/classifiche/festa.js'; s.onload = () => ok(window.TSFesta || null); s.onerror = () => ok(null); document.head.appendChild(s); });
}
export async function festaTicketRisolto(profile) {
  try {
    const T = await caricaFesta(); if (!T) return;
    const nome = String(profile?.nome || '').trim().split(/\s+/)[0];
    T.mostra({ titolo: 'Ticket risolto!', chi: nome ? 'Grazie, ' + nome + '!' : 'Grazie!', frase: prossimaFrase(profile?.id || 'io'), bottone: 'Grazie!', senzaLink: true });
  } catch (e) { /* il riconoscimento non blocca mai il lavoro */ }
}
