import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { creaClientPerNuovoUtente } from '../../lib/supabaseAdminClient';
import { useProfile } from '../../lib/useProfile';
import { notificheSupportate, statoPermessoNotifiche, richiediPermessoNotifiche, mostraNotifica } from '../../lib/notifiche';
import Navbar from '../../components/Navbar';
import TicketList from '../../components/TicketList';

const TAB_STATO = [
  { valore: 'attivi', etichetta: 'Da gestire' },
  { valore: 'aperto', etichetta: 'Aperti' },
  { valore: 'in_lavorazione', etichetta: 'In lavorazione' },
  { valore: 'risolto', etichetta: 'Risolti' },
  { valore: 'tutti', etichetta: 'Tutti' },
];

export default function DashboardAdminAzienda() {
  const { profile, loading, logout } = useProfile();
  const [studi, setStudi] = useState([]);
  const [utentiStudio, setUtentiStudio] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [filtroStato, setFiltroStato] = useState('attivi');
  const [filtroSede, setFiltroSede] = useState('tutte');
  const [errore, setErrore] = useState('');
  const [successo, setSuccesso] = useState('');
  const [mostraSetup, setMostraSetup] = useState(false);
  const [permessoNotifiche, setPermessoNotifiche] = useState('default');

  const [nomeStudio, setNomeStudio] = useState('');
  const [indirizzoStudio, setIndirizzoStudio] = useState('');

  const [studioSelezionato, setStudioSelezionato] = useState('');
  const [nomeUtente, setNomeUtente] = useState('');
  const [emailUtente, setEmailUtente] = useState('');
  const [passwordUtente, setPasswordUtente] = useState('');
  const [creandoUtente, setCreandoUtente] = useState(false);

  const [modificaId, setModificaId] = useState(null);
  const [nomeModificato, setNomeModificato] = useState('');

  useEffect(() => {
    if (profile) {
      caricaStudi();
      caricaUtentiStudio();
      caricaTickets();
      setPermessoNotifiche(statoPermessoNotifiche());
    }
  }, [profile, filtroStato, filtroSede]);

  // Sottoscrizione realtime: mostra una notifica quando arriva un nuovo ticket
  useEffect(() => {
    if (!profile) return;

    const canale = supabase
      .channel('nuovi-ticket-' + profile.azienda_id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tickets', filter: `azienda_id=eq.${profile.azienda_id}` },
        (payload) => {
          const nuovoTicket = payload.new;
          mostraNotifica('Nuovo ticket ricevuto', nuovoTicket.titolo);
          caricaTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canale);
    };
  }, [profile?.azienda_id]);

  async function attivaNotifiche() {
    const risultato = await richiediPermessoNotifiche();
    setPermessoNotifiche(risultato);
  }

  async function caricaStudi() {
    const { data } = await supabase
      .from('studi')
      .select('*')
      .eq('azienda_id', profile.azienda_id)
      .order('creato_il', { ascending: false });
    setStudi(data || []);
  }

  async function caricaUtentiStudio() {
    const { data } = await supabase
      .from('profiles')
      .select('*, studi(nome)')
      .eq('azienda_id', profile.azienda_id)
      .eq('ruolo', 'utente_studio')
      .order('creato_il', { ascending: false });
    setUtentiStudio(data || []);
  }

  async function caricaTickets() {
    let query = supabase
      .from('tickets')
      .select('*, studi(nome)')
      .eq('azienda_id', profile.azienda_id)
      .order('creato_il', { ascending: false });

    if (filtroStato === 'attivi') query = query.in('stato', ['aperto', 'in_lavorazione']);
    else if (filtroStato !== 'tutti') query = query.eq('stato', filtroStato);

    if (filtroSede !== 'tutte') query = query.eq('studio_id', filtroSede);

    const { data } = await query;
    setTickets(data || []);
  }

  async function creaStudio(e) {
    e.preventDefault();
    setErrore('');
    setSuccesso('');
    const { error } = await supabase.from('studi').insert({
      azienda_id: profile.azienda_id,
      nome: nomeStudio,
      indirizzo: indirizzoStudio,
    });
    if (error) {
      setErrore(error.message);
      return;
    }
    setNomeStudio('');
    setIndirizzoStudio('');
    setSuccesso('Studio creato.');
    caricaStudi();
  }

  async function creaUtenteStudio(e) {
    e.preventDefault();
    setErrore('');
    setSuccesso('');
    setCreandoUtente(true);

    try {
      const clientTemporaneo = creaClientPerNuovoUtente();
      const { data: datiSignup, error: erroreSignup } = await clientTemporaneo.auth.signUp({
        email: emailUtente,
        password: passwordUtente,
      });

      if (erroreSignup) {
        setErrore('Errore nella creazione dell\'account: ' + erroreSignup.message);
        return;
      }

      const { error: erroreProfilo } = await supabase.from('profiles').insert({
        id: datiSignup.user.id,
        ruolo: 'utente_studio',
        nome: nomeUtente,
        email: emailUtente,
        azienda_id: profile.azienda_id,
        studio_id: studioSelezionato,
        creato_da: profile.id,
      });

      if (erroreProfilo) {
        setErrore('Account creato ma errore nel collegare il profilo: ' + erroreProfilo.message);
        return;
      }

      setSuccesso('Utente studio creato con successo.');
      setNomeUtente('');
      setEmailUtente('');
      setPasswordUtente('');
      caricaUtentiStudio();
    } catch (err) {
      setErrore('Errore imprevisto: ' + err.message);
    } finally {
      setCreandoUtente(false);
    }
  }

  function iniziaModifica(utente) {
    setModificaId(utente.id);
    setNomeModificato(utente.nome);
  }

  async function salvaModifica(utente) {
    setErrore('');
    setSuccesso('');
    const { error } = await supabase.from('profiles').update({ nome: nomeModificato }).eq('id', utente.id);
    if (error) {
      setErrore(error.message);
      return;
    }
    setModificaId(null);
    setSuccesso('Nome aggiornato.');
    caricaUtentiStudio();
  }

  async function resettaPassword(utente) {
    if (!utente.email) {
      setErrore('Questo profilo non ha un\'email salvata (creato prima dell\'aggiornamento): non è possibile inviare il reset automatico.');
      return;
    }
    setErrore('');
    setSuccesso('');
    const { error } = await supabase.auth.resetPasswordForEmail(utente.email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
    });
    if (error) {
      setErrore('Errore nell\'invio dell\'email di reset: ' + error.message);
      return;
    }
    setSuccesso(`Email di reset password inviata a ${utente.email}.`);
  }

  async function eliminaUtente(utente) {
    if (!confirm(`Eliminare l'accesso di "${utente.nome}"? Non potrà più accedere all'app. Questa azione non è reversibile.`)) {
      return;
    }
    setErrore('');
    setSuccesso('');
    const { error } = await supabase.from('profiles').delete().eq('id', utente.id);
    if (error) {
      setErrore(error.message);
      return;
    }
    setSuccesso('Utente eliminato.');
    caricaUtentiStudio();
  }

  if (loading || !profile) return <div className="container">Caricamento…</div>;

  return (
    <div>
      <Navbar
        titolo="Assistenza — Amministrazione"
        nome={profile.nome}
        onLogout={logout}
        azioneExtra={
          <button className="btn btn-secondary" onClick={() => setMostraSetup(!mostraSetup)}>
            ⚙️ Set up
          </button>
        }
      />
      <div className="container">
        {errore && <div className="errore">{errore}</div>}
        {successo && <div className="successo">{successo}</div>}

        {notificheSupportate() && permessoNotifiche !== 'granted' && (
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 14 }}>🔔 Attiva le notifiche per essere avvisato quando arriva un nuovo ticket.</span>
            <button className="btn" onClick={attivaNotifiche}>Attiva notifiche</button>
          </div>
        )}

        {mostraSetup && (
          <div className="card" style={{ borderColor: '#2563eb', borderWidth: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Set up</h2>
              <button className="btn btn-secondary" onClick={() => setMostraSetup(false)}>Chiudi ✕</button>
            </div>

            <h3 style={{ fontSize: 15, marginTop: 18 }}>Nuovo studio</h3>
            <form onSubmit={creaStudio}>
              <label>Nome studio</label>
              <input value={nomeStudio} onChange={e => setNomeStudio(e.target.value)} required />
              <label>Indirizzo</label>
              <input value={indirizzoStudio} onChange={e => setIndirizzoStudio(e.target.value)} />
              <button className="btn" type="submit">Crea studio</button>
            </form>

            <h3 style={{ fontSize: 15, marginTop: 24, borderTop: '1px solid #e5e7eb', paddingTop: 18 }}>
              Crea accesso per uno studio
            </h3>
            <form onSubmit={creaUtenteStudio}>
              <label>Studio</label>
              <select value={studioSelezionato} onChange={e => setStudioSelezionato(e.target.value)} required>
                <option value="">Seleziona studio…</option>
                {studi.map(s => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
              <label>Nome e cognome</label>
              <input value={nomeUtente} onChange={e => setNomeUtente(e.target.value)} required />
              <label>Email</label>
              <input type="email" value={emailUtente} onChange={e => setEmailUtente(e.target.value)} required />
              <label>Password provvisoria</label>
              <input type="text" value={passwordUtente} onChange={e => setPasswordUtente(e.target.value)} required />
              <button className="btn" type="submit" disabled={creandoUtente}>
                {creandoUtente ? 'Creazione…' : 'Crea accesso studio'}
              </button>
            </form>

            <h3 style={{ fontSize: 15, marginTop: 24, borderTop: '1px solid #e5e7eb', paddingTop: 18 }}>
              Studi esistenti
            </h3>
            {studi.length === 0 && <p style={{ color: '#6b7280' }}>Nessuno studio ancora.</p>}
            {studi.map(s => (
              <div key={s.id} className="ticket-item" style={{ cursor: 'default' }}>
                <strong>{s.nome}</strong>
                {s.indirizzo && <div style={{ fontSize: 13, color: '#6b7280' }}>{s.indirizzo}</div>}
              </div>
            ))}

            <h3 style={{ fontSize: 15, marginTop: 24, borderTop: '1px solid #e5e7eb', paddingTop: 18 }}>
              Utenti studio — modifica e reset password
            </h3>
            {utentiStudio.length === 0 && <p style={{ color: '#6b7280' }}>Nessun utente studio ancora.</p>}
            {utentiStudio.map(u => (
              <div key={u.id} className="ticket-item" style={{ cursor: 'default' }}>
                {modificaId === u.id ? (
                  <div>
                    <input value={nomeModificato} onChange={e => setNomeModificato(e.target.value)} style={{ marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" onClick={() => salvaModifica(u)} style={{ padding: '6px 12px', fontSize: 13 }}>Salva</button>
                      <button className="btn btn-secondary" onClick={() => setModificaId(null)} style={{ padding: '6px 12px', fontSize: 13 }}>Annulla</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <strong>{u.nome}</strong>
                      {u.email && <div style={{ fontSize: 13, color: '#6b7280' }}>{u.email}</div>}
                      {u.studi?.nome && <div style={{ fontSize: 13, color: '#6b7280' }}>Sede: {u.studi.nome}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" onClick={() => iniziaModifica(u)} style={{ padding: '6px 12px', fontSize: 13 }}>Modifica nome</button>
                      <button className="btn btn-secondary" onClick={() => resettaPassword(u)} style={{ padding: '6px 12px', fontSize: 13 }}>Reset password</button>
                      <button className="btn btn-danger" onClick={() => eliminaUtente(u)} style={{ padding: '6px 12px', fontSize: 13 }}>Elimina</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Ticket ricevuti</h2>
            <select style={{ width: 200, marginBottom: 0 }} value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
              <option value="tutte">Tutte le sedi</option>
              {studi.map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 12 }}>
            {TAB_STATO.map(t => (
              <span
                key={t.valore}
                onClick={() => setFiltroStato(t.valore)}
                style={{
                  display: 'inline-block', padding: '8px 14px', borderRadius: 999, fontSize: 13,
                  fontWeight: 600, cursor: 'pointer', marginRight: 8, marginBottom: 8,
                  background: filtroStato === t.valore ? '#2563eb' : '#eef0f3',
                  color: filtroStato === t.valore ? 'white' : '#1a1a1a',
                }}
              >
                {t.etichetta}
              </span>
            ))}
          </div>

          <TicketList tickets={tickets} mostraStudio />
        </div>
      </div>
    </div>
  );
}
