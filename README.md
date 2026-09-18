# Assistenza Studi

App per la gestione di ticket di assistenza tra studi, amministratori di azienda e super admin.

## Ruoli

- **Super Admin**: crea le aziende e gli account degli amministratori di azienda.
- **Admin Azienda**: crea gli studi e gli accessi per i clienti degli studi; gestisce i ticket (in lavorazione / risolto).
- **Utente Studio**: apre ticket verso l'amministrazione (problema generico o guasto attrezzatura, con foto obbligatoria per i guasti).

Ogni ticket mostra sempre la **data di apertura**, oltre a data di presa in carico e data di risoluzione.

---

## 1. Setup Supabase

1. Crea un nuovo progetto su [supabase.com](https://supabase.com).
2. Vai su **SQL Editor** → New query, incolla il contenuto di `supabase/schema.sql` ed esegui. Questo crea tutte le tabelle, le policy RLS e il bucket di storage per le foto.
3. Vai su **Project Settings > API** e copia:
   - `Project URL` → useremo come `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → useremo come `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Deploy della Edge Function (creazione utenti)

La creazione di account (admin azienda, utenti studio) richiede permessi elevati che non devono mai stare nel browser. È gestita da una Edge Function:

```bash
npm install -g supabase
supabase login
supabase link --project-ref TUO-PROJECT-REF
supabase functions deploy crea-utente
```

Non serve configurare manualmente `SUPABASE_SERVICE_ROLE_KEY`: Supabase la inietta automaticamente nelle Edge Functions.

### Creazione del primo Super Admin (bootstrap manuale)

Il super admin è il primo utente e va creato a mano una sola volta:

1. Su Supabase Dashboard → **Authentication > Users** → "Add user" → inserisci email e password.
2. Copia l'`UUID` dell'utente creato.
3. Su **SQL Editor**, esegui:

```sql
insert into public.profiles (id, ruolo, nome)
values ('INCOLLA-QUI-UUID', 'super_admin', 'Nome Super Admin');
```

Da qui in poi, tutti gli altri account (admin azienda, utenti studio) si creano dall'interno dell'app.

---

## 2. Setup locale / GitHub

```bash
cd assistenza-studi
cp .env.example .env.local
# compila .env.local con i tuoi valori Supabase
npm install
npm run dev
```

Poi crea un repository su GitHub e pusha il progetto:

```bash
git init
git add .
git commit -m "Prima versione app assistenza studi"
git branch -M main
git remote add origin https://github.com/TUO-USER/assistenza-studi.git
git push -u origin main
```

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

---

## App installabile (PWA)

L'app è configurata come **Progressive Web App**: una volta pubblicata su Render (che fornisce HTTPS automaticamente, requisito obbligatorio), chi la usa può installarla come una vera app:

- **Da smartphone (Android/iOS)**: aprendo il sito da Chrome/Safari comparirà l'opzione "Aggiungi a schermata Home" (su Android appare anche un banner automatico "Installa app" grazie al componente incluso).
- **Da computer (Chrome/Edge)**: nella barra degli indirizzi compare l'icona di installazione, oppure il banner in basso mostrato automaticamente dall'app.

Una volta installata, si apre a schermo intero come un'app nativa, con icona propria, senza barra del browser.

Non serve nessuna configurazione aggiuntiva: manifest, icone e service worker sono già inclusi nel progetto (`public/manifest.json`, `public/icon-192.png`, `public/icon-512.png`, generati automaticamente da `next-pwa` in fase di build).

**Nota**: in sviluppo locale (`npm run dev`) la PWA è disattivata di proposito (i service worker in dev creano più problemi che benefici); funziona solo nella build di produzione (`npm run build && npm run start`), quindi la vedrai attiva direttamente su Render.

---

## Note sulla foto degli allegati

- Il bucket `allegati-ticket` è **privato**: le foto non sono mai accessibili con link diretto pubblico.
- Solo admin azienda / super admin possono scaricarle (link firmato, valido 60 secondi).
- Al primo download, la foto viene **eliminata automaticamente dallo storage**, come richiesto: resta solo la traccia (chi e quando l'ha scaricata) nel database, non il file.

## Prossimi miglioramenti possibili

- Notifiche email/push quando un ticket cambia stato.
- Possibilità per l'utente studio di aggiungere commenti di follow-up.
- Esportazione ticket in Excel/PDF per reportistica periodica.
- Ricerca e filtri avanzati (per data, per studio, per tipo) nella dashboard admin.
