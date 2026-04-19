import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  RefreshCcw, 
  FileText, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  Upload,
  Loader,
  X
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Card from '../UI/Card';
import Button from '../UI/Button';
import './AccountDetail.css';

const MOCK_HISTORY = [
  { id: 'up_1', filename: 'HDFC_Mar_2026.pdf', date: '2026-04-01', type: 'PDF', status: 'success', rows: 42, skipped: 0, failed: 0 },
  { id: 'up_2', filename: 'HDFC_Feb_2026.csv', date: '2026-03-05', type: 'CSV', status: 'success', rows: 38, skipped: 2, failed: 0 },
  { id: 'up_3', filename: 'Scan_Apr_05.png', date: '2026-04-05', type: 'PDF', status: 'failed', rows: 0, skipped: 0, failed: 1, errorReason: 'Unrecognised column headers' },
];

const AccountDetail = ({ account, onBack, setAccounts, setSelectedAccount, accounts, transactions, setTransactions, onUpload, historyRefreshId }) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedAccount, setEditedAccount] = useState({ ...account });
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyError, setVerifyError] = useState('');

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('bank_statements')
      .select('*')
      .eq('account_id', account.id)
      .order('created_at', { ascending: false });
    
    if (!error) setHistory(data || []);
    setLoadingHistory(false);
  };

  useEffect(() => {
    fetchHistory();
    
    if (!user?.id) return;

    // Real-time sync for upload history
    const channel = supabase
      .channel(`account-history-${account.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'bank_statements', 
          filter: `account_id=eq.${account.id}` 
        },
        () => fetchHistory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [account.id, historyRefreshId, user?.id]);

  const handleSave = async () => {
    setShowVerifyModal(true);
  };

  const confirmSave = async () => {
    if (!verifyPassword) { setVerifyError('Password required.'); return; }
    setVerifying(true);
    setVerifyError('');

    // Re-verify password with Supabase
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: verifyPassword
    });

    if (authError) {
      setVerifyError('Invalid password. Verification failed.');
      setVerifying(false);
      return;
    }

    const { error } = await supabase
      .from('accounts')
      .update({
        name: editedAccount.name,
        bank_name: editedAccount.bank_name,
        type: editedAccount.type,
        masked_info: editedAccount.masked_info
      })
      .eq('id', account.id);

    setVerifying(false);
    if (!error) {
      setAccounts(accounts.map(acc => acc.id === account.id ? editedAccount : acc));
      if (setSelectedAccount) setSelectedAccount(editedAccount);
      setIsEditing(false);
      setShowVerifyModal(false);
      setVerifyPassword('');
    } else {
      setVerifyError('Save failed: ' + error.message);
    }
  };

  const deleteUploadBatch = async (id, filename, rowCount) => {
    const confirmation = window.confirm(`Permanently remove all transactions from "${filename}"?`);
    if (confirmation) {
      // 1. Delete associated transactions
      await supabase.from('transactions').delete().eq('source', 'statement_import').eq('reference_no', id); 
      // Actually, better to delete by mapped_txn_id in statement_rows or just use a shared reference.
      // Our Current StatementReview confirms rows and sets mapped_txn_id.
      
      // The most reliable way is to delete from statement_rows first, which cascadingly handles things if set up, 
      // or manually delete transactions linked to this statement.
      
      // Let's delete transactions that came from this statement
      const { data: rows } = await supabase.from('statement_rows').select('mapped_txn_id').eq('statement_id', id);
      const txnIds = rows?.map(r => r.mapped_txn_id).filter(Boolean) || [];
      
      if (txnIds.length > 0) {
        await supabase.from('transactions').delete().in('id', txnIds);
      }

      // 2. Delete statement rows
      await supabase.from('statement_rows').delete().eq('statement_id', id);

      // 3. Delete the statement record itself
      const { error } = await supabase.from('bank_statements').delete().eq('id', id);
      
      if (!error) {
        setHistory(history.filter(h => h.id !== id));
        if (setTransactions) {
           setTransactions(prev => prev.filter(t => !txnIds.includes(t.id)));
        }
      } else {
        alert('Delete failed: ' + error.message);
      }
    }
  };

  return (
    <div className="account-detail animate-fade-in">
      <header className="detail-header">
        <button onClick={onBack} className="back-link"><ArrowLeft size={20} /> Back to List</button>
        <div className="detail-header-main">
          {isEditing ? (
            <input 
              className="name-edit-input" 
              value={editedAccount.name}
              maxLength={50}
              onChange={(e) => setEditedAccount({...editedAccount, name: e.target.value})}
              autoFocus
            />
          ) : (
            <h1>{account.name}</h1>
          )}
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          >
            {isEditing ? <><Save size={14} /> Save</> : <><Edit3 size={14} /> Edit Details</>}
          </Button>
        </div>
      </header>

      <div className="detail-grid">
        <section className="detail-main">
          <Card title="Account Information" className="info-card">
            <div className="info-grid">
              <div className="info-item">
                <label>Bank Name</label>
                {isEditing ? (
                  <input value={editedAccount.bank_name} onChange={e => setEditedAccount({...editedAccount, bank_name: e.target.value})} />
                ) : <span>{account.bank_name}</span>}
              </div>
              <div className="info-item">
                <label>Account Type</label>
                {isEditing ? (
                  <select value={editedAccount.type} onChange={e => setEditedAccount({...editedAccount, type: e.target.value})}>
                    <option value="Savings">Savings</option>
                    <option value="Current">Current</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Loan">Loan</option>
                  </select>
                ) : <span>{account.type}</span>}
              </div>
              <div className="info-item">
                <label>Masked Identifier</label>
                {isEditing ? (
                  <input value={editedAccount.masked_info} onChange={e => setEditedAccount({...editedAccount, masked_info: e.target.value})} />
                ) : <span>{account.masked_info || '—'}</span>}
              </div>
            </div>
          </Card>

          <Card title="Upload History" className="history-card">
            <div className="history-table-wrapper">
              {loadingHistory ? (
                <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)'}}>
                  <Loader className="spin" />
                  <p>Loading history...</p>
                </div>
              ) : history.length === 0 ? (
                <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)'}}>
                   <FileText size={48} style={{opacity: 0.2, marginBottom: '16px'}} />
                   <p>No upload history found for this account.</p>
                </div>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Rows</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(batch => (
                      <tr key={batch.id}>
                        <td>
                          <div className="file-info">
                            <FileText size={16} />
                            <span>{batch.filename}</span>
                          </div>
                        </td>
                        <td>{new Date(batch.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`status-pill ${batch.status === 'complete' ? 'success' : 'failed'}`}>
                            {batch.status === 'complete' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                            {batch.status}
                          </span>
                        </td>
                        <td>{batch.row_count}</td>
                        <td className="actions-cell">
                          <button className="icon-btn delete" onClick={() => deleteUploadBatch(batch.id, batch.filename, batch.row_count)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </section>

        <aside className="detail-sidebar">
          <Card className="action-card">
             <h3>Quick Actions</h3>
             <Button fullWidth className="btn-upload" onClick={onUpload}><Upload size={18} /> Upload New Statement</Button>
             <div className="sidebar-note">Statement parsing automatically creates associated transactions.</div>
             <Button variant="secondary" fullWidth style={{marginTop: '12px'}} onClick={fetchHistory}><RefreshCcw size={16} /> Refresh History</Button>
          </Card>
        </aside>
      </div>

      {/* Password Verification Modal */}
      {showVerifyModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowVerifyModal(false); }}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Verify Identity</h3>
              <button className="modal-close-btn" onClick={() => setShowVerifyModal(false)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Confirm your password to save changes to this bank account.
            </p>
            {verifyError && <p className="error-text" style={{ marginBottom: '12px' }}>{verifyError}</p>}
            <div className="form-group">
              <label>Login Password</label>
              <input 
                type="password" 
                placeholder="Enter your password" 
                value={verifyPassword}
                onChange={e => { setVerifyPassword(e.target.value); setVerifyError(''); }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && confirmSave()}
              />
            </div>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <Button variant="secondary" onClick={() => setShowVerifyModal(false)}>Cancel</Button>
              <Button onClick={confirmSave} disabled={verifying}>
                {verifying ? 'Verifying...' : 'Confirm & Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountDetail;
