import { useState, useRef, useEffect, useMemo } from 'react';
import {
  IndianRupee, Calendar, Tag, CreditCard, UserPlus, Clock,
  ArrowDownCircle, ArrowUpCircle, HandCoins,
  Camera, Sparkles, Loader, RefreshCw, Link2, PlusCircle, FileText
} from 'lucide-react';
import Card from '../UI/Card';
import Button from '../UI/Button';
import './ExpenseForm.css';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { normalizeMerchant, suggestCategory } from '../../utils/merchantUtils';

const MODES = ['UPI', 'Cash', 'Credit Card', 'Debit Card', 'Net Banking', 'Cheque'];

const ExpenseForm = ({ onAddExpense, categories = [], accounts = [], onCategoryAdded, transactions = [] }) => {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const [formData, setFormData] = useState({
    type: 'expense',
    income_type: 'Credit',
    amount: '',
    category_id: '',
    account_id: accounts[0]?.id || '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    paymentMode: 'UPI',
    description: '',
    hasPayback: false,
    paybackEntity: '',
    paybackType: 'full', 
    paybackAmount: '',
    isDebt: false,
    debtEntity: '',
    lentEntity: '',
    // ── Repayment fields ─────────────────────────────────
    isRepayment: false,
    repaymentMode: 'settle_existing', // 'settle_existing' | 'new_credit' | 'just_expense'
    linkedTxnId: '',
    repaymentEntity: ''
  });

  // Pending credits/debts the user might want to repay against
  const pendingCredits = useMemo(() =>
    transactions.filter(t =>
      (t.type === 'income' && t.income_type === 'Credit' && t.status === 'pending') ||
      (t.liability_type === 'debt' && t.type === 'expense' && t.status === 'pending')
    ),
  [transactions]);

  // ── REAL-TIME AUTO-CATEGORIZATION ─────────────────────────────
  // Automatically suggest a category as the user types
  useEffect(() => {
    if (!formData.description || formData.description.length < 3) return;
    
    // Only auto-suggest if no category is picked yet, or if the current one was an auto-pick
    const merchantOverrides = user?.preferences?.merchantOverrides || {};
    const normalized = normalizeMerchant(formData.description, merchantOverrides);
    const suggested = suggestCategory(normalized, categories);

    if (suggested && (!formData.category_id || formData._autoPicked)) {
      setFormData(prev => ({
        ...prev,
        category_id: suggested.id,
        _autoPicked: true // Mark as auto-picked so we can allow user to override
      }));
    }
  }, [formData.description]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleTypeToggle = (type) => {
    setFormData(prev => ({
      ...prev,
      type,
      category_id: '',
      isRepayment: false,
      repaymentMode: 'settle_existing',
      linkedTxnId: '',
      repaymentEntity: ''
    }));
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim() || !user) return;
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: user.id,
          name: newCatName,
          type: formData.type,
          icon: 'Tag'
        })
        .select()
        .single();
      
      if (!error && data) {
        setFormData(p => ({ ...p, category_id: data.id }));
        setNewCatName('');
        setShowAddCategory(false);
        if (onCategoryAdded) onCategoryAdded();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSnapshotUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setScanError('Configuration Error: Gemini API key not found in .env');
      return;
    }

    try {
      setIsScanning(true);
      setScanError('');

      // Read file to base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `You are an expert financial receipt and payment screenshot data extractor.
Analyze this payment snippet (like an offline receipt, Google Pay, or PhonePe completion screen).
Extract the details into a STRICT JSON object with no wrapping markdown or trailing comments.
Keys must be exactly:
- "amount": number (extract just the numeric value paid)
- "date": string (format as "YYYY-MM-DD", fallback to empty string if missing)
- "time": string (format as "HH:MM", 24hr, fallback to empty string if missing)
- "description": string (the merchant name, person paid, or user note)
- "paymentMode": string (analyze the image and map precisely to ONE of these: "UPI", "Cash", "Credit Card", "Debit Card", "Net Banking", "Cheque". Default to "UPI" if it's GPay/PhonePe and you can't tell, "Cash" if physical receipt unless stated otherwise)

Return ONLY JSON.`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64, mimeType: file.type } }
      ]);
      
      const responseText = result.response.text();
      const cleanJson = responseText.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
      const data = JSON.parse(cleanJson);

      // Hydrate form
      const merchantOverrides = user?.preferences?.merchantOverrides || {};
      const normalized = normalizeMerchant(data.description || '', merchantOverrides);
      const suggestedCat = suggestCategory(normalized, categories);

      setFormData(prev => ({
        ...prev,
        amount: data.amount ? String(data.amount) : prev.amount,
        date: data.date || prev.date,
        time: data.time || prev.time,
        description: normalized || data.description || prev.description,
        paymentMode: MODES.includes(data.paymentMode) ? data.paymentMode : prev.paymentMode,
        category_id: suggestedCat?.id || prev.category_id
      }));

    } catch (err) {
      console.error("AI scanning failed:", err);
      setScanError(err.message || 'Failed to read receipt. Please enter manually.');
    } finally {
      setIsScanning(false);
      // Reset input so they can scan the same file again if they want
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.category_id || isSubmitting || !user) return;
    // Repayment path-specific guards
    if (formData.isRepayment && formData.repaymentMode === 'settle_existing' && !formData.linkedTxnId && pendingCredits.length > 0) return;
    if (formData.isRepayment && formData.repaymentMode === 'new_credit' && !formData.repaymentEntity.trim()) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {

      // ── REPAYMENT FLOW ────────────────────────────────────────────────────
      if (formData.isRepayment) {
        const linkedTxn = pendingCredits.find(t => t.id === formData.linkedTxnId);
        const entityName =
          formData.repaymentMode === 'settle_existing'
            ? (linkedTxn?.entity_name || linkedTxn?.paybackEntity || null)
            : formData.repaymentMode === 'new_credit'
              ? (formData.repaymentEntity.trim() || null)
              : null;

        // Step 1 — Insert the repayment expense
        const { data: repData, error: repError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            account_id: formData.account_id || null,
            category_id: formData.category_id,
            type: 'expense',
            income_type: null,
            amount: parseFloat(formData.amount),
            description: formData.description || (entityName ? `Repayment to ${entityName}` : 'Repayment'),
            payment_mode: formData.paymentMode,
            txn_date: formData.date,
            txn_time: formData.time,
            liability_type: 'repayment',
            entity_name: entityName,
            liability_amount: 0,
            status: 'settled',
            settled_at: new Date().toISOString()
          })
          .select()
          .single();

        if (repError) {
          console.error('Repayment insert failed:', repError);
          setSubmitError(`Failed to save repayment: ${repError.message}`);
          return;
        }
        if (!repData) {
          setSubmitError('Repayment could not be verified. Please check your history and try again.');
          return;
        }

        // Step 2 (Path A) — Mark the linked transaction as settled
        if (formData.repaymentMode === 'settle_existing' && formData.linkedTxnId) {
          const { error: settleError } = await supabase
            .from('transactions')
            .update({ status: 'settled', settled_at: new Date().toISOString() })
            .eq('id', formData.linkedTxnId);

          if (settleError) {
            setSubmitError(`Repayment recorded, but couldn't settle the original debt: ${settleError.message}`);
            return;
          }
        }

        // Step 3 (Path B) — Also insert a matching credit income entry
        if (formData.repaymentMode === 'new_credit' && formData.repaymentEntity.trim()) {
          const creditCat = categories.find(c =>
            c.name?.toLowerCase() === 'credit' && c.type === 'income'
          );
          if (creditCat) {
            const { error: creditError } = await supabase
              .from('transactions')
              .insert({
                user_id: user.id,
                account_id: formData.account_id || null,
                category_id: creditCat.id,
                type: 'income',
                income_type: 'Credit',
                amount: parseFloat(formData.amount),
                description: `Borrowed from ${formData.repaymentEntity.trim()}`,
                payment_mode: formData.paymentMode,
                txn_date: formData.date,
                txn_time: formData.time,
                liability_type: 'payback',
                entity_name: formData.repaymentEntity.trim(),
                liability_amount: parseFloat(formData.amount),
                status: 'settled',
                settled_at: new Date().toISOString()
              })
              .select()
              .single();

            if (creditError) {
              setSubmitError(`Repayment recorded, but couldn't create the credit entry: ${creditError.message}`);
              return;
            }
          }
        }

        // Success — reset repayment fields and navigate
        setFormData(prev => ({
          ...prev,
          amount: '',
          isRepayment: false,
          repaymentMode: 'settle_existing',
          linkedTxnId: '',
          repaymentEntity: ''
        }));
        onAddExpense();
        return;
      }

      // ── STANDARD FLOW ──────────────────────────────────────────────────────
      const isLent = formData.type === 'lent';
      const actualType = isLent ? 'expense' : formData.type;

      let finalPaybackAmount = 0;
      if (isLent) {
        finalPaybackAmount = formData.amount;
      } else if (formData.hasPayback && actualType === 'expense') {
        if (formData.paybackType === 'full') finalPaybackAmount = formData.amount;
        else if (formData.paybackType === 'half') finalPaybackAmount = formData.amount / 2;
        else finalPaybackAmount = formData.paybackAmount;
      }

      const { data, error } = await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: formData.account_id || null,
        category_id: formData.category_id,
        type: actualType,
        income_type: actualType === 'income' ? formData.income_type : null,
        amount: parseFloat(formData.amount),
        description: formData.description,
        payment_mode: formData.paymentMode,
        txn_date: formData.date,
        txn_time: formData.time,
        liability_type: isLent
          ? 'payback'
          : (actualType === 'expense'
              ? (formData.hasPayback ? 'payback' : (formData.isDebt ? 'debt' : 'none'))
              : 'none'),
        entity_name: isLent
          ? formData.lentEntity
          : (formData.hasPayback
              ? formData.paybackEntity
              : (formData.isDebt ? formData.debtEntity : null)),
        liability_amount: isLent
          ? parseFloat(formData.amount)
          : (formData.hasPayback
              ? parseFloat(finalPaybackAmount)
              : (formData.isDebt ? parseFloat(formData.amount) : 0)),
        status: (isLent || formData.hasPayback || formData.isDebt || (actualType === 'income' && formData.income_type === 'Credit')) ? 'pending' : 'settled'
      }).select().single();

      if (error) {
        console.error('Transaction insert failed:', error);
        setSubmitError(`Failed to save: ${error.message}`);
        return;
      }
      if (!data) {
        console.error('Transaction insert returned no data — row may not have been persisted.');
        setSubmitError('Transaction could not be verified. Please check your history and try again.');
        return;
      }

      // Insert confirmed — reset form and navigate
      setFormData(prev => ({
        ...prev,
        amount: '',
        hasPayback: false,
        paybackEntity: '',
        paybackAmount: '',
        isDebt: false,
        debtEntity: '',
        lentEntity: '',
        isRepayment: false,
        linkedTxnId: '',
        repaymentEntity: '',
        repaymentMode: 'settle_existing'
      }));
      onAddExpense();
    } catch (err) {
      console.error('Transaction submit exception:', err);
      setSubmitError(`Unexpected error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const mappedTypeForCategory = formData.type === 'lent' ? 'expense' : formData.type;
  const filteredCategories = categories.filter(c => c.type === mappedTypeForCategory || c.type === 'all');

  return (
    <Card title="Record Transaction" className="expense-form-card">
      <div className="type-toggle">
        <button 
          className={`type-btn expense ${formData.type === 'expense' ? 'active' : ''}`}
          onClick={() => handleTypeToggle('expense')}
        >
          <ArrowDownCircle size={18} /> Expense
        </button>
        <button 
          className={`type-btn income ${formData.type === 'income' ? 'active' : ''}`}
          onClick={() => handleTypeToggle('income')}
        >
          <ArrowUpCircle size={18} /> Income
        </button>
        <button 
          className={`type-btn lent ${formData.type === 'lent' ? 'active' : ''}`}
          onClick={() => handleTypeToggle('lent')}
          style={formData.type === 'lent' ? { background: '#2dd4bf', color: '#111827' } : {}}
        >
          <UserPlus size={18} /> Lent
        </button>
      </div>

      <div className="ai-scanner-section">
        <button 
          type="button" 
          className={`ai-scan-btn ${isScanning ? 'scanning' : ''}`}
          onClick={() => fileRef.current?.click()}
          disabled={isScanning}
        >
          {isScanning ? (
            <><Loader size={16} className="spin" /> Reading Receipt...</>
          ) : (
            <><Camera size={16} /> Scan Receipt <Sparkles size={14} className="sparkle" /></>
          )}
        </button>
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileRef} 
          style={{ display: 'none' }} 
          onChange={handleSnapshotUpload} 
        />
        {scanError && <p className="scan-error">{scanError}</p>}
      </div>

      <form onSubmit={handleSubmit} className="expense-form">
        <div className={`amount-input-wrapper ${formData.type} ${isScanning ? 'disabled' : ''}`}>
          <IndianRupee size={24} className="currency-icon" />
          <input
            type="number"
            name="amount"
            placeholder="0.00"
            value={formData.amount}
            onChange={handleChange}
            className="amount-input"
            required
            autoFocus
          />
        </div>

        <div className="form-grid">
          {formData.type === 'income' && (
            <div className="form-group">
              <label><ArrowUpCircle size={16} /> Income Classification</label>
              <div className="type-toggle income-sub-toggle">
                <button 
                  type="button"
                  className={`type-btn ${formData.income_type === 'Salary' ? 'active income' : ''}`}
                  onClick={() => setFormData(p => ({ ...p, income_type: 'Salary' }))}
                >Salary</button>
                <button 
                  type="button"
                  className={`type-btn ${formData.income_type === 'Credit' ? 'active income' : ''}`}
                  onClick={() => setFormData(p => ({ ...p, income_type: 'Credit' }))}
                >Credit</button>
              </div>
            </div>
          )}

          {formData.type === 'lent' && (
            <div className="form-group animate-fade-in" style={{ padding: '16px', background: 'rgba(45,212,191,0.1)', border: '1px solid #2dd4bf', borderRadius: '12px', gridColumn: 'span 2' }}>
              <label style={{ color: '#2dd4bf', fontWeight: 'bold' }}><UserPlus size={16} /> Who did you lend this to?</label>
              <input
                type="text"
                name="lentEntity"
                placeholder="Name or Phone Number (e.g. Rahul)"
                value={formData.lentEntity}
                onChange={handleChange}
                required
                style={{ marginTop: '8px' }}
              />
            </div>
          )}

          <div className="form-group">
            <label><Tag size={16} /> Category</label>
            <div className="category-grid">
              {filteredCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-item ${formData.category_id === cat.id ? 'active' : ''}`}
                    onClick={() => setFormData(p => ({ ...p, category_id: cat.id }))}
                  >
                    {/* Lucide icon mapped from category name */}
                    <span className="cat-icon">
                      {(() => { const Icon = getCategoryIcon(cat); return <Icon size={18} />; })()}
                    </span>
                    <span className="cat-label">{cat.name}</span>
                  </button>
              ))}
              <button 
                type="button" 
                className={`category-item add-new ${showAddCategory ? 'active' : ''}`}
                onClick={() => setShowAddCategory(!showAddCategory)}
              >
                <span className="cat-icon">+</span>
                <span className="cat-label">New</span>
              </button>
            </div>
            {showAddCategory && (
              <div className="add-category-inline animate-fade-in">
                <input 
                  type="text" 
                  placeholder="Category Name" 
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
                <Button onClick={handleCreateCategory} size="sm">Add</Button>
              </div>
            )}
          </div>

          <div className="form-group">
            <label><CreditCard size={16} /> Account Source</label>
            <select name="account_id" value={formData.account_id} onChange={handleChange}>
              <option value="">No Account</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.bank_name})</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label><Calendar size={16} /> Date</label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label><Clock size={16} /> Time</label>
              <input type="time" name="time" value={formData.time} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-group">
            <label><CreditCard size={16} /> Payment Mode</label>
            <select name="paymentMode" value={formData.paymentMode} onChange={handleChange}>
              {MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Description (Optional)</label>
            <input
              type="text"
              name="description"
              placeholder="What was this for?"
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          {formData.type === 'expense' && (
            <div className="extra-features">

              {/* ── Repayment Section ────────────────────────── */}
              <div className="repayment-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isRepayment"
                    checked={formData.isRepayment}
                    onChange={handleChange}
                    disabled={formData.isDebt}
                  />
                  <RefreshCw size={16} /> Repayment — I'm paying back a debt
                </label>

                {formData.isRepayment && (
                  <div className="repayment-details animate-fade-in">
                    <p className="repayment-prompt">How would you like to record this?</p>

                    <div className="repayment-path-options">
                      <button
                        type="button"
                        className={`repayment-path-card ${formData.repaymentMode === 'settle_existing' ? 'active' : ''}`}
                        onClick={() => setFormData(p => ({ ...p, repaymentMode: 'settle_existing' }))}
                      >
                        <Link2 size={15} className="path-icon" />
                        <div className="path-text">
                          <span className="path-title">Settle an existing debt</span>
                          <span className="path-desc">Link to a pending credit or debt entry</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className={`repayment-path-card ${formData.repaymentMode === 'new_credit' ? 'active' : ''}`}
                        onClick={() => setFormData(p => ({ ...p, repaymentMode: 'new_credit' }))}
                      >
                        <PlusCircle size={15} className="path-icon" />
                        <div className="path-text">
                          <span className="path-title">New credit entry + settle</span>
                          <span className="path-desc">The borrowing wasn't recorded — create &amp; close it</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className={`repayment-path-card ${formData.repaymentMode === 'just_expense' ? 'active' : ''}`}
                        onClick={() => setFormData(p => ({ ...p, repaymentMode: 'just_expense' }))}
                      >
                        <FileText size={15} className="path-icon" />
                        <div className="path-text">
                          <span className="path-title">Just log as expense</span>
                          <span className="path-desc">Simple record, flagged as a repayment</span>
                        </div>
                      </button>
                    </div>

                    {/* Path A: pick from pending debts */}
                    {formData.repaymentMode === 'settle_existing' && (
                      <div className="form-group repayment-sub-field">
                        <label>Select the debt to settle</label>
                        {pendingCredits.length === 0 ? (
                          <p className="no-pending-msg">No pending debts found — choose another option above.</p>
                        ) : (
                          <select name="linkedTxnId" value={formData.linkedTxnId} onChange={handleChange}>
                            <option value="">— Select a debt —</option>
                            {pendingCredits.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.entity_name || t.paybackEntity || t.description || 'Unknown'}
                                {' '}— ₹{Number(t.amount).toLocaleString('en-IN')} ({t.date})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Path B: new credit entity */}
                    {formData.repaymentMode === 'new_credit' && (
                      <div className="form-group repayment-sub-field">
                        <label>Who did you borrow from?</label>
                        <input
                          type="text"
                          name="repaymentEntity"
                          placeholder="e.g. Rahul / HDFC Credit Card"
                          value={formData.repaymentEntity}
                          onChange={handleChange}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Borrowed / Debt Section ──────────────────── */}
              <div className="debt-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isDebt"
                    checked={formData.isDebt}
                    onChange={handleChange}
                    disabled={formData.hasPayback || formData.isRepayment}
                  />
                  <HandCoins size={16} /> Borrowed / Paid by someone Else
                </label>

                {formData.isDebt && (
                  <div className="payback-details animate-fade-in">
                    <div className="form-group">
                      <label>Owed To (Entity Name)</label>
                      <input
                        type="text"
                        name="debtEntity"
                        placeholder="e.g. Zomato / Friend Name"
                        value={formData.debtEntity}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {submitError && (
          <p className="scan-error" style={{ textAlign: 'center', marginBottom: 8 }}>{submitError}</p>
        )}

        <Button
          fullWidth
          className={`submit-btn ${formData.type}`}
          size="lg"
          disabled={
            isSubmitting ||
            !formData.amount ||
            !formData.category_id ||
            (formData.isRepayment && formData.repaymentMode === 'settle_existing' && !formData.linkedTxnId && pendingCredits.length > 0) ||
            (formData.isRepayment && formData.repaymentMode === 'new_credit' && !formData.repaymentEntity.trim())
          }
        >
          {isSubmitting
            ? 'Recording...'
            : formData.isRepayment
              ? 'Record Repayment'
              : `Add ${formData.type === 'expense' ? 'Expense' : 'Income'}`
          }
        </Button>
      </form>
    </Card>
  );
};

export default ExpenseForm;
