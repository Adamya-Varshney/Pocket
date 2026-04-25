import { LayoutDashboard, PlusCircle, History, User, Users, Wallet } from 'lucide-react';
import './Layout.css';

const Layout = ({ children, activeTab, onTabChange }) => {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'add', label: 'Record', icon: PlusCircle },
    { id: 'history', label: 'History', icon: History },
    { id: 'groups', label: 'Groups', icon: Users },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="layout">
      <nav className="app-nav">
        <div className="nav-logo">
          <Wallet size={28} color="var(--primary)" />
          Pocket
        </div>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon size={24} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
