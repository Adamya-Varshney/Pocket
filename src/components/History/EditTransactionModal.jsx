import { useState, useEffect } from 'react';
import { X, Calendar, Clock, IndianRupee, Tag, CreditCard, FileText } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import Button from '../UI/Button';
import './EditTransactionModal.css';

const MODES = ['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Net Banking'];

const EditTransactionModal = ({ transaction, categories, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    amount: '',
    category_id: '',
    paymentMode: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (transaction) {
      setFormData({
        date: transaction.date || '',
        time: transaction.time ? transaction.time.slice(0, 5) : '',
        amount: transaction.amount ? String(transaction.amount) : '',
        category_id: transaction.category_id || '',
        paymentMode: transaction.paymentMode || '',
        description: transaction.description || ''
      });
    }
  }, [transaction]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.category_id) return;
    setIsSubmitting(true);
    setError('');

    try {
      const { data, error: updateError } = await supabase
        .from('transactions')
        .update({
          txn_date: formData.date,
          txn_time: formData.time ? `${formData.time}:00` : null,
          amount: parseFloat(formData.amount),
          category_id: formData.category_id,
          payment_mode: formData.paymentMode,
          description: formData.description
        })
        .eq('id', transaction.id)
        .select()
        .single();

      if (updateError) throw updateError;
      
      onSave(data);
    } catch (err) {
      console.error('Update failed:', err);
      setError(err.message || 'Failed to update transaction.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="edit-modal-overlay animate-fade-in">
      <div className="edit-modal-content">
        <button className="close-btn" onClick={onClose}><X size={20} /></button>
        <h2>Edit Transaction</h2>
        <p className="modal-subtitle">Update details or backdate this record.</p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="edit-form">
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

          <div className="form-row">
            <div className="form-group">
              <label><IndianRupee size={16} /> Amount</label>
              <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label><Tag size={16} /> Category</label>
              <select name="category_id" value={formData.category_id} onChange={handleChange} required>
                <option value="">Select Category...</option>
                {categories.filter(c => c.type === transaction.type).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label><CreditCard size={16} /> Payment Mode</label>
            <select name="paymentMode" value={formData.paymentMode} onChange={handleChange}>
              <option value="">Select Mode...</option>
              {MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label><FileText size={16} /> Description (Optional)</label>
            <input type="text" name="description" value={formData.description} onChange={handleChange} placeholder="What was this for?" />
          </div>

          <div className="modal-actions">
            <Button type="submit" fullWidth disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTransactionModal;
