# Assistenza Studi

App per la gestione di ticket di assistenza tra studi, amministratori di azienda e super admin.

## Ruoli

- **Super Admin**: crea le aziende e gli account degli amministratori di azienda.
- **Admin Azienda**: crea gli studi e gli accessi per i clienti degli studi; gestisce i ticket (in lavorazione / risolto).
- **Utente Studio**: apre ticket verso l'amministrazione (foto sempre obbligatoria).

Ogni ticket mostra sempre la **data di apertura**.

---

## 1. Setup Supabase

1. Crea un nuovo progetto su [supabase.com](https://supabase.com).
2. Vai su **SQL Editor** → New query, incolla il contenuto di `supabase/schema.sql` ed esegui. Crea tutte le tabelle, le policy RLS e il bucket di storage per le foto.
3. Vai su **Project Settings > API** e copia:
   - `Project URL` → useremo come `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → useremo come `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Se hai già un progetto esistente (aggiornamento)

Se il tuo progetto Supabase esiste già (schema installato in precedenza), esegui anche lo script `aggiornamento-schema.sql` (fornito a parte) su **SQL Editor**: aggiunge la colonna email ai profili, i permessi di eliminazione e abilita il realtime per le notifiche. Non tocca i dati esistenti.

### ⚠️ Passaggio fondamentale: disattiva la conferma email

Poiché gli account vengono creati dagli admin per conto di altre persone (che potrebbero non controllare subito la mail), va disattivata la richiesta di conferma email:

1. Su Supabase, vai su **Authentication** → **Providers** (o **Sign In / Providers** a seconda della versione dell'interfaccia)
2. Clicca su **Email**
3. Disattiva l'opzione **"Confirm email"**
4. Salva

Senza questo passaggio, gli utenti creati da admin/super admin non riusciranno a fare login finché non confermano un'email che magari non hanno nemmeno ricevuto/controllato.

### Creazione del primo Super Admin (bootstrap manuale)

Il super admin è il primo utente e va creato a mano una sola volta:

1. Su Supabase → **Authentication > Users** → "Add user" → email e password, **Auto Confirm User** attivo.
2. Copia l'`UUID` dell'utente creato.
3. Su **SQL Editor**, esegui (sostituendo i valori):

```sql
insert into public.profiles (id, ruolo, nome)
values ('INCOLLA-QUI-UUID', 'super_admin', 'Nome Super Admin');
```

Da qui in poi, tutti gli altri account (admin azienda, utenti studio) si creano dall'interno dell'app — niente terminale, niente CLI.

---

## 2. Caricare il progetto su GitHub (via browser, senza Terminale)

1. Vai su [github.com](https://github.com), crea un nuovo repository (vuoto).
2. Sulla pagina del repository: **Add file** → **Upload files**.
3. Trascina dentro **tutto** il contenuto di questa cartella (non serve escludere nulla, è già pulita).
4. Scrivi un messaggio di commit e clicca **Commit changes**.

---

## 3. Deploy su Render

1. Su Render → **New > Web Service** → collega il repository GitHub appena creato.
2. Impostazioni:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
3. In **Environment**, aggiungi le variabili:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Render assegnerà un URL pubblico tipo `https://assistenza-studi.onrender.com`.

Ogni volta che modifichi un file su GitHub (tramite upload/modifica dal sito), Render rifà da solo il deploy in automatico.

---

## App installabile (PWA)

L'app è configurata come Progressive Web App: una volta online su Render (HTTPS automatico), può essere "installata" su telefono e computer, con icona propria e senza barra del browser. Manifest, icone e service worker sono già inclusi, nessuna configurazione aggiuntiva richiesta (attivo solo nella build di produzione, non in `npm run dev`).

## Notifiche di nuovo ticket

L'admin azienda vede un bottone "Attiva notifiche": una volta concesso il permesso del browser, ogni nuovo ticket della propria azienda fa comparire una notifica di sistema sul device — **mentre l'app è aperta** (anche minimizzata o in un'altra scheda/finestra). Non funziona ad app completamente chiusa: quello richiederebbe un sistema di push notification con backend dedicato (VAPID), non incluso in questa versione.

## Gestione utenze (Super Admin e Admin Azienda)

- **Super Admin**: nella dashboard vede l'elenco di tutti gli amministratori azienda e utenti studio, può modificarne il nome, inviare un'email di reset password, eliminare l'accesso (con richiesta di conferma), ed eliminare intere aziende (con richiesta di conferma — elimina a cascata studi, utenti e ticket collegati).
- **Admin Azienda**: dentro il pannello "Set up" può modificare il nome e resettare la password degli utenti studio che ha creato, oltre a eliminarne l'accesso.
- Il **reset password** invia un'email con un link (pagina `/reset-password` inclusa nel progetto) che permette all'utente di impostare una nuova password da solo. Funziona solo per utenti creati **dopo** questo aggiornamento (serve l'email salvata nel profilo) — chi era stato creato prima non ha l'email salvata e va ricreato, oppure gli va assegnata manualmente da SQL Editor: `update public.profiles set email = 'indirizzo@esempio.it' where id = 'UUID-UTENTE';`

---

## Note sulla foto degli allegati

- Il bucket `allegati-ticket` è **privato**: le foto non sono mai accessibili con link diretto pubblico.
- Solo admin azienda / super admin possono scaricarle (link firmato, valido 60 secondi).
- Al primo download, la foto viene **eliminata automaticamente dallo storage**: resta solo la traccia (chi e quando l'ha scaricata) nel database, non il file.
- La foto è **sempre obbligatoria** per aprire un ticket, qualunque sia il tipo.

## Prossimi miglioramenti possibili

- Notifiche email/push quando un ticket cambia stato.
- Possibilità per l'utente studio di aggiungere commenti di follow-up.
- Esportazione ticket in Excel/PDF per reportistica periodica.
- Ricerca e filtri avanzati nella dashboard admin.
