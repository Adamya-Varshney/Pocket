import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { KeyRound, Mail, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import Button from '../UI/Button';
import './AuthScreen.css';

const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { 
            data: { phone },
            emailRedirectTo: window.location.origin 
          }
        });
        if (error) throw error;
        
        // Check if an existing account prevents identity creation
        if (data?.user?.identities && data.user.identities.length === 0) {
          throw new Error('Email is already registered or account already exists.');
        }

        // If "Confirm Email" is active on Supabase side, session will be null even if user was created
        if (data?.user && data?.session === null) {
          setSuccessMsg('Account created! Please check your email to confirm your address before logging in.');
        }
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-wrapper animate-fade-in">
       
       <div className="auth-brand">
         <div className="auth-logo">P</div>
         <h1>Pocket</h1>
         <p>The AI-native financial clarity engine.</p>
       </div>

       <div className="auth-card">
          <div className="auth-tabs">
             <button className={`auth-tab ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>Sign In</button>
             <button className={`auth-tab ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>Create Account</button>
          </div>

          <form className="auth-form" onSubmit={handleAuth}>
             
             {errorMsg && <div className="auth-alert error">{errorMsg}</div>}
             {successMsg && <div className="auth-alert success">{successMsg}</div>}

             <div className="auth-input-group">
                <label>Email Address</label>
                <div className="auth-input-wrap">
                  <Mail size={18} className="auth-icon" />
                  <input 
                    type="email" 
                    placeholder="you@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
             </div>

             {!isLogin && (
               <div className="auth-input-group">
                  <label>Contact Number</label>
                  <div className="auth-input-wrap">
                    <span className="auth-icon" style={{ fontSize: '14px', fontWeight: 'bold' }}>#</span>
                    <input 
                      type="tel" 
                      placeholder="+91 9999999999" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required={!isLogin}
                    />
                  </div>
               </div>
             )}

             <div className="auth-input-group">
                <label>Password</label>
                <div className="auth-input-wrap">
                  <KeyRound size={18} className="auth-icon" />
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
             </div>

             <button type="submit" className="auth-submit-btn" disabled={isLoading}>
                {isLoading ? <Loader2 size={20} className="spinner" /> : (isLogin ? 'Sign in securely' : 'Create account')}
                {!isLoading && <ArrowRight size={18} />}
             </button>
          </form>
       </div>

       <div className="auth-footer-trust">
         <ShieldCheck size={14} />
         <span>Your data is encrypted end-to-end. We never sell your personal information.</span>
       </div>

    </div>
  );
};

export default AuthScreen;
