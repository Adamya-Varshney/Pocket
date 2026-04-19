import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ArrowLeft, UserPlus, Trash2, Shield, User } from 'lucide-react';
import Card from '../UI/Card';

const GroupDetail = ({ group, user, onBack }) => {
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', category: 'Others', date: new Date().toISOString().split('T')[0] });
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [filterMemberId, setFilterMemberId] = useState('all');

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
      const { data, error } = await supabase.rpc('invite_user_by_email', {
        p_group_id: group.id,
        p_email: inviteEmail.trim()
      });
      if (error) throw error;
      setInviteEmail('');
      alert('User invited successfully!');
      fetchData();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.amount || !expenseForm.description) return;
    try {
      const { error } = await supabase.from('expense_group_transactions').insert({
        group_id: group.id,
        paid_by: user.id,
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        txn_date: expenseForm.date
      });
      if (error) throw error;
      setExpenseForm({ ...expenseForm, description: '', amount: '' });
      fetchData(); // Instant local sync
    } catch (error) {
      alert('Failed to add expense');
    }
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    await supabase.from('expense_group_transactions').delete().eq('id', expenseToDelete.id);
    setExpenseToDelete(null);
    fetchData(); // Instant local sync
  };

  const filteredExpenses = expenses.filter(exp => 
    filterMemberId === 'all' ? true : exp.paid_by === filterMemberId
  );

  const getMemberName = (uid) => {
    if (uid === user.id) return 'You';
    const match = members.find(m => m.user_id === uid);
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
          <Card className="add-expense-card">
            <h3>Add Expense</h3>
            <form className="add-expense-form" onSubmit={handleAddExpense}>
              <input 
                type="text" 
                className="full-row"
                placeholder="What was this for? (e.g. Dinner, Rent)" 
                value={expenseForm.description}
                onChange={e => setExpenseForm({...expenseForm, description: e.target.value})}
                required
              />
              <input 
                type="number" 
                placeholder="Amount (₹)" 
                value={expenseForm.amount}
                onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                required
              />
              <input 
                type="date" 
                value={expenseForm.date}
                onChange={e => setExpenseForm({...expenseForm, date: e.target.value})}
                required
              />
              <div className="full-row">
                <button type="submit" className="btn-primary" style={{width:'100%'}}>Add to Group Ledger</button>
              </div>
            </form>
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
                    <span style={{ fontWeight: 600, display: 'block' }}>{exp.description}</span>
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
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="modal-overlay">
          <div className="delete-modal">
            <h3>Delete Expense</h3>
            <p>Are you sure you want to delete the "{expenseToDelete.description}" expense of ₹{expenseToDelete.amount} from the group ledger? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setExpenseToDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={confirmDeleteExpense}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetail;
