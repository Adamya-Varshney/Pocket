import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Sparkles, ThumbsUp, ThumbsDown, ChevronRight, Info } from 'lucide-react';
import Card from '../UI/Card';
import './SpendStory.css';

const SpendStory = ({ user, transactionsCount, onViewAll }) => {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  useEffect(() => {
    if (user?.id) fetchLatestInsight();
  }, [user?.id]);

  const fetchLatestInsight = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('insights')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setInsight(data);
        setFeedbackGiven(!!data.feedback);
      }
    } catch (err) {
      console.log('No insight found for this week yet');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (type) => {
    if (feedbackGiven) return;
    try {
      const { error } = await supabase
        .from('insights')
        .update({ feedback: type })
        .eq('id', insight.id);
      
      if (!error) {
        setFeedbackGiven(true);
        setInsight(prev => ({ ...prev, feedback: type }));
      }
    } catch (err) {
      console.error('Feedback failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="spend-story-skeleton">
        <div className="shimmer" />
        <div className="skeleton-header">
          <div className="skeleton-badge" />
          <div className="skeleton-date" />
        </div>
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
    );
  }

  // Placeholder Nudge for insufficient data
  if (!insight && transactionsCount < 10) {
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
            <p>Upload {10 - transactionsCount} more transactions this week to unlock your behavioral insight.</p>
          </div>
          <ChevronRight size={20} color="var(--text-muted)" />
        </div>
      </div>
    );
  }

  if (!insight) return null;

  return (
    <div className="spend-story-card animate-slide-up">
      <div className="spend-story-bg" />
      
      <div className="story-content">
        <div className="story-header">
          <div className="story-badge">
            <Sparkles size={14} />
            <span>Weekly Story</span>
          </div>
          <div className="story-date">
             {new Date(insight.week_start).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
          </div>
        </div>

        <div className="story-body" onClick={onViewAll} style={{ cursor: onViewAll ? 'pointer' : 'default' }}>
          <p className="story-text">{insight.rendered_text}</p>
        </div>

        <div className="story-footer">
          <div className="story-feedback">
            <span className="feedback-label">Was this interesting?</span>
            <div className="feedback-btns">
              <button 
                className={`feedback-btn ${insight.feedback === 'up' ? 'active' : ''}`}
                onClick={() => handleFeedback('up')}
                disabled={feedbackGiven && insight.feedback !== 'up'}
              >
                <ThumbsUp size={18} />
              </button>
              <button 
                className={`feedback-btn ${insight.feedback === 'down' ? 'active' : ''}`}
                onClick={() => handleFeedback('down')}
                disabled={feedbackGiven && insight.feedback !== 'down'}
              >
                <ThumbsDown size={18} />
              </button>
            </div>
          </div>
          <div className="story-module-info">
            <Sparkles size={14} />
            <span>AI Insight</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpendStory;
