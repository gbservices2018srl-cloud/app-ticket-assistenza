// Gestione delle notifiche di sistema (compaiono sul device quando l'app
// è aperta, anche in background/minimizzata). Non funzionano ad app chiusa:
// per quello servirebbe un sistema di push notification vero e proprio.

export function notificheSupportate() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function statoPermessoNotifiche() {
  if (!notificheSupportate()) return 'non-supportato';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

export async function richiediPermessoNotifiche() {
  if (!notificheSupportate()) return 'non-supportato';
  const risultato = await Notification.requestPermission();
  return risultato;
}

export function mostraNotifica(titolo, corpo) {
  if (!notificheSupportate()) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(titolo, {
      body: corpo,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });
  } catch (e) {
    // Alcuni browser mobile richiedono di passare dal service worker
    // per mostrare notifiche; fallback silenzioso se non disponibile.
    console.warn('Notifica non mostrata:', e);
  }
}
