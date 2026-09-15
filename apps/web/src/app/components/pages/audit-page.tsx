import { useState, useMemo } from 'react';
import { AlertTriangle, Filter, X, Search, ChevronDown } from 'lucide-react';
import { useStore } from '../../lib/store';

const ACTION_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Все действия' },
  { key: 'create', label: 'Создание' },
  { key: 'update', label: 'Изменение' },
  { key: 'delete', label: 'Удаление' },
  { key: 'status', label: 'Смена статуса' },
  { key: 'price_change', label: 'Изменение цены' },
  { key: 'reschedule', label: 'Перенос записи' },
  { key: 'register', label: 'Регистрация' },
];

export function AuditPage() {
  const { auditLog } = useStore();
  const [showSuspiciousOnly, setShowSuspiciousOnly] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const users = useMemo(() => [...new Set(auditLog.map(e => e.user))], [auditLog]);

  const filtered = useMemo(() => {
    return auditLog.filter(e => {
      if (showSuspiciousOnly && !e.isSuspicious) return false;
      if (userFilter && e.user !== userFilter) return false;
      if (actionFilter && e.actionKey !== actionFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return e.action.toLowerCase().includes(q) || e.entity.toLowerCase().includes(q) || e.user.toLowerCase().includes(q) || e.newValue.toLowerCase().includes(q);
      }
      return true;
    });
  }, [auditLog, showSuspiciousOnly, userFilter, actionFilter, searchQuery]);

  const suspiciousCount = auditLog.filter(e => e.isSuspicious).length;

  return (
    <div className="p-4 lg:p-8 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[#111827]" style={{ fontSize: '24px', fontWeight: 700 }}>Аудит</h1>
          <p className="text-[#6B7280] mt-0.5" style={{ fontSize: '13px' }}>{auditLog.length} записей · {suspiciousCount} подозрительных</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${showFilters ? 'border-[#2D6BE4] bg-[#EBF0F9] text-[#2D6BE4]' : 'border-[#E5E7EB] text-[#6B7280]'}`}
            style={{ fontSize: '13px', fontWeight: 500 }}>
            <Filter className="w-4 h-4" /> Фильтры
          </button>
          <button onClick={() => setShowSuspiciousOnly(!showSuspiciousOnly)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${showSuspiciousOnly ? 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]' : 'border-[#E5E7EB] text-[#6B7280]'}`}
            style={{ fontSize: '13px', fontWeight: 500 }}>
            <AlertTriangle className="w-4 h-4" /> {suspiciousCount}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none" style={{ fontSize: '13px' }} />
          </div>
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827]" style={{ fontSize: '13px' }}>
            <option value="">Все пользователи</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827]" style={{ fontSize: '13px' }}>
            {ACTION_FILTERS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>
      )}

      {/* Active filter badges */}
      {(showSuspiciousOnly || userFilter || actionFilter || searchQuery) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {showSuspiciousOnly && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF2F2] text-[#DC2626]" style={{ fontSize: '12px', fontWeight: 500 }}>
              Подозрительные <button onClick={() => setShowSuspiciousOnly(false)}><X className="w-3 h-3" /></button>
            </span>
          )}
          {userFilter && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EBF0F9] text-[#1B4F8A]" style={{ fontSize: '12px', fontWeight: 500 }}>
              {userFilter} <button onClick={() => setUserFilter('')}><X className="w-3 h-3" /></button>
            </span>
          )}
          {actionFilter && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F3F4F6] text-[#6B7280]" style={{ fontSize: '12px', fontWeight: 500 }}>
              {ACTION_FILTERS.find(a => a.key === actionFilter)?.label} <button onClick={() => setActionFilter('')}><X className="w-3 h-3" /></button>
            </span>
          )}
          <span className="text-[#9CA3AF]" style={{ fontSize: '12px', lineHeight: '28px' }}>{filtered.length} результатов</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
          <Search className="w-10 h-10 text-[#E5E7EB] mx-auto mb-3" />
          <p className="text-[#6B7280]" style={{ fontSize: '15px', fontWeight: 500 }}>Ничего не найдено</p>
          <p className="text-[#9CA3AF] mt-1" style={{ fontSize: '13px' }}>Попробуйте изменить фильтры</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  {['Дата/время', 'Пользователь', 'Действие', 'Объект', 'Было', 'Стало', 'IP'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[#6B7280]" style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => (
                  <tr key={entry.id}
                    className={`border-b border-[#F3F4F6] last:border-0 transition-colors hover:bg-[#F9FAFB] ${entry.isSuspicious ? 'bg-[#FEF2F2] hover:bg-[#FEE2E2]' : ''}`}>
                    <td className="px-4 py-3 text-[#6B7280] whitespace-nowrap" style={{ fontSize: '13px' }}>{entry.timestamp}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setUserFilter(entry.user)} className="text-[#111827] hover:text-[#2D6BE4]" style={{ fontSize: '13px', fontWeight: 500 }}>
                        {entry.user}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {entry.isSuspicious && <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />}
                        <span className="text-[#111827]" style={{ fontSize: '13px' }}>{entry.action}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]" style={{ fontSize: '13px' }}>{entry.entity}</td>
                    <td className="px-4 py-3">
                      {entry.oldValue ? <span className="text-[#9CA3AF] line-through" style={{ fontSize: '12px' }}>{entry.oldValue}</span> : <span className="text-[#D1D5DB]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[#111827]" style={{ fontSize: '13px', fontWeight: entry.isSuspicious ? 600 : 400 }}>{entry.newValue}</td>
                    <td className="px-4 py-3 text-[#9CA3AF]" style={{ fontSize: '11px', fontFamily: 'monospace' }}>{entry.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-2">
            {filtered.map(entry => (
              <div key={entry.id} className={`bg-white rounded-xl border p-4 ${entry.isSuspicious ? 'border-[#FECACA] bg-[#FEF2F2]' : 'border-[#E5E7EB]'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[#6B7280]" style={{ fontSize: '12px' }}>{entry.timestamp}</span>
                  <div className="flex items-center gap-2">
                    {entry.isSuspicious && <AlertTriangle className="w-4 h-4 text-[#DC2626]" />}
                    <span className="text-[#9CA3AF]" style={{ fontSize: '10px', fontFamily: 'monospace' }}>{entry.ip}</span>
                  </div>
                </div>
                <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{entry.action}</p>
                <p className="text-[#6B7280] mt-0.5" style={{ fontSize: '12px' }}>{entry.user} · {entry.entity}</p>
                {(entry.oldValue || entry.newValue) && (
                  <div className="mt-2 pt-2 border-t border-[#F3F4F6] flex items-center gap-2">
                    {entry.oldValue && <span className="text-[#9CA3AF] line-through" style={{ fontSize: '12px' }}>{entry.oldValue}</span>}
                    {entry.oldValue && <span className="text-[#9CA3AF]">→</span>}
                    <span className="text-[#111827]" style={{ fontSize: '12px', fontWeight: 500 }}>{entry.newValue}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
