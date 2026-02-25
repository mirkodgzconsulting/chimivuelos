require('dotenv').config({ path: '.env.local', debug: false });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    const { data, error } = await supabase
        .from('audit_logs')
        .select('id, metadata, new_values, old_values, action, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
    
    if (error) console.error(error);
    
    let out = '';
    data.forEach(r => {
        out += "=== " + r.id + " " + r.created_at + "\n";
        out += "CHANGED: " + JSON.stringify(r.metadata.changed_keys) + "\n";
        
        const c = r.metadata.changed_keys || [];
        c.forEach(k => {
            out += k + "\nOLD: " + JSON.stringify(r.old_values[k]) + "\nNEW: " + JSON.stringify(r.new_values[k]) + "\n";
        });
    });
    fs.writeFileSync('log_dump.txt', out);
}

main();
