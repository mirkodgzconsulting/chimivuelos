require('dotenv').config({ path: '.env.local', debug: false });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    const { data, error } = await supabase
        .from('audit_logs')
        .select('id, metadata, new_values, old_values, action, created_at')
        .order('created_at', { ascending: false })
        .limit(2);
    
    if (error) console.error(error);
    data.forEach(r => {
        console.log("===", r.id, r.created_at);
        console.log("CHANGED:", r.metadata.changed_keys);
        
        const c = r.metadata.changed_keys || [];
        c.forEach(k => {
            console.log(k, "OLD:", JSON.stringify(r.old_values[k]), "NEW:", JSON.stringify(r.new_values[k]));
        });
    });
}

main();
