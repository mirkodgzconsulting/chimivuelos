
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
let env = {};
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Fetching columns from raw SQL via rpc if available, or just checking known columns...');
    
    // Check if 'passenger_name', 'passenger', 'traveler_name' exists by trying to select it
    const { data, error } = await supabase
        .from('flights')
        .select('passenger_name, passenger, traveler_name, details')
        .limit(1);

    if (error) {
        console.log('Error selecting passenger columns:', error.message);
        // If error says "column does not exist", we know.
    } else {
        console.log('Columns found:', data);
    }
}

run();
