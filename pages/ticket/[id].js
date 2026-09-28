import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useProfile, formattaData } from '../../lib/useProfile';
import Navbar from '../../components/Navbar';

const ETICHETTE_STATO = {
  aperto: 'Aperto',
  in_lavorazione: 'In lavorazione',
  risolto: 'Risolto',
};

const ETICHETTE_TIPO = {
  problema_generico: 'Problema generico',
  guasto_attrezzatura: 'Guasto attrezzatura',
};

export default function DettaglioTicket() {
  const router = useRouter();
  const { id } = router.query;
  const { profile, loading, logout } = useProfile();

  const [ticket, setTicket] = useState(null);
  const [allegati, setAllegati] = useState([]);
  const [soluzioni, setSoluzioni] = useState([]);
  const [testoSoluzione, setTestoSoluzione] = useState('');
  const [errore, setErrore] = useState('');
  const [successo, setSuccesso] = useState('');
  const [aggiornando, setAggiornando] = useState(false);

  const [costi, setCosti] = useState([]);
  const [importoCosto, setImportoCosto] = useState('');
  const [descrizioneCosto, setDescrizioneCosto] = useState('');
  const [dataCosto, setDataCosto] = useState(() => new Date().toISOString().slice(0, 10));
  const [salvandoCosto, setSalvandoCosto] = useState(false);

  const isAmministrazione = profile && (profile.ruolo === 'admin_azienda' || profile.ruolo === 'super_admin');

  useEffect(() => {
    if (id && profile) caricaTutto();
  }, [id, profile]);

  async function caricaTutto() {
    const { data: t } = await supabase.from('tickets').select('*, studi(nome)').eq('id', id).single();
    setTicket(t);

    const { data: a } = await supabase
      .from('ticket_allegati')
      .select('*')
      .eq('ticket_id', id)
      .eq('eliminato', false);
    setAllegati(a || []);

    const { data: s } = await supabase
      .from('ticket_soluzioni')
      .select('*')
      .eq('ticket_id', id)
      .order('risolto_il', { ascending: false });
    setSoluzioni(s || []);

    // Il caricamento è tentato per tutti; le regole di sicurezza (RLS) su
    // Supabase decidono cosa arriva davvero: l'amministrazione vede tutto,
    // lo studio vede solo i costi dei propri ticket (sola lettura).
    const { data: c } = await supabase
      .from('ticket_costi')
      .select('*')
      .eq('ticket_id', id)
      .order('data_costo', { ascending: false });
    setCosti(c || []);
  }

  async function aggiungiCosto(e) {
    e.preventDefault();
    setErrore('');
    setSuccesso('');

    const valore = parseFloat(importoCosto.replace(',', '.'));
    if (isNaN(valore) || valore < 0) {
      setErrore('Inserisci un importo valido.');
      return;
    }

    setSalvandoCosto(true);

    const { error } = await supabase.from('ticket_costi').insert({
      ticket_id: ticket.id,
      azienda_id: ticket.azienda_id,
      studio_id: ticket.studio_id,
      nome_studio: ticket.studi?.nome || null,
      titolo_ticket: ticket.titolo,
      importo: valore,
      descrizione: descrizioneCosto || null,
      data_costo: dataCosto,
      inserito_da: profile.id,
    });

    setSalvandoCosto(false);

    if (error) {
      setErrore('Errore nel salvataggio del costo: ' + error.message);
      return;
    }

    setImportoCosto('');
    setDescrizioneCosto('');
    setDataCosto(new Date().toISOString().slice(0, 10));
    setSuccesso('Costo registrato.');
    caricaTutto();
  }

  async function eliminaCosto(costo) {
    if (!confirm('Eliminare questa voce di costo?')) return;
    setErrore('');
    const { error } = await supabase.from('ticket_costi').delete().eq('id', costo.id);
    if (error) {
      setErrore('Errore durante l\'eliminazione: ' + error.message);
      return;
    }
    caricaTutto();
  }

  async function scaricaFoto(allegato) {
    const nomeFile = allegato.storage_path.split('/').pop();
    const { data, error } = await supabase.storage
      .from('allegati-ticket')
      .createSignedUrl(allegato.storage_path, 60);

    if (error) {
      setErrore('Errore nel recupero della foto: ' + error.message);
      return;
    }

    try {
      // Scarica davvero i byte del file PRIMA di cancellarlo dallo storage,
      // per essere certi che il download sia completato con successo.
      const rispostaFile = await fetch(data.signedUrl);
      if (!rispostaFile.ok) {
        setErrore('Errore nel download della foto: il file potrebbe non essere più disponibile.');
        return;
      }
      const blob = await rispostaFile.blob();
      const urlBlob = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlBlob;
      link.download = nomeFile;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(urlBlob);
    } catch (err) {
      setErrore('Errore nel download della foto: ' + err.message);
      return;
    }

    // Segna come scaricata
    await supabase
      .from('ticket_allegati')
      .update({ scaricato: true, scaricato_il: new Date().toISOString(), scaricato_da: profile.id })
      .eq('id', allegato.id);

    // Elimina il file dallo storage e marca come eliminato (sparisce dopo il download)
    await supabase.storage.from('allegati-ticket').remove([allegato.storage_path]);
    await supabase.from('ticket_allegati').update({ eliminato: true }).eq('id', allegato.id);

    setSuccesso('Foto scaricata. Non sarà più disponibile per un nuovo download.');
    caricaTutto();
  }

  async function prendiInCarico() {
    setAggiornando(true);
    await supabase
      .from('tickets')
      .update({ stato: 'in_lavorazione', assegnato_a: profile.id, presa_in_carico_il: new Date().toISOString() })
      .eq('id', id);
    setAggiornando(false);
    caricaTutto();
  }

  async function segnaRisolto(e) {
    e.preventDefault();
    if (!testoSoluzione.trim()) {
      setErrore('Inserisci una descrizione della soluzione trovata.');
      return;
    }
    setAggiornando(true);
    setErrore('');

    await supabase.from('ticket_soluzioni').insert({
      ticket_id: id,
      testo_soluzione: testoSoluzione,
      risolto_da: profile.id,
    });

    await supabase
      .from('tickets')
      .update({ stato: 'risolto', risolto_il: new Date().toISOString() })
      .eq('id', id);

    setTestoSoluzione('');
    setAggiornando(false);
    caricaTutto();
  }

  async function eliminaTicket() {
    if (!confirm('Eliminare definitivamente questo ticket? Verranno eliminate anche la soluzione e la cronologia collegate. Questa azione non è reversibile.')) {
      return;
    }
    setErrore('');
    const { error } = await supabase.from('tickets').delete().eq('id', id);
    if (error) {
      setErrore('Errore durante l\'eliminazione: ' + error.message);
      return;
    }
    router.push(profile.ruolo === 'super_admin' ? '/dashboard/super-admin' : '/dashboard/admin-azienda');
  }

  if (loading || !profile || !ticket) return <div className="container">Caricamento…</div>;

  return (
    <div>
      <Navbar titolo="Dettaglio ticket" nome={profile.nome} onLogout={logout} />
      <div className="container">
        <button className="btn btn-secondary" onClick={() => router.back()} style={{ marginBottom: 16 }}>
          ← Torna indietro
        </button>

        {errore && <div className="errore">{errore}</div>}
        {successo && <div className="successo">{successo}</div>}

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2 style={{ marginTop: 0 }}>{ticket.titolo}</h2>
            <div>
              <span className={`badge badge-${ticket.stato}`}>{ETICHETTE_STATO[ticket.stato]}</span>
              <span className="badge badge-tipo">{ETICHETTE_TIPO[ticket.tipo]}</span>
            </div>
          </div>

          <p className="data-apertura" style={{ fontSize: 14, marginBottom: 16 }}>
            <strong>Data apertura:</strong> {formattaData(ticket.creato_il)}
            {ticket.studi && <> — Studio: {ticket.studi.nome}</>}
          </p>

          <p>{ticket.descrizione}</p>

          {ticket.presa_in_carico_il && (
            <p style={{ fontSize: 13, color: '#6b7280' }}>Presa in carico il {formattaData(ticket.presa_in_carico_il)}</p>
          )}
          {ticket.risolto_il && (
            <p style={{ fontSize: 13, color: '#6b7280' }}>Risolto il {formattaData(ticket.risolto_il)}</p>
          )}
        </div>

        {allegati.length > 0 && (
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Foto allegata</h3>
            {allegati.map(a => (
              <div key={a.id} style={{ marginBottom: 8 }}>
                {isAmministrazione ? (
                  <button className="btn" onClick={() => scaricaFoto(a)}>Scarica foto</button>
                ) : (
                  <p style={{ color: '#6b7280', fontSize: 13 }}>Foto allegata, visibile solo all'amministrazione.</p>
                )}
              </div>
            ))}
            <p style={{ fontSize: 12, color: '#9ca3af' }}>
              Nota: una volta scaricata dall'amministrazione, la foto viene rimossa definitivamente.
            </p>
          </div>
        )}

        {soluzioni.length > 0 && (
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Soluzione</h3>
            {soluzioni.map(s => (
              <div key={s.id} style={{ marginBottom: 10 }}>
                <p style={{ margin: 0 }}>{s.testo_soluzione}</p>
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Risolto il {formattaData(s.risolto_il)}</p>
              </div>
            ))}
          </div>
        )}

        {costi.length > 0 && (
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Costo sostenuto</h3>

            <div style={{ marginBottom: isAmministrazione ? 16 : 0 }}>
              {costi.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e5e7eb', padding: '8px 0' }}>
                  <div>
                    <strong>€ {Number(c.importo).toFixed(2)}</strong>
                    {c.descrizione && <div style={{ fontSize: 13, color: '#6b7280' }}>{c.descrizione}</div>}
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(c.data_costo).toLocaleDateString('it-IT')}</div>
                  </div>
                  {isAmministrazione && (
                    <button className="btn btn-danger" onClick={() => eliminaCosto(c)} style={{ padding: '4px 10px', fontSize: 12 }}>
                      Elimina
                    </button>
                  )}
                </div>
              ))}
              <div style={{ textAlign: 'right', marginTop: 8, fontWeight: 700 }}>
                Totale: € {costi.reduce((tot, c) => tot + Number(c.importo), 0).toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {isAmministrazione && (
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Aggiungi costo</h3>
            <form onSubmit={aggiungiCosto}>
              <label>Importo (€)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Es. 45,00"
                value={importoCosto}
                onChange={e => setImportoCosto(e.target.value)}
                required
              />
              <label>Data</label>
              <input type="date" value={dataCosto} onChange={e => setDataCosto(e.target.value)} required />
              <label>Descrizione (facoltativa)</label>
              <input
                type="text"
                placeholder="Es. Sostituzione toner, intervento tecnico esterno…"
                value={descrizioneCosto}
                onChange={e => setDescrizioneCosto(e.target.value)}
              />
              <button className="btn" type="submit" disabled={salvandoCosto}>
                {salvandoCosto ? 'Salvataggio…' : 'Aggiungi costo'}
              </button>
            </form>
          </div>
        )}

        {isAmministrazione && ticket.stato === 'risolto' && (
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Gestione ticket</h3>
            <button className="btn btn-danger" onClick={eliminaTicket}>
              Elimina ticket
            </button>
          </div>
        )}

        {isAmministrazione && ticket.stato !== 'risolto' && (
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Gestione ticket</h3>
            {ticket.stato === 'aperto' && (
              <button className="btn" onClick={prendiInCarico} disabled={aggiornando}>
                Prendi in lavorazione
              </button>
            )}
            {ticket.stato === 'in_lavorazione' && (
              <form onSubmit={segnaRisolto} style={{ marginTop: 12 }}>
                <label>Descrivi la soluzione trovata</label>
                <textarea rows={4} value={testoSoluzione} onChange={e => setTestoSoluzione(e.target.value)} required />
                <button className="btn" type="submit" disabled={aggiornando}>
                  {aggiornando ? 'Salvataggio…' : 'Segna come risolto'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
