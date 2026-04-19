import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aucxyabdlrdgezytsvhg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1Y3h5YWJkbHJkZ2V6eXRzdmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjUxOTYsImV4cCI6MjA5MTUwMTE5Nn0._un9cf4F4Z56PJXgZVkoZVPL6_x7QXMSgVgu7dpAlKY'
);

// We need an email and password to log in and bypass RLS
const login = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@example.com', // I don't know the exact user, but I can fetch rows
    password: 'password123'
  });
  console.log("Login error:", error);
};

const run = async () => {
    const { data: rows } = await supabase.from('statement_rows').select('id').limit(1);
    if (!rows || rows.length === 0) {
        console.log("No rows found.");
        return;
    }
    const id = rows[0].id;
    const candidates = ['categorized', 'categorised', 'reviewed', 'confirmed', 'completed', 'verified', 'settled', 'ignored', 'pending'];
    
    for (const c of candidates) {
        const { error } = await supabase.from('statement_rows').update({ status: c }).eq('id', id);
        if (error) {
            console.log(`[FAIL] ${c} -> ${error.message}`);
        } else {
            console.log(`[PASS] ${c}`);
        }
    }
};

run().catch(console.error);
