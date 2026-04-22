
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixDebtStatus() {
  console.log('Searching for "Credit" income transactions marked as settled...');
  
  const { data, error } = await supabase
    .from('transactions')
    .update({ status: 'pending' })
    .eq('type', 'income')
    .eq('income_type', 'Credit')
    .eq('status', 'settled');

  if (error) {
    console.error('Error updating transactions:', error);
  } else {
    console.log('Successfully updated existing Credit transactions to pending status.');
  }
}

fixDebtStatus();
