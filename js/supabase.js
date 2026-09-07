const SUPABASE_URL = 'https://efqolftrbsrlssjynppn.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_8X_nPFays64uHe-79mC68Q_AitP_c3l';

const SUPABASE_CONFIGURED =
    SUPABASE_URL.startsWith('https://') &&
    SUPABASE_ANON_KEY.startsWith('sb_');

const supabaseClient =
    SUPABASE_CONFIGURED && window.supabase
        ? window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        )
        : null;

window.SUPABASE_CONFIGURED = SUPABASE_CONFIGURED;
window.supabaseClient = supabaseClient;