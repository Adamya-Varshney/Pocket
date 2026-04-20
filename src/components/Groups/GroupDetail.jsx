import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ArrowLeft, UserPlus, Trash2, Shield, User, PlusCircle, Bell } from 'lucide-react';
import Card from '../UI/Card';
import AdvancedExpenseModal from './AdvancedExpenseModal';
import emailjs from '@emailjs/browser';

const GroupDetail = ({ group, user, onBack, accounts }) => {
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [filterMemberId, setFilterMemberId] = useState('all');
  const [settleModal, setSettleModal] = useState(null);
  const [inviteModalText, setInviteModalText] = useState('');
  const [sendingReminderTo, setSendingReminderTo] = useState(null);

  const isOwner = group.myRole === 'owner';

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch members
      const { data: memData } = await supabase
        .from('expense_group_members')
        .select('*')
        .eq('group_id', group.id);
      if (memData) setMembers(memData);

      // Fetch expenses
      const { data: expData } = await supabase
        .from('expense_group_transactions')
        .select('*')
        .eq('group_id', group.id)
        .order('txn_date', { ascending: false });
      if (expData) setExpenses(expData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const expChannel = supabase.channel(`group-exp-${group.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_group_transactions', filter: `group_id=eq.${group.id}` }, fetchData)
      .subscribe();
      
    const memChannel = supabase.channel(`group-mem-${group.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_group_members', filter: `group_id=eq.${group.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(expChannel);
      supabase.removeChannel(memChannel);
    };
  }, [group.id]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !isOwner) return;
    try {
      const email = inviteEmail.trim();
      const { data, error } = await supabase.rpc('invite_user_by_email', {
        p_group_id: group.id,
        p_email: email
      });
      if (error) throw error;
      
      const appUrl = window.location.origin;
      const text = `Hey! I've added you to our expense group "${group.name}" on Pocket to track shared expenses.\n\nPlease sign up or log in here to view the ledger:\n${appUrl}\n\nMake sure to sign up with this exact email address (${email}) to access the group!\n\nCheers!`;
      
      setInviteModalText(text);
      setInviteEmail('');
      fetchData();
    } catch (error) {
      alert(error.message);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteModalText);
      alert('Invite text copied to clipboard! Paste it in WhatsApp, Gmail, or any messaging app.');
      setInviteModalText('');
    } catch (err) {
      alert('Failed to copy automatically, you can still highlight and copy the text!');
    }
  };

  const getMemberKey = (m) => m.user_id || m.member_email;

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    await supabase.from('expense_group_transactions').delete().eq('id', expenseToDelete.id);
    setExpenseToDelete(null);
    fetchData(); // Instant local sync
  };

  const realExpenses = expenses.filter(e => e.category !== 'Settlement');
  const settlements = expenses.filter(e => e.category === 'Settlement');

  const filteredExpenses = expenses.filter(exp => 
    filterMemberId === 'all' ? true : exp.paid_by === filterMemberId
  );

  const totalMembers = members.length;

  const balances = {};
  members.forEach(m => {
    const key = getMemberKey(m);
    balances[key] = {
      key: key,
      user_id: m.user_id,
      name: m.member_name || m.member_email?.split('@')[0] || 'Unknown',
      email: m.member_email,
      paid: 0,
      balance: 0
    };
  });

  realExpenses.forEach(exp => {
    const amt = Number(exp.amount) || 0;
    
    if (exp.advanced_split) {
       // --- New Advanced Split Config ---
       const split = exp.advanced_split;
       (split.paid || []).forEach(p => {
         if (balances[p.key]) {
           balances[p.key].paid += Number(p.amount);
           balances[p.key].balance += Number(p.amount);
         }
       });
       (split.owed || []).forEach(o => {
         if (balances[o.key]) {
           balances[o.key].balance -= Number(o.amount);
         }
       });
    } else {
       // --- Legacy Uniform Split Config (Backwards compatibility) ---
       const share = totalMembers > 0 ? amt / totalMembers : 0;
       
       // Who paid?
       if (balances[exp.paid_by]) {
         balances[exp.paid_by].paid += amt;
         balances[exp.paid_by].balance += amt;
       }
       
       // Everyone owes equally
       Object.values(balances).forEach(b => {
         b.balance -= share;
       });
    }
  });

  settlements.forEach(settle => {
    const fromId = settle.paid_by;
    const toMatch = settle.description.match(/SETTLEMENT_TO:(.+)/);
    if (toMatch && toMatch[1]) {
      const toId = toMatch[1];
      const amount = Number(settle.amount);
      if (balances[fromId]) balances[fromId].balance += amount;
      if (balances[toId]) balances[toId].balance -= amount;
    }
  });

  const debtors = [];
  const creditors = [];

  Object.values(balances).forEach(b => {
    if (b.balance < -0.01) debtors.push({ ...b });
    else if (b.balance > 0.01) creditors.push({ ...b });
  });

  debtors.sort((a, b) => a.balance - b.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  const suggestedSettlements = [];
  let i = 0; let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
    
    suggestedSettlements.push({
      from: debtor.key,
      fromName: debtor.name,
      fromEmail: debtor.email,
      to: creditor.key,
      toName: creditor.name,
      amount: amount
    });

    debtor.balance += amount;
    creditor.balance -= amount;
    if (Math.abs(debtor.balance) < 0.01) i++;
    if (creditor.balance < 0.01) j++;
  }

  const handleSettleUp = async () => {
    if (!settleModal) return;
    try {
      const { error } = await supabase.from('expense_group_transactions').insert({
        group_id: group.id,
        paid_by: settleModal.from,
        description: `SETTLEMENT_TO:${settleModal.to}`,
        amount: parseFloat(settleModal.amount),
        category: 'Settlement',
        txn_date: new Date().toISOString().split('T')[0]
      });
      if (error) throw error;
      setSettleModal(null);
      fetchData();
    } catch (error) {
      alert('Failed to record settlement');
    }
  };

  const handleSendReminder = async (settlement) => {
    // Check if configuration exists
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
      alert("Missing EmailJS Configuration! Please configure your keys in the .env file.");
      return;
    }

    if (!settlement.fromEmail) {
      alert("This user does not have an email address tied to their profile.");
      return;
    }

    setSendingReminderTo(settlement.from);
    try {
      const templateParams = {
        to_email: settlement.fromEmail,
        to_name: settlement.fromName,
        from_name: settlement.toName === 'You' ? user.user_metadata?.display_name || 'A group member' : settlement.toName,
        group_name: group.name,
        amount: settlement.amount.toFixed(2),
        app_url: window.location.origin
      };

      await emailjs.send(serviceId, templateId, templateParams, publicKey);
      alert(`Reminder successfully sent to ${settlement.fromName}!`);
    } catch (error) {
      console.error('Email sending failed:', error);
      alert('Failed to send the email reminder. Check your EmailJS configuration.');
    } finally {
      setSendingReminderTo(null);
    }
  };

  const getMemberName = (key) => {
    if (key === user.id) return 'You';
    const match = members.find(m => m.user_id === key || m.member_email === key);
    return match?.member_name || match?.member_email?.split('@')[0] || 'Unknown Member';
  };

  if (loading && members.length === 0) return <div style={{padding:'24px'}}>Loading group details...</div>;

  return (
    <div className="group-detail-container animate-fade-in">
      <header className="group-detail-header">
        <button className="back-btn" onClick={onBack}><ArrowLeft size={20} /></button>
        <div>
          <h1 className="groups-title">{group.name}</h1>
          <p className="groups-subtitle">Shared Ledger</p>
        </div>
      </header>

      <div className="group-layout">
        <div className="expenses-section">
          <Card className="add-expense-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
            <h3 style={{ marginBottom: '16px' }}>Record an Expense</h3>
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '14px', marginBottom: '24px' }}>
              Add a new group expense, specify exactly who paid, and instantly decide how to split the cost among members.
            </p>
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setShowAdvancedModal(true)}>
              <PlusCircle size={20} /> Advanced Expense Entry
            </button>
          </Card>

          <Card className="transactions-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Group Expenses</h3>
              <select 
                value={filterMemberId} 
                onChange={e => setFilterMemberId(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'var(--text)',
                  fontSize: '14px'
                }}
              >
                <option value="all">All Members</option>
                <option value={user.id}>You</option>
                {members.filter(m => m.user_id !== user.id).map(m => (
                  <option key={m.id} value={m.user_id}>
                    {m.member_name || m.member_email?.split('@')[0] || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>
            <div className="transaction-list-group">
              {filteredExpenses.length === 0 ? <p className="text-muted">No expenses recorded yet.</p> : null}
              {filteredExpenses.map(exp => (
                <div key={exp.id} className="group-txn-item">
                  <div>
                    <span style={{ fontWeight: 600, display: 'block', color: exp.category === 'Settlement' ? '#00c853' : 'inherit' }}>
                      {exp.category === 'Settlement' 
                        ? `Payment to ${getMemberName(exp.description.replace('SETTLEMENT_TO:', ''))}` 
                        : exp.description}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {exp.txn_date} • Paid by <strong style={{color:'var(--text)'}}>{getMemberName(exp.paid_by)}</strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ color: '#f44336', fontWeight: 'bold' }}>₹{exp.amount}</span>
                    {isOwner && (
                      <button className="del-btn" onClick={() => setExpenseToDelete(exp)} title="Delete">
                        <Trash2 size={16}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="members-section">
          <Card>
            <h3>Members ({members.length})</h3>
            <div className="member-list" style={{ marginTop: '16px' }}>
              {members.map(m => (
                <div key={m.id} className="member-item">
                  <div className="member-info">
                    <span style={{ display:'flex', alignItems:'center', gap:'8px', fontWeight: 500 }}>
                      {m.role === 'owner' ? <Shield size={14} color="#00c853"/> : <User size={14} color="#3b82f6"/>}
                      {m.user_id === user.id ? 'You' : (m.member_name || 'Member')}
                    </span>
                    {m.member_email && m.user_id !== user.id && (
                       <span className="email">{m.member_email}</span>
                    )}
                  </div>
                  <span className={`role-badge ${m.role}`}>{m.role}</span>
                </div>
              ))}
            </div>

            {isOwner && (
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <h4>Invite Participant</h4>
                <form className="invite-form" onSubmit={handleInvite}>
                  <input 
                    type="email" 
                    placeholder="User's exact email..." 
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)' }}
                  />
                  <button type="submit" className="btn-primary" style={{ padding: '8px 12px' }}><UserPlus size={16}/></button>
                </form>
              </div>
            )}
          </Card>

          <Card style={{ marginTop: '16px' }}>
            <h3>Balances & Settlements</h3>
            
            {suggestedSettlements.length === 0 ? (
              <p className="text-muted" style={{ marginTop: '16px' }}>All settled up!</p>
            ) : (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-muted)' }}>Suggested payments</h4>
                {suggestedSettlements.map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '14px' }}>
                      <strong>{s.from === user.id ? 'You' : s.fromName}</strong> owes <strong>{s.to === user.id ? 'You' : s.toName}</strong> 
                      <div style={{ color: '#f44336', fontWeight: 'bold' }}>₹{s.amount.toFixed(2)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* Only allow reminding if the debtor isn't the logged-in user! */}
                      {s.from !== user.id && (
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => handleSendReminder(s)}
                          disabled={sendingReminderTo === s.from}
                        >
                          <Bell size={12} />
                          {sendingReminderTo === s.from ? 'Sending...' : 'Remind'}
                        </button>
                      )}
                      
                      <button 
                        className="btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--primary)' }}
                        onClick={() => setSettleModal(s)}
                      >
                        Settle Up
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ marginTop: '16px' }}>
               <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-muted)' }}>Member Balances</h4>
               {Object.values(balances).map(b => (
                 <div key={b.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                    <span>{b.user_id === user.id ? 'You' : b.name}</span>
                    <strong style={{ color: b.balance > 0.01 ? '#00c853' : b.balance < -0.01 ? '#f44336' : 'var(--text-muted)'}}>
                      {b.balance > 0.01 ? '+' : ''}{b.balance.toFixed(2)}
                    </strong>
                 </div>
               ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="modal-overlay">
          <div className="delete-modal">
            <h3>Delete Transaction</h3>
            <p>Are you sure you want to delete this transaction of ₹{expenseToDelete.amount}? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setExpenseToDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={confirmDeleteExpense}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Modal */}
      {settleModal && (
        <div className="modal-overlay">
          <div className="delete-modal">
            <h3>Confirm Settlement</h3>
            <p>Record a payment of <strong>₹{settleModal.amount.toFixed(2)}</strong> from {settleModal.from === user.id ? 'You' : settleModal.fromName} to {settleModal.to === user.id ? 'You' : settleModal.toName}?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setSettleModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleSettleUp}>Record Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Link Modal */}
      {inviteModalText && (
        <div className="modal-overlay">
          <div className="delete-modal" style={{ maxWidth: '500px' }}>
            <h3>User Added to Ledger!</h3>
            <p>They are now in the group. To let them know, copy the message below and send it to them via WhatsApp or email.</p>
            <textarea 
              readOnly 
              value={inviteModalText} 
              style={{ width: '100%', height: '150px', padding: '12px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', marginTop: '12px', resize: 'none' }}
            />
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn-secondary" onClick={() => setInviteModalText('')}>Close</button>
              <button className="btn-primary" onClick={copyToClipboard}>Copy to Clipboard</button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Expense Split Modal */}
      <AdvancedExpenseModal 
        show={showAdvancedModal}
        onClose={() => setShowAdvancedModal(false)}
        group={group}
        members={members}
        user={user}
        onExpenseAdded={fetchData}
        accounts={accounts}
      />
    </div>
  );
};

export default GroupDetail;
