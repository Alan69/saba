import { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router';
import {
  LayoutGrid, Users, DollarSign, BarChart3, Settings, Shield,
  Menu, X, ChevronLeft, CalendarDays, Bell, ExternalLink, CheckCheck, LogOut
} from 'lucide-react';
import { useStore, type Notification } from '../lib/store';
import { useAuth } from '../lib/auth';
import { isImpersonating, stopImpersonation } from '../lib/api';

const ROLE_LABELS: Record<string, string> = { owner: 'Владелец', admin: 'Администратор', master: 'Мастер' };

const NAV_ITEMS = [
  { to: '/', icon: BarChart3, label: 'Дашборд' },
  { to: '/schedule', icon: LayoutGrid, label: 'Шахматка' },
  { to: '/clients', icon: Users, label: 'Клиенты' },
  { to: '/salary', icon: DollarSign, label: 'Зарплаты' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
  { to: '/audit', icon: Shield, label: 'Аудит' },
];

const MOBILE_TABS = [
  { to: '/schedule', icon: LayoutGrid, label: 'Шахматка' },
  { to: '/clients', icon: Users, label: 'Клиенты' },
  { to: '/', icon: BarChart3, label: 'Дашборд' },
  { to: '/salary', icon: DollarSign, label: 'Ещё' },
];

const NOTIF_COLORS: Record<Notification['type'], string> = {
  success: '#059669', error: '#DC2626', info: '#3B82F6', warning: '#D97706',
};

export function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useStore();
  const { user, company, logout } = useAuth();
  const widgetPath = `/booking/${company?.slug ?? ''}`;
  const initials = (user?.name ?? 'S').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col h-screen" style={{ fontFamily: 'Inter, sans-serif' }}>
      {isImpersonating() && (
        <div className="shrink-0 bg-[#0D1F3C] text-white px-4 py-2 flex items-center justify-between" style={{ fontSize: '13px' }}>
          <span>Режим супер-админа: вы работаете под компанией «{company?.name}»</span>
          <button
            onClick={() => { stopImpersonation(); window.location.href = `${import.meta.env.BASE_URL}admin`; }}
            className="px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25" style={{ fontWeight: 500 }}>
            Вернуться в панель
          </button>
        </div>
      )}
    <div className="flex flex-1 min-h-0 bg-[#F9FAFB]">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col border-r border-[#E5E7EB] bg-white transition-all duration-200 ${sidebarCollapsed ? 'w-[68px]' : 'w-[240px]'}`}>
        <div className="flex items-center justify-between px-4 h-[60px] border-b border-[#E5E7EB]">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0D1F3C] flex items-center justify-center">
                <span className="text-white" style={{ fontSize: '14px', fontWeight: 700 }}>S</span>
              </div>
              <span className="text-[#0D1F3C]" style={{ fontSize: '18px', fontWeight: 700 }}>saba</span>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="w-8 h-8 rounded-lg bg-[#0D1F3C] flex items-center justify-center mx-auto">
              <span className="text-white" style={{ fontSize: '14px', fontWeight: 700 }}>S</span>
            </div>
          )}
          {!sidebarCollapsed && (
            <button onClick={() => setSidebarCollapsed(true)} className="p-1.5 rounded-md hover:bg-[#F9FAFB] text-[#6B7280]">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
        {sidebarCollapsed && (
          <button onClick={() => setSidebarCollapsed(false)} className="mx-auto mt-2 p-1.5 rounded-md hover:bg-[#F9FAFB] text-[#6B7280]">
            <ChevronLeft className="w-4 h-4 rotate-180" />
          </button>
        )}
        <nav className="flex-1 py-2 px-2 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive ? 'bg-[#EBF0F9] text-[#1B4F8A]' : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
                } ${sidebarCollapsed ? 'justify-center' : ''}`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.label}</span>}
            </NavLink>
          ))}
          <div className="pt-3 mt-3 border-t border-[#E5E7EB]">
            <NavLink
              to="/onboarding"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827] ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <CalendarDays className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span style={{ fontSize: '14px', fontWeight: 500 }}>Онбординг</span>}
            </NavLink>
            <NavLink
              to={widgetPath}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827] ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <ExternalLink className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span style={{ fontSize: '14px', fontWeight: 500 }}>Виджет записи</span>}
            </NavLink>
          </div>
        </nav>
        <div className="p-3 border-t border-[#E5E7EB]">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-[#0D1F3C] flex items-center justify-center shrink-0">
              <span className="text-white" style={{ fontSize: '12px', fontWeight: 600 }}>{initials}</span>
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[#111827] truncate" style={{ fontSize: '13px', fontWeight: 600 }}>{user?.name ?? ''}</p>
                <p className="text-[#6B7280] truncate" style={{ fontSize: '11px' }}>{ROLE_LABELS[user?.role ?? 'owner']} · {company?.name ?? ''}</p>
              </div>
            )}
            {!sidebarCollapsed && (
              <button onClick={() => { logout(); navigate('/login'); }} title="Выйти"
                className="p-1.5 rounded-md hover:bg-[#FEF2F2] text-[#6B7280] hover:text-[#DC2626] shrink-0">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Top Bar */}
        <header className="lg:hidden flex items-center justify-between px-4 h-[56px] bg-white border-b border-[#E5E7EB]">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 -ml-2">
            {mobileMenuOpen ? <X className="w-5 h-5 text-[#111827]" /> : <Menu className="w-5 h-5 text-[#111827]" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#0D1F3C] flex items-center justify-center">
              <span className="text-white" style={{ fontSize: '12px', fontWeight: 700 }}>S</span>
            </div>
            <span className="text-[#0D1F3C]" style={{ fontSize: '16px', fontWeight: 700 }}>saba</span>
          </div>
          <button onClick={() => setNotifOpen(!notifOpen)} className="p-2 -mr-2 relative">
            <Bell className="w-5 h-5 text-[#6B7280]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#DC2626] text-white flex items-center justify-center" style={{ fontSize: '9px', fontWeight: 700 }}>{unreadCount}</span>
            )}
          </button>
        </header>

        {/* Desktop notification bell — fixed top-right */}
        <div className="hidden lg:block absolute top-4 right-6 z-30">
          <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 rounded-lg hover:bg-[#F3F4F6] bg-white border border-[#E5E7EB]">
            <Bell className="w-5 h-5 text-[#6B7280]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#DC2626] text-white flex items-center justify-center" style={{ fontSize: '10px', fontWeight: 700 }}>{unreadCount}</span>
            )}
          </button>
        </div>

        {/* Notification Panel */}
        {notifOpen && (
          <div className="absolute right-0 lg:right-4 top-[56px] lg:top-[52px] w-full lg:w-[380px] bg-white border border-[#E5E7EB] lg:rounded-xl shadow-xl z-50 max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
              <h3 className="text-[#111827]" style={{ fontSize: '15px', fontWeight: 600 }}>Уведомления</h3>
              <button onClick={() => { markAllNotificationsRead(); }} className="flex items-center gap-1 text-[#2D6BE4]" style={{ fontSize: '12px', fontWeight: 500 }}>
                <CheckCheck className="w-3.5 h-3.5" /> Прочитать все
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-[#9CA3AF]" style={{ fontSize: '14px' }}>Нет уведомлений</div>
              ) : notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => { markNotificationRead(n.id); setNotifOpen(false); }}
                  className={`px-4 py-3 border-b border-[#F3F4F6] last:border-0 cursor-pointer hover:bg-[#F9FAFB] ${!n.read ? 'bg-[#F0F6FF]' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: NOTIF_COLORS[n.type] }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[#111827] truncate" style={{ fontSize: '13px', fontWeight: 600 }}>{n.title}</p>
                        <span className="text-[#9CA3AF] shrink-0 ml-2" style={{ fontSize: '11px' }}>{n.timestamp}</span>
                      </div>
                      <p className="text-[#6B7280] mt-0.5" style={{ fontSize: '12px' }}>{n.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overlay to close notif/menu */}
        {(notifOpen || mobileMenuOpen) && (
          <div className="fixed inset-0 z-40" onClick={() => { setNotifOpen(false); setMobileMenuOpen(false); }} />
        )}

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute inset-x-0 top-[56px] z-50 bg-white border-b border-[#E5E7EB] shadow-lg">
            <nav className="p-4 space-y-1">
              {NAV_ITEMS.map(item => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg ${isActive ? 'bg-[#EBF0F9] text-[#1B4F8A]' : 'text-[#6B7280]'}`}>
                  <item.icon className="w-5 h-5" />
                  <span style={{ fontSize: '15px', fontWeight: 500 }}>{item.label}</span>
                </NavLink>
              ))}
              <div className="pt-2 mt-2 border-t border-[#E5E7EB]">
                <NavLink to="/onboarding" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#6B7280]">
                  <CalendarDays className="w-5 h-5" />
                  <span style={{ fontSize: '15px', fontWeight: 500 }}>Онбординг</span>
                </NavLink>
                <NavLink to={widgetPath} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#6B7280]">
                  <ExternalLink className="w-5 h-5" />
                  <span style={{ fontSize: '15px', fontWeight: 500 }}>Виджет записи</span>
                </NavLink>
                <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[#DC2626]">
                  <LogOut className="w-5 h-5" />
                  <span style={{ fontSize: '15px', fontWeight: 500 }}>Выйти</span>
                </button>
              </div>
            </nav>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto pb-[80px] lg:pb-0">
          <Outlet />
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#E5E7EB] flex z-40">
          {MOBILE_TABS.map(item => {
            const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
            return (
              <NavLink key={item.to} to={item.to} className={`flex-1 flex flex-col items-center py-2 pt-2.5 ${isActive ? 'text-[#1B4F8A]' : 'text-[#6B7280]'}`}>
                <item.icon className="w-5 h-5" />
                <span style={{ fontSize: '10px', fontWeight: 500 }} className="mt-0.5">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
    </div>
  );
}
