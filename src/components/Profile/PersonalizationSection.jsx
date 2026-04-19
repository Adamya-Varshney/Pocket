import { useState, useEffect, useRef } from 'react';
import {
  Palette, LayoutDashboard, AlignJustify, Tags, CalendarDays,
  Moon, Sun, Monitor, ChevronDown
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import Card from '../UI/Card';
import Button from '../UI/Button';
import { useAuth } from '../../context/AuthContext';
import { ICON_REGISTRY, getCategoryIcon } from '../../utils/categoryIcons';
import './PersonalizationSection.css';

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

// ── Icon Picker (inline dropdown grid) ──────────────────────────────
const IconPicker = ({ currentKey, onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const CurrentIcon = getCategoryIcon({ name: '', icon: currentKey });

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="icon-picker-wrapper" ref={ref}>
      <button
        type="button"
        className="icon-picker-trigger"
        onClick={() => setOpen(o => !o)}
        title="Change icon"
      >
        <CurrentIcon size={18} />
        <ChevronDown size={12} className="icon-picker-caret" />
      </button>
      {open && (
        <div className="icon-picker-dropdown">
          {Object.entries(ICON_REGISTRY).map(([key, { Icon, label }]) => (
            <button
              key={key}
              type="button"
              className={`icon-picker-item ${currentKey === key ? 'active' : ''}`}
              title={label}
              onClick={() => { onSelect(key); setOpen(false); }}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const PersonalizationSection = ({ accounts, categories: realCategories, onRefreshCategories }) => {
  const { user, updateProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [theme, setTheme] = useState('dark');
  const [defaultSort, setDefaultSort] = useState('newest');
  const [defaultRange, setDefaultRange] = useState('this-month');
  const [defaultAccount, setDefaultAccount] = useState('all');
  const [density, setDensity] = useState('comfortable');
  const [showAccountName, setShowAccountName] = useState(true);
  const [showCategoryIcon, setShowCategoryIcon] = useState(true);
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [weekStartsOn, setWeekStartsOn] = useState('Monday');
  const [localCats, setLocalCats] = useState([]);

  useEffect(() => {
    if (!user) return;
    const prefs = user.preferences || {};
    setTheme(prefs.theme || 'dark');
    setDefaultSort(prefs.defaultSort || 'newest');
    setDefaultRange(prefs.defaultRange || 'this-month');
    setDefaultAccount(prefs.defaultAccount || 'all');
    setDensity(prefs.density || 'comfortable');
    setShowAccountName(prefs.showAccountName ?? true);
    setShowCategoryIcon(prefs.showCategoryIcon ?? true);
    setDateFormat(prefs.dateFormat || 'DD/MM/YYYY');
    setWeekStartsOn(prefs.weekStartsOn || 'Monday');
  }, [user?.id]);

  useEffect(() => {
    if (realCategories?.length) setLocalCats(realCategories);
  }, [realCategories]);

  const handleSavePreferences = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    const { error } = await updateProfile({
      preferences: { theme, defaultSort, defaultRange, defaultAccount, density, showAccountName, showCategoryIcon, dateFormat, weekStartsOn }
    });
    setIsSaving(false);
    if (error) {
      alert(`Save failed: ${error.message || JSON.stringify(error)}`);
    } else {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleCategoryChange = async (id, field, value) => {
    setLocalCats(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    const { error } = await supabase.from('categories').update({ [field]: value }).eq('id', id);
    if (error) console.error('Category update error:', error);
    else if (onRefreshCategories) onRefreshCategories();
  };

  return (
    <div className="personalization-section">

      {/* ─── 1. Theme ─────────────────────────────── */}
      <Card className="pers-card">
        <div className="card-section-header">
          <div className="title-group">
            <div className="pers-icon-box" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#EC4899' }}>
              <Palette size={20} />
            </div>
            <div>
              <h3 className="card-section-title">Theme</h3>
              <p className="card-section-desc">App appearance</p>
            </div>
          </div>
        </div>
        <div className="pers-card-body">
          <div className="theme-selector">
            <button className={`theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}><Sun size={16} /> Light</button>
            <button className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}><Moon size={16} /> Dark</button>
            <button className={`theme-btn ${theme === 'system' ? 'active' : ''}`} onClick={() => setTheme('system')}><Monitor size={16} /> System</button>
          </div>
          <div className={`theme-live-preview ${theme}`}>
            <div className="preview-nav"></div>
            <div className="preview-card-mock"><span>₹45,000</span></div>
            <div className="preview-row-mock"></div>
            <div className="preview-row-mock"></div>
          </div>
        </div>
      </Card>

      {/* ─── 2. Dashboard Defaults ─────────────── */}
      <Card className="pers-card">
        <div className="card-section-header">
          <div className="title-group">
            <div className="pers-icon-box" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}>
              <LayoutDashboard size={20} />
            </div>
            <div>
              <h3 className="card-section-title">Dashboard Defaults</h3>
              <p className="card-section-desc">Initial loading state filters</p>
            </div>
          </div>
        </div>
        <div className="pers-card-body">
          <div className="settings-grid">
            <div className="setting-group">
              <label>Default Sort</label>
              <select value={defaultSort} onChange={e => setDefaultSort(e.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="highest">Highest amount</option>
                <option value="lowest">Lowest amount</option>
              </select>
            </div>
            <div className="setting-group">
              <label>Date Range</label>
              <select value={defaultRange} onChange={e => setDefaultRange(e.target.value)}>
                <option value="this-month">This month</option>
                <option value="last-30">Last 30 days</option>
                <option value="last-7">Last 7 days</option>
                <option value="all-time">All time</option>
              </select>
            </div>
            <div className="setting-group col-span-2">
              <label>Default Account Filter</label>
              <select value={defaultAccount} onChange={e => setDefaultAccount(e.target.value)}>
                <option value="all">All Accounts (Combined Balance)</option>
                {accounts?.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.masked_info || '****'})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* ─── 3. List Density ────────────────────── */}
      <Card className="pers-card">
        <div className="card-section-header">
          <div className="title-group">
            <div className="pers-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
              <AlignJustify size={20} />
            </div>
            <div>
              <h3 className="card-section-title">List Density</h3>
              <p className="card-section-desc">Transaction row size & contents</p>
            </div>
          </div>
        </div>
        <div className="pers-card-body">
          <div className="density-selector">
            {['compact', 'comfortable', 'spacious'].map(d => (
              <button key={d} className={`density-btn ${density === d ? 'active' : ''}`} onClick={() => setDensity(d)}>{d}</button>
            ))}
          </div>
          <div className="toggles-sidebar mt-4">
            <div className="toggle-row">
              <span>Show account name</span>
              <ToggleSwitch checked={showAccountName} onChange={setShowAccountName} />
            </div>
            <div className="toggle-row">
              <span>Show category icon</span>
              <ToggleSwitch checked={showCategoryIcon} onChange={setShowCategoryIcon} />
            </div>
          </div>
          <div className="density-preview-box mt-4">
            <span className="p-label">Live Preview</span>
            <div className={`mock-txn-row density-${density}`}>
              {showCategoryIcon && <div className="mock-icon">🍽️</div>}
              <div className="mock-details">
                <span className="mock-title">Dinner at Zomato</span>
                <div className="mock-sub-row">
                  <span className="mock-time">08:30 PM</span>
                  {showAccountName && <span className="mock-acc">• HDFC Credit</span>}
                </div>
              </div>
              <span className="mock-amount">-₹1,250</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ─── 4. Categories ──────────────────────── */}
      <Card className="pers-card">
        <div className="card-section-header">
          <div className="title-group">
            <div className="pers-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
              <Tags size={20} />
            </div>
            <div>
              <h3 className="card-section-title">Categories</h3>
              <p className="card-section-desc">Rename and change icons — changes apply globally</p>
            </div>
          </div>
        </div>
        <div className="pers-card-body">
          <div className="categories-list">
            {localCats.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading categories...</p>
            )}
            {localCats.map(cat => (
              <div key={cat.id} className="category-edit-row">
                <IconPicker
                  currentKey={cat.icon}
                  onSelect={key => handleCategoryChange(cat.id, 'icon', key)}
                />
                <input
                  type="text"
                  value={cat.name}
                  onChange={e => handleCategoryChange(cat.id, 'name', e.target.value)}
                  className="cat-name-input"
                />
              </div>
            ))}
          </div>
          <p className="sys-note">Changes are saved immediately and reflected everywhere in the app.</p>
        </div>
      </Card>

      {/* ─── 5. Date & Region Format ─────────────── */}
      <Card className="pers-card">
        <div className="card-section-header">
          <div className="title-group">
            <div className="pers-icon-box" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' }}>
              <CalendarDays size={20} />
            </div>
            <div>
              <h3 className="card-section-title">Date & Region</h3>
              <p className="card-section-desc">Localize your formats</p>
            </div>
          </div>
        </div>
        <div className="pers-card-body">
          <div className="settings-grid">
            <div className="setting-group">
              <label>Date Format</label>
              <select value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
                <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 25/03/2026)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 03/25/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-03-25)</option>
              </select>
            </div>
            <div className="setting-group">
              <label>Week starts on</label>
              <select value={weekStartsOn} onChange={e => setWeekStartsOn(e.target.value)}>
                <option value="Sunday">Sunday</option>
                <option value="Monday">Monday</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      <div className="save-actions">
        <Button fullWidth onClick={handleSavePreferences} disabled={isSaving}>
          {isSaving ? 'Saving...' : saveSuccess ? '✓ Preferences Saved!' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
};

export default PersonalizationSection;
