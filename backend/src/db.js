const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.\n' +
    'Copy .env.example to .env and fill in your Supabase credentials.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: ws,
  },
});

module.exports = supabase;

