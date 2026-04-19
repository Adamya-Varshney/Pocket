import { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  TrendingDown,
  Radar,
  Moon,
  Bell,
  BellOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import Card from '../UI/Card';
import './NotificationsSection.css';

const MOCK_CURRENT_SCORE = 72;

const DELIVERY_DAYS = ['Monday', 'Tuesday', 'Wednesday'];
const DELIVERY_TIMES = [
  { label: 'Morning', time: '8:00 AM' },
  { label: 'Afternoon', time: '12:00 PM' },
  { label: 'Evening', time: '6:00 PM' },
];

const Toggle = ({ checked, onChange, id }) => (
  <button
    id={id}
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`toggle-switch ${checked ? 'on' : 'off'}`}
  >
    <span className="toggle-knob" />
  </button>
);

const SettingsRow = ({ icon: Icon, iconColor, label, sublabel, right, disabled }) => (
  <div className={`settings-row ${disabled ? 'disabled' : ''}`}>
    <div className="settings-row-left">
      {Icon && (
        <div className="settings-icon-box" style={{ background: `${iconColor}18` }}>
          <Icon size={18} color={iconColor} />
        </div>
      )}
      <div className="settings-text">
        <span className="settings-label">{label}</span>
        {sublabel && <span className="settings-sublabel">{sublabel}</span>}
      </div>
    </div>
    <div className="settings-row-right">{right}</div>
  </div>
);

const NotificationsSection = () => {
  // 0. Master Toggle
  const [masterNotificationsOn, setMasterNotificationsOn] = useState(true);

  // 1. Spend Story
  const [spendStoryOn, setSpendStoryOn] = useState(true);
  const [deliveryDay, setDeliveryDay] = useState('Monday');
  const [deliveryTime, setDeliveryTime] = useState('Morning');

  // 2. Cash Flow Score
  const [cashFlowOn, setCashFlowOn] = useState(true);
  const [dropThreshold, setDropThreshold] = useState(10);

  const alertedScore = useMemo(() => MOCK_CURRENT_SCORE - dropThreshold, [dropThreshold]);

  // 3. Subscription Radar
  const [weeklyReminderOn, setWeeklyReminderOn] = useState(true);
  const [detectionMode, setDetectionMode] = useState('immediate'); // 'immediate' | 'weekly'

  // 4. Quiet Hours
  const [quietOn, setQuietOn] = useState(false);
  const [quietFrom, setQuietFrom] = useState('22:00');
  const [quietTo, setQuietTo] = useState('08:00');

  // 5. Permission Status
  const [permissionStatus, setPermissionStatus] = useState('default'); // 'granted' | 'denied' | 'default'

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    } else {
      setPermissionStatus('unsupported');
    }
  }, []);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setPermissionStatus(perm);
    }
  };

  const permissionConfig = {
    granted: {
      icon: CheckCircle2,
      label: 'Allowed',
      sublabel: 'Pocket can deliver alerts to this device.',
      color: '#10B981',
      cls: 'allowed',
    },
    denied: {
      icon: XCircle,
      label: 'Blocked',
      sublabel: 'Notifications are blocked for this browser.',
      color: '#EF4444',
      cls: 'blocked',
    },
    default: {
      icon: AlertCircle,
      label: 'Not set',
      sublabel: 'Permission has not been requested yet.',
      color: '#F59E0B',
      cls: 'not-set',
    },
    unsupported: {
      icon: BellOff,
      label: 'Unsupported',
      sublabel: 'This browser does not support notifications.',
      color: '#71717A',
      cls: 'blocked',
    },
  };

  const perm = permissionConfig[permissionStatus] ?? permissionConfig.default;
  const PermIcon = perm.icon;

  return (
    <div className="notifications-section">

      {/* ─── 0. Master Toggle ───────────────────────────── */}
      <Card className="notif-card master-toggle-card" style={{ border: masterNotificationsOn ? '' : '1px solid #EF4444' }}>
        <div className="card-section-header">
          <div className="card-section-title-group">
            <div className={`card-icon-box ${masterNotificationsOn ? 'card-icon-blue' : 'card-icon-red'}`} style={{ color: masterNotificationsOn ? '' : '#EF4444', background: masterNotificationsOn ? '' : 'rgba(239, 68, 68, 0.15)' }}>
              {masterNotificationsOn ? <Bell size={20} /> : <BellOff size={20} />}
            </div>
            <div>
              <h3 className="card-section-title">Master Notifications</h3>
              <p className="card-section-desc">
                {masterNotificationsOn 
                  ? 'All selected notifications will be sent' 
                  : 'All notifications are currently paused'}
              </p>
            </div>
          </div>
          <Toggle id="master-toggle" checked={masterNotificationsOn} onChange={setMasterNotificationsOn} />
        </div>
      </Card>

      <div className={`notification-settings-group ${!masterNotificationsOn ? 'disabled-group' : ''}`}>
        {/* ─── 1. Spend Story ─────────────────────────────── */}
      <Card className="notif-card">
        <div className="card-section-header">
          <div className="card-section-title-group">
            <div className="card-icon-box card-icon-purple">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="card-section-title">Spend Story</h3>
              <p className="card-section-desc">Your weekly AI financial summary card</p>
            </div>
          </div>
          <Toggle id="spendstory-toggle" checked={spendStoryOn} onChange={setSpendStoryOn} />
        </div>

        {spendStoryOn && (
          <div className="card-section-body animate-fade-in">
            <div className="sub-setting">
              <label className="sub-label">Delivery day</label>
              <div className="segmented-control-sm">
                {DELIVERY_DAYS.map(d => (
                  <button
                    key={d}
                    className={deliveryDay === d ? 'active' : ''}
                    onClick={() => setDeliveryDay(d)}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div className="sub-setting">
              <label className="sub-label">Delivery time</label>
              <div className="segmented-control-sm">
                {DELIVERY_TIMES.map(t => (
                  <button
                    key={t.label}
                    className={deliveryTime === t.label ? 'active' : ''}
                    onClick={() => setDeliveryTime(t.label)}
                  >
                    {t.label}
                    <span className="time-hint">{t.time}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="preview-chip">
              <Info size={13} />
              Sent every {deliveryDay} at {DELIVERY_TIMES.find(t => t.label === deliveryTime)?.time}
            </div>
          </div>
        )}
      </Card>

      {/* ─── 2. Cash Flow Score ─────────────────────────── */}
      <Card className="notif-card">
        <div className="card-section-header">
          <div className="card-section-title-group">
            <div className="card-icon-box card-icon-teal">
              <TrendingDown size={20} />
            </div>
            <div>
              <h3 className="card-section-title">Cash Flow Score Alert</h3>
              <p className="card-section-desc">Get alerted when your score drops suddenly</p>
            </div>
          </div>
          <Toggle id="cashflow-toggle" checked={cashFlowOn} onChange={setCashFlowOn} />
        </div>

        {cashFlowOn && (
          <div className="card-section-body animate-fade-in">
            <div className="sub-setting">
              <div className="slider-header">
                <label className="sub-label">Drop threshold</label>
                <span className="slider-value">{dropThreshold} pts</span>
              </div>
              <div className="slider-wrapper">
                <span className="slider-cap">5</span>
                <input
                  type="range"
                  min={5}
                  max={20}
                  step={1}
                  value={dropThreshold}
                  onChange={e => setDropThreshold(Number(e.target.value))}
                  className="score-slider"
                />
                <span className="slider-cap">20</span>
              </div>
            </div>
            <div className={`score-preview ${alertedScore < 50 ? 'danger' : alertedScore < 65 ? 'warn' : ''}`}>
              <TrendingDown size={15} />
              You'll be alerted if your score drops below&nbsp;
              <strong>{alertedScore}</strong>&nbsp;from&nbsp;<strong>{MOCK_CURRENT_SCORE}</strong>
            </div>
          </div>
        )}
      </Card>

      {/* ─── 3. Subscription Radar ──────────────────────── */}
      <Card className="notif-card">
        <div className="card-section-header">
          <div className="card-section-title-group">
            <div className="card-icon-box card-icon-indigo">
              <Radar size={20} />
            </div>
            <div>
              <h3 className="card-section-title">Subscription Radar</h3>
              <p className="card-section-desc">Recurring payment detection alerts</p>
            </div>
          </div>
        </div>

        <div className="card-section-body">
          <SettingsRow
            label="Weekly scan reminder"
            sublabel="Get reminded before your weekly scan"
            right={<Toggle id="weekly-reminder" checked={weeklyReminderOn} onChange={setWeeklyReminderOn} />}
          />
          <div className="sub-setting">
            <label className="sub-label">New subscription detection</label>
            <div className="segmented-control-sm two-col">
              <button
                className={detectionMode === 'immediate' ? 'active' : ''}
                onClick={() => setDetectionMode('immediate')}
              >
                Immediate
                <span className="time-hint">As soon as detected</span>
              </button>
              <button
                className={detectionMode === 'weekly' ? 'active' : ''}
                onClick={() => setDetectionMode('weekly')}
              >
                Weekly digest
                <span className="time-hint">Bundled with scan</span>
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* ─── 4. Quiet Hours ─────────────────────────────── */}
      <Card className="notif-card">
        <div className="card-section-header">
          <div className="card-section-title-group">
            <div className="card-icon-box card-icon-blue">
              <Moon size={20} />
            </div>
            <div>
              <h3 className="card-section-title">Quiet Hours</h3>
              <p className="card-section-desc">Queue all alerts during this window</p>
            </div>
          </div>
          <Toggle id="quiet-toggle" checked={quietOn} onChange={setQuietOn} />
        </div>

        {quietOn && (
          <div className="card-section-body animate-fade-in">
            <div className="time-range-row">
              <div className="time-field">
                <label>From</label>
                <input type="time" value={quietFrom} onChange={e => setQuietFrom(e.target.value)} />
              </div>
              <div className="time-divider">→</div>
              <div className="time-field">
                <label>To</label>
                <input type="time" value={quietTo} onChange={e => setQuietTo(e.target.value)} />
              </div>
            </div>
            <div className="preview-chip">
              <Moon size={13} />
              Alerts queued{' '}
              {new Date(`2000-01-01T${quietFrom}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' '}→{' '}
              {new Date(`2000-01-01T${quietTo}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' '}· Delivered at wake time
            </div>
          </div>
        )}
      </Card>

      {/* ─── 5. Permission Status ───────────────────────── */}
      <Card className="notif-card">
        <div className="card-section-header">
          <div className="card-section-title-group">
            <div className={`card-icon-box`} style={{ background: `${perm.color}18` }}>
              <Bell size={20} color={perm.color} />
            </div>
            <div>
              <h3 className="card-section-title">Push Permission</h3>
              <p className="card-section-desc">Browser / OS notification access</p>
            </div>
          </div>
          <div className={`perm-badge ${perm.cls}`}>
            <PermIcon size={14} />
            {perm.label}
          </div>
        </div>

        <div className="card-section-body">
          <p className="perm-sublabel">{perm.sublabel}</p>

          {permissionStatus === 'denied' && (
            <div className="blocked-instructions animate-fade-in">
              <p className="blocked-title">How to re-enable:</p>
              <ol className="blocked-steps">
                <li>Click the <strong>🔒 lock icon</strong> in your browser's address bar.</li>
                <li>Find <strong>Notifications</strong> and set it to <em>Allow</em>.</li>
                <li>Reload the page.</li>
              </ol>
            </div>
          )}

          {permissionStatus === 'default' && (
            <button className="enable-btn" onClick={requestPermission}>
              <Bell size={16} /> Enable Notifications
            </button>
          )}
        </div>
      </Card>

      <div className="save-actions">
        <button className="save-btn" onClick={() => alert('Notification preferences saved!')}>
          Save preferences
        </button>
      </div>
      </div>
    </div>
  );
};

export default NotificationsSection;
