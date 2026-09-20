import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { creaClientPerNuovoUtente } from '../../lib/supabaseAdminClient';
import { useProfile } from '../../lib/useProfile';
import Navbar from '../../components/Navbar';

export default function DashboardSuperAdmin() {
  const { profile, loading, logout } = useProfile();
  const [aziende, setAziende] = useState([]);
  const [nomeAzienda, setNomeAzienda] = useState('');
  const [errore, setErrore] = useState('');
  const [successo, setSuccesso] = useState('');

  // Azienda aperta (drill-down) e i suoi dati
  const [aziendaEspansa, setAziendaEspansa] = useState(null);
  const [utentiAzienda, setUtentiAzienda] = useState([]);
  const [studiAzienda, setStudiAzienda] = useState([]);

  // Form "aggiungi utente" dentro l'azienda espansa
  const [ruoloNuovo, setRuoloNuovo] = useState('utente_studio');
  const [studioNuovo, setStudioNuovo] = useState('');
  const [nomeNuovo, setNomeNuovo] = useState('');
  const [emailNuovo, setEmailNuovo] = useState('');
  const [passwordNuovo, setPasswordNuovo] = useState('');
  const [creando, setCreando] = useState(false);

  const [modificaId, setModificaId] = useState(null);
  const [nomeModificato, setNomeModificato] = useState('');

  useEffect(() => {
    if (profile) caricaAziende();
  }, [profile]);

  async function caricaAziende() {
    const { data } = await supabase.from('aziende').select('*').order('creato_il', { ascending: false });
    setAziende(data || []);
  }

  async function apriAzienda(azienda) {
    if (aziendaEspansa === azienda.id) {
      setAziendaEspansa(null);
      return;
    }
    setAziendaEspansa(azienda.id);
    setErrore('');
    setSuccesso('');
    await caricaDatiAzienda(azienda.id);
  }

  async function caricaDatiAzienda(aziendaId) {
    const { data: utenti } = await supabase
      .from('profiles')
      .select('*, studi(nome)')
      .eq('azienda_id', aziendaId)
      .order('ruolo', { ascending: true })
      .order('creato_il', { ascending: false });
    setUtentiAzienda(utenti || []);

    const { data: studi } = await supabase
      .from('studi')
      .select('*')
      .eq('azienda_id', aziendaId)
      .order('nome', { ascending: true });
    setStudiAzienda(studi || []);
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
      if (aziendaEspansa === azienda.id) setAziendaEspansa(null);
      caricaAziende();
    } catch (err) {
      setErrore('Errore imprevisto: ' + err.message);
    }
  }

  async function creaUtenteInAzienda(e) {
    e.preventDefault();
    setErrore('');
    setSuccesso('');

    if (ruoloNuovo === 'utente_studio' && !studioNuovo) {
      setErrore('Seleziona uno studio per l\'utente studio.');
      return;
    }

    setCreando(true);

    try {
      const clientTemporaneo = creaClientPerNuovoUtente();
      const { data: datiSignup, error: erroreSignup } = await clientTemporaneo.auth.signUp({
        email: emailNuovo,
        password: passwordNuovo,
      });

      if (erroreSignup) {
        setErrore('Errore nella creazione dell\'account: ' + erroreSignup.message);
        return;
      }

      const { error: erroreProfilo } = await supabase.from('profiles').insert({
        id: datiSignup.user.id,
        ruolo: ruoloNuovo,
        nome: nomeNuovo,
        email: emailNuovo,
        azienda_id: aziendaEspansa,
        studio_id: ruoloNuovo === 'utente_studio' ? studioNuovo : null,
        creato_da: profile.id,
      });

      if (erroreProfilo) {
        setErrore('Account creato ma errore nel collegare il profilo: ' + erroreProfilo.message);
        return;
      }

      setSuccesso('Utente creato con successo.');
      setNomeNuovo('');
      setEmailNuovo('');
      setPasswordNuovo('');
      setStudioNuovo('');
      caricaDatiAzienda(aziendaEspansa);
    } catch (err) {
      setErrore('Errore imprevisto: ' + err.message);
    } finally {
      setCreando(false);
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
    caricaDatiAzienda(aziendaEspansa);
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
      caricaDatiAzienda(aziendaEspansa);
    } catch (err) {
      setErrore('Errore imprevisto: ' + err.message);
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
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Aziende registrate</h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: -8 }}>Clicca su un'azienda per vedere e gestire i suoi utenti.</p>

          {aziende.length === 0 && <p style={{ color: '#6b7280' }}>Nessuna azienda ancora.</p>}

          {aziende.map(a => (
            <div key={a.id} style={{ marginBottom: 10 }}>
              <div
                className="ticket-item"
                onClick={() => apriAzienda(a)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}
              >
                <strong>{aziendaEspansa === a.id ? '▾ ' : '▸ '}{a.nome}</strong>
                <button
                  className="btn btn-danger"
                  onClick={(e) => { e.stopPropagation(); eliminaAzienda(a); }}
                  style={{ padding: '6px 12px', fontSize: 13 }}
                >
                  Elimina azienda
                </button>
              </div>

              {aziendaEspansa === a.id && (
                <div style={{ border: '1px solid #2563eb', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 16, background: '#f8faff' }}>
                  <h3 style={{ fontSize: 15, marginTop: 0 }}>Aggiungi utente a "{a.nome}"</h3>
                  <form onSubmit={creaUtenteInAzienda}>
                    <label>Ruolo</label>
                    <select value={ruoloNuovo} onChange={e => setRuoloNuovo(e.target.value)}>
                      <option value="admin_azienda">Amministratore azienda</option>
                      <option value="utente_studio">Utente studio</option>
                    </select>

                    {ruoloNuovo === 'utente_studio' && (
                      <>
                        <label>Studio</label>
                        <select value={studioNuovo} onChange={e => setStudioNuovo(e.target.value)}>
                          <option value="">Seleziona studio…</option>
                          {studiAzienda.map(s => (
                            <option key={s.id} value={s.id}>{s.nome}</option>
                          ))}
                        </select>
                        {studiAzienda.length === 0 && (
                          <p style={{ fontSize: 12, color: '#b91c1c', marginTop: -8 }}>
                            Questa azienda non ha ancora studi creati (li crea l'admin azienda dal suo pannello).
                          </p>
                        )}
                      </>
                    )}

                    <label>Nome e cognome</label>
                    <input value={nomeNuovo} onChange={e => setNomeNuovo(e.target.value)} required />
                    <label>Email</label>
                    <input type="email" value={emailNuovo} onChange={e => setEmailNuovo(e.target.value)} required />
                    <label>Password provvisoria</label>
                    <input type="text" value={passwordNuovo} onChange={e => setPasswordNuovo(e.target.value)} required />
                    <button className="btn" type="submit" disabled={creando}>
                      {creando ? 'Creazione…' : 'Crea utente'}
                    </button>
                  </form>

                  <h3 style={{ fontSize: 15, marginTop: 24, borderTop: '1px solid #dbe4f5', paddingTop: 16 }}>
                    Utenti di questa azienda
                  </h3>
                  {utentiAzienda.length === 0 && <p style={{ color: '#6b7280' }}>Nessun utente ancora.</p>}
                  {utentiAzienda.map(u => (
                    <div key={u.id} className="ticket-item" style={{ cursor: 'default', background: 'white' }}>
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
                            <span className="badge badge-tipo" style={{ marginLeft: 8 }}>
                              {u.ruolo === 'admin_azienda' ? 'Admin azienda' : 'Utente studio'}
                            </span>
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
