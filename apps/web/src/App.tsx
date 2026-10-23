import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { Console } from './pages/Console';
import { Approvals } from './pages/Approvals';
import { AuditLogs } from './pages/AuditLogs';
import { About } from './pages/About';
import { api } from './lib/api';
import { Activity, ArrowUpRight, CheckCircle2, ClipboardList, Command, FileClock, Gauge, Info, RotateCcw, ShieldCheck, UserRound, Workflow } from 'lucide-react';

type Role = 'operator' | 'approver' | 'admin';
const navigation = [
  { to: '/', label: 'Overview', icon: Gauge, end: true },
  { to: '/approvals', label: 'Approval queue', icon: ShieldCheck, end: false },
  { to: '/audit', label: 'Audit trail', icon: FileClock, end: false },
  { to: '/about', label: 'Policies & setup', icon: ClipboardList, end: false },
];
function PageHeading() {
  const location = useLocation();
  const page = navigation.find((item) => item.to === location.pathname) ?? navigation[0];
  if (location.pathname !== '/') return null;
  return <div className="page-heading"><div><div className="eyebrow">PERMISSIONOS / CONTROL PLANE</div><h1>{page.label}</h1><p>Human oversight for AI actions, with every decision traceable.</p></div><div className="environment-pill"><span className="environment-dot" /> Local demo environment</div></div>;
}
export function App() {
  const [currentRole, setCurrentRole] = useState<Role>('operator');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [isResetting, setIsResetting] = useState(false);
  useEffect(() => {
    api.getHealth().then(() => setHealthStatus('online')).catch(() => setHealthStatus('offline'));
    api.loginAs('operator').then(setCurrentUser).catch(() => setHealthStatus('offline'));
  }, []);
  const handleSwitchRole = async (role: Role) => {
    try { const user = await api.loginAs(role); setCurrentRole(role); setCurrentUser(user); }
    catch (err) { console.error('Failed to switch role:', err); }
  };
  const handleResetDemo = async () => {
    if (!confirm('Reset all demo orders, approvals and audit records?')) return;
    setIsResetting(true);
    try { await api.resetDemo(); window.location.reload(); }
    catch (err: any) { alert(`Reset failed: ${err.message}`); }
    finally { setIsResetting(false); }
  };
  return <BrowserRouter><div className="app-shell">
    <aside className="sidebar">
      <div>
        <div className="brand-lockup"><div className="brand-mark"><ShieldCheck size={22} /></div><div><div className="brand-name">PermissionOS</div><div className="brand-caption">AI ACTION GOVERNANCE</div></div></div>
        <div className="workspace-label">WORKSPACE <span>DEMO</span></div>
        <nav className="side-nav">{navigation.map(({to,label,icon:Icon,end}) => <NavLink key={to} to={to} end={end} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={18}/><span>{label}</span>{label === 'Approval queue' && <span className="nav-indicator"/>}</NavLink>)}</nav>
        <div className="sidebar-divider" />
        <div className="sidebar-section-label">SYSTEM STATUS</div>
        <div className="system-status-card"><div className="status-icon"><Activity size={17}/></div><div className="status-copy"><strong>Gateway API</strong><span>{healthStatus === 'online' ? 'Connected and responding' : healthStatus === 'checking' ? 'Checking connection…' : 'Connection unavailable'}</span></div><span className={`status-light ${healthStatus}`} /></div>
        <div className="system-status-card"><div className="status-icon violet"><Workflow size={17}/></div><div className="status-copy"><strong>Policy engine</strong><span>Default-deny enforcement</span></div><span className="status-light online" /></div>
      </div>
      <div className="sidebar-footer">
        <div className="sidebar-section-label">DEMO ACTOR</div>
        <div className="role-picker"><div className="role-avatar"><UserRound size={17}/></div><div className="role-select-wrap"><strong>{currentUser?.displayName || currentRole}</strong><span>Current session role</span></div><select aria-label="Switch demo role" value={currentRole} onChange={(e) => handleSwitchRole(e.target.value as Role)}><option value="operator">Operator</option><option value="approver">Approver</option><option value="admin">Admin</option></select></div>
        {currentRole === 'admin' && <button className="reset-button" onClick={handleResetDemo} disabled={isResetting}><RotateCcw size={14}/>{isResetting ? 'Resetting…' : 'Reset demo data'}</button>}
        <div className="sidebar-version"><span>PermissionOS</span><span>v0.1.0 <ArrowUpRight size={12}/></span></div>
      </div>
    </aside>
    <div className="main-column"><header className="topbar"><div className="breadcrumb"><Command size={15}/><span>Control plane</span><span className="breadcrumb-slash">/</span><strong>Governance console</strong></div><div className="topbar-right"><span className="secure-chip"><CheckCircle2 size={14}/> Policy checks enabled</span><div className="user-chip"><span className="user-chip-avatar">{(currentRole[0] || 'O').toUpperCase()}</span><span>{currentRole}</span></div></div></header>
      <main className="main-content"><PageHeading/><Routes><Route path="/" element={<Console/>}/><Route path="/approvals" element={<Approvals/>}/><Route path="/audit" element={<AuditLogs/>}/><Route path="/about" element={<About/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes><footer className="page-footer"><span>PermissionOS · Human approval layer for AI agents</span><span><Info size={13}/> Demo data only</span></footer></main>
    </div>
  </div></BrowserRouter>;
}
export default App;
