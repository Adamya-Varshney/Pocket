import { useState, useEffect, useMemo } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, Check, X, Tag, ChevronDown,
  Inbox, RefreshCw, CheckSquare, XSquare, FileText, Loader
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { getCategoryIcon } from '../../utils/categoryIcons';
import Card from '../UI/Card';
import Button from '../UI/Button';
import './StatementReview.css';
import { normalizeMerchant, suggestCategory } from '../../utils/merchantUtils';

// RowEditor confirms rows and sets mapped_txn_id.
const RowEditor = ({ row, edit, categories, onChange, onConfirm, onSkip, isConfirming }) => {
  const normalized = useMemo(() => normalizeMerchant(row.description), [row.description]);
  const isExpense = edit.type === 'expense';
  const displayAmount = isExpense ? row.debit_amount : row.credit_amount;
  const Icon = isExpense ? ArrowDownCircle : ArrowUpCircle;

  return (
    <div className={`review-row ${edit.type}`}>
      <div className="review-row-left">
        <div className={`review-type-btn ${edit.type}`} onClick={() =>
          onChange({ type: edit.type === 'expense' ? 'income' : 'expense' })
        } title="Toggle expense/income">
          <Icon size={18} />
        </div>
        <div className="review-row-info">
          <span className="review-merchant">{edit.description || normalized}</span>
          <span className="review-raw">{row.description !== normalized ? row.description : ''}</span>
          <span className="review-date">{row.txn_date}</span>
        </div>
      </div>

      <div className="review-row-center">
        {/* Description override */}
        <input
          className="review-desc-input"
          value={edit.description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Description override..."
        />
        {/* Category picker */}
        <div className="review-cat-select-wrap">
          <Tag size={14} className="review-cat-icon" />
          <select
            className={`review-cat-select ${!edit.categoryId ? 'required' : ''}`}
            value={edit.categoryId || ''}
            onChange={e => onChange({ categoryId: e.target.value || null })}
          >
            <option value="">{isExpense ? '— Choose Expense Cat —' : '— Choose Income Cat —'}</option>
            {categories
              .filter(c => c.type === edit.type || !c.type)
              .map(c => {
                const CatIcon = getCategoryIcon(c);
                return <option key={c.id} value={c.id}>{c.name}</option>;
              })}
          </select>
        </div>
      </div>

      <div className="review-row-right">
        <span className={`review-amount ${edit.type}`}>
          {isExpense ? '-' : '+'}₹{displayAmount.toLocaleString('en-IN')}
        </span>
        <div className="review-actions">
          <button
            className="review-btn confirm"
            onClick={() => onConfirm(row.id)}
            disabled={isConfirming || !edit.categoryId}
            title={!edit.categoryId ? "Category required" : "Add to ledger"}
          >
            {isConfirming ? <Loader size={14} className="spin" /> : <Check size={14} />}
          </button>
          <button
            className="review-btn skip"
            onClick={() => onSkip(row.id)}
            disabled={isConfirming}
            title="Skip this row"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const StatementReview = ({ categories = [], onDone, merchantOverrides = {} }) => {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({});
  const [confirming, setConfirming] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [groupBy, setGroupBy] = useState('statement'); // statement | date

  // ── Fetch all pending rows ───────────────────────────────────────
  const fetchRows = async () => {
    if (!user?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('statement_rows')
      .select(`
        *,
        bank_statements(filename, account_id, accounts(name, bank_name))
      `)
      .eq('user_id', user.id)
      .eq('status', 'pending');

    if (error) { console.error('StatementReview fetch error:', error); setLoading(false); return; }

    // Initial pass: normalize merchants & suggest categories
    const hydrated = (data || []).map(row => {
      const normalized = normalizeMerchant(row.description, merchantOverrides);
      const suggestedCat = suggestCategory(normalized, categories);
      return {
        ...row,
        normalized_description: normalized,
        suggested_category_id: suggestedCat?.id || null
      };
    });

    const initialEdits = {};
    hydrated.forEach(row => {
      initialEdits[row.id] = {
        type: row.debit_amount > 0 ? 'expense' : 'income',
        amount: row.debit_amount > 0 ? row.debit_amount : row.credit_amount,
        description: row.normalized_description,
        categoryId: row.suggested_category_id,
      };
    });

    setRows(hydrated);
    setEdits(initialEdits);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, [user?.id]);

  const updateEdit = (rowId, changes) => {
    setEdits(prev => ({ ...prev, [rowId]: { ...prev[rowId], ...changes } }));
  };

  // ── Confirm single row → insert into transactions ────────────────
  const confirmRow = async (rowId) => {
    setConfirming(prev => new Set([...prev, rowId]));
    const row = rows.find(r => r.id === rowId);
    const edit = edits[rowId];
    if (!row || !edit) return;

    const { data: txn, error: txnErr } = await supabase
      .from('transactions')
      .insert({
        user_id:          row.user_id,
        account_id:       row.account_id,
        type:             edit.type,
        amount:           Number(edit.amount),
        description:      edit.description?.trim() || row.description,
        txn_date:         row.txn_date,
        txn_time:         null,
        category_id:      edit.categoryId,
        payment_mode:     'Bank Transfer',
        status:           'settled',
        liability_type:   'none',
        liability_amount: 0,
        entity_name:      null,
        income_type:      edit.type === 'income' ? (edit.categoryId ? 'Credit' : 'Other') : null,
        reference_no:     row.reference_no || null,
        source:           'statement_import',
      })
      .select()
      .single();

    if (!txnErr && txn) {
      // 2. Link the row. 'ignored' is used to satisfy the strict DB check constraint, 
      // while 'mapped_txn_id' guarantees we know it was successfully confirmed.
      const { error: updateErr } = await supabase
        .from('statement_rows')
        .update({ 
          status: 'ignored', 
          mapped_txn_id: txn.id 
        })
        .eq('id', rowId);

      if (updateErr) {
        console.error('Statement row update failed:', updateErr);
        // Important: If we failed to mark it reviewed, we should probably warn 
        // that it might reappear, but since it IS in the ledger, 
        // we show the error and offer a manual refresh.
        alert(`Transaction added to ledger, but status update failed: ${updateErr.message}. The row may reappear in Review until refreshed.`);
      } else {
        // Success: remove from local UI
        setRows(prev => prev.filter(r => r.id !== rowId));
      }
    } else {
      alert(`Ledger entry failed: ${txnErr?.message || 'Unknown error'}`);
    }

    setConfirming(prev => { const s = new Set(prev); s.delete(rowId); return s; });
  };

  // ── Skip single row ──────────────────────────────────────────────
  const skipRow = async (rowId) => {
    await supabase.from('statement_rows').update({ status: 'ignored' }).eq('id', rowId);
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  // ── Confirm ALL remaining rows ───────────────────────────────────
  const confirmAll = async () => {
    const readyRows = rows.filter(r => edits[r.id]?.categoryId);
    if (readyRows.length === 0) {
      alert('No rows have categories assigned. Please assign categories before confirming.');
      return;
    }

    if (readyRows.length < rows.length) {
      if (!window.confirm(`Only ${readyRows.length} out of ${rows.length} rows have categories. Confirm only these?`)) return;
    }

    setBulkWorking(true);
    for (const row of readyRows) {
      await confirmRow(row.id);
    }
    setBulkWorking(false);
    if (rows.length === readyRows.length) onDone();
  };

  // ── Skip ALL remaining rows ──────────────────────────────────────
  const skipAll = async () => {
    if (!window.confirm(`Skip all ${rows.length} pending rows?`)) return;
    setBulkWorking(true);
    const ids = rows.map(r => r.id);
    await supabase.from('statement_rows').update({ status: 'ignored' }).in('id', ids);
    setRows([]);
    setBulkWorking(false);
    onDone();
  };

  // ── Group rows ───────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const groups = {};
    rows.forEach(row => {
      const key = groupBy === 'statement'
        ? (row.bank_statements?.filename || 'Unknown statement')
        : (row.txn_date || 'Unknown date');
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return Object.entries(groups);
  }, [rows, groupBy]);

  // ── Empty state: all done ────────────────────────────────────────
  if (!loading && rows.length === 0) {
    return (
      <div className="review-done-state animate-fade-in">
        <CheckSquare size={56} className="done-icon" />
        <h2>All caught up!</h2>
        <p>All imported transactions have been reviewed.</p>
        <Button onClick={onDone}>Back to History</Button>
      </div>
    );
  }

  return (
    <div className="statement-review animate-fade-in">

      {/* ── Header ───────────────────────────────────── */}
      <div className="review-header">
        <div>
          <h1 className="review-title">Review Imports</h1>
          <p className="review-subtitle">
            {loading ? 'Loading...' : `${rows.length} transaction${rows.length !== 1 ? 's' : ''} from bank statements need review`}
          </p>
        </div>
        <div className="review-header-actions">
          <select
            className="group-select"
            value={groupBy}
            onChange={e => setGroupBy(e.target.value)}
          >
            <option value="statement">Group by Statement</option>
            <option value="date">Group by Date</option>
          </select>
          <button className="refresh-btn" onClick={fetchRows} title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ── Bulk Actions ─────────────────────────────── */}
      {!loading && rows.length > 0 && (
        <div className="bulk-actions">
          <span className="bulk-hint">
            <FileText size={14} /> Auto-detect pre-fills type & merchant name. Assign categories and confirm.
          </span>
          <div className="bulk-btns">
            <button className="bulk-btn confirm-all" onClick={confirmAll} disabled={bulkWorking}>
              {bulkWorking ? <Loader size={14} className="spin" /> : <CheckSquare size={14} />}
              Confirm All ({rows.length})
            </button>
            <button className="bulk-btn skip-all" onClick={skipAll} disabled={bulkWorking}>
              <XSquare size={14} /> Skip All
            </button>
          </div>
        </div>
      )}

      {/* ── Row Groups ───────────────────────────────── */}
      {loading ? (
        <div className="review-loading">
          <Loader size={32} className="spin" />
          <p>Loading pending imports...</p>
        </div>
      ) : (
        <div className="review-groups">
          {grouped.map(([groupKey, groupRows]) => (
            <Card key={groupKey} className="review-group-card">
              <div className="group-header">
                <FileText size={14} />
                <span className="group-name">{groupKey}</span>
                <span className="group-count">{groupRows.length} rows</span>
              </div>
              <div className="group-rows">
                {groupRows.map(row => (
                  <RowEditor
                    key={row.id}
                    row={row}
                    edit={edits[row.id] || { type: 'expense', description: row.description, categoryId: null }}
                    categories={categories}
                    onChange={(changes) => updateEdit(row.id, changes)}
                    onConfirm={confirmRow}
                    onSkip={skipRow}
                    isConfirming={confirming.has(row.id)}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Back ─────────────────────────────────────── */}
      <div style={{ marginTop: 24 }}>
        <Button variant="secondary" fullWidth onClick={onDone}>
          ← Back to History
        </Button>
      </div>
    </div>
  );
};

export default StatementReview;
