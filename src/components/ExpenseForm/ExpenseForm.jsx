import { useState } from 'react';
import {
  IndianRupee, Calendar, Tag, CreditCard, UserPlus, Clock,
  ArrowDownCircle, ArrowUpCircle, HandCoins
} from 'lucide-react';
import Card from '../UI/Card';
import Button from '../UI/Button';
import './ExpenseForm.css';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { getCategoryIcon } from '../../utils/categoryIcons';

const MODES = ['UPI', 'Cash', 'Credit Card', 'Debit Card', 'Net Banking', 'Cheque'];

const ExpenseForm = ({ onAddExpense, categories = [], accounts = [], onCategoryAdded }) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    lentEntity: ''
  });

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
      category_id: '' // Force re-selection
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.category_id || isSubmitting || !user) return;
    
    setIsSubmitting(true);
    try {
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

      const { error } = await supabase.from('transactions').insert({
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
        status: (isLent || formData.hasPayback || formData.isDebt) ? 'pending' : 'settled'
      });

      if (!error) {
        setFormData(prev => ({
          ...prev,
          amount: '',
          hasPayback: false,
          paybackEntity: '',
          paybackAmount: '',
          isDebt: false,
          debtEntity: '',
          lentEntity: ''
        }));
        onAddExpense();
      }
    } catch (err) {
      console.error(err);
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

      <form onSubmit={handleSubmit} className="expense-form">
        <div className={`amount-input-wrapper ${formData.type}`}>
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
              <div className="payback-section">
                <label className="checkbox-label" style={{ opacity: 0.5 }}>
                  <input type="checkbox" disabled />
                  <UserPlus size={16} /> Use the 'Lent' tab above to record money owed to you
                </label>
              </div>

              <div className="debt-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isDebt"
                    checked={formData.isDebt}
                    onChange={handleChange}
                    disabled={formData.hasPayback}
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

        <Button 
          fullWidth 
          className={`submit-btn ${formData.type}`} 
          size="lg"
          disabled={isSubmitting || !formData.amount || !formData.category_id}
        >
          {isSubmitting ? 'Recording...' : `Add ${formData.type === 'expense' ? 'Expense' : 'Income'}`}
        </Button>
      </form>
    </Card>
  );
};

export default ExpenseForm;
