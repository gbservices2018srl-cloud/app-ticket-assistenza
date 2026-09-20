// Supabase Edge Function: elimina-utente
// Deploy: npx supabase functions deploy elimina-utente
//
// Elimina davvero un account (non solo il profilo): usa i permessi
// elevati (service role) necessari per cancellare da auth.users.
// Grazie a "on delete cascade" sulla colonna profiles.id, cancellare
// l'utente da auth elimina automaticamente anche la riga in profiles.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

  const supabaseUtente = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabaseUtente.auth.getUser();
  if (!user) {
    return jsonResponse({ errore: 'Token non valido' }, 401);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: chiamante } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!chiamante || (chiamante.ruolo !== 'super_admin' && chiamante.ruolo !== 'admin_azienda')) {
    return jsonResponse({ errore: 'Non autorizzato' }, 403);
  }

  const { azione, id } = await req.json();

  if (azione === 'utente') {
    const { data: target } = await supabaseAdmin.from('profiles').select('*').eq('id', id).single();
    if (!target) return jsonResponse({ errore: 'Utente non trovato' }, 404);

    const autorizzato =
      chiamante.ruolo === 'super_admin'
        ? target.ruolo !== 'super_admin'
        : chiamante.ruolo === 'admin_azienda' &&
          target.ruolo === 'utente_studio' &&
          target.azienda_id === chiamante.azienda_id;

    if (!autorizzato) return jsonResponse({ errore: 'Non autorizzato a eliminare questo utente' }, 403);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) return jsonResponse({ errore: error.message }, 400);

    return jsonResponse({ ok: true });
  }

  if (azione === 'azienda') {
    if (chiamante.ruolo !== 'super_admin') {
      return jsonResponse({ errore: 'Solo il super admin può eliminare un\'azienda' }, 403);
    }

    const { data: profiliAzienda } = await supabaseAdmin.from('profiles').select('id').eq('azienda_id', id);

    for (const p of profiliAzienda || []) {
      await supabaseAdmin.auth.admin.deleteUser(p.id);
    }

    const { error } = await supabaseAdmin.from('aziende').delete().eq('id', id);
    if (error) return jsonResponse({ errore: error.message }, 400);

    return jsonResponse({ ok: true });
  }

  return jsonResponse({ errore: 'Azione non riconosciuta' }, 400);
});
