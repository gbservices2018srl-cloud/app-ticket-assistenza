// Supabase Edge Function: crea-utente
// Deploy: supabase functions deploy crea-utente
// Chiamata dal frontend con l'header Authorization del chiamante loggato.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ errore: 'Metodo non permesso' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ errore: 'Non autenticato' }), { status: 401 });
  }

  // Client "come utente chiamante" per verificare chi è
  const supabaseUtente = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await supabaseUtente.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ errore: 'Token non valido' }), { status: 401 });
  }

  // Client con service role per operazioni admin
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: profiloChiamante } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profiloChiamante) {
    return new Response(JSON.stringify({ errore: 'Profilo chiamante non trovato' }), { status: 403 });
  }

  const body = await req.json();
  const { email, password, nome, ruolo, azienda_id, studio_id } = body;

  // Regole di autorizzazione
  if (profiloChiamante.ruolo === 'super_admin') {
    if (ruolo !== 'admin_azienda') {
      return new Response(JSON.stringify({ errore: 'Il super admin può creare solo admin azienda' }), { status: 403 });
    }
  } else if (profiloChiamante.ruolo === 'admin_azienda') {
    if (ruolo !== 'utente_studio' || azienda_id !== profiloChiamante.azienda_id) {
      return new Response(JSON.stringify({ errore: 'Puoi creare solo utenti studio della tua azienda' }), { status: 403 });
    }
  } else {
    return new Response(JSON.stringify({ errore: 'Non autorizzato a creare utenti' }), { status: 403 });
  }

  // Crea l'utente in auth
  const { data: nuovoUtente, error: erroreCreazione } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (erroreCreazione) {
    return new Response(JSON.stringify({ errore: erroreCreazione.message }), { status: 400 });
  }

  // Crea il profilo collegato
  const { error: erroreProfilo } = await supabaseAdmin.from('profiles').insert({
    id: nuovoUtente.user.id,
    ruolo,
    nome,
    azienda_id: azienda_id || null,
    studio_id: studio_id || null,
    creato_da: profiloChiamante.id,
  });

  if (erroreProfilo) {
    // rollback: elimina l'utente auth se il profilo fallisce
    await supabaseAdmin.auth.admin.deleteUser(nuovoUtente.user.id);
    return new Response(JSON.stringify({ errore: erroreProfilo.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ ok: true, utente_id: nuovoUtente.user.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
