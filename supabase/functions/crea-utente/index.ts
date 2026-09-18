// Supabase Edge Function: crea-utente
// Deploy: supabase functions deploy crea-utente
// Chiamata dal frontend con l'header Authorization del chiamante loggato.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Header CORS: necessari perché il browser chiama questa funzione da un altro indirizzo
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // Il browser manda prima una richiesta "OPTIONS" di controllo (preflight):
  // va sempre risposta subito con gli header CORS, senza altra logica.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ errore: 'Metodo non permesso' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ errore: 'Non autenticato' }, 401);
  }

  // Client "come utente chiamante" per verificare chi è
  const supabaseUtente = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await supabaseUtente.auth.getUser();
  if (!user) {
    return jsonResponse({ errore: 'Token non valido' }, 401);
  }

  // Client con service role per operazioni admin
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: profiloChiamante } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profiloChiamante) {
    return jsonResponse({ errore: 'Profilo chiamante non trovato' }, 403);
  }

  const body = await req.json();
  const { email, password, nome, ruolo, azienda_id, studio_id } = body;

  // Regole di autorizzazione
  if (profiloChiamante.ruolo === 'super_admin') {
    if (ruolo !== 'admin_azienda') {
      return jsonResponse({ errore: 'Il super admin può creare solo admin azienda' }, 403);
    }
  } else if (profiloChiamante.ruolo === 'admin_azienda') {
    if (ruolo !== 'utente_studio' || azienda_id !== profiloChiamante.azienda_id) {
      return jsonResponse({ errore: 'Puoi creare solo utenti studio della tua azienda' }, 403);
    }
  } else {
    return jsonResponse({ errore: 'Non autorizzato a creare utenti' }, 403);
  }

  // Crea l'utente in auth
  const { data: nuovoUtente, error: erroreCreazione } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (erroreCreazione) {
    return jsonResponse({ errore: erroreCreazione.message }, 400);
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
    return jsonResponse({ errore: erroreProfilo.message }, 400);
  }

  return jsonResponse({ ok: true, utente_id: nuovoUtente.user.id });
});
