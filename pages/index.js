import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [caricando, setCaricando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    controllaSessioneEReindirizza();
  }, []);

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
    <div className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="card">
        <h1 style={{ marginTop: 0, fontSize: 22 }}>Assistenza Studi</h1>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Accedi con le credenziali fornite dall'amministrazione.</p>
        {errore && <div className="errore">{errore}</div>}
        <form onSubmit={handleLogin}>
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button className="btn" type="submit" disabled={caricando} style={{ width: '100%' }}>
            {caricando ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}
