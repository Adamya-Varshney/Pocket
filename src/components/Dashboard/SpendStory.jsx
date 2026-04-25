import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Sparkles, ThumbsUp, ThumbsDown, ChevronRight, TrendingUp, Shield, ShoppingBag } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { analyzeSpendStory } from '../../utils/spendStoryEngine';
import './SpendStory.css';

const MODULE_ICONS = {
  LifestyleCreep: ShoppingBag,
  ContingentSurge: Shield,
  CategorySpike: TrendingUp,
  SpendVelocity: TrendingUp,
  SavingsDelta: TrendingUp,
};

const MODULE_LABELS = {
  LifestyleCreep: 'Lifestyle Alert',
  ContingentSurge: 'Emergency Insight',
  CategorySpike: 'Spending Outlier',
  SpendVelocity: 'Trend Analysis',
  SavingsDelta: 'Savings Advisory',
};

const SpendStory = ({ user, transactions = [], onViewAll }) => {
  const [savedInsight, setSavedInsight] = useState(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [saving, setSaving] = useState(false);

  // Run intelligence engine client-side against loaded transactions
  const analysis = useMemo(() => {
    if (!transactions || transactions.length < 5) return null;
    return analyzeSpendStory(transactions);
  }, [transactions]);

  // Check for already-saved insight this week
  useEffect(() => {
    if (user?.id) fetchSavedInsight();
  }, [user?.id]);

  const fetchSavedInsight = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('insights')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSavedInsight(data);
        setFeedbackGiven(!!data.feedback);
      }
    } catch (err) {
      // Table might not exist yet, that's fine
    }
  };

  // Save insight to DB when a new one is generated
  useEffect(() => {
    if (!analysis?.primary || !user?.id || saving) return;
    
    const insight = analysis.primary;
    // If we already have a saved insight for this week, skip
    if (savedInsight?.week_start === analysis.weekStart) return;

    const saveInsight = async () => {
      setSaving(true);
      try {
        const { data, error } = await supabase
          .from('insights')
          .upsert({
            user_id: user.id,
            week_start: analysis.weekStart,
            pattern_module: insight.module,
            pattern_data: insight.data,
            rendered_text: insight.text,
            delivered_at: new Date().toISOString(),
          }, { onConflict: 'user_id,week_start' })
          .select()
          .maybeSingle();

        if (data) setSavedInsight(data);
      } catch (err) {
        console.log('Could not save insight:', err.message);
      } finally {
        setSaving(false);
      }
    };
    saveInsight();
  }, [analysis?.weekStart, user?.id]);

  const handleFeedback = async (type) => {
    if (feedbackGiven || !savedInsight?.id) return;
    try {
      const { error } = await supabase
        .from('insights')
        .update({ feedback: type })
        .eq('id', savedInsight.id);
      
      if (!error) {
        setFeedbackGiven(true);
        setSavedInsight(prev => ({ ...prev, feedback: type }));
      }
    } catch (err) {
      console.error('Feedback failed:', err);
    }
  };

  // ─── Render States ─────────────────────────────────────────────

  // No analysis possible (insufficient data)
  if (!analysis || !analysis.primary) {
    return (
      <div 
        className="spend-story-nudge animate-fade-in" 
        onClick={onViewAll} 
        style={{ cursor: onViewAll ? 'pointer' : 'default' }}
      >
        <div className="nudge-content">
          <div className="nudge-icon">
            <Sparkles size={24} color="#a855f7" />
          </div>
          <div className="nudge-text">
            <h4>Your Spend Story is forming...</h4>
            <p>
              {transactions.length < 5 
                ? `Add ${5 - transactions.length} more transactions to unlock behavioral insights.`
                : 'Keep logging expenses — your first weekly story will appear soon.'
              }
            </p>
          </div>
          <ChevronRight size={20} color="var(--text-muted)" />
        </div>
      </div>
    );
  }

  // ─── Active Insight Card ───────────────────────────────────────
  const insight = analysis.primary;
  const ModuleIcon = MODULE_ICONS[insight.module] || Sparkles;
  const moduleLabel = MODULE_LABELS[insight.module] || 'AI Insight';

  return (
    <div className="spend-story-card animate-slide-up">
      <div className="spend-story-bg" />
      
      <div className="story-content">
        <div className="story-header">
          <div className="story-badge">
            <ModuleIcon size={14} />
            <span>{moduleLabel}</span>
          </div>
          <div className="story-date">
            Week of {new Date(analysis.weekStart).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
          </div>
        </div>

        <div className="story-body" onClick={onViewAll} style={{ cursor: onViewAll ? 'pointer' : 'default' }}>
          <p className="story-text">{insight.text}</p>
        </div>

        {/* Tier Breakdown Donut Chart */}
        {analysis.tierBreakdown && (
          <div className="tier-donut-container" style={{ width: '100%', height: '220px', marginTop: '16px', display: 'flex', flexDirection: 'column' }}>
            {(() => {
              const { necessary, discretionary, contingent } = analysis.tierBreakdown;
              const data = [
                { name: 'Necessary', value: necessary, color: '#3b82f6' },      // blue-500
                { name: 'Discretionary', value: discretionary, color: '#f59e0b' }, // amber-500
                { name: 'Contingent', value: contingent, color: '#10b981' }       // emerald-500
              ].filter(d => d.value > 0);

              if (data.length === 0) return null;

              return (
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value) => `₹${value.toLocaleString('en-IN')}`} 
                      contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              );
            })()}
            <div className="tier-legend" style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: 'auto', marginBottom: '8px' }}>
              <span className="tier-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }} /> Necessary</span>
              <span className="tier-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} /> Discretionary</span>
              <span className="tier-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} /> Contingent</span>
            </div>
          </div>
        )}

        <div className="story-footer">
          <div className="story-feedback">
            <span className="feedback-label">Was this useful?</span>
            <div className="feedback-btns">
              <button 
                className={`feedback-btn ${savedInsight?.feedback === 'up' ? 'active' : ''}`}
                onClick={() => handleFeedback('up')}
                disabled={feedbackGiven && savedInsight?.feedback !== 'up'}
              >
                <ThumbsUp size={16} />
              </button>
              <button 
                className={`feedback-btn ${savedInsight?.feedback === 'down' ? 'active' : ''}`}
                onClick={() => handleFeedback('down')}
                disabled={feedbackGiven && savedInsight?.feedback !== 'down'}
              >
                <ThumbsDown size={16} />
              </button>
            </div>
          </div>
          <div className="story-module-info">
            <Sparkles size={14} />
            <span>AI Insight • {analysis.all.length} pattern{analysis.all.length !== 1 ? 's' : ''} detected</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpendStory;
