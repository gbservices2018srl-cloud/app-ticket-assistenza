import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

// Accesso unico To Smile (appgestione.it): il riquadro passa da appgestione.it/sso/ticket e torna qui
// con un codice monouso (#sso=...) che scambiamo con la sessione Supabase.
const SSO_HOME = 'https://appgestione.it';
const SSO_INGRESSO = SSO_HOME + '/sso/ticket';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [caricando, setCaricando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    avvio();
  }, []);

  async function avvio() {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (/(^|&)sso/.test(window.location.hash.slice(1))) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    const codice = hash.get('sso');
    if (codice) {
      setCaricando(true);
      try { await supabase.auth.signOut({ scope: 'local' }); } catch (e) {}
      const { error } = await supabase.auth.verifyOtp({ token_hash: codice, type: 'magiclink' });
      setCaricando(false);
      if (error) setErrore('Accesso To Smile non riuscito: riprova dal riquadro su appgestione.it.');
      else { try { localStorage.setItem('tk_sso', '1'); } catch (e) {} }
    } else if (hash.get('sso_noprofilo')) {
      setErrore(`Il tuo accesso To Smile funziona, ma qui non hai ancora un profilo per ${hash.get('sso_noprofilo')}. Chiedi all'amministrazione di crearti l'accesso con questa email.`);
    } else if (hash.get('sso_errore')) {
      setErrore('Accesso To Smile non riuscito: riprova dal riquadro su appgestione.it.');
    }
    await controllaSessioneEReindirizza();
  }

  async function controllaSessioneEReindirizza() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profilo } = await supabase
        .from('profiles')
        .select('ruolo')
        .eq('id', user.id)
        .single();
      if (profilo) reindirizza(profilo.ruolo);
    }
  }

  function reindirizza(ruolo) {
    if (ruolo === 'super_admin') router.push('/dashboard/super-admin');
    else if (ruolo === 'admin_azienda') router.push('/dashboard/admin-azienda');
    else router.push('/dashboard/studio');
  }

  async function handleLogin(e) {
    e.preventDefault();
    setErrore('');
    setCaricando(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrore('Email o password non corretti.');
      setCaricando(false);
      return;
    }

    const { data: profilo, error: erroreProfilo } = await supabase
      .from('profiles')
      .select('ruolo')
      .eq('id', data.user.id)
      .single();

    if (erroreProfilo || !profilo) {
      setErrore('Nessun profilo associato a questo account. Contatta l\'amministrazione.');
      setCaricando(false);
      return;
    }

    reindirizza(profilo.ruolo);
  }

  return (
    <div className="login-sfondo">
      <div className="login-card">
        <img src="/logo.png" alt="TO Smile" className="login-logo" />
        <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 0, marginBottom: 26 }}>
          Accedi con le credenziali fornite dall'amministrazione.
        </p>
        {errore && <div className="errore">{errore}</div>}
        <form onSubmit={handleLogin}>
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button className="btn" type="submit" disabled={caricando} style={{ width: '100%', padding: '13px 20px', fontSize: 15, marginTop: 4 }}>
            {caricando ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
          <a className="btn btn-secondary" href={SSO_INGRESSO} style={{ display: 'block', width: '100%', padding: '12px 20px', textDecoration: 'none', boxSizing: 'border-box' }}>
            Entra con l'accesso To Smile
          </a>
          <p style={{ color: '#6b7280', fontSize: 12.5, margin: '8px 0 0' }}>Per chi fa parte del gruppo: stessa email e password di appgestione.it</p>
        </div>
      </div>
    </div>
  );
}
