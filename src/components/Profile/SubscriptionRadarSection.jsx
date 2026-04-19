import { useState, useMemo } from 'react';
import { 
  Radar, Plus, Settings2, Trash2, Edit3, X, EyeOff, RotateCcw, AlertTriangle, CheckCircle2, SlidersHorizontal
} from 'lucide-react';
import Card from '../UI/Card';
import Button from '../UI/Button';
import './SubscriptionRadarSection.css';

const INITIAL_SUBSCRIPTIONS = [
  { id: 's1', merchant: 'Netflix', amount: 649, cadence: 'monthly', nextCharge: '14th Apr', status: 'confirmed', type: 'auto' },
  { id: 's2', merchant: 'Spotify', amount: 119, cadence: 'monthly', nextCharge: '22nd Apr', status: 'confirmed', type: 'auto' },
  { id: 's3', merchant: 'Amazon Prime', amount: 1499, cadence: 'yearly', nextCharge: '10th Aug', status: 'confirmed', type: 'auto' },
  { id: 's4', merchant: 'AWS Services', amount: 450, cadence: 'monthly', nextCharge: '1st May', status: 'dismissed', type: 'auto', dismissedDate: '01st Mar' }
];

const ToggleSwitch = ({ checked, onChange }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`toggle-switch ${checked ? 'on' : 'off'}`}
  >
    <span className="toggle-knob" />
  </button>
);

const SubscriptionRadarSection = () => {
  const [activeTab, setActiveTab] = useState('confirmed'); // confirmed, dismissed, settings
  const [subscriptions, setSubscriptions] = useState(INITIAL_SUBSCRIPTIONS);
  const [sortOrder, setSortOrder] = useState('cost'); // cost, name, date

  // Settings
  const [sensitivity, setSensitivity] = useState('balanced');
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [showAnnual, setShowAnnual] = useState(true);

  // Modals
  const [modalMode, setModalMode] = useState(null); // 'edit', 'add'
  const [editTarget, setEditTarget] = useState(null);

  // Form State for Add/Edit
  const [formMerchant, setFormMerchant] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCadence, setFormCadence] = useState('monthly');
  const [formDate, setFormDate] = useState('');

  // Derived Totals
  const totals = useMemo(() => {
    let monthly = 0;
    let yearly = 0;
    subscriptions.forEach(sub => {
      if (sub.status === 'confirmed') {
        if (sub.cadence === 'monthly') {
          monthly += sub.amount;
          yearly += (sub.amount * 12);
        } else if (sub.cadence === 'yearly') {
          yearly += sub.amount;
          monthly += (sub.amount / 12);
        } else if (sub.cadence === 'weekly') {
          monthly += (sub.amount * 4.33);
          yearly += (sub.amount * 52);
        }
      }
    });
    return { monthly: Math.round(monthly), yearly: Math.round(yearly) };
  }, [subscriptions]);

  const sortedSubscriptions = useMemo(() => {
    let filtered = subscriptions.filter(s => s.status === activeTab);
    
    // Hide annual if toggle is off and on confirmed tab
    if (activeTab === 'confirmed' && !showAnnual) {
      filtered = filtered.filter(s => s.cadence !== 'yearly');
    }

    return filtered.sort((a, b) => {
      if (sortOrder === 'cost') {
        const aYearly = a.cadence === 'monthly' ? a.amount * 12 : (a.cadence === 'yearly' ? a.amount : a.amount * 52);
        const bYearly = b.cadence === 'monthly' ? b.amount * 12 : (b.cadence === 'yearly' ? b.amount : b.amount * 52);
        return bYearly - aYearly;
      }
      if (sortOrder === 'name') return a.merchant.localeCompare(b.merchant);
      return 0; // naive date sort for mock
    });
  }, [subscriptions, activeTab, sortOrder, showAnnual]);

  const handleDismiss = (id) => {
    setSubscriptions(subs => subs.map(s => s.id === id ? { ...s, status: 'dismissed', dismissedDate: 'Today' } : s));
  };

  const handleResurface = (id) => {
    setSubscriptions(subs => subs.map(s => s.id === id ? { ...s, status: 'confirmed' } : s));
  };

  const handleIgnoreForever = (id) => {
    if(window.confirm('Ignore this charge forever? It will never show up on the Radar again.')) {
      setSubscriptions(subs => subs.filter(s => s.id !== id));
    }
  };

  const openEditModal = (sub) => {
    setEditTarget(sub.id);
    setFormMerchant(sub.merchant);
    setFormAmount(sub.amount.toString());
    setFormCadence(sub.cadence);
    setFormDate(sub.nextCharge);
    setModalMode('edit');
  };

  const openAddModal = () => {
    setEditTarget(null);
    setFormMerchant('');
    setFormAmount('');
    setFormCadence('monthly');
    setFormDate('');
    setModalMode('add');
  };

  const saveModal = () => {
    if (!formMerchant || !formAmount) return alert("Please fill all fields");
    
    if (modalMode === 'add') {
      const newSub = {
        id: 'new_' + Date.now(),
        merchant: formMerchant,
        amount: parseFloat(formAmount),
        cadence: formCadence,
        nextCharge: formDate || 'Next billing cycle',
        status: 'confirmed',
        type: 'manual'
      };
      setSubscriptions([newSub, ...subscriptions]);
    } else {
      setSubscriptions(subs => subs.map(s => s.id === editTarget ? {
        ...s,
        merchant: formMerchant,
        amount: parseFloat(formAmount),
        cadence: formCadence,
        nextCharge: formDate
      } : s));
    }
    setModalMode(null);
  };

  const renderModal = () => {
    if (!modalMode) return null;
    return (
      <div className="security-modal animate-fade-in">
        <div className="security-modal-content">
          <button className="close-btn" onClick={() => setModalMode(null)}><X size={20}/></button>
          <h2>{modalMode === 'add' ? 'Add Subscription' : 'Edit Subscription'}</h2>
          
          <div className="modal-form-grid mt-4">
            <div className="input-group">
              <label>Merchant Name</label>
              <input type="text" value={formMerchant} onChange={e => setFormMerchant(e.target.value)} placeholder="e.g. Gym Membership" />
            </div>
            <div className="input-group">
              <label>Amount (₹)</label>
              <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="input-group">
              <label>Billing Cadence</label>
              <select value={formCadence} onChange={e => setFormCadence(e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="input-group">
              <label>Next Charge / Start Date</label>
              <input type="text" value={formDate} onChange={e => setFormDate(e.target.value)} placeholder="e.g. 5th of Month" />
            </div>
          </div>
          
          <div className="modal-actions mt-4">
             <Button fullWidth onClick={saveModal}>Save Subscription</Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="radar-section">
      
      {/* ─── Pinned Totals ─────────────────────────────── */}
      <div className="pinned-totals-card">
         <div className="pt-icon"><Radar size={24}/></div>
         <div className="pt-metrics">
            <div className="pt-stat"><span>Monthly Burn</span><strong>₹{totals.monthly.toLocaleString()}</strong></div>
            <div className="pt-divider"></div>
            <div className="pt-stat"><span>Annual Projection</span><strong>₹{totals.yearly.toLocaleString()}</strong></div>
         </div>
      </div>

      {/* ─── Tab Navigation ────────────────────────────── */}
      <div className="radar-tabs">
         <button className={`rtab ${activeTab === 'confirmed' ? 'active' : ''}`} onClick={() => setActiveTab('confirmed')}>
           Confirmed ({subscriptions.filter(s=>s.status==='confirmed').length})
         </button>
         <button className={`rtab ${activeTab === 'dismissed' ? 'active' : ''}`} onClick={() => setActiveTab('dismissed')}>
           Dismissed ({subscriptions.filter(s=>s.status==='dismissed').length})
         </button>
         <button className={`rtab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
           <Settings2 size={16}/> Settings
         </button>
      </div>

      {/* ─── Active Tab Content ─────────────────────────── */}
      <Card className="radar-content-card">
        {activeTab === 'confirmed' && (
          <div className="tab-pane animate-fade-in">
             <div className="tab-header">
                <select className="sort-dropdown" value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
                  <option value="cost">Sort: Annual Cost (High to Low)</option>
                  <option value="name">Sort: Name (A-Z)</option>
                  <option value="date">Sort: Next Charge</option>
                </select>
                <Button variant="secondary" size="sm" onClick={openAddModal}><Plus size={14}/> Add Manual</Button>
             </div>
             
             <div className="subs-list">
               {sortedSubscriptions.length === 0 ? <p className="empty-text">No confirmed subscriptions found.</p> : sortedSubscriptions.map(sub => (
                 <div key={sub.id} className="sub-row">
                    <div className="sub-info">
                       <h4 className="sub-name">{sub.merchant} {sub.type === 'manual' && <span className="manual-badge">Manual</span>}</h4>
                       <p className="sub-meta">{sub.cadence} · Next: {sub.nextCharge}</p>
                    </div>
                    <div className="sub-cost">
                       <strong>₹{sub.amount.toLocaleString()}</strong>
                       <span>/ {sub.cadence.replace('ly', '')}</span>
                    </div>
                    <div className="sub-actions">
                       <button className="icon-action" onClick={() => openEditModal(sub)} title="Edit"><Edit3 size={16}/></button>
                       <button className="icon-action danger" onClick={() => handleDismiss(sub.id)} title="Dismiss"><EyeOff size={16}/></button>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'dismissed' && (
          <div className="tab-pane animate-fade-in">
             <div className="tab-header">
                <p className="info-text">These items have been dismissed and excluded from your monthly subscription totals.</p>
             </div>
             <div className="subs-list">
               {sortedSubscriptions.length === 0 ? <p className="empty-text">No dismissed subscriptions.</p> : sortedSubscriptions.map(sub => (
                 <div key={sub.id} className="sub-row dismissed-mode">
                    <div className="sub-info">
                       <h4 className="sub-name">{sub.merchant}</h4>
                       <p className="sub-meta">Dismissed on: {sub.dismissedDate}</p>
                    </div>
                    <div className="sub-cost dim">
                       <strong>₹{sub.amount.toLocaleString()}</strong>
                       <span>/ {sub.cadence.replace('ly', '')}</span>
                    </div>
                    <div className="sub-actions">
                       <button className="action-text-btn" onClick={() => handleResurface(sub.id)}><RotateCcw size={14}/> Re-surface</button>
                       <button className="icon-action danger" onClick={() => handleIgnoreForever(sub.id)} title="Ignore Forever"><Trash2 size={16}/></button>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="tab-pane animate-fade-in">
             <div className="settings-header">
               <SlidersHorizontal size={20} className="text-purple"/> 
               <h3>Detection Logic</h3>
             </div>
             <p className="info-text mb-4">Control how aggressively the AI scans your transactions for new subscriptions.</p>

             <div className="settings-grid">
               <div className="setting-group wide">
                 <label>Detection Sensitivity</label>
                 <select value={sensitivity} onChange={e => setSensitivity(e.target.value)}>
                   <option value="conservative">Conservative (Confidence ≥ 0.85) - Fewer false positives</option>
                   <option value="balanced">Balanced (Confidence ≥ 0.70) - Recommended</option>
                   <option value="aggressive">Aggressive (Confidence ≥ 0.55) - Catches more</option>
                 </select>
               </div>
               
               <div className="toggle-row">
                 <div className="toggle-info">
                   <span className="toggle-title">Auto-confirm high confidence</span>
                   <p>Don't require review for items with ≥ 0.90 AI confidence score.</p>
                 </div>
                 <ToggleSwitch checked={autoConfirm} onChange={setAutoConfirm}/>
               </div>

               <div className="toggle-row">
                 <div className="toggle-info">
                   <span className="toggle-title">Show annual subscriptions in list</span>
                   <p>Include once-a-year charges in the main Active Radar view.</p>
                 </div>
                 <ToggleSwitch checked={showAnnual} onChange={setShowAnnual}/>
               </div>
             </div>
          </div>
        )}
      </Card>

      {renderModal()}
    </div>
  );
};

export default SubscriptionRadarSection;
