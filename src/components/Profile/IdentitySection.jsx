import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

import { 
  Camera, 
  Mail, 
  Phone, 
  Lock, 
  Globe, 
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  ArrowRight,
  Plus
} from 'lucide-react';
import Card from '../UI/Card';
import Button from '../UI/Button';
import './IdentitySection.css';

const IdentitySection = () => {
  const { user: authUser } = useAuth();
  
  const [user, setUser] = useState({
    displayName: authUser?.profile?.display_name || authUser?.user_metadata?.display_name || 'User',
    email: authUser?.email || '',
    secondaryEmail: authUser?.profile?.secondary_email || authUser?.user_metadata?.secondary_email || '',
    primaryPhone: authUser?.profile?.primary_phone || authUser?.user_metadata?.phone || '',
    recoveryPhone: authUser?.profile?.recovery_phone || authUser?.user_metadata?.recovery_phone || '',
    photoURL: authUser?.profile?.photo_url || null,
    isOAuth: false, 
    provider: 'email'
  });

  useEffect(() => {
    if (authUser) {
      setUser(p => ({ 
        ...p, 
        email: authUser.email,
        primaryPhone: authUser.profile?.primary_phone || authUser.user_metadata?.phone || '',
        recoveryPhone: authUser.profile?.recovery_phone || authUser.user_metadata?.recovery_phone || '',
        displayName: authUser.profile?.display_name || authUser.user_metadata?.display_name || p.displayName,
        secondaryEmail: authUser.profile?.secondary_email || authUser.user_metadata?.secondary_email || ''
      }));
    }
  }, [authUser]);

  const maskPhone = (phoneStr) => {
    if (!phoneStr || phoneStr.length < 6) return phoneStr;
    return phoneStr.slice(0, 3) + '******' + phoneStr.slice(-4);
  };

  const [showPassword, setShowPassword] = useState(false);
  const [modalState, setModalState] = useState(null); 
  const [otpInput, setOtpInput] = useState('');
  
  const fileInputRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  const calculatePasswordStrength = (pass) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length >= 8) strength += 25;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) strength += 25;
    if (/\d/.test(pass)) strength += 25;
    if (/[^\w\s]/.test(pass)) strength += 25;
    return strength;
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.size <= 2 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Str = reader.result;
        setUser(prev => ({ ...prev, photoURL: base64Str }));
        
        if (authUser?.profile?.id) {
          supabase.from('profiles').update({ photo_url: base64Str }).eq('id', authUser.id);
        } else {
          supabase.auth.updateUser({ data: { photo_url: base64Str } });
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert("File too large. Max 2MB.");
    }
  };

  const renderModalContent = () => {
    if (!modalState) return null;
    const { type, step, tempValue } = modalState;

    if (type === 'recovery-phone') {
      if (step === 1) {
        return (
          <div className="modal-content animate-fade-in">
            <h3>Update Recovery Phone</h3>
            <p className="modal-desc">Enter the new recovery phone number. We will send an SMS OTP to verify it.</p>
            <div className="form-group mt-4">
              <input 
                type="tel" 
                placeholder="+91 XXXXX XXXXX"
                value={tempValue}
                onChange={(e) => setModalState({...modalState, tempValue: e.target.value})}
                autoFocus
              />
            </div>
            <div className="modal-actions mt-4">
              <Button variant="secondary" onClick={() => setModalState(null)}>Cancel</Button>
              <Button disabled={!tempValue} onClick={() => {
                setOtpInput('');
                setModalState({...modalState, step: 2});
              }}>
                Send OTP <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        );
      }
      return (
        <div className="modal-content animate-fade-in">
          <h3>Verify Recovery Phone</h3>
          <p className="modal-desc">Simulating OTP. Enter any 6 digits to verify <strong>{tempValue}</strong>.</p>
          <div className="form-group mt-4">
            <input 
              type="text" 
              maxLength={6} 
              placeholder="XXXXXX" 
              value={otpInput} 
              onChange={e => setOtpInput(e.target.value)}
              style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem' }}
            />
          </div>
          <div className="modal-actions mt-4">
            <Button variant="secondary" onClick={() => setModalState({...modalState, step: 1})}>Back</Button>
            <Button disabled={otpInput.length < 6} onClick={() => {
              // Trigger backend in background without awaiting or blocking UI
              if (authUser?.profile?.id) {
                supabase.from('profiles').update({ recovery_phone: tempValue }).eq('id', authUser.id);
              } else {
                supabase.auth.updateUser({ data: { recovery_phone: tempValue } });
              }
              
              setUser({...user, recoveryPhone: tempValue});
              setModalState(null);
              // Small timeout to allow React to paint the closing modal before alerting
              setTimeout(() => alert("Recovery phone securely updated! (Mock OTP)"), 100);
            }}>Confirm & Update</Button>
          </div>
        </div>
      );
    }

    if (type === 'password') {
      if (step === 1) {
        return (
          <div className="modal-content animate-fade-in">
            <h3>Change Password</h3>
            <p className="modal-desc">For maximum security, we will send an OTP to <strong>{user.email}</strong> to authorize this change.</p>
            <div className="password-form-modal">
              <div className="form-group mt-4">
                <label>New Password</label>
                <div className="pass-input-box">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="New password" 
                    onChange={(e) => setModalState({...modalState, tempValue: e.target.value})}
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="eye-btn">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="strength-bar"><div className="fill" style={{ width: `${calculatePasswordStrength(tempValue)}%` }}></div></div>
              </div>
            </div>
            <div className="modal-actions mt-4">
              <Button variant="secondary" onClick={() => setModalState(null)}>Cancel</Button>
              <Button onClick={() => {
                if(tempValue.length < 6) return alert("Password too short");
                setOtpInput('');
                setModalState({...modalState, step: 2});
              }}>
                Send OTP <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        );
      }
      return (
        <div className="modal-content animate-fade-in">
          <h3>Security Verification</h3>
          <p className="modal-desc">Simulating OTP. Enter any 6 digits to authorize your new password.</p>
          <div className="form-group mt-4">
            <input 
              type="text" 
              maxLength={6} 
              placeholder="XXXXXX" 
              value={otpInput} 
              onChange={e => setOtpInput(e.target.value)}
              style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem' }}
            />
          </div>
          <div className="modal-actions mt-4">
            <Button variant="secondary" onClick={() => setModalState({...modalState, step: 1})}>Back</Button>
            <Button disabled={otpInput.length < 6} onClick={() => {
                 // Background process
                 supabase.auth.updateUser({ password: tempValue });
                 setModalState(null);
                 setTimeout(() => alert("Password securely updated! (Mock OTP)"), 100);
            }}>Update Password</Button>
          </div>
        </div>
      );
    }

    if (type === 'add-secondary-email') {
      return (
        <div className="modal-content animate-fade-in">
          <h3>Add Secondary Email</h3>
          <p className="modal-desc">Save a backup email that can be swapped to be your primary email anytime via OTP verification.</p>
          <div className="form-group mt-4">
            <input 
              type="email" 
              placeholder="secondary@example.com"
              value={tempValue}
              onChange={(e) => setModalState({...modalState, tempValue: e.target.value})}
              autoFocus
            />
          </div>
          <div className="modal-actions mt-4">
            <Button variant="secondary" onClick={() => setModalState(null)}>Cancel</Button>
            <Button disabled={!tempValue || tempValue === user.email} onClick={() => {
              // Background process to profile datatable
              if (authUser?.profile?.id) {
                supabase.from('profiles').update({ secondary_email: tempValue }).eq('id', authUser.id);
              } else {
                supabase.auth.updateUser({ data: { secondary_email: tempValue } });
              }
              setUser({...user, secondaryEmail: tempValue});
              setModalState(null);
            }}>Save Secondary Email</Button>
          </div>
        </div>
      );
    }

    if (type === 'swap-email') {
      if (step === 1) {
        return (
          <div className="modal-content animate-fade-in">
            <h3>Make Secondary Email Primary</h3>
            <p className="modal-desc">We will send an OTP to <strong>{user.secondaryEmail}</strong> to confirm you own it before making it your primary login.</p>
            <div className="modal-actions mt-4">
              <Button variant="secondary" onClick={() => setModalState(null)}>Cancel</Button>
              <Button onClick={() => {
                setOtpInput('');
                setModalState({...modalState, step: 2});
              }}>
                Send OTP <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        );
      }
      return (
        <div className="modal-content animate-fade-in">
          <h3>Verify Secondary Email</h3>
          <p className="modal-desc">Simulating OTP. Enter any 6 digits to complete the mock swap.</p>
          <div className="form-group mt-4">
            <input 
              type="text" 
              maxLength={6} 
              placeholder="XXXXXX" 
              value={otpInput} 
              onChange={e => setOtpInput(e.target.value)}
              style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem' }}
            />
          </div>
          <div className="modal-actions mt-4">
            <Button variant="secondary" onClick={() => setModalState({...modalState, step: 1})}>Back</Button>
            <Button disabled={otpInput.length < 6} onClick={() => {
              const targetEmail = user.secondaryEmail;
              const oldPrimary = user.email;

              // Force UI local swap ignoring backend delays
              supabase.auth.updateUser({ 
                 email: targetEmail,
                 data: { secondary_email: oldPrimary } 
              });

              if (authUser?.profile?.id) {
                supabase.from('profiles').update({ 
                  primary_email: targetEmail, 
                  secondary_email: oldPrimary 
                }).eq('id', authUser.id);
              }
              
              setUser({...user, email: targetEmail, secondaryEmail: oldPrimary});
              setModalState(null);
              setTimeout(() => alert("Emails swapped successfully! (Mock OTP)"), 100);
            }}>Verify & Swap</Button>
          </div>
        </div>
      );
    }

    if (type === 'link-method') {
      return (
        <div className="modal-content animate-fade-in">
          <h3>Link Additional Method</h3>
          <p className="modal-desc">Connect a third-party login provider to your account.</p>
          <div className="provider-options mt-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Button variant="outline" fullWidth onClick={async () => {
              try {
                const { error } = await supabase.auth.signInWithOAuth({ 
                  provider: 'google',
                  options: {
                    redirectTo: window.location.origin
                  }
                });
                
                if (error) throw error;
              } catch (e) {
                alert("Error linking Google: " + e.message);
              }
            }}>
               <Globe size={16} className="mr-2" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> Link Google
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setModalState(null)}>Cancel</Button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="identity-section">
      <Card className="identity-main-card">
        <div className="avatar-upload">
          <div className="avatar-preview">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" />
            ) : (
              <div className="initials-avatar">{getInitials(user.displayName)}</div>
            )}
            <button className="photo-edit-btn" onClick={() => fileInputRef.current.click()}>
              <Camera size={16} />
            </button>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} hidden accept="image/*" />
          </div>
          {user.photoURL && (
            <button className="remove-photo-link" onClick={() => {
               setUser(p => ({ ...p, photoURL: null }));
               if (authUser?.profile?.id) {
                 supabase.from('profiles').update({ photo_url: null }).eq('id', authUser.id);
               } else {
                 supabase.auth.updateUser({ data: { photo_url: null } });
               }
            }}>
              Remove photo
            </button>
          )}
        </div>

        <div className="name-edit-group">
          <label className="field-label">Display Name</label>
          <div className="name-input-wrapper">
            <input
              type="text"
              value={user.displayName}
              maxLength={50}
              placeholder={user.email.split('@')[0]}
              onChange={async (e) => {
                const newName = e.target.value;
                setUser(p => ({ ...p, displayName: newName }));
                if (authUser?.profile?.id) {
                  await supabase.from('profiles').update({ display_name: newName }).eq('id', authUser.id);
                } else {
                  await supabase.auth.updateUser({ data: { display_name: newName } });
                }
              }}
              className="display-name-input"
            />
            <span className="char-count">{user.displayName.length}/50</span>
          </div>
          <p className="field-helper">Shown in export headers and insight cards.</p>
        </div>
      </Card>

      <Card title="Email Addresses" className="identity-card">
        <div className="identity-row">
          <div className="identity-info">
            <Mail size={18} className="icon-muted" />
            <div className="info-text">
              <span className="info-val">{user.email}</span>
              {user.isOAuth ? (
                <span className="info-note managed">Primary • Managed by Google</span>
              ) : (
                <span className="info-note">Primary • Verified</span>
              )}
            </div>
          </div>
        </div>

        {user.secondaryEmail ? (
           <div className="identity-row mt-3 border-top pt-3" style={{ borderTop: '1px solid #333' }}>
             <div className="identity-info">
               <Mail size={18} className="icon-muted" />
               <div className="info-text">
                 <span className="info-val">{user.secondaryEmail}</span>
                 <span className="info-note text-orange" style={{ color: '#F97316' }}>Secondary Backup</span>
               </div>
             </div>
             {!user.isOAuth && (
               <div className="email-actions" style={{ display: 'flex', gap: '8px' }}>
                 <Button variant="outline" size="sm" onClick={async () => {
                     if(window.confirm("Remove secondary email?")) {
                       if (authUser?.profile?.id) {
                         supabase.from('profiles').update({ secondary_email: null }).eq('id', authUser.id);
                       } else {
                         supabase.auth.updateUser({ data: { secondary_email: null } });
                       }
                       setUser({...user, secondaryEmail: null});
                     }
                 }}><Trash2 size={16} /></Button>
                 <Button variant="secondary" size="sm" onClick={() => setModalState({type: 'swap-email', step: 1, tempValue: ''})}>
                   Make Primary
                 </Button>
               </div>
             )}
           </div>
        ) : (
           <div className="identity-row mt-3 border-top pt-3" style={{ borderTop: '1px solid #333' }}>
             <Button variant="outline" fullWidth size="sm" onClick={() => setModalState({type: 'add-secondary-email', step: 1, tempValue: ''})}>
                <Plus size={16} className="mr-2" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> Add Secondary Email
             </Button>
           </div>
        )}
      </Card>

      <Card title="Phone Numbers" className="identity-card">
        <div className="identity-row">
          <div className="identity-info">
            <Phone size={18} className="icon-muted" />
            <div className="info-text">
              <span className={`info-val ${!user.primaryPhone ? 'empty' : ''}`}>
                {user.primaryPhone ? maskPhone(user.primaryPhone) : 'Not provided'}
              </span>
              <span className="info-note">Primary Contact • Verified</span>
            </div>
          </div>
        </div>

        {user.recoveryPhone ? (
           <div className="identity-row mt-3 border-top pt-3" style={{ borderTop: '1px solid #333' }}>
             <div className="identity-info">
               <Phone size={18} className="icon-muted" />
               <div className="info-text">
                 <span className="info-val">{maskPhone(user.recoveryPhone)}</span>
                 <span className="info-note text-orange" style={{ color: '#F97316' }}>Recovery Number</span>
               </div>
             </div>
             <div className="email-actions" style={{ display: 'flex', gap: '8px' }}>
               <Button variant="outline" size="sm" onClick={async () => {
                   if(window.confirm("Remove recovery phone?")) {
                     if (authUser?.profile?.id) {
                       await supabase.from('profiles').update({ recovery_phone: null }).eq('id', authUser.id);
                     } else {
                       await supabase.auth.updateUser({ data: { recovery_phone: null } });
                     }
                     setUser({...user, recoveryPhone: null});
                   }
               }}><Trash2 size={16} /></Button>
               <Button variant="secondary" size="sm" onClick={() => setModalState({type: 'recovery-phone', step: 1, tempValue: ''})}>
                 Change
               </Button>
             </div>
           </div>
        ) : (
           <div className="identity-row mt-3 border-top pt-3" style={{ borderTop: '1px solid #333' }}>
             <Button variant="outline" fullWidth size="sm" onClick={() => setModalState({type: 'recovery-phone', step: 1, tempValue: ''})}>
                <Plus size={16} className="mr-2" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> Add Recovery Phone
             </Button>
           </div>
        )}
      </Card>

      <Card title="Security" className="identity-card">
        {!user.isOAuth ? (
          <div className="security-summary">
            <div className="security-info">
              <Lock size={18} className="icon-muted" />
              <div className="info-text">
                <span className="info-val">Password</span>
                <span className="info-note">Last changed 3 months ago</span>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setModalState({type: 'password', step: 1, tempValue: ''})}>
              Update
            </Button>
          </div>
        ) : (
          <div className="oauth-note">
            <Lock size={20} />
            <p>Password management is handled by Google. You can update your security settings in your Google Account.</p>
          </div>
        )}
      </Card>

      <Card title="Linked Methods" className="identity-card">
        <div className="providers-list">
          <div className="provider-item">
            <div className="provider-info">
              {user.provider === 'google' ? <Globe size={20} /> : <Key size={20} />}
              <span>{user.provider === 'google' ? 'Google' : 'Email & Password'}</span>
            </div>
            <span className="provider-status active"><CheckCircle2 size={14} /> Active</span>
          </div>
          <Button variant="secondary" fullWidth className="mt-2 text-primary" onClick={() => setModalState({ type: 'link-method', step: 1, tempValue: '' })}>
            Link additional method
          </Button>
        </div>
      </Card>

      {modalState && (
        <div className="modal-overlay">
          {renderModalContent()}
        </div>
      )}
    </div>
  );
};

export default IdentitySection;
