/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
try {
  const envConfig = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
  envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    }
  });
} catch {
  console.warn('Could not read .env.local file');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function setupStorage() {
  console.log('Setting up storage bucket: client-documents...');

  const { error } = await supabase.storage.createBucket('client-documents', {
    public: true, // Making it public for easy access via URL as implemented
    fileSizeLimit: 10485760, // 10MB limit per file?
    allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  });

  if (error) {
    if (error.message.includes('already exists')) {
        console.log('Bucket "client-documents" already exists. Ensuring it is public...');
        await supabase.storage.updateBucket('client-documents', { public: true });
    } else {
        console.error('Error creating bucket:', error);
        return;
    }
  } else {
    console.log('Bucket "client-documents" created successfully.');
  }

  console.log('Storage setup complete.');
}

setupStorage();
