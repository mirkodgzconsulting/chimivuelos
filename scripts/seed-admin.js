const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function seedAdmin() {
  // 1. Read .env.local manually
  const envPath = path.resolve(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('No .env.local found');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      env[key.trim()] = value.trim();
    }
  });

  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
  const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const email = 'info@chimivuelos.pe';
  const password = 'chimi2026@@A';
  const userData = {
    first_name: 'Admin',
    last_name: 'Principal', // You can customize this if you want
    role: 'admin',
    phone: '999888777' // Default phone or empty
  };

  try {
    // 2. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: userData.role,
        first_name: userData.first_name,
        last_name: userData.last_name
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError.message);
      // Wait, maybe user already exists? Let's check.
      if (authError.message.includes('User already registered') || authError.status === 422) {
          // If exists, maybe we update the profile just in case? Or just exit.
          console.log('User already exists. Proceding to ensure profile...');
          // Need to find user ID if we want to ensure profile, but let's assume if user exists, auth is handled.
          // Or we can fetch user by email to get ID.
          const { data: users, error: listError } = await supabase.auth.admin.listUsers();
          const existingUser = users.users.find(u => u.email === email);
          if (existingUser) {
              await ensureProfile(supabase, existingUser.id, email, userData);
              return;
          }
      }
      return;
    }

    const userId = authData.user.id;
    console.log(`Auth user created: ${userId}`);

    // 3. Create Profile
    await ensureProfile(supabase, userId, email, userData);

    console.log('Admin user seeded successfully!');

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

async function ensureProfile(supabase, userId, email, userData) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role,
        phone: userData.phone,
        active: true
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
    } else {
      console.log('Profile created/updated successfully.');
    }
}

seedAdmin();
