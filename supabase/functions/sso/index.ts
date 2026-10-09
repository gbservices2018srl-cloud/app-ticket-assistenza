// Funzione "sso": ingresso dall'accesso unico To Smile (appgestione.it).
// 1) appgestione.it manda qui il browser con un biglietto monouso (?ticket=...)
// 2) la funzione lo fa verificare ad appgestione.it, che risponde chi è la persona e che ruolo ha
// 3) prepara l'accesso Supabase per quella email e rimanda all'app con un codice monouso (#sso=...),
//    che l'app scambia con la sessione (verifyOtp). Nessuna email viene inviata.
// Con un biglietto "revoke" (persona disattivata o senza più accesso) blocca l'utente.
// Con "catalog" restituisce aziende e studi (per scegliere il livello nel pannello accessi).
// Con "sync" (persona appena approvata, o permessi/dati cambiati) crea o aggiorna subito utente e profilo,
// senza aspettare il primo ingresso.
// Il livello (super_admin, admin_azienda, utente_studio + quale) lo decide il pannello accessi: il profilo qui viene
// creato o aggiornato da solo, quindi nessuno deve avere una password di Ticket.
import { createClient } from "npm:@supabase/supabase-js@2";

const CENTRAL = "https://appgestione.it";
const APP = "ticket";
const APP_URL = "https://ticket.appgestione.it/";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const back = (hash: string) => new Response(null, { status: 302, headers: { Location: APP_URL + "#" + hash, "Cache-Control": "no-store" } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Ticket = { purpose: "login" | "revoke" | "catalog" | "sync" | "sedi"; sedi?: Sede[]; email: string; firstName?: string; lastName?: string;
  role?: "user" | "admin"; livello?: string | null; ente?: string | null; oldEmail?: string | null; ssoId?: string | null; figura?: string | null };

type Sede = { id: string; nome: string; sigla: string; email: string; indirizzo: string; societa: string; riuniti: number; attiva: boolean };
const normSede = (s: unknown) => String(s || "").toLowerCase().replace(/to\s*smile|studio|sede|ambulatorio/g, "").replace(/[^a-z0-9]/g, "");
// Sedi del gruppo dal pannello accessi → studi di Ticket (nome, indirizzo, azienda = società). Le sedi disattivate restano per lo storico.
async function copiaSedi(sedi: Sede[]): Promise<string[]> {
  const avvisi: string[] = [];
  // deno-lint-ignore no-explicit-any
  const aziende: any[] = (await admin.from("aziende").select("id, nome")).data || [];
  // deno-lint-ignore no-explicit-any
  const studi: any[] = (await admin.from("studi").select("id, nome, azienda_id, central_id")).data || [];
  for (const x of sedi) {
    const s = studi.find((r) => r.central_id === x.id) || studi.find((r) => !r.central_id && (normSede(r.nome) === normSede(x.nome) ||
      (normSede(r.nome).length >= 4 && normSede(x.nome).includes(normSede(r.nome)))));
    if (!s && !x.attiva) continue;
    let aziendaId = s?.azienda_id || null;
    if (x.societa) {
      let a = aziende.find((z) => String(z.nome).trim().toLowerCase() === x.societa.trim().toLowerCase());
      if (!a) {
        const { data, error } = await admin.from("aziende").insert({ nome: x.societa }).select("id, nome").single();
        if (error || !data) { avvisi.push(`${x.nome}: società non creata (${error?.message})`); continue; }
        a = data; aziende.push(a);
      }
      aziendaId = a.id;
    }
    if (!aziendaId && aziende.length === 1) aziendaId = aziende[0].id;
    if (!aziendaId) { avvisi.push(`${x.nome}: indica la società per crearla in Ticket.`); continue; }
    const row: Record<string, unknown> = { nome: x.nome, azienda_id: aziendaId, central_id: x.id };
    if (x.indirizzo) row.indirizzo = x.indirizzo;
    const { error } = s ? await admin.from("studi").update(row).eq("id", s.id) : await admin.from("studi").insert(row);
    if (error) avvisi.push(`${x.nome}: ${error.message}`); else if (s) s.central_id = x.id;
  }
  return avvisi;
}
type Esito = { ok: boolean; motivo?: string };
async function applicaLivello(id: string, t: Ticket, email: string): Promise<Esito> {
  const L = String(t.livello || "");
  const row: Record<string, unknown> = { ruolo: L, azienda_id: null, studio_id: null, email, figura: t.figura || null };
  if (L === "admin_azienda") {
    const { data } = await admin.from("aziende").select("id").eq("id", t.ente || "").maybeSingle();
    if (!data) return { ok: false, motivo: "azienda non trovata" };
    row.azienda_id = data.id;
  } else if (L === "utente_studio") {
    const { data } = await admin.from("studi").select("id, azienda_id").eq("id", t.ente || "").maybeSingle();
    if (!data) return { ok: false, motivo: "studio non trovato" };
    row.studio_id = data.id; row.azienda_id = data.azienda_id;
  } else if (L !== "super_admin") return { ok: false, motivo: "livello sconosciuto" };
  const nome = `${t.firstName || ""} ${t.lastName || ""}`.trim() || email;
  row.nome = nome;
  const { data: p } = await admin.from("profiles").select("id").eq("id", id).maybeSingle();
  const { error } = p ? await admin.from("profiles").update(row).eq("id", id)
    : await admin.from("profiles").insert({ id, ...row });
  if (error) { console.error("profilo", error.message); return { ok: false, motivo: error.message }; }
  return { ok: true };
}

// Utente Supabase della persona (lo crea se non c'è), sbloccato, con l'email attuale e collegato al suo id dell'accesso unico
async function utente(email: string, uid: string | null, ssoId?: string | null): Promise<string | null> {
  const meta = ssoId ? { app_metadata: { central_id: ssoId } } : {};
  if (uid) {
    const { error } = await admin.auth.admin.updateUserById(uid, { ban_duration: "none", email, email_confirm: true, ...meta });
    if (error) await admin.auth.admin.updateUserById(uid, { ban_duration: "none", ...meta }); // email già usata da un altro utente: resta la vecchia
    return uid;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, ...meta });
  return error || !data.user ? null : data.user.id;
}

async function catalogo() {
  const [a, s] = await Promise.all([
    admin.from("aziende").select("id, nome").order("nome"),
    admin.from("studi").select("id, nome, indirizzo, aziende(nome)").order("nome"),
  ]);
  return {
    aziende: (a.data || []).map((x) => ({ id: x.id, nome: x.nome })),
    // deno-lint-ignore no-explicit-any
    studi: (s.data || []).map((x: any) => ({ id: x.id, nome: x.nome, indirizzo: x.indirizzo || "", info: x.aziende?.nome || "" })),
  };
}

// Ticket: chi è amministratore nell'accesso unico diventa super_admin se non ha già un profilo.
// Gli altri devono avere un profilo creato dall'amministrazione (azienda e studio).
async function ensureProfile(id: string, t: Ticket, email: string): Promise<boolean> {
  const { data: p } = await admin.from("profiles").select("id").eq("id", id).maybeSingle();
  if (p) return true;
  if (t.role !== "admin") return false;
  const nome = `${t.firstName || ""} ${t.lastName || ""}`.trim() || email;
  const { error } = await admin.from("profiles").insert({ id, ruolo: "super_admin", nome, email });
  return !error;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  let ticket = url.searchParams.get("ticket") || "";
  const isPost = req.method === "POST";
  if (!ticket && isPost) { try { ticket = (await req.json()).ticket || ""; } catch { /* corpo vuoto */ } }
  if (!ticket) return isPost ? json({ error: "biglietto mancante" }, 400) : back("sso_errore=biglietto");

  const r = await fetch(CENTRAL + "/api/sso/ticket", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket, app: APP }),
  });
  if (!r.ok) return isPost ? json({ error: "biglietto non valido" }, 401) : back("sso_errore=scaduto");
  const t: Ticket = await r.json();
  const email = String(t.email || "").trim().toLowerCase();
  if (!email) return isPost ? json({ error: "email mancante" }, 400) : back("sso_errore=email");

  if (t.purpose === "catalog") return json({ enti: await catalogo() });
  if (t.purpose === "sedi") return json({ ok: true, avvisi: await copiaSedi(t.sedi || []) });

  // Chi è: prima per id dell'accesso unico (non cambia mai, nemmeno se cambia l'email), poi per email, poi per la vecchia email
  let uid: string | null = null;
  if (t.ssoId) uid = ((await admin.rpc("sso_user_by_central", { p_id: String(t.ssoId) })).data as string) || null;
  if (!uid) uid = ((await admin.rpc("sso_user_id", { p_email: email })).data as string) || null;
  if (!uid && t.oldEmail) uid = ((await admin.rpc("sso_user_id", { p_email: String(t.oldEmail).toLowerCase() })).data as string) || null;

  if (t.purpose === "sync") { // persona approvata o cambiata nel pannello: utente e profilo pronti subito
    if (!t.livello) return json({ ok: true }); // vecchio permesso senza livello: il profilo si gestisce dentro Ticket
    const id = await utente(email, uid, t.ssoId);
    if (!id) return json({ ok: false, motivo: "utente non creato" });
    return json(await applicaLivello(id, t, email));
  }

  if (t.purpose === "revoke") {
    if (uid) await admin.auth.admin.updateUserById(uid as string, { ban_duration: "876000h" });
    return json({ ok: true, blocked: !!uid });
  }

  // Nessun accesso in questa app: lo creiamo se il pannello ha scelto il livello, o per chi è amministratore.
  if (!uid && t.role !== "admin" && !t.livello) return back("sso_noprofilo=" + encodeURIComponent(email));
  const id = await utente(email, uid, t.ssoId);
  if (!id) return back("sso_errore=utente");
  const ok = t.livello ? (await applicaLivello(id, t, email)).ok : await ensureProfile(id, t, email);
  if (!ok) return back("sso_noprofilo=" + encodeURIComponent(email));

  // il link d'accesso va all'email che l'utente ha davvero qui (se la nuova email era già di un altro utente, resta la vecchia)
  const { data: au } = await admin.auth.admin.getUserById(id);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: au?.user?.email || email });
  if (linkError || !link?.properties?.hashed_token) return back("sso_errore=link");
  return back("sso=" + encodeURIComponent(link.properties.hashed_token));
});
