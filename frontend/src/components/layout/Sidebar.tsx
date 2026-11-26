import React from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  ShieldAlert,
  BarChart3,
  Cpu,
  Settings,
  Shield,
  Activity,
  ExternalLink
} from 'lucide-react';

export type NavigationTab = 
  | 'overview' 
  | 'transactions' 
  | 'alerts' 
  | 'analytics' 
  | 'model' 
  | 'settings';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  unresolvedAlertCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  unresolvedAlertCount
}) => {
  const menuItems = [
    {
      id: 'overview' as NavigationTab,
      label: 'Overview',
      icon: LayoutDashboard,
      description: 'System health & summary'
    },
    {
      id: 'transactions' as NavigationTab,
      label: 'Transactions',
      icon: ArrowLeftRight,
      description: 'Audit & real-time monitoring'
    },
    {
      id: 'alerts' as NavigationTab,
      label: 'Fraud Alerts',
      icon: ShieldAlert,
      badge: unresolvedAlertCount > 0 ? unresolvedAlertCount : undefined,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      description: 'Incident triage & resolution'
    },
    {
      id: 'analytics' as NavigationTab,
      label: 'Analytics',
      icon: BarChart3,
      description: 'Fraud trends & distributions'
    },
    {
      id: 'model' as NavigationTab,
      label: 'Model Performance',
      icon: Cpu,
      description: 'Evaluation metrics & curves'
    },
    {
      id: 'settings' as NavigationTab,
      label: 'Settings',
      icon: Settings,
      description: 'Thresholds & configurations'
    }
  ];

  return (
    <aside className="w-64 h-screen bg-[#0A0E1A] border-r border-slate-800/80 flex flex-col flex-shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80">
        <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm shadow-blue-500/10">
          <Shield className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-semibold text-white tracking-tight text-sm">
              FraudShield<span className="text-blue-400 font-mono">.AI</span>
            </h1>
            <span className="text-[10px] px-1.5 py-0.2 font-mono uppercase bg-blue-950/60 text-blue-400 border border-blue-500/30 rounded">
              v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">Fintech Risk Engine</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-400">
          Main Console
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`px-2 py-0.5 text-xs font-mono rounded-full border ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-[#070A13]/60">
        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium">Risk Engine</span>
            <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
              <Activity className="w-3 h-3 animate-pulse" />
              ONLINE
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Streaming transactions over WebSocket port 8000.
          </p>
        </div>
      </div>
    </aside>
  );
};
