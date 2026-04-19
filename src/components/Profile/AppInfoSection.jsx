import { useState } from 'react';
import { 
  Info, ChevronDown, ChevronUp, Mail, Bug, FileText, ExternalLink, Copyright, Star, Copy, Trash2, X, MessageCircle
} from 'lucide-react';
import Card from '../UI/Card';
import Button from '../UI/Button';
import './AppInfoSection.css';

const FAQS = [
  { id: 'f1', q: 'How does Pocket categorize my transactions?', a: 'Pocket uses a secure AI model to analyze merchant names and descriptions to assign one of 17 standard categories. You can manually override these in the accounts view.' },
  { id: 'f2', q: 'Is my bank data safe?', a: 'Yes. We only read CSV/PDF files locally on your device. Your sensitive data is never uploaded unencrypted to our servers.' },
  { id: 'f3', q: 'Why is my Cash Flow Score dropping?', a: 'Your score drops if your discretionary spending outpaces your configured income thresholds, or if recurring subscriptions increase sharply.' }
];

const AppInfoSection = () => {
  const [openFaq, setOpenFaq] = useState(null);
  const [modalMode, setModalMode] = useState(null); // 'contact', 'bug'
  const [rating, setRating] = useState(0);
  const [featureCategory, setFeatureCategory] = useState('feature');
  const [featureText, setFeatureText] = useState('');

  const toggleFaq = (id) => {
    setOpenFaq(openFaq === id ? null : id);
  };

  const handleRating = (val) => {
    setRating(val);
    if (val >= 4) {
      setTimeout(() => alert('Thank you! Redirecting to App Store to leave a review...'), 500);
    }
  };

  const handleCopyDebug = () => {
    const debugInfo = {
      appVersion: 'v1.0.4-beta',
      build: '2026.04.12',
      userAgent: navigator.userAgent,
      userIdHash: 'usr_8fX92mq1z',
      locale: Intl.DateTimeFormat().resolvedOptions().locale
    };
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
      .then(() => alert("Debug info copied to clipboard!"))
      .catch(() => alert("Failed to copy automatically."));
  };

  const handleClearCache = () => {
    if(window.confirm('Are you sure you want to clear your local browser cache? This will reset your theme and layout preferences, but your transactions remain safe.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const renderModal = () => {
    if (!modalMode) return null;
    return (
      <div className="security-modal animate-fade-in">
        <div className="security-modal-content">
          <button className="close-btn" onClick={() => setModalMode(null)}><X size={20}/></button>
          <h2>{modalMode === 'contact' ? 'Contact Support' : 'Report a Bug'}</h2>
          
          <div className="input-group mt-4">
             <label>{modalMode === 'contact' ? 'How can we help you?' : 'Describe what broke'}</label>
             <textarea 
               rows={4} 
               placeholder={modalMode === 'contact' ? "I have a question about..." : "Steps to reproduce..."}
               className="support-textarea"
             ></textarea>
          </div>

          {modalMode === 'bug' && (
             <div className="input-group mt-2">
               <label>Upload Screenshot (Optional)</label>
               <div className="mock-upload-box">
                 <span>Click to browse</span>
               </div>
             </div>
          )}

          <p className="sys-note mt-4">
             App Version (v1.0.4) and Device OS will be attached automatically to help us investigate.
          </p>
          
          <div className="modal-actions mt-4">
             <Button fullWidth onClick={() => { alert('Message sent!'); setModalMode(null); }}>Submit message</Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="appinfo-section">
      
      {/* ─── 1. Version & Release ─────────────────────────── */}
      <Card className="info-card">
         <div className="version-header">
           <div className="app-logo-mock">P</div>
           <div className="version-titles">
             <h2>Pocket</h2>
             <span>Version 1.0.4-beta (Build 2604)</span>
           </div>
         </div>
         
         <div className="changelog-box">
            <h4>What's new in this release</h4>
            <ul>
               <li>Added Merchant Overrides engine</li>
               <li>Built completely custom Profile parameters</li>
               <li>Cash Flow Score algorithms refined</li>
            </ul>
         </div>
      </Card>

      {/* ─── 2. Help & Support ────────────────────────────── */}
      <Card className="info-card">
        <div className="card-section-header">
           <div className="title-group">
              <div className="icon-box" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}>
                 <Info size={20} />
              </div>
              <div>
                <h3 className="card-section-title">Help & Support</h3>
                <p className="card-section-desc">Get answers and report issues</p>
              </div>
           </div>
        </div>
        <div className="info-card-body">
           <div className="faq-accordion">
              {FAQS.map(faq => (
                <div key={faq.id} className={`faq-item ${openFaq === faq.id ? 'open' : ''}`}>
                   <button className="faq-q" onClick={() => toggleFaq(faq.id)}>
                     {faq.q}
                     {openFaq === faq.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                   </button>
                   <div className="faq-a">
                     <p>{faq.a}</p>
                   </div>
                </div>
              ))}
           </div>
           <div className="support-actions mt-4">
              <Button variant="outline" onClick={() => setModalMode('contact')}><Mail size={16}/> Contact Support</Button>
              <Button variant="outline" onClick={() => setModalMode('bug')}><Bug size={16}/> Report a Bug</Button>
           </div>
        </div>
      </Card>

      {/* ─── 3. Feedback ──────────────────────────────────── */}
      <Card className="info-card">
        <div className="card-section-header">
           <div className="title-group">
              <div className="icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
                 <MessageCircle size={20} />
              </div>
              <div>
                <h3 className="card-section-title">Feedback</h3>
                <p className="card-section-desc">Help us build a better Pocket</p>
              </div>
           </div>
        </div>
        <div className="info-card-body">
           <div className="feedback-form">
              <label>Submit Feature Request</label>
              <div className="feedback-inputs">
                <select value={featureCategory} onChange={e => setFeatureCategory(e.target.value)}>
                   <option value="feature">Feature Request</option>
                   <option value="design">Design Improvement</option>
                   <option value="other">Other</option>
                </select>
                <textarea 
                  rows={2} 
                  placeholder="I wish Pocket could..." 
                  value={featureText} 
                  onChange={e => setFeatureText(e.target.value)}
                ></textarea>
                <button className="text-submit-btn" onClick={() => { alert('Feedback submitted!'); setFeatureText(''); }}>Send</button>
              </div>
           </div>
           
           <div className="rating-box mt-4">
              <span>Rate Pocket</span>
              <div className="stars">
                 {[1,2,3,4,5].map(star => (
                   <button key={star} className={`star-btn ${rating >= star ? 'filled' : ''}`} onClick={() => handleRating(star)}>
                     <Star size={24} fill={rating >= star ? "#F59E0B" : "none"} color={rating >= star ? "#F59E0B" : "#71717A"}/>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      </Card>

      {/* ─── 4. Legal & Diagnostics ───────────────────────── */}
      <Card className="info-card">
        <div className="card-section-header">
           <div className="title-group">
              <div className="icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
                 <FileText size={20} />
              </div>
              <div>
                <h3 className="card-section-title">Legal & Diagnostics</h3>
                <p className="card-section-desc">Docs and troubleshooting</p>
              </div>
           </div>
        </div>
        <div className="info-card-body">
           <div className="legal-links">
             <a href="#" className="legal-link"><ExternalLink size={14}/> Terms of Service</a>
             <a href="#" className="legal-link"><ExternalLink size={14}/> Privacy Policy</a>
             <a href="#" className="legal-link"><ExternalLink size={14}/> Open Source Licenses</a>
           </div>

           <div className="diag-actions mt-4">
              <button className="diag-btn copy" onClick={handleCopyDebug}><Copy size={14}/> Copy debug info</button>
              <button className="diag-btn clear" onClick={handleClearCache}><Trash2 size={14}/> Clear local cache</button>
           </div>
        </div>
      </Card>
      
      <div className="branding-footer">
         <Copyright size={12}/> 2026 Pocket Finance. All rights reserved.
      </div>

      {renderModal()}
    </div>
  );
};

export default AppInfoSection;
