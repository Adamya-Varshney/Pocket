import { useState, useEffect } from 'react';
import { 
  Shield, ShieldCheck, ShieldAlert, Laptop, Monitor, 
  Smartphone, UploadCloud, Download, Lock, CheckCircle2, AlertTriangle, X, LogOut 
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import Card from '../UI/Card';
import Button from '../UI/Button';
import './PrivacySecuritySection.css';

const INITIAL_SESSIONS = [
  { id: '1', device: 'MacBook Pro', os: 'macOS', city: 'Mumbai', time: 'Active now', current: true, type: 'desktop' },
  { id: '2', device: 'iPhone 14', os: 'iOS', city: 'Delhi', time: '2 hours ago', current: false, type: 'mobile' },
  { id: '3', device: 'Windows PC', os: 'Windows 11', city: 'Bangalore', time: 'Yesterday', current: false, type: 'desktop' }
];

const INITIAL_EXPORTS = [
  { id: 'exp1', date: '2026-03-25', status: 'ready', link: '#' }
];

const Toggle = ({ checked, onChange }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`toggle-switch ${checked ? 'on' : 'off'}`}
  >
    <span className="toggle-knob" />
  </button>
);

const MOCK_BACKUP_CODES = ['A1B2-C3D4', 'E5F6-G7H8', 'I9J0-K1L2', 'M3N4-O5P6', 'Q7R8-S9T0', 'U1V2-W3X4', 'Y5Z6-A7B8', 'C9D0-E1F2'];

const PrivacySecuritySection = () => {
  const [sessions, setSessions] = useState(INITIAL_SESSIONS);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [exports, setExports] = useState(INITIAL_EXPORTS);
  const [exportProcessing, setExportProcessing] = useState(false);

  // Privacy toggles
  const [anonAnalytics, setAnonAnalytics] = useState(true);
  const [crashReporting, setCrashReporting] = useState(true);
  const [aiImprovement, setAiImprovement] = useState(false);

  // Modals state
  const [modalMode, setModalMode] = useState(null); // '2fa-setup', '2fa-disable', 'delete-account'
  
  // 2FA Flow
  const [twoFaStep, setTwoFaStep] = useState(1);
  const [totpCode, setTotpCode] = useState('');
  
  // Deletion Flow
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletionScheduled, setDeletionScheduled] = useState(false);

  const signOutSession = (id) => {
    setSessions(sessions.filter(s => s.id !== id));
  };

  const signOutAllOther = () => {
    setSessions(sessions.filter(s => s.current));
  };

  const handleExportRequest = () => {
    setExportProcessing(true);
    setTimeout(() => {
      setExports([{ id: Date.now().toString(), date: 'Today', status: 'ready', link: '#' }, ...exports]);
      setExportProcessing(false);
      alert('Your export is ready and has been delivered to your email.');
    }, 3000);
  };

  const finish2FASetup = () => {
    setIs2FAEnabled(true);
    setModalMode(null);
    setTwoFaStep(1);
  };

  const render2FAModal = () => {
    if (modalMode === '2fa-setup') {
      if (twoFaStep === 1) {
        return (
          <div className="security-modal animate-fade-in">
            <div className="security-modal-content">
              <button className="close-btn" onClick={() => setModalMode(null)}><X size={20}/></button>
              <h2>Set up Authenticator</h2>
              <p className="modal-desc">Scan this QR code with Google Authenticator, Authy, or your preferred TOTP app.</p>
              <div className="qr-placeholder">
                 <ShieldCheck size={64} color="#10B981"/>
                 <span>Mock QR Code</span>
              </div>
              <div className="manual-key-box">
                <span>Manual Entry Key:</span>
                <code>JBSWY3DPEHPK3PXP</code>
              </div>
              <div className="input-group">
                <label>Enter 6-digit code</label>
                <input 
                  type="text" 
                  maxLength={6} 
                  placeholder="******" 
                  value={totpCode} 
                  onChange={e => setTotpCode(e.target.value)}
                  className="totp-input"
                />
              </div>
              <div className="modal-actions">
                <Button fullWidth onClick={() => {
                  if (totpCode.length === 6) setTwoFaStep(2);
                  else alert("Enter a 6-digit code");
                }}>Verify Code</Button>
              </div>
            </div>
          </div>
        );
      }
      if (twoFaStep === 2) {
        return (
          <div className="security-modal animate-fade-in">
            <div className="security-modal-content">
              <h2>Save Backup Codes</h2>
              <div className="success-banner"><CheckCircle2 size={16}/> 2FA successfully configured</div>
              <p className="modal-desc">These exact codes are single-use. If you lose your device, these are the ONLY way to access your account.</p>
              <div className="backup-codes-grid">
                {MOCK_BACKUP_CODES.map(code => <div key={code} className="backup-code">{code}</div>)}
              </div>
              <div className="modal-actions">
                 <Button variant="outline" fullWidth onClick={() => alert('Codes copied!')}>Copy to Clipboard</Button>
                 <Button fullWidth onClick={finish2FASetup}>I have saved these safely</Button>
              </div>
            </div>
          </div>
        );
      }
    }

    if (modalMode === '2fa-disable') {
      return (
        <div className="security-modal animate-fade-in">
            <div className="security-modal-content">
              <button className="close-btn" onClick={() => setModalMode(null)}><X size={20}/></button>
              <h2>Disable 2FA</h2>
              <p className="modal-desc">Please confirm your password and a current authenticator code to disable Two-Factor Authentication.</p>
              
              <div className="input-group">
                <label>Current Password</label>
                <input type="password" placeholder="••••••••"/>
              </div>
              <div className="input-group">
                <label>Enter 6-digit TOTP code</label>
                <input type="text" maxLength={6} placeholder="******" />
              </div>
              
              <div className="modal-actions mt-4">
                 <Button variant="danger" fullWidth onClick={() => { setIs2FAEnabled(false); setModalMode(null); }}>Disable 2FA</Button>
              </div>
            </div>
          </div>
      );
    }
    return null;
  };

  const renderDeletionModal = () => {
    if (modalMode !== 'delete-account') return null;

    if (deletionScheduled) {
      return (
        <div className="security-modal animate-fade-in">
          <div className="security-modal-content">
            <div className="warning-icon-large danger"><AlertTriangle size={48}/></div>
            <h2>Account Scheduled for Deletion</h2>
            <p className="modal-desc mt-2 text-center">Your account has been locked. All data will be permanently purged in <strong>7 days</strong>.</p>
            <p className="modal-desc mt-2 text-center">An email has been sent. Click the "Cancel Deletion" link in the email to abort this process within the 7-day grace period.</p>
            <div className="modal-actions mt-4">
               <Button fullWidth variant="danger" onClick={() => supabase.auth.signOut()}>
                 <LogOut size={16} /> Sign Out Now
               </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="security-modal animate-fade-in">
        <div className="security-modal-content">
          <button className="close-btn" onClick={() => setModalMode(null)}><X size={20}/></button>
          <h2>Delete Account</h2>
          
          <div className="deletion-impact-box">
             <AlertTriangle size={20} color="#EF4444"/>
             <div className="impact-text">
               <strong>This action is permanent after 7 days.</strong>
               <p>You will lose: 243 Transactions, 3 Linked Accounts, and all AI Insights.</p>
             </div>
          </div>

          <p className="modal-desc mt-4">To confirm, type the word <strong>DELETE</strong> below and enter your password.</p>
          
          <div className="input-group mt-2">
            <input 
              type="text" 
              placeholder="DELETE" 
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
            />
          </div>
          <div className="input-group mt-2">
            <input 
              type="password" 
              placeholder="Current Password" 
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
            />
          </div>
          
          <div className="modal-actions mt-4">
              <Button 
                variant="danger" 
                fullWidth 
                disabled={deleteConfirmText !== 'DELETE' || !deletePassword}
                onClick={() => setDeletionScheduled(true)}
              >
                Permanently Delete Account
              </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="privacy-section">
      
      {/* ─── 1. Active Sessions ─────────────────────────────── */}
      <Card className="security-card">
        <div className="card-section-header">
           <div className="title-group">
              <Laptop size={20} className="icon-blue" />
              <div>
                <h3 className="card-section-title">Active Sessions</h3>
                <p className="card-section-desc">Manage your signed-in devices</p>
              </div>
           </div>
           {sessions.length > 1 && (
             <Button variant="secondary" size="sm" onClick={signOutAllOther}>Sign out all other</Button>
           )}
        </div>
        <div className="sessions-list">
          {sessions.map(s => (
            <div key={s.id} className="session-item">
               <div className="session-icon">
                 {s.type === 'desktop' ? <Monitor size={20}/> : <Smartphone size={20}/>}
               </div>
               <div className="session-info">
                 <div className="session-device">
                   {s.device} {s.current && <span className="current-badge">This device</span>}
                 </div>
                 <div className="session-meta">{s.os} · {s.city} · {s.time}</div>
               </div>
               {!s.current && (
                 <button className="sign-out-link" onClick={() => signOutSession(s.id)}>Sign out</button>
               )}
            </div>
          ))}
        </div>
      </Card>

      {/* ─── 2. 2FA ─────────────────────────────────────────── */}
      <Card className="security-card">
        <div className="card-section-header">
           <div className="title-group">
              <Shield size={20} className={is2FAEnabled ? "icon-green" : "icon-gray"} />
              <div>
                <h3 className="card-section-title">Two-Factor Authentication</h3>
                <p className="card-section-desc">Extra security for your account</p>
              </div>
           </div>
           <div className={`status-badge ${is2FAEnabled ? 'enabled' : 'disabled'}`}>
             {is2FAEnabled ? 'Enabled' : 'Disabled'}
           </div>
        </div>
        <div className="twofa-actions">
           {!is2FAEnabled ? (
             <Button onClick={() => setModalMode('2fa-setup')}>Set up 2FA</Button>
           ) : (
             <div className="twofa-active-actions">
                <Button variant="secondary" onClick={() => { setTwoFaStep(2); setModalMode('2fa-setup'); }}>View Backup Codes</Button>
                <Button variant="outline" onClick={() => setModalMode('2fa-disable')}>Disable 2FA</Button>
             </div>
           )}
        </div>
      </Card>

      {/* ─── 3. Data Export ─────────────────────────────────── */}
      <Card className="security-card">
        <div className="card-section-header">
           <div className="title-group">
              <Download size={20} className="icon-purple" />
              <div>
                <h3 className="card-section-title">Data Export</h3>
                <p className="card-section-desc">Download a ZIP of your financial data (CSV format)</p>
              </div>
           </div>
        </div>
        <div className="export-controls">
           <select className="export-select">
             <option>All time</option>
             <option>Last 3 months</option>
             <option>Last 6 months</option>
             <option>Custom range...</option>
           </select>
           <Button 
             disabled={exportProcessing} 
             onClick={handleExportRequest}
           >
             {exportProcessing ? 'Preparing ZIP...' : 'Request Export'}
           </Button>
        </div>
        {exportProcessing && <div className="export-status">Preparing export for delivery via email within 5 minutes...</div>}
        
        {exports.length > 0 && (
          <div className="export-history">
            <h4>Recent Exports</h4>
            {exports.map(exp => (
              <div key={exp.id} className="export-item">
                <div className="export-date">{exp.date}</div>
                <div className="export-actions">
                  <span className="export-status-label">{exp.status}</span>
                  <a href={exp.link} className="download-link">Download</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ─── 4. Privacy Preferences ─────────────────────────── */}
      <Card className="security-card">
        <div className="card-section-header">
           <div className="title-group">
              <Lock size={20} className="icon-indigo" />
              <div>
                <h3 className="card-section-title">Privacy Preferences</h3>
                <p className="card-section-desc">Control how we use your data</p>
              </div>
           </div>
        </div>
        <div className="privacy-toggles">
           <div className="toggle-row">
             <div className="toggle-info">
               <strong>Anonymous Analytics</strong>
               <p>Helps improve the app. No personal data ever shared.</p>
             </div>
             <Toggle checked={anonAnalytics} onChange={setAnonAnalytics} />
           </div>
           <div className="toggle-row">
             <div className="toggle-info">
               <strong>Crash Reporting</strong>
               <p>Sends error logs if the app crashes to help us fix bugs faster.</p>
             </div>
             <Toggle checked={crashReporting} onChange={setCrashReporting} />
           </div>
           <div className="toggle-row">
             <div className="toggle-info">
               <strong>AI Improvement Data</strong>
               <p>Allow snapshot correction data to be used to improve AI extraction accuracy.</p>
             </div>
             <Toggle checked={aiImprovement} onChange={setAiImprovement} />
           </div>
        </div>
      </Card>

      {/* ─── 5. Account Deletion ────────────────────────────── */}
      <Card className="security-card danger-zone">
        <div className="card-section-header">
           <div className="title-group">
              <ShieldAlert size={20} className="icon-red" />
              <div>
                <h3 className="card-section-title">Danger Zone</h3>
                <p className="card-section-desc">Permanently remove your account and data</p>
              </div>
           </div>
        </div>
        <div className="danger-actions mt-4">
           <p className="danger-info">Once deleted, your account will enter a 7-day grace period. After that, data is permanently purged.</p>
           <Button variant="danger" onClick={() => setModalMode('delete-account')}>Delete Account...</Button>
        </div>
      </Card>

      {render2FAModal()}
      {renderDeletionModal()}
    </div>
  );
};

export default PrivacySecuritySection;
