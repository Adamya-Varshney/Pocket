import { useState, useMemo, useEffect } from 'react';
import { Coins, Info, Calendar, Settings, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import Card from '../UI/Card';
import Button from '../UI/Button';
import { useAuth } from '../../context/AuthContext';
import './FinancialSection.css';

const INCOME_SOURCES = ['Salary', 'Business', 'Freelance', 'Other'];
const COMMON_DAYS = [1, 5, 10, 15, 20, 25];

const FinancialSection = () => {
  const { user, setUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null); // { type: 'success'|'error', text: string }

  const [financialData, setFinancialData] = useState({
    incomeMode: 'monthly',
    incomeAmount: '',
    incomeSource: 'Salary',
    creditDate: 1,
    preferNotToSay: false,
    monthStartDate: 1,
    customStartDate: '',
    numberFormat: 'indian',
    showPaise: true,
  });

  // Sync form whenever user profile data loads (async from Supabase)
  useEffect(() => {
    if (!user) return;
    setFinancialData({
      incomeMode:     user.income_mode     || 'monthly',
      incomeAmount:   user.income_amount   != null ? String(user.income_amount) : '',
      incomeSource:   user.income_source   || 'Salary',
      creditDate:     user.credit_date     || 1,
      preferNotToSay: user.prefer_not_to_say || false,
      monthStartDate: user.month_start_date  || 1,
      customStartDate: '',
      numberFormat:   user.number_format   || 'indian',
      showPaise:      user.show_paise      ?? true,
    });
  }, [user?.id, user?.income_amount, user?.income_mode, user?.income_source,
      user?.month_start_date, user?.number_format, user?.show_paise]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFinancialData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    if (!user?.id) {
      setSaveMessage({ type: 'error', text: 'No user session found. Please refresh and log in again.' });
      return;
    }
    setIsSaving(true);
    setSaveMessage(null);

    const startDate = financialData.monthStartDate === 'custom'
      ? (parseInt(financialData.customStartDate) || 1)
      : parseInt(financialData.monthStartDate);

    const payload = {
      id:               user.id,
      income_mode:      financialData.incomeMode,
      income_amount:    parseFloat(financialData.incomeAmount) || 0,
      income_source:    financialData.incomeSource,
      credit_date:      parseInt(financialData.creditDate),
      prefer_not_to_say: financialData.preferNotToSay,
      month_start_date: startDate,
      number_format:    financialData.numberFormat,
      show_paise:       financialData.showPaise,
    };

    console.log('[FinancialSection] Saving payload:', payload);

    // Direct Supabase call — bypasses any context abstraction issues
    const { data: upserted, error: upsertErr } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .maybeSingle();

    console.log('[FinancialSection] Upsert result:', { upserted, upsertErr });

    if (upsertErr) {
      setIsSaving(false);
      setSaveMessage({ type: 'error', text: `Save failed: ${upsertErr.message}` });
      return;
    }

    // ── Salary History Logging ───────────────────────────────────────
    // Record this change in history if income-related fields changed
    const hasIncomeChanged = 
      payload.income_amount !== (user?.income_amount || 0) ||
      payload.income_mode   !== (user?.income_mode   || 'monthly') ||
      payload.income_source !== (user?.income_source || 'Salary') ||
      payload.credit_date   !== (user?.credit_date   || 1);

    if (hasIncomeChanged) {
      console.log('[FinancialSection] Income changed, recording in salary_history');
      await supabase.from('salary_history').insert({
        user_id:       user.id,
        income_mode:   payload.income_mode,
        income_amount: payload.income_amount,
        income_source: payload.income_source,
        credit_date:   payload.credit_date,
        effective_from: new Date().toISOString().split('T')[0]
      });
    }
    // ─────────────────────────────────────────────────────────────────

    // Re-fetch to guarantee we see what the DB actually stored
    const { data: fresh, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    console.log('[FinancialSection] Re-fetch result:', { fresh, fetchErr });

    setIsSaving(false);

    if (fetchErr || !fresh) {
      setSaveMessage({ type: 'error', text: `Saved but failed to reload: ${fetchErr?.message || 'no row returned'}` });
      return;
    }

    // Merge fresh profile data into global user state
    setUser(prev => ({ ...prev, ...fresh }));

    setSaveMessage({ type: 'success', text: `Saved! Income: ₹${(fresh.income_amount || 0).toLocaleString('en-IN')} · Month starts ${fresh.month_start_date}` });
    setTimeout(() => setSaveMessage(null), 6000);
  };

  const currentStartDate = financialData.monthStartDate === 'custom'
    ? parseInt(financialData.customStartDate) || 1
    : parseInt(financialData.monthStartDate) || 1;

  const monthPreview = useMemo(() => {
    const today = new Date();
    const startDay = currentStartDate;
    let periodStart;
    if (today.getDate() >= startDay) {
      periodStart = new Date(today.getFullYear(), today.getMonth(), startDay);
    } else {
      periodStart = new Date(today.getFullYear(), today.getMonth() - 1, startDay);
    }
    const displayEnd = startDay === 1
      ? new Date(today.getFullYear(), today.getMonth() + 1, 0)
      : new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, startDay - 1);

    const fmt = (d) => `${d.getDate()}${getOrdinal(d.getDate())} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
    return `${fmt(periodStart)} → ${fmt(displayEnd)}`;
  }, [currentStartDate]);

  function getOrdinal(d) {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th';
    }
  }

  const formatPreviewAmount = (amount) => {
    const formatted = financialData.showPaise ? amount : Math.round(amount);
    return new Intl.NumberFormat(financialData.numberFormat === 'indian' ? 'en-IN' : 'en-US', {
      style: 'currency', currency: 'INR',
      minimumFractionDigits: financialData.showPaise ? 2 : 0,
      maximumFractionDigits: financialData.showPaise ? 2 : 0,
    }).format(formatted);
  };

  // Salary banner — shows saved value from DB (via user state)
  const savedIncome = user?.income_amount;
  const incomeDisplay = savedIncome && savedIncome > 0
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(savedIncome)
    : null;

  return (
    <div className="financial-section">

      {/* ── Salary Banner ─────────────────────────────── */}
      {incomeDisplay ? (
        <div className="current-salary-banner">
          <div className="salary-banner-label">
            Your current {user?.income_mode || 'monthly'} income ({user?.income_source || 'Salary'})
          </div>
          <div className="salary-banner-amount">{incomeDisplay}</div>
          <div className="salary-banner-hint">Update the value below and click Save Changes.</div>
        </div>
      ) : (
        <div className="current-salary-banner no-salary">
          <div className="salary-banner-label">No income saved yet</div>
          <div className="salary-banner-hint">Enter your income below and click Save Changes.</div>
        </div>
      )}

      {/* ── Save Status Message ───────────────────────── */}
      {saveMessage && (
        <div className={`save-feedback ${saveMessage.type}`}>
          {saveMessage.type === 'success'
            ? <CheckCircle size={16} />
            : <AlertCircle size={16} />
          }
          <span>{saveMessage.text}</span>
        </div>
      )}

      {/* 1: Monthly Income */}
      <Card title="Monthly Income" className="financial-card">
        <div className="income-header">
          <div className="segmented-control">
            <button className={financialData.incomeMode === 'monthly' ? 'active' : ''} onClick={() => setFinancialData(p => ({ ...p, incomeMode: 'monthly' }))}>Monthly</button>
            <button className={financialData.incomeMode === 'annual' ? 'active' : ''} onClick={() => setFinancialData(p => ({ ...p, incomeMode: 'annual' }))}>Annual</button>
          </div>
          <div className="income-input-box">
            <Coins size={16} />
            <input
              type="number"
              name="incomeAmount"
              placeholder="e.g. 50000"
              value={financialData.incomeAmount}
              onChange={handleInputChange}
              disabled={financialData.preferNotToSay}
            />
          </div>
        </div>

        {!financialData.preferNotToSay && (
          <div className="income-details animate-fade-in">
            <div className="form-row">
              <div className="form-group flex-2">
                <label>Income source type</label>
                <select name="incomeSource" value={financialData.incomeSource} onChange={handleInputChange}>
                  {INCOME_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group flex-1">
                <label>Credit date</label>
                <input type="number" name="creditDate" min="1" max="31" value={financialData.creditDate} onChange={handleInputChange} />
              </div>
            </div>
            <p className="helper-text">Used to distinguish late-month credit vs. true overspend.</p>
          </div>
        )}

        <div className="privacy-toggle">
          <label className="checkbox-label">
            <input type="checkbox" name="preferNotToSay" checked={financialData.preferNotToSay} onChange={handleInputChange} />
            Prefer not to say
          </label>
          <div className="note-card">
            <Info size={14} />
            <span>Only used to personalise your insights — never shared</span>
          </div>
        </div>
      </Card>

      {/* 2: Financial Month Start Date */}
      <Card title="Financial Month Start Date" className="financial-card">
        <div className="day-picker">
          {COMMON_DAYS.map(day => (
            <button
              key={day}
              className={`day-btn ${(financialData.monthStartDate === day || financialData.monthStartDate === String(day)) ? 'active' : ''}`}
              onClick={() => setFinancialData(p => ({ ...p, monthStartDate: day }))}
            >
              {day}
            </button>
          ))}
          <button
            className={`day-btn ${financialData.monthStartDate === 'custom' ? 'active' : ''}`}
            onClick={() => setFinancialData(p => ({ ...p, monthStartDate: 'custom' }))}
          >
            Custom
          </button>
        </div>

        {financialData.monthStartDate === 'custom' && (
          <div className="custom-day-input animate-fade-in">
            <input type="number" placeholder="Enter day (1-31)" min="1" max="31"
              value={financialData.customStartDate}
              onChange={e => setFinancialData(p => ({ ...p, customStartDate: e.target.value }))}
            />
          </div>
        )}

        <div className="impact-preview">
          <Calendar size={18} />
          <div>
            <p className="preview-label">Your monthly period is currently:</p>
            <p className="preview-range">{monthPreview}</p>
          </div>
        </div>
        <p className="helper-text">Affects dashboard totals and Vitals 30-day calculations.</p>
      </Card>

      {/* 3: Number & Amount Format */}
      <Card title="Formatting" className="financial-card">
        <div className="format-toggles">
          <div className="format-group">
            <label>Amount system</label>
            <div className="segmented-control mt-2">
              <button className={financialData.numberFormat === 'indian' ? 'active' : ''} onClick={() => setFinancialData(p => ({ ...p, numberFormat: 'indian' }))}>Indian</button>
              <button className={financialData.numberFormat === 'international' ? 'active' : ''} onClick={() => setFinancialData(p => ({ ...p, numberFormat: 'international' }))}>International</button>
            </div>
          </div>
          <div className="format-group">
            <label>Decimal display</label>
            <div className="segmented-control mt-2">
              <button className={financialData.showPaise ? 'active' : ''} onClick={() => setFinancialData(p => ({ ...p, showPaise: true }))}>Show paise</button>
              <button className={!financialData.showPaise ? 'active' : ''} onClick={() => setFinancialData(p => ({ ...p, showPaise: false }))}>Hide / Round</button>
            </div>
          </div>
        </div>
        <div className="live-preview">
          <span className="live-label">Preview Example</span>
          <div className="preview-box">
            <span className="preview-val">{formatPreviewAmount(125000.50)}</span>
          </div>
        </div>
      </Card>

      {/* 4: Primary Currency */}
      <Card className="financial-card currency-card">
        <div className="currency-info">
          <div className="currency-label"><Settings size={18} /><span>Primary Currency</span></div>
          <div className="currency-val"><strong>INR (₹)</strong><Lock size={14} className="lock-icon" /></div>
        </div>
        <div className="v2-badge"><Info size={14} />Multi-currency support coming soon (V2)</div>
      </Card>

      <div className="save-actions">
        <Button fullWidth size="lg" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};

export default FinancialSection;
