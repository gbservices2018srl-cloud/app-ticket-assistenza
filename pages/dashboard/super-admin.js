import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import Navbar from '../../components/Navbar';

export default function DashboardSuperAdmin() {
  const { profile, loading, logout } = useProfile();
  const [aziende, setAziende] = useState([]);
  const [nomeAzienda, setNomeAzienda] = useState('');
  const [errore, setErrore] = useState('');
  const [successo, setSuccesso] = useState('');

  const [aziendaSelezionata, setAziendaSelezionata] = useState('');
  const [nomeAdmin, setNomeAdmin] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [creandoAdmin, setCreandoAdmin] = useState(false);

  useEffect(() => {
    if (profile) caricaAziende();
  }, [profile]);

  async function caricaAziende() {
    const { data } = await supabase.from('aziende').select('*').order('creato_il', { ascending: false });
    setAziende(data || []);
  }

  async function creaAzienda(e) {
    e.preventDefault();
    setErrore('');
    setSuccesso('');
    const { error } = await supabase.from('aziende').insert({ nome: nomeAzienda });
    if (error) {
      setErrore(error.message);
      return;
    }
    setNomeAzienda('');
    setSuccesso('Azienda creata.');
    caricaAziende();
  }

  async function creaAdmin(e) {
    e.preventDefault();
    setErrore('');
    setSuccesso('');
    setCreandoAdmin(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const risposta = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/crea-utente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: emailAdmin,
          password: passwordAdmin,
          nome: nomeAdmin,
          ruolo: 'admin_azienda',
          azienda_id: aziendaSelezionata,
        }),
      });

      const risultato = await risposta.json();

      if (!risposta.ok) {
        setErrore(risultato.errore || 'Errore nella creazione dell\'admin.');
        return;
      }

      setSuccesso('Amministratore azienda creato con successo.');
      setNomeAdmin('');
      setEmailAdmin('');
      setPasswordAdmin('');
    } catch (err) {
      setErrore('Errore di connessione alla funzione di creazione utente: ' + err.message);
    } finally {
      setCreandoAdmin(false);
    }
  }

  if (loading || !profile) return <div className="container">Caricamento…</div>;

  return (
    <div>
      <Navbar titolo="Assistenza — Super Admin" nome={profile.nome} onLogout={logout} />
      <div className="container">
        {errore && <div className="errore">{errore}</div>}
        {successo && <div className="successo">{successo}</div>}

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Nuova azienda</h2>
          <form onSubmit={creaAzienda}>
            <label>Nome azienda</label>
            <input value={nomeAzienda} onChange={e => setNomeAzienda(e.target.value)} required />
            <button className="btn" type="submit">Crea azienda</button>
          </form>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Crea amministratore azienda</h2>
          <form onSubmit={creaAdmin}>
            <label>Azienda</label>
            <select value={aziendaSelezionata} onChange={e => setAziendaSelezionata(e.target.value)} required>
              <option value="">Seleziona azienda…</option>
              {aziende.map(a => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
            <label>Nome e cognome</label>
            <input value={nomeAdmin} onChange={e => setNomeAdmin(e.target.value)} required />
            <label>Email</label>
            <input type="email" value={emailAdmin} onChange={e => setEmailAdmin(e.target.value)} required />
            <label>Password provvisoria</label>
            <input type="text" value={passwordAdmin} onChange={e => setPasswordAdmin(e.target.value)} required />
            <button className="btn" type="submit" disabled={creandoAdmin}>
              {creandoAdmin ? 'Creazione…' : 'Crea admin azienda'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Aziende registrate</h2>
          {aziende.length === 0 && <p style={{ color: '#6b7280' }}>Nessuna azienda ancora.</p>}
          {aziende.map(a => (
            <div key={a.id} className="ticket-item">
              <strong>{a.nome}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
