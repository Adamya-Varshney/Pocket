import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { X, Check } from 'lucide-react';

const AdvancedExpenseModal = ({ show, onClose, group, members, user, onExpenseAdded, accounts }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Payer State
  const [payerMode, setPayerMode] = useState('SINGLE'); // 'SINGLE' or 'MULTIPLE'
  const [singlePayerId, setSinglePayerId] = useState(user.id);
  const [multiPayers, setMultiPayers] = useState({});

  // Split State
  const [splitMode, setSplitMode] = useState('EQUAL_ALL'); 
  // 'EQUAL_ALL' | 'EQUAL_SELECTED' | 'EXACT' | 'FULL_AMOUNT'
  const [splitSelected, setSplitSelected] = useState([]);
  const [splitExact, setSplitExact] = useState({});
  const [fullAmountTarget, setFullAmountTarget] = useState('');
  
  // Sync Status
  const [syncToPersonal, setSyncToPersonal] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts?.[0]?.id || '');

  useEffect(() => {
    if (show && accounts?.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [show, accounts, selectedAccountId]);

  useEffect(() => {
    if (show) {
      setSplitSelected(members.map(m => m.user_id || m.member_email));
      setSinglePayerId(user.id);
    }
  }, [show, members, user]);

  const getMemberKey = m => m.user_id || m.member_email;
  const getMemberName = m => {
    if (m.user_id === user.id) return 'You';
    return m.member_name || m.member_email?.split('@')[0] || 'Unknown';
  };

  const parsedAmount = parseFloat(amount) || 0;

  // Validation Logic
  let isMathValid = true;
  let remainingPayer = 0;
  let remainingSplit = 0;

  if (payerMode === 'MULTIPLE') {
    const totalPaid = Object.values(multiPayers).reduce((sum, v) => sum + (parseFloat(v)||0), 0);
    remainingPayer = parsedAmount - totalPaid;
    if (Math.abs(remainingPayer) > 0.01) isMathValid = false;
  }

  if (splitMode === 'EQUAL_SELECTED' && splitSelected.length === 0) {
    isMathValid = false;
  }

  if (splitMode === 'EXACT') {
    const totalSplit = Object.values(splitExact).reduce((sum, v) => sum + (parseFloat(v)||0), 0);
    remainingSplit = parsedAmount - totalSplit;
    if (Math.abs(remainingSplit) > 0.01) isMathValid = false;
  }

  if (splitMode === 'FULL_AMOUNT' && !fullAmountTarget) {
    isMathValid = false;
  }

  if (!description || parsedAmount <= 0) {
    isMathValid = false;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isMathValid) return;

    // Build the advanced_split JSONB payload
    // paid: [ {key, amount} ]
    // owed: [ {key, amount} ]
    
    let paidArr = [];
    if (payerMode === 'SINGLE') {
      paidArr.push({ key: singlePayerId, amount: parsedAmount });
    } else {
      Object.keys(multiPayers).forEach(k => {
         const val = parseFloat(multiPayers[k]);
         if (val > 0) paidArr.push({ key: k, amount: val });
      });
    }

    let owedArr = [];
    if (splitMode === 'EQUAL_ALL') {
      const share = parsedAmount / members.length;
      members.forEach(m => owedArr.push({ key: getMemberKey(m), amount: share }));
    } else if (splitMode === 'EQUAL_SELECTED') {
      const share = parsedAmount / splitSelected.length;
      splitSelected.forEach(k => owedArr.push({ key: k, amount: share }));
    } else if (splitMode === 'EXACT') {
      Object.keys(splitExact).forEach(k => {
         const val = parseFloat(splitExact[k]);
         if (val > 0) owedArr.push({ key: k, amount: val });
      });
    } else if (splitMode === 'FULL_AMOUNT') {
      owedArr.push({ key: fullAmountTarget, amount: parsedAmount });
    }

    const advanced_split = {
      paid: paidArr,
      owed: owedArr,
      splitMode: splitMode
    };

    try {
      const fallbackPayer = payerMode === 'SINGLE' ? singlePayerId : user.id;

      let insertData = {
        group_id: group.id,
        paid_by: fallbackPayer, 
        description: description,
        amount: parsedAmount,
        category: 'Others', 
        txn_date: date,
        advanced_split: advanced_split
      };

      const { data: groupTxn, error: groupErr } = await supabase
        .from('expense_group_transactions')
        .insert(insertData)
        .select()
        .single();
        
      if (groupErr) throw groupErr;

      // ──────────────────────────────────────────────────────────────────────
      // ── Personal Ledger Sync: Resolving Dashboard Isolation ───────────────
      // ──────────────────────────────────────────────────────────────────────
      const userPaidEntry = paidArr.find(p => p.key === user.id);
      if (syncToPersonal && userPaidEntry && userPaidEntry.amount > 0) {
        // Find a matching personal category based on the group category name
        // (Uses the same fuzzy logic from merchantUtils)
        const { data: personalCats } = await supabase.from('categories').select('*');
        const personalCat = personalCats?.find(c => 
          c.name.toLowerCase().includes(insertData.category.toLowerCase()) ||
          insertData.category.toLowerCase().includes(c.name.toLowerCase())
        );

        await supabase.from('transactions').insert({
          user_id:      user.id,
          account_id:   selectedAccountId,
          type:         'expense',
          amount:       userPaidEntry.amount,
          description:  `[Group: ${group.name}] ${description}`,
          txn_date:     date,
          category_id:  personalCat?.id || null,
          payment_mode: 'UPI', // Default for groups usually
          status:       'settled',
          source:       'group_expense',
          reference_no: `grp_${groupTxn.id}` // Link back to group transaction
        });
      }
      // ──────────────────────────────────────────────────────────────────────
      
      // Reset Modal
      setDescription('');
      setAmount('');
      setMultiPayers({});
      setSplitExact({});
      onExpenseAdded();
      onClose();

    } catch (err) {
      alert('Failed to insert advanced expense: ' + err.message);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" style={{ overflowY:'auto' }}>
      <div className="delete-modal" style={{ maxWidth: '600px', margin: '40px auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Advanced Expense</h2>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer' }}><X size={20} color="var(--text-muted)"/></button>
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ fontSize:'12px', color:'var(--text-muted)' }}>Description</label>
            <input type="text" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Dinner, Taxi, etc." style={{width:'100%', padding:'10px', marginTop:'4px'}}/>
          </div>
          <div>
            <label style={{ fontSize:'12px', color:'var(--text-muted)' }}>Amount (₹)</label>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" style={{width:'100%', padding:'10px', marginTop:'4px', fontSize:'24px', fontWeight:'bold'}}/>
          </div>
          <div>
            <label style={{ fontSize:'12px', color:'var(--text-muted)' }}>Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:'100%', padding:'10px', marginTop:'4px'}}/>
          </div>
        </div>

        {/* --- PERSONAL SYNC --- */}
        <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '14px' }}>Personal Ledger Sync</h4>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
               <input type="checkbox" checked={syncToPersonal} onChange={e => setSyncToPersonal(e.target.checked)} />
               <span style={{ fontSize: '12px' }}>Add to Dashboard</span>
            </label>
          </div>
          
          {syncToPersonal && (
            <div className="animate-fade-in">
              <label style={{ fontSize:'11px', color:'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Which account did you pay from?</label>
              <select 
                value={selectedAccountId} 
                onChange={e => setSelectedAccountId(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '13px' }}
              >
                {accounts?.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.bank_name || 'Bank'} - {acc.name}</option>
                ))}
              </select>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Only the portion you paid (₹{(paidArr.find(p => p.key === user.id)?.amount || 0).toFixed(2)}) will be recorded.
              </p>
            </div>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }}/>

        {/* --- WHO PAID --- */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Who Paid?</h4>
          <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
            <button className={`btn-secondary ${payerMode === 'SINGLE' ? 'btn-primary' : ''}`} onClick={()=>setPayerMode('SINGLE')}>Single Payer</button>
            <button className={`btn-secondary ${payerMode === 'MULTIPLE' ? 'btn-primary' : ''}`} onClick={()=>setPayerMode('MULTIPLE')}>Multiple</button>
          </div>

          {payerMode === 'SINGLE' ? (
            <select value={singlePayerId} onChange={e=>setSinglePayerId(e.target.value)} style={{width:'100%', padding:'10px'}}>
              {members.map(m => (
                 <option key={getMemberKey(m)} value={getMemberKey(m)}>{getMemberName(m)}</option>
              ))}
            </select>
          ) : (
            <div>
              {members.map(m => (
                <div key={getMemberKey(m)} style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px'}}>
                  <span style={{flex:1, fontSize:'14px'}}>{getMemberName(m)}</span>
                  <input type="number" placeholder="0" value={multiPayers[getMemberKey(m)]||''} onChange={e => setMultiPayers({...multiPayers, [getMemberKey(m)]: e.target.value})} style={{width:'100px', padding:'6px'}}/>
                </div>
              ))}
              {Math.abs(remainingPayer) > 0.01 && (
                <div style={{color:'#f44336', fontSize:'12px', marginTop:'8px'}}>₹{remainingPayer.toFixed(2)} remaining to assign.</div>
              )}
            </div>
          )}
        </div>

        {/* --- HOW TO SPLIT --- */}
        <div>
          <h4 style={{ margin: '0 0 12px 0' }}>How to Split?</h4>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px' }}>
            <button className={`btn-secondary ${splitMode === 'EQUAL_ALL' ? 'btn-primary' : ''}`} onClick={()=>setSplitMode('EQUAL_ALL')} style={{fontSize:'12px'}}>Equal (All)</button>
            <button className={`btn-secondary ${splitMode === 'EQUAL_SELECTED' ? 'btn-primary' : ''}`} onClick={()=>setSplitMode('EQUAL_SELECTED')} style={{fontSize:'12px'}}>Equal (Selected)</button>
            <button className={`btn-secondary ${splitMode === 'EXACT' ? 'btn-primary' : ''}`} onClick={()=>setSplitMode('EXACT')} style={{fontSize:'12px'}}>Exact Amounts</button>
            <button className={`btn-secondary ${splitMode === 'FULL_AMOUNT' ? 'btn-primary' : ''}`} onClick={()=>setSplitMode('FULL_AMOUNT')} style={{fontSize:'12px'}}>Full Amount</button>
          </div>

          {splitMode === 'EQUAL_ALL' && (
            <p style={{fontSize:'13px', color:'var(--text-muted)'}}>Splitting equally among all {members.length} members (₹{(parsedAmount/members.length).toFixed(2)} / each).</p>
          )}

          {splitMode === 'EQUAL_SELECTED' && (
            <div>
               {members.map(m => {
                 const key = getMemberKey(m);
                 const checked = splitSelected.includes(key);
                 return (
                   <label key={key} style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', fontSize:'14px'}}>
                     <input type="checkbox" checked={checked} onChange={e => {
                       if (checked) setSplitSelected(splitSelected.filter(x => x !== key));
                       else setSplitSelected([...splitSelected, key]);
                     }}/>
                     {getMemberName(m)}
                   </label>
                 );
               })}
               <p style={{fontSize:'13px', color:'var(--text-muted)', marginTop:'8px'}}>
                 ₹{(parsedAmount / (splitSelected.length||1)).toFixed(2)} per person.
               </p>
            </div>
          )}

          {splitMode === 'EXACT' && (
            <div>
               {members.map(m => (
                <div key={getMemberKey(m)} style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px'}}>
                  <span style={{flex:1, fontSize:'14px'}}>{getMemberName(m)}</span>
                  <input type="number" placeholder="0" value={splitExact[getMemberKey(m)]||''} onChange={e => setSplitExact({...splitExact, [getMemberKey(m)]: e.target.value})} style={{width:'100px', padding:'6px'}}/>
                </div>
              ))}
              {Math.abs(remainingSplit) > 0.01 && (
                <div style={{color:'#f44336', fontSize:'12px', marginTop:'8px'}}>₹{remainingSplit.toFixed(2)} remaining to assign.</div>
              )}
            </div>
          )}

          {splitMode === 'FULL_AMOUNT' && (
            <div>
              <p style={{fontSize:'13px', color:'var(--text-muted)', marginBottom:'8px'}}>Who owes the full amount?</p>
              <select value={fullAmountTarget} onChange={e=>setFullAmountTarget(e.target.value)} style={{width:'100%', padding:'10px'}}>
                <option value="">-- Select Member --</option>
                {members.map(m => (
                   <option key={getMemberKey(m)} value={getMemberKey(m)}>{getMemberName(m)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button 
          onClick={handleSubmit} 
          disabled={!isMathValid} 
          className="btn-primary" 
          style={{ width:'100%', marginTop:'24px', padding:'14px', fontSize:'16px', opacity: isMathValid ? 1 : 0.5 }}
        >
          {isMathValid ? 'Add to Group Ledger' : 'Fix amounts to continue'}
        </button>

      </div>
    </div>
  );
};

export default AdvancedExpenseModal;
