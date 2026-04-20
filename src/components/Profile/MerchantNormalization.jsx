import { useState, useMemo } from 'react';
import {
  Search,
  RotateCcw,
  Store,
  ArrowRight,
  Save,
  CheckCircle
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Card from '../UI/Card';
import './MerchantNormalization.css';
import { normalizeMerchant } from '../../utils/merchantUtils';

const MerchantNormalization = ({ transactions, merchantOverrides, setMerchantOverrides }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [savingKey, setSavingKey] = useState(null); // track which row is saving

  const uniqueMerchants = useMemo(() => {
    const merchants = Array.from(new Set(transactions.map(t => t.description)));
    return merchants.filter(m => m.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [transactions, searchTerm]);

  // Persist overrides to profiles.preferences.merchantOverrides in Supabase
  const persistOverrides = async (overrides) => {
    if (!user?.id) return;
    const currentPrefs = user.preferences || {};
    await supabase
      .from('profiles')
      .upsert(
        { id: user.id, preferences: { ...currentPrefs, merchantOverrides: overrides } },
        { onConflict: 'id' }
      );
  };

  const handleOverride = async (original, custom) => {
    setSavingKey(original);
    let newOverrides;
    if (!custom) {
      newOverrides = { ...merchantOverrides };
      delete newOverrides[original];
    } else {
      newOverrides = { ...merchantOverrides, [original]: custom };
    }
    setMerchantOverrides(newOverrides);
    await persistOverrides(newOverrides);
    setSavingKey(null);
  };

  const resetAll = async () => {
    if (window.confirm('Reset all merchant overrides to system defaults?')) {
      setMerchantOverrides({});
      await persistOverrides({});
    }
  };

  return (
    <div className="merchant-normalization animate-fade-in">
      <header className="merchants-header">
        <div className="search-bar">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search merchants..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="reset-all-btn" onClick={resetAll}>
          <RotateCcw size={16} /> Reset All
        </button>
      </header>

      <div className="merchants-list">
        {uniqueMerchants.map(merchant => (
          <Card key={merchant} className="merchant-row">
            <div className="merchant-original">
              <Store size={18} className="store-icon" />
              <div className="merchant-name-stack">
                <span className="original-label">Original Statement Name</span>
                <span className="original-val">{merchant}</span>
                {(() => {
                  const systemMatch = normalizeMerchant(merchant, {}); // check without user overrides
                  if (systemMatch !== merchant) {
                    return <span className="system-match-badge">System Match: {systemMatch}</span>;
                  }
                  return null;
                })()}
              </div>
            </div>
            
            <div className="merchant-arrow">
              <ArrowRight size={20} />
            </div>

            <div className="merchant-override">
              <input
                type="text"
                placeholder="Set custom name..."
                defaultValue={merchantOverrides[merchant] || ''}
                onBlur={(e) => handleOverride(merchant, e.target.value)}
              />
              {savingKey === merchant && (
                <span className="saving-indicator">saving...</span>
              )}
              {merchantOverrides[merchant] && savingKey !== merchant && (
                <CheckCircle size={14} className="saved-icon" />
              )}
              {merchantOverrides[merchant] && (
                <button
                  className="reset-single"
                  onClick={() => handleOverride(merchant, '')}
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </Card>
        ))}
        {uniqueMerchants.length === 0 && (
          <div className="no-merchants">
            <p>No merchants found matching "{searchTerm}"</p>
          </div>
        )}
      </div>

      <div className="normalization-footer">
        <p>Overrides are saved to the database and persist across sessions. Applied retroactively to all transactions.</p>
      </div>
    </div>
  );
};

export default MerchantNormalization;
