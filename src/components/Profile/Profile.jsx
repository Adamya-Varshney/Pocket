import { useState } from 'react';
import { 
  User, 
  ChevronRight, 
  Wallet, 
  CreditCard, 
  Bell, 
  ShieldCheck, 
  Palette, 
  History, 
  Radar, 
  Info,
  ArrowLeft,
  LogOut
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import IdentitySection from './IdentitySection';
import FinancialSection from './FinancialSection';
import AccountsSection from './AccountsSection';
import MerchantNormalization from './MerchantNormalization';
import NotificationsSection from './NotificationsSection';
import PrivacySecuritySection from './PrivacySecuritySection';
import PersonalizationSection from './PersonalizationSection';
import SpendStoryPreferences from './SpendStoryPreferences';
import SubscriptionRadarSection from './SubscriptionRadarSection';
import AppInfoSection from './AppInfoSection';
import './Profile.css';

const PROFILE_SEGMENTS = [
  { id: 'identity', title: 'Identity', icon: User, color: '#3B82F6', subtitle: 'Personal details & Account' },
  { id: 'financial', title: 'Financial profile', icon: Wallet, color: '#10B981', subtitle: 'Income & Budget limits' },
  { id: 'accounts', title: 'Accounts & data sources', icon: CreditCard, color: '#F97316', subtitle: 'Bank & App connections' },
  { id: 'notifications', title: 'Notifications', icon: Bell, color: '#8B5CF6', subtitle: 'Alerts & Reminders' },
  { id: 'privacy', title: 'Privacy & security', icon: ShieldCheck, color: '#EF4444', subtitle: 'Data & Access control' },
  { id: 'personalization', title: 'Personalization', icon: Palette, color: '#B45309', subtitle: 'Theme & Appearance' },
  { id: 'insights', title: 'Spend Story preferences', icon: History, color: '#2DD4BF', subtitle: 'AI Insight settings' },
  { id: 'sub-radar', title: 'Subscription Radar', icon: Radar, color: '#6366F1', subtitle: 'Detect recurring payments' },
  { id: 'appinfo', title: 'App info', icon: Info, color: '#71717A', subtitle: 'Version & Legal' },
];

const Profile = ({ 
  accounts, 
  setAccounts, 
  merchantOverrides, 
  setMerchantOverrides,
  transactions,
  setTransactions,
  categories,
  onRefreshCategories,
  onNavigate
}) => {
  const [activeSegment, setActiveSegment] = useState(null);

  const handleSegmentClick = (id) => {
    if (['identity', 'financial', 'accounts', 'spendstory', 'notifications', 'privacy', 'personalization', 'insights', 'sub-radar', 'appinfo'].includes(id)) {
      setActiveSegment(id);
    } else {
      alert(`${id} segment placeholder`);
    }
  };

  if (activeSegment === 'identity') {
    return (
      <div className="profile-subpage animate-fade-in">
        <header className="profile-subpage-header">
          <button className="back-btn" onClick={() => setActiveSegment(null)}>
            <ArrowLeft size={24} />
          </button>
          <h1>Identity</h1>
        </header>
        <IdentitySection />
      </div>
    );
  }

  if (activeSegment === 'financial') {
    return (
      <div className="profile-subpage animate-fade-in">
        <header className="profile-subpage-header">
          <button className="back-btn" onClick={() => setActiveSegment(null)}>
            <ArrowLeft size={24} />
          </button>
          <h1>Financial profile</h1>
        </header>
        <FinancialSection />
      </div>
    );
  }

  if (activeSegment === 'accounts') {
    return (
      <div className="profile-subpage animate-fade-in">
        <header className="profile-subpage-header">
          <button className="back-btn" onClick={() => setActiveSegment(null)}>
            <ArrowLeft size={24} />
          </button>
          <h1>Accounts & data sources</h1>
        </header>
        <AccountsSection 
          accounts={accounts} 
          setAccounts={setAccounts} 
          transactions={transactions}
          setTransactions={setTransactions}
          onManageMerchants={() => setActiveSegment('spendstory')}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  if (activeSegment === 'spendstory') {
    return (
      <div className="profile-subpage animate-fade-in">
        <header className="profile-subpage-header">
          <button className="back-btn" onClick={() => setActiveSegment(null)}>
            <ArrowLeft size={24} />
          </button>
          <h1>Merchant overrides</h1>
        </header>
        <MerchantNormalization 
          transactions={transactions} 
          merchantOverrides={merchantOverrides}
          setMerchantOverrides={setMerchantOverrides}
        />
      </div>
    );
  }

  if (activeSegment === 'notifications') {
    return (
      <div className="profile-subpage animate-fade-in">
        <header className="profile-subpage-header">
          <button className="back-btn" onClick={() => setActiveSegment(null)}>
            <ArrowLeft size={24} />
          </button>
          <h1>Notifications</h1>
        </header>
        <NotificationsSection />
      </div>
    );
  }

  if (activeSegment === 'privacy') {
    return (
      <div className="profile-subpage animate-fade-in">
        <header className="profile-subpage-header">
          <button className="back-btn" onClick={() => setActiveSegment(null)}>
            <ArrowLeft size={24} />
          </button>
          <h1>Privacy & security</h1>
        </header>
        <PrivacySecuritySection />
      </div>
    );
  }

  if (activeSegment === 'personalization') {
    return (
      <div className="profile-subpage animate-fade-in">
        <header className="profile-subpage-header">
          <button className="back-btn" onClick={() => setActiveSegment(null)}>
            <ArrowLeft size={24} />
          </button>
          <h1>Personalization</h1>
        </header>
        <PersonalizationSection 
          accounts={accounts} 
          categories={categories}
          onRefreshCategories={onRefreshCategories}
        />
      </div>
    );
  }

  if (activeSegment === 'insights') {
    return (
      <div className="profile-subpage animate-fade-in">
        <header className="profile-subpage-header">
          <button className="back-btn" onClick={() => setActiveSegment(null)}>
            <ArrowLeft size={24} />
          </button>
          <h1>Spend Story Preferences</h1>
        </header>
        <SpendStoryPreferences />
      </div>
    );
  }

  if (activeSegment === 'sub-radar') {
    return (
      <div className="profile-subpage animate-fade-in">
        <header className="profile-subpage-header">
          <button className="back-btn" onClick={() => setActiveSegment(null)}>
            <ArrowLeft size={24} />
          </button>
          <h1>Subscription Radar</h1>
        </header>
        <SubscriptionRadarSection />
      </div>
    );
  }

  if (activeSegment === 'appinfo') {
    return (
      <div className="profile-subpage animate-fade-in">
        <header className="profile-subpage-header">
          <button className="back-btn" onClick={() => setActiveSegment(null)}>
            <ArrowLeft size={24} />
          </button>
          <h1>App Info</h1>
        </header>
        <AppInfoSection />
      </div>
    );
  }

  return (
    <div className="profile-container animate-fade-in">
      <header className="profile-header">
        <h1 className="profile-title">Settings</h1>
        <p className="profile-subtitle">Manage your account and preferences</p>
      </header>

      <div className="profile-segments-list">
        {PROFILE_SEGMENTS.map((segment) => {
          const Icon = segment.icon;
          return (
            <div 
              key={segment.id} 
              className="segment-item"
              onClick={() => handleSegmentClick(segment.id)}
            >
              <div className="segment-icon-box" style={{ backgroundColor: `${segment.color}15` }}>
                <Icon size={20} color={segment.color} />
              </div>
              <div className="segment-info">
                <span className="segment-name">{segment.title}</span>
                <span className="segment-subtitle">{segment.subtitle}</span>
              </div>
              <ChevronRight size={18} className="segment-arrow" />
            </div>
          );
        })}
      </div>
      
      <div className="profile-footer">
        <button className="sign-out-btn" onClick={() => supabase.auth.signOut()}>
          <LogOut size={16} /> Sign Out
        </button>
        <span className="version-info">Pocket v1.0.0 (MVP)</span>
      </div>
    </div>
  );
};

export default Profile;
