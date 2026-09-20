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

  // Livello 1: azienda aperta
  const [aziendaEspansa, setAziendaEspansa] = useState(null);
  const [amministratori, setAmministratori] = useState([]);
  const [studiAzienda, setStudiAzienda] = useState([]);

  // Livello 2: amministratore aperto (dentro l'azienda)
  const [adminEspanso, setAdminEspanso] = useState(null);
  const [utentiStudio, setUtentiStudio] = useState([]);

  // Form "aggiungi amministratore" (dentro l'azienda)
  const [nomeAdmin, setNomeAdmin] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [passwordAdmin, setPasswordAdmin] = useState('');
  const [creandoAdmin, setCreandoAdmin] = useState(false);

  // Form "aggiungi utente studio" (dentro l'amministratore)
  const [studioNuovo, setStudioNuovo] = useState('');
  const [nomeUtente, setNomeUtente] = useState('');
  const [emailUtente, setEmailUtente] = useState('');
  const [passwordUtente, setPasswordUtente] = useState('');
  const [creandoUtente, setCreandoUtente] = useState(false);

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
      setAdminEspanso(null);
      return;
    }
    setAziendaEspansa(azienda.id);
    setAdminEspanso(null);
    setErrore('');
    setSuccesso('');
    await caricaAmministratori(azienda.id);
    await caricaStudiAzienda(azienda.id);
  }

  async function caricaAmministratori(aziendaId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('azienda_id', aziendaId)
      .eq('ruolo', 'admin_azienda')
      .order('creato_il', { ascending: false });
    setAmministratori(data || []);
  }

  async function caricaStudiAzienda(aziendaId) {
    const { data } = await supabase
      .from('studi')
      .select('*')
      .eq('azienda_id', aziendaId)
      .order('nome', { ascending: true });
    setStudiAzienda(data || []);
  }

  async function apriAdmin(admin) {
    if (adminEspanso === admin.id) {
      setAdminEspanso(null);
      return;
    }
    setAdminEspanso(admin.id);
    setErrore('');
    setSuccesso('');
    await caricaUtentiStudio(admin.azienda_id);
  }

  async function caricaUtentiStudio(aziendaId) {
    const { data } = await supabase
      .from('profiles')
      .select('*, studi(nome)')
      .eq('azienda_id', aziendaId)
      .eq('ruolo', 'utente_studio')
      .order('creato_il', { ascending: false });
    setUtentiStudio(data || []);
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
      if (aziendaEspansa === azienda.id) { setAziendaEspansa(null); setAdminEspanso(null); }
      caricaAziende();
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
        azienda_id: aziendaEspansa,
        creato_da: profile.id,
      });

      if (erroreProfilo) {
        setErrore('Account creato ma errore nel collegare il profilo: ' + erroreProfilo.message);
        return;
      }

      setSuccesso('Amministratore creato con successo.');
      setNomeAdmin('');
      setEmailAdmin('');
      setPasswordAdmin('');
      caricaAmministratori(aziendaEspansa);
    } catch (err) {
      setErrore('Errore imprevisto: ' + err.message);
    } finally {
      setCreandoAdmin(false);
    }
  }

  async function creaUtenteStudio(e) {
    e.preventDefault();
    setErrore('');
    setSuccesso('');

    if (!studioNuovo) {
      setErrore('Seleziona uno studio.');
      return;
    }

    setCreandoUtente(true);

    try {
      const adminCorrente = amministratori.find(a => a.id === adminEspanso);
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
        azienda_id: adminCorrente.azienda_id,
        studio_id: studioNuovo,
        creato_da: adminCorrente.id,
      });

      if (erroreProfilo) {
        setErrore('Account creato ma errore nel collegare il profilo: ' + erroreProfilo.message);
        return;
      }

      setSuccesso('Utente studio creato con successo.');
      setNomeUtente('');
      setEmailUtente('');
      setPasswordUtente('');
      setStudioNuovo('');
      caricaUtentiStudio(adminCorrente.azienda_id);
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

  async function salvaModifica(utente, ricaricaFn) {
    setErrore('');
    setSuccesso('');
    const { error } = await supabase.from('profiles').update({ nome: nomeModificato }).eq('id', utente.id);
    if (error) {
      setErrore(error.message);
      return;
    }
    setModificaId(null);
    setSuccesso('Nome aggiornato.');
    ricaricaFn();
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

  async function eliminaUtente(utente, ricaricaFn) {
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
      if (utente.id === adminEspanso) setAdminEspanso(null);
      ricaricaFn();
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
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: -8 }}>
            Clicca su un'azienda per vedere i suoi amministratori, poi su un amministratore per vedere i suoi utenti studio.
          </p>

          {aziende.length === 0 && <p style={{ color: '#6b7280' }}>Nessuna azienda ancora.</p>}

          {aziende.map(a => (
            <div key={a.id} style={{ marginBottom: 10 }}>
              {/* LIVELLO 1: AZIENDA */}
              <div
                className="ticket-item"
                onClick={() => apriAzienda(a)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}
              >
                <strong>{aziendaEspansa === a.id ? '▾ ' : '▸ '}🏢 {a.nome}</strong>
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
                  <h3 style={{ fontSize: 15, marginTop: 0 }}>Aggiungi amministratore a "{a.nome}"</h3>
                  <form onSubmit={creaAdmin}>
                    <label>Nome e cognome</label>
                    <input value={nomeAdmin} onChange={e => setNomeAdmin(e.target.value)} required />
                    <label>Email</label>
                    <input type="email" value={emailAdmin} onChange={e => setEmailAdmin(e.target.value)} required />
                    <label>Password provvisoria</label>
                    <input type="text" value={passwordAdmin} onChange={e => setPasswordAdmin(e.target.value)} required />
                    <button className="btn" type="submit" disabled={creandoAdmin}>
                      {creandoAdmin ? 'Creazione…' : 'Crea amministratore'}
                    </button>
                  </form>

                  <h3 style={{ fontSize: 15, marginTop: 24, borderTop: '1px solid #dbe4f5', paddingTop: 16 }}>
                    Amministratori
                  </h3>
                  {amministratori.length === 0 && <p style={{ color: '#6b7280' }}>Nessun amministratore ancora.</p>}

                  {amministratori.map(admin => (
                    <div key={admin.id} style={{ marginBottom: 8 }}>
                      {/* LIVELLO 2: AMMINISTRATORE */}
                      <div
                        className="ticket-item"
                        onClick={() => apriAdmin(admin)}
                        style={{ background: 'white', cursor: 'pointer', marginBottom: 0 }}
                      >
                        {modificaId === admin.id ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <input value={nomeModificato} onChange={e => setNomeModificato(e.target.value)} style={{ marginBottom: 8 }} />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button className="btn" onClick={() => salvaModifica(admin, () => caricaAmministratori(aziendaEspansa))} style={{ padding: '6px 12px', fontSize: 13 }}>Salva</button>
                              <button className="btn btn-secondary" onClick={() => setModificaId(null)} style={{ padding: '6px 12px', fontSize: 13 }}>Annulla</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <strong>{adminEspanso === admin.id ? '▾ ' : '▸ '}👤 {admin.nome}</strong>
                              {admin.email && <div style={{ fontSize: 13, color: '#6b7280' }}>{admin.email}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                              <button className="btn btn-secondary" onClick={() => iniziaModifica(admin)} style={{ padding: '6px 12px', fontSize: 13 }}>Modifica nome</button>
                              <button className="btn btn-secondary" onClick={() => resettaPassword(admin)} style={{ padding: '6px 12px', fontSize: 13 }}>Reset password</button>
                              <button className="btn btn-danger" onClick={() => eliminaUtente(admin, () => caricaAmministratori(aziendaEspansa))} style={{ padding: '6px 12px', fontSize: 13 }}>Elimina</button>
                            </div>
                          </div>
                        )}
                      </div>

                      {adminEspanso === admin.id && (
                        <div style={{ border: '1px solid #93c5fd', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 14, background: '#eff6ff' }}>
                          <h4 style={{ fontSize: 14, marginTop: 0 }}>Aggiungi utente studio (creato da {admin.nome})</h4>
                          <form onSubmit={creaUtenteStudio}>
                            <label>Studio</label>
                            <select value={studioNuovo} onChange={e => setStudioNuovo(e.target.value)} required>
                              <option value="">Seleziona studio…</option>
                              {studiAzienda.map(s => (
                                <option key={s.id} value={s.id}>{s.nome}</option>
                              ))}
                            </select>
                            {studiAzienda.length === 0 && (
                              <p style={{ fontSize: 12, color: '#b91c1c', marginTop: -8 }}>
                                Nessuno studio ancora per questa azienda (li crea l'admin azienda dal suo pannello "Set up").
                              </p>
                            )}
                            <label>Nome e cognome</label>
                            <input value={nomeUtente} onChange={e => setNomeUtente(e.target.value)} required />
                            <label>Email</label>
                            <input type="email" value={emailUtente} onChange={e => setEmailUtente(e.target.value)} required />
                            <label>Password provvisoria</label>
                            <input type="text" value={passwordUtente} onChange={e => setPasswordUtente(e.target.value)} required />
                            <button className="btn" type="submit" disabled={creandoUtente}>
                              {creandoUtente ? 'Creazione…' : 'Crea utente studio'}
                            </button>
                          </form>

                          <h4 style={{ fontSize: 14, marginTop: 20, borderTop: '1px solid #bfdbfe', paddingTop: 14 }}>
                            Utenti studio di questa azienda
                          </h4>
                          {utentiStudio.length === 0 && <p style={{ color: '#6b7280', fontSize: 13 }}>Nessun utente studio ancora.</p>}
                          {utentiStudio.map(u => (
                            <div key={u.id} className="ticket-item" style={{ cursor: 'default', background: 'white' }}>
                              {modificaId === u.id ? (
                                <div>
                                  <input value={nomeModificato} onChange={e => setNomeModificato(e.target.value)} style={{ marginBottom: 8 }} />
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn" onClick={() => salvaModifica(u, () => caricaUtentiStudio(admin.azienda_id))} style={{ padding: '6px 12px', fontSize: 13 }}>Salva</button>
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
                                    <button className="btn btn-danger" onClick={() => eliminaUtente(u, () => caricaUtentiStudio(admin.azienda_id))} style={{ padding: '6px 12px', fontSize: 13 }}>Elimina</button>
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
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
