import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import Navbar from '../../components/Navbar';
import TicketList from '../../components/TicketList';

export default function DashboardAdminAzienda() {
  const { profile, loading, logout } = useProfile();
  const [studi, setStudi] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [filtroStato, setFiltroStato] = useState('tutti');
  const [errore, setErrore] = useState('');
  const [successo, setSuccesso] = useState('');
  const [mostraSetup, setMostraSetup] = useState(false);

  const [nomeStudio, setNomeStudio] = useState('');
  const [indirizzoStudio, setIndirizzoStudio] = useState('');

  const [studioSelezionato, setStudioSelezionato] = useState('');
  const [nomeUtente, setNomeUtente] = useState('');
  const [emailUtente, setEmailUtente] = useState('');
  const [passwordUtente, setPasswordUtente] = useState('');
  const [creandoUtente, setCreandoUtente] = useState(false);

  useEffect(() => {
    if (profile) {
      caricaStudi();
      caricaTickets();
    }
  }, [profile, filtroStato]);

  async function caricaStudi() {
    const { data } = await supabase
      .from('studi')
      .select('*')
      .eq('azienda_id', profile.azienda_id)
      .order('creato_il', { ascending: false });
    setStudi(data || []);
  }

  async function caricaTickets() {
    let query = supabase
      .from('tickets')
      .select('*, studi(nome)')
      .eq('azienda_id', profile.azienda_id)
      .order('creato_il', { ascending: false });

    if (filtroStato !== 'tutti') query = query.eq('stato', filtroStato);

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
      const { data: { session } } = await supabase.auth.getSession();

      const risposta = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/crea-utente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: emailUtente,
          password: passwordUtente,
          nome: nomeUtente,
          ruolo: 'utente_studio',
          azienda_id: profile.azienda_id,
          studio_id: studioSelezionato,
        }),
      });

      const risultato = await risposta.json();

      if (!risposta.ok) {
        setErrore(risultato.errore || 'Errore nella creazione dell\'utente.');
        return;
      }

      setSuccesso('Utente studio creato con successo.');
      setNomeUtente('');
      setEmailUtente('');
      setPasswordUtente('');
    } catch (err) {
      setErrore('Errore di connessione alla funzione di creazione utente: ' + err.message);
    } finally {
      setCreandoUtente(false);
    }
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
          </div>
        )}

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Ticket ricevuti</h2>
            <select style={{ width: 200, marginBottom: 0 }} value={filtroStato} onChange={e => setFiltroStato(e.target.value)}>
              <option value="tutti">Tutti gli stati</option>
              <option value="aperto">Aperti</option>
              <option value="in_lavorazione">In lavorazione</option>
              <option value="risolto">Risolti</option>
            </select>
          </div>
          <TicketList tickets={tickets} mostraStudio />
        </div>
      </div>
    </div>
  );
}
