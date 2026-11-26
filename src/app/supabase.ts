import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hgsyegaaajouwsazhbun.supabase.co';
const supabasePublishableKey = 'sb_publishable_zvrgL7nxqZoXkl_b-PerAA_jZzVptpT';

export const supabase = createClient(supabaseUrl, supabasePublishableKey);