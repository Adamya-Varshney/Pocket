import { useState } from 'react';
import { 
  Sparkles, History, Filter, ThumbsUp, ThumbsDown, BrainCircuit, ShieldAlert, EyeOff, X, MessageSquare
} from 'lucide-react';
import Card from '../UI/Card';
import Button from '../UI/Button';
import './SpendStoryPreferences.css';

const MOCK_INSIGHTS = [
  { id: 'i1', type: 'Category Spike', text: 'You spent ₹4,500 more on Food & Dining this week compared to your 6-week average.', date: 'Today', feedback: null },
  { id: 'i2', type: 'Weekday Clustering', text: '70% of your discretionary spending happens on Fridays.', date: '3 days ago', feedback: 'useful' },
  { id: 'i3', type: 'New Merchant', text: 'You have a new recurring charge from "AWS Services".', date: '1 week ago', feedback: 'not-useful' },
  { id: 'i4', type: 'Category Spike', text: 'Utility bills are 15% higher this month.', date: '2 weeks ago', feedback: 'useful' }
];

const SYSTEM_CATEGORIES = [
  'Food & Dining', 'Transport', 'Bills & Utilities', 'Shopping', 'Entertainment', 'Groceries', 
  'Healthcare', 'Housing', 'Travel', 'Education', 'Investments', 'Savings', 'Other'
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

const SpendStoryPreferences = () => {
  // 1. History
  const [insights, setInsights] = useState(MOCK_INSIGHTS);
  const [historyFilter, setHistoryFilter] = useState('all'); // all, useful, not-useful, no-feedback
  const [selectedInsight, setSelectedInsight] = useState(null);

  // 2. Pattern Preferences
  const [patterns, setPatterns] = useState({
    spike: true,
    cluster: true,
    merchant: true
  });
  const [patternWarning, setPatternWarning] = useState(false);

  // 3. Category Exclusions
  const [excludedCategories, setExcludedCategories] = useState(['Housing', 'Investments']); // mock fixed expenses

  const handlePatternToggle = (key) => {
    const activeCount = Object.values(patterns).filter(Boolean).length;
    
    // Guard: Prevent disabling the last active pattern
    if (activeCount === 1 && patterns[key] === true) {
      setPatternWarning(true);
      setTimeout(() => setPatternWarning(false), 3000);
      return;
    }

    setPatterns({ ...patterns, [key]: !patterns[key] });
  };

  const toggleExclusion = (cat) => {
    if (excludedCategories.includes(cat)) {
      setExcludedCategories(excludedCategories.filter(c => c !== cat));
    } else {
      setExcludedCategories([...excludedCategories, cat]);
    }
  };

  const handleFeedback = (id, feedbackVal) => {
    setInsights(insights.map(ins => ins.id === id ? { ...ins, feedback: feedbackVal } : ins));
    if (selectedInsight) {
      setSelectedInsight({ ...selectedInsight, feedback: feedbackVal });
    }
  };

  const getFilteredInsights = () => {
    switch (historyFilter) {
      case 'useful': return insights.filter(i => i.feedback === 'useful');
      case 'not-useful': return insights.filter(i => i.feedback === 'not-useful');
      case 'no-feedback': return insights.filter(i => i.feedback === null);
      default: return insights;
    }
  };

  const filteredInsights = getFilteredInsights();

  const renderInsightModal = () => {
    if (!selectedInsight) return null;
    return (
      <div className="security-modal animate-fade-in">
        <div className="security-modal-content">
          <button className="close-btn" onClick={() => setSelectedInsight(null)}><X size={20}/></button>
          <div className="modal-pill">{selectedInsight.type}</div>
          <h2 className="mt-4">Insight Details</h2>
          <div className="insight-full-text">
            "{selectedInsight.text}"
          </div>
          <p className="modal-desc">Delivered: {selectedInsight.date}</p>
          
          <div className="feedback-section">
             <p className="feedback-label">Was this helpful?</p>
             <div className="feedback-actions">
                <button 
                  className={`feedback-btn thumbs-up ${selectedInsight.feedback === 'useful' ? 'active' : ''}`}
                  onClick={() => handleFeedback(selectedInsight.id, 'useful')}
                >
                  <ThumbsUp size={16}/> Yes
                </button>
                <button 
                  className={`feedback-btn thumbs-down ${selectedInsight.feedback === 'not-useful' ? 'active' : ''}`}
                  onClick={() => handleFeedback(selectedInsight.id, 'not-useful')}
                >
                  <ThumbsDown size={16}/> No
                </button>
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="spendstory-section">
      
      {/* ─── 1. Insight History ────────────────────────────── */}
      <Card className="story-card">
        <div className="card-section-header">
           <div className="title-group">
              <div className="icon-box" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}>
                 <History size={20} />
              </div>
              <div>
                <h3 className="card-section-title">Insight History</h3>
                <p className="card-section-desc">Review and tune past cards</p>
              </div>
           </div>
        </div>
        <div className="story-card-body">
           <div className="filter-scroll-wrapper">
             <Filter size={14} className="filter-icon" />
             <div className="filter-pills">
               {['all', 'useful', 'not-useful', 'no-feedback'].map(f => (
                 <button 
                   key={f}
                   className={`filter-pill ${historyFilter === f ? 'active' : ''}`}
                   onClick={() => setHistoryFilter(f)}
                 >
                   {f.replace('-', ' ')}
                 </button>
               ))}
             </div>
           </div>

           <div className="insights-list">
              {filteredInsights.length === 0 ? (
                <div className="empty-state">No insights match this filter.</div>
              ) : (
                filteredInsights.map(ins => (
                  <div key={ins.id} className="insight-row" onClick={() => setSelectedInsight(ins)}>
                    <div className="insight-content">
                       <span className="insight-type">{ins.type}</span>
                       <p className="insight-snippet">{ins.text}</p>
                       <span className="insight-date">{ins.date}</span>
                    </div>
                    <div className="insight-feedback-badge">
                       {ins.feedback === 'useful' && <ThumbsUp size={14} className="badge-up"/>}
                       {ins.feedback === 'not-useful' && <ThumbsDown size={14} className="badge-down"/>}
                       {ins.feedback === null && <MessageSquare size={14} className="badge-none"/>}
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>
      </Card>

      {/* ─── 2. Pattern Preferences ────────────────────────── */}
      <Card className="story-card">
        <div className="card-section-header">
           <div className="title-group">
              <div className="icon-box" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' }}>
                 <BrainCircuit size={20} />
              </div>
              <div>
                <h3 className="card-section-title">Pattern Types</h3>
                <p className="card-section-desc">Configure AI detection algorithms</p>
              </div>
           </div>
        </div>
        <div className="story-card-body">
           <div className="toggles-sidebar">
             <div className="toggle-row">
               <div className="toggle-info">
                 <span className="toggle-title">Category spike insights</span>
                 <p>Alerts when a category deviates from historic averages.</p>
               </div>
               <ToggleSwitch checked={patterns.spike} onChange={() => handlePatternToggle('spike')}/>
             </div>
             <div className="toggle-row">
               <div className="toggle-info">
                 <span className="toggle-title">Weekday clustering</span>
                 <p>Finds patterns in when you spend (e.g. weekend splurges).</p>
               </div>
               <ToggleSwitch checked={patterns.cluster} onChange={() => handlePatternToggle('cluster')}/>
             </div>
             <div className="toggle-row">
               <div className="toggle-info">
                 <span className="toggle-title">New merchant alerts</span>
                 <p>Highlights first-time charges and subscriptions.</p>
               </div>
               <ToggleSwitch checked={patterns.merchant} onChange={() => handlePatternToggle('merchant')}/>
             </div>
           </div>
           
           {patternWarning && (
             <div className="pattern-warning animate-fade-in">
               <ShieldAlert size={14}/>
               At least one pattern type must remain active for Spend Story to function.
             </div>
           )}
        </div>
      </Card>

      {/* ─── 3. Category Exclusions ────────────────────────── */}
      <Card className="story-card">
        <div className="card-section-header">
           <div className="title-group">
              <div className="icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
                 <EyeOff size={20} />
              </div>
              <div>
                <h3 className="card-section-title">Category Exclusions</h3>
                <p className="card-section-desc">Hide stable expenses from narrative analysis</p>
              </div>
           </div>
        </div>
        <div className="story-card-body">
           <p className="info-text">
             Excluded categories will <strong>not</strong> trigger 'spike' or 'clustering' insights (useful for Fixed Expenses like Rent). They will still appear normally in your Dashboard Vitals.
           </p>

           <div className="exclusion-grid">
              {SYSTEM_CATEGORIES.map(cat => {
                const isExcluded = excludedCategories.includes(cat);
                return (
                  <button 
                    key={cat}
                    className={`exclusion-chip ${isExcluded ? 'excluded' : ''}`}
                    onClick={() => toggleExclusion(cat)}
                  >
                    {cat}
                    {isExcluded && <EyeOff size={12}/>}
                  </button>
                )
              })}
           </div>
        </div>
      </Card>

      <div className="save-actions">
         <Button fullWidth onClick={() => alert("Spend Story preferences saved!")}>Save Preferences</Button>
      </div>

      {renderInsightModal()}
    </div>
  );
};

export default SpendStoryPreferences;
