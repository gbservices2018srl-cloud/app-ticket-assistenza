import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { creaClientPerNuovoUtente } from '../../lib/supabaseAdminClient';
import { useProfile } from '../../lib/useProfile';
import Navbar from '../../components/Navbar';

export default function DashboardSuperAdmin() {
  const { profile, loading, logout } = useProfile();
  const [aziende, setAziende] = useState([]);
  const [utenti, setUtenti] = useState([]);
  const [nomeAzienda, setNomeAzienda] = useState('');
  const [errore, setErrore] = useState('');
  const [successo, setSuccesso] = useState('');

  const [aziendaSelezionata, setAziendaSelezionata] = useState('');
  const [nomeAdmin, setNomeAdmin] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [creandoAdmin, setCreandoAdmin] = useState(false);

  const [modificaId, setModificaId] = useState(null);
  const [nomeModificato, setNomeModificato] = useState('');

  useEffect(() => {
    if (profile) {
      caricaAziende();
      caricaUtenti();
    }
  }, [profile]);

  async function caricaAziende() {
    const { data } = await supabase.from('aziende').select('*').order('creato_il', { ascending: false });
    setAziende(data || []);
  }

  async function caricaUtenti() {
    const { data } = await supabase
      .from('profiles')
      .select('*, aziende(nome), studi(nome)')
      .in('ruolo', ['admin_azienda', 'utente_studio'])
      .order('creato_il', { ascending: false });
    setUtenti(data || []);
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

  async function eliminaAzienda(azienda) {
    if (!confirm(`Eliminare definitivamente l'azienda "${azienda.nome}"? Verranno eliminati anche tutti i suoi studi, utenti (account compresi) e ticket collegati. Questa azione non è reversibile.`)) {
      return;
    }
    setErrore('');
    setSuccesso('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const risposta = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/elimina-utente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ azione: 'azienda', id: azienda.id }),
      });
      const risultato = await risposta.json();
      if (!risposta.ok) {
        setErrore('Errore durante l\'eliminazione: ' + (risultato.errore || 'errore sconosciuto'));
        return;
      }
      setSuccesso('Azienda e tutti i suoi account eliminati.');
      caricaAziende();
      caricaUtenti();
    } catch (err) {
      setErrore('Errore imprevisto: ' + err.message);
    }
  }

  async function creaAdmin(e) {
    e.preventDefault();
    setErrore('');
    setSuccesso('');
    setCreandoAdmin(true);

    try {
      const clientTemporaneo = creaClientPerNuovoUtente();
      const { data: datiSignup, error: erroreSignup } = await clientTemporaneo.auth.signUp({
        email: emailAdmin,
        password: passwordAdmin,
      });

      if (erroreSignup) {
        setErrore('Errore nella creazione dell\'account: ' + erroreSignup.message);
        return;
      }

      const { error: erroreProfilo } = await supabase.from('profiles').insert({
        id: datiSignup.user.id,
        ruolo: 'admin_azienda',
        nome: nomeAdmin,
        email: emailAdmin,
        azienda_id: aziendaSelezionata,
        creato_da: profile.id,
      });

      if (erroreProfilo) {
        setErrore('Account creato ma errore nel collegare il profilo: ' + erroreProfilo.message);
        return;
      }

      setSuccesso('Amministratore azienda creato con successo.');
      setNomeAdmin('');
      setEmailAdmin('');
      setPasswordAdmin('');
      caricaUtenti();
    } catch (err) {
      setErrore('Errore imprevisto: ' + err.message);
    } finally {
      setCreandoAdmin(false);
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
    caricaUtenti();
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
    if (!confirm(`Eliminare definitivamente l'account di "${utente.nome}" (${utente.email || 'nessuna email salvata'})? L'account non esisterà più, l'email tornerà libera. Questa azione non è reversibile.`)) {
      return;
    }
    setErrore('');
    setSuccesso('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const risposta = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/elimina-utente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ azione: 'utente', id: utente.id }),
      });
      const risultato = await risposta.json();
      if (!risposta.ok) {
        setErrore('Errore durante l\'eliminazione: ' + (risultato.errore || 'errore sconosciuto'));
        return;
      }
      setSuccesso('Account eliminato definitivamente. L\'email può essere riutilizzata subito.');
      caricaUtenti();
    } catch (err) {
      setErrore('Errore imprevisto: ' + err.message);
    }
  }

  if (loading || !profile) return <div className="container">Caricamento…</div>;

  const amministratori = utenti.filter(u => u.ruolo === 'admin_azienda');
  const utentiStudio = utenti.filter(u => u.ruolo === 'utente_studio');

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
            <div key={a.id} className="ticket-item" style={{ cursor: 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{a.nome}</strong>
                <button className="btn btn-danger" onClick={() => eliminaAzienda(a)} style={{ padding: '6px 12px', fontSize: 13 }}>
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Amministratori azienda</h2>
          {amministratori.length === 0 && <p style={{ color: '#6b7280' }}>Nessun amministratore ancora.</p>}
          {amministratori.map(u => (
            <RigaUtente
              key={u.id}
              utente={u}
              sottotitolo={u.aziende?.nome ? `Azienda: ${u.aziende.nome}` : ''}
              inModifica={modificaId === u.id}
              nomeModificato={nomeModificato}
              onCambiaNome={setNomeModificato}
              onIniziaModifica={() => iniziaModifica(u)}
              onSalvaModifica={() => salvaModifica(u)}
              onAnnullaModifica={() => setModificaId(null)}
              onResetPassword={() => resettaPassword(u)}
              onElimina={() => eliminaUtente(u)}
            />
          ))}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Utenti studio (tutte le aziende)</h2>
          {utentiStudio.length === 0 && <p style={{ color: '#6b7280' }}>Nessun utente studio ancora.</p>}
          {utentiStudio.map(u => (
            <RigaUtente
              key={u.id}
              utente={u}
              sottotitolo={[u.aziende?.nome, u.studi?.nome].filter(Boolean).join(' — ')}
              inModifica={modificaId === u.id}
              nomeModificato={nomeModificato}
              onCambiaNome={setNomeModificato}
              onIniziaModifica={() => iniziaModifica(u)}
              onSalvaModifica={() => salvaModifica(u)}
              onAnnullaModifica={() => setModificaId(null)}
              onResetPassword={() => resettaPassword(u)}
              onElimina={() => eliminaUtente(u)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RigaUtente({
  utente, sottotitolo, inModifica, nomeModificato, onCambiaNome,
  onIniziaModifica, onSalvaModifica, onAnnullaModifica, onResetPassword, onElimina,
}) {
  return (
    <div className="ticket-item" style={{ cursor: 'default' }}>
      {inModifica ? (
        <div>
          <input value={nomeModificato} onChange={e => onCambiaNome(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onSalvaModifica} style={{ padding: '6px 12px', fontSize: 13 }}>Salva</button>
            <button className="btn btn-secondary" onClick={onAnnullaModifica} style={{ padding: '6px 12px', fontSize: 13 }}>Annulla</button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong>{utente.nome}</strong>
              {utente.email && <div style={{ fontSize: 13, color: '#6b7280' }}>{utente.email}</div>}
              {sottotitolo && <div style={{ fontSize: 13, color: '#6b7280' }}>{sottotitolo}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={onIniziaModifica} style={{ padding: '6px 12px', fontSize: 13 }}>Modifica nome</button>
              <button className="btn btn-secondary" onClick={onResetPassword} style={{ padding: '6px 12px', fontSize: 13 }}>Reset password</button>
              <button className="btn btn-danger" onClick={onElimina} style={{ padding: '6px 12px', fontSize: 13 }}>Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
