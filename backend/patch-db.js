require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function patchDatabase() {
  console.log('Applying database patch to add `pending_review` to `chat_status` enum...');

  // We must use a stored procedure to run ALTER TYPE, as it's not directly exposed in the Supabase client library.
  // This assumes a function `eval(query text)` exists on the database.
  // A safer alternative would be to use a proper migration tool.
  const { data, error } = await supabase.rpc('eval', {
    query: "ALTER TYPE public.chat_status ADD VALUE IF NOT EXISTS 'pending_review';"
  });

  if (error) {
    console.error('Error applying database patch:', error.message);
    console.error('This likely means you need to run the SQL command manually on your Supabase instance, or the `eval` RPC function is not enabled.');
    return;
  }

  console.log('Database patch applied successfully.', data);
}

patchDatabase();
