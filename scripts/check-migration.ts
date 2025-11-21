import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { error } = await supabase.from('tournaments').select('id').limit(1);
console.log(error ? '❌ Migration NOT applied' : '✅ Migration applied');
process.exit(error ? 1 : 0);
