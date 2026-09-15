import { useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { formatPrice } from '../../lib/mock-data';
import { toast } from 'sonner';
import { X, Eye, Banknote, ChevronDown, ChevronUp, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function SalaryPage() {
  const { employees, appointments, services } = useStore();
  const getService = (id: string) => services.find(s => s.id === id);
  const [period, setPeriod] = useState('april');
  const [viewAs, setViewAs] = useState<string>('owner'); // 'owner' or employee id
  const [showPayModal, setShowPayModal] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const masterData = useMemo(() => {
    return employees.filter(e => e.role === 'master').map(emp => {
      const paidApts = appointments.filter(a => a.masterId === emp.id && a.status === 'paid');
      const allApts = appointments.filter(a => a.masterId === emp.id && !['cancelled'].includes(a.status));
      const revenue = paidApts.reduce((sum, a) => sum + a.price, 0);
      const salary = emp.salaryType === 'percent' ? Math.round(revenue * emp.salaryValue / 100) : emp.salaryValue;
      const paidOut = Math.round(salary * 0.6);
      const accruals = paidApts.map(a => {
        const svc = getService(a.serviceId);
        return { id: a.id, service: svc?.name || '', price: a.price, share: Math.round(a.price * emp.salaryValue / 100), time: a.startAt };
      });
      return { ...emp, appointmentsCount: allApts.length, paidCount: paidApts.length, revenue, salary, paidOut, balance: salary - paidOut, accruals };
    });
  }, [employees, appointments]);

  const selectedMaster = viewAs !== 'owner' ? masterData.find(m => m.id === viewAs) : null;
  const totalSalary = masterData.reduce((s, m) => s + m.salary, 0);
  const totalBalance = masterData.reduce((s, m) => s + m.balance, 0);

  // Master personal view
  if (selectedMaster) {
    return (
      <div className="p-4 lg:p-8 max-w-[600px] mx-auto">
        <button onClick={() => setViewAs('owner')} className="flex items-center gap-2 text-[#6B7280] mb-4" style={{ fontSize: '14px' }}>
          ← Вернуться к обзору
        </button>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mb-4 text-center">
          <div className="w-16 h-16 rounded-full bg-[#EBF0F9] flex items-center justify-center mx-auto mb-3">
            <span className="text-[#1B4F8A]" style={{ fontSize: '24px', fontWeight: 700 }}>{selectedMaster.name[0]}</span>
          </div>
          <h2 className="text-[#111827]" style={{ fontSize: '20px', fontWeight: 700 }}>{selectedMaster.name}</h2>
          <p className="text-[#6B7280]" style={{ fontSize: '14px' }}>{selectedMaster.salaryValue}% от услуги · {selectedMaster.paidCount} оплаченных записей</p>
          <div className="mt-5 pt-5 border-t border-[#E5E7EB]">
            <p className="text-[#6B7280] uppercase" style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.05em' }}>Ваш баланс</p>
            <p className="text-[#059669] mt-1" style={{ fontSize: '36px', fontWeight: 700 }}>{formatPrice(selectedMaster.balance)}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-[#F9FAFB] rounded-lg p-3">
              <p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>Выручка</p>
              <p className="text-[#111827]" style={{ fontSize: '15px', fontWeight: 600 }}>{formatPrice(selectedMaster.revenue)}</p>
            </div>
            <div className="bg-[#F9FAFB] rounded-lg p-3">
              <p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>Начислено</p>
              <p className="text-[#111827]" style={{ fontSize: '15px', fontWeight: 600 }}>{formatPrice(selectedMaster.salary)}</p>
            </div>
            <div className="bg-[#F9FAFB] rounded-lg p-3">
              <p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>Выплачено</p>
              <p className="text-[#111827]" style={{ fontSize: '15px', fontWeight: 600 }}>{formatPrice(selectedMaster.paidOut)}</p>
            </div>
          </div>
        </div>

        <h3 className="text-[#111827] mb-3" style={{ fontSize: '16px', fontWeight: 600 }}>Начисления</h3>
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          {selectedMaster.accruals.length === 0 ? (
            <div className="p-6 text-center text-[#9CA3AF]" style={{ fontSize: '14px' }}>Нет начислений</div>
          ) : selectedMaster.accruals.map(a => (
            <div key={a.id} className="px-4 py-3 border-b border-[#F3F4F6] last:border-0 flex items-center justify-between">
              <div>
                <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{a.service}</p>
                <p className="text-[#6B7280]" style={{ fontSize: '12px' }}>{a.time} · Клиент заплатил {formatPrice(a.price)}</p>
              </div>
              <span className="text-[#059669]" style={{ fontSize: '14px', fontWeight: 600 }}>+{formatPrice(a.share)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-[#111827]" style={{ fontSize: '24px', fontWeight: 700 }}>Зарплаты</h1>
        <select value={period} onChange={e => setPeriod(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#111827]" style={{ fontSize: '14px' }}>
          <option value="april">Апрель 2026</option>
          <option value="march">Март 2026</option>
          <option value="february">Февраль 2026</option>
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
          <p className="text-[#9CA3AF]" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>ВСЕГО НАЧИСЛЕНО</p>
          <p className="text-[#111827] mt-1" style={{ fontSize: '22px', fontWeight: 700 }}>{formatPrice(totalSalary)}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
          <p className="text-[#9CA3AF]" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>К ВЫПЛАТЕ</p>
          <p className="text-[#059669] mt-1" style={{ fontSize: '22px', fontWeight: 700 }}>{formatPrice(totalBalance)}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
          <p className="text-[#9CA3AF]" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>МАСТЕРОВ</p>
          <p className="text-[#111827] mt-1" style={{ fontSize: '22px', fontWeight: 700 }}>{masterData.length}</p>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E5E7EB]">
              {['Мастер', 'Записей', 'Выручка', 'Начислено', 'Выплачено', 'Баланс', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[#6B7280]" style={{ fontSize: '12px', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {masterData.map(m => (
              <tr key={m.id} className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#EBF0F9] flex items-center justify-center shrink-0">
                      <span className="text-[#1B4F8A]" style={{ fontSize: '12px', fontWeight: 600 }}>{m.name[0]}</span>
                    </div>
                    <div>
                      <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{m.name}</p>
                      <p className="text-[#6B7280]" style={{ fontSize: '11px' }}>{m.salaryValue}% от услуги</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#111827]" style={{ fontSize: '14px' }}>{m.paidCount} / {m.appointmentsCount}</td>
                <td className="px-4 py-3 text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{formatPrice(m.revenue)}</td>
                <td className="px-4 py-3 text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{formatPrice(m.salary)}</td>
                <td className="px-4 py-3 text-[#6B7280]" style={{ fontSize: '14px' }}>{formatPrice(m.paidOut)}</td>
                <td className="px-4 py-3">
                  <span className="text-[#059669]" style={{ fontSize: '14px', fontWeight: 600 }}>{formatPrice(m.balance)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowPayModal(m.id)} className="px-3 py-1.5 rounded-lg bg-[#2D6BE4] text-white" style={{ fontSize: '12px', fontWeight: 500 }}>Выплатить</button>
                    <button onClick={() => setViewAs(m.id)} className="p-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB]" title="Вид мастера">
                      <Eye className="w-4 h-4 text-[#6B7280]" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards with expandable accruals */}
      <div className="lg:hidden space-y-3">
        {masterData.map(m => (
          <div key={m.id} className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#EBF0F9] flex items-center justify-center">
                    <span className="text-[#1B4F8A]" style={{ fontSize: '14px', fontWeight: 600 }}>{m.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-[#111827]" style={{ fontSize: '16px', fontWeight: 600 }}>{m.name}</p>
                    <p className="text-[#6B7280]" style={{ fontSize: '12px' }}>{m.salaryValue}% · {m.paidCount} записей</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowPayModal(m.id)} className="px-3 py-1.5 rounded-lg bg-[#2D6BE4] text-white shrink-0" style={{ fontSize: '12px', fontWeight: 500 }}>Выплатить</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#E5E7EB]">
                <div><p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>Выручка</p><p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 600 }}>{formatPrice(m.revenue)}</p></div>
                <div><p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>Начислено</p><p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 600 }}>{formatPrice(m.salary)}</p></div>
                <div><p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>Баланс</p><p className="text-[#059669]" style={{ fontSize: '14px', fontWeight: 600 }}>{formatPrice(m.balance)}</p></div>
              </div>
            </div>
            <button onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
              className="w-full px-4 py-2 border-t border-[#E5E7EB] flex items-center justify-center gap-1 text-[#6B7280] hover:bg-[#F9FAFB]" style={{ fontSize: '12px', fontWeight: 500 }}>
              {expandedId === m.id ? <><ChevronUp className="w-3.5 h-3.5" /> Скрыть</> : <><ChevronDown className="w-3.5 h-3.5" /> Начисления ({m.accruals.length})</>}
            </button>
            <AnimatePresence>
              {expandedId === m.id && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="border-t border-[#E5E7EB]">
                    {m.accruals.map(a => (
                      <div key={a.id} className="px-4 py-2 border-b border-[#F3F4F6] last:border-0 flex justify-between">
                        <div>
                          <p className="text-[#111827]" style={{ fontSize: '13px' }}>{a.service}</p>
                          <p className="text-[#9CA3AF]" style={{ fontSize: '11px' }}>{a.time} · {formatPrice(a.price)}</p>
                        </div>
                        <span className="text-[#059669]" style={{ fontSize: '13px', fontWeight: 600 }}>+{formatPrice(a.share)}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* View as master buttons (mobile) */}
      <div className="lg:hidden mt-4">
        <p className="text-[#6B7280] mb-2" style={{ fontSize: '13px', fontWeight: 500 }}>Посмотреть как мастер:</p>
        <div className="flex gap-2 flex-wrap">
          {masterData.map(m => (
            <button key={m.id} onClick={() => setViewAs(m.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280]" style={{ fontSize: '13px' }}>
              <User className="w-3.5 h-3.5" /> {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Pay Modal */}
      <AnimatePresence>
        {showPayModal && (
          <PayoutModal masterId={showPayModal} masterData={masterData} onClose={() => setShowPayModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function PayoutModal({ masterId, masterData, onClose }: { masterId: string; masterData: any[]; onClose: () => void }) {
  const master = masterData.find((m: any) => m.id === masterId);
  const [amount, setAmount] = useState(master?.balance?.toString() || '');
  const [method, setMethod] = useState('cash');

  if (!master) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div className="relative w-[90%] lg:w-[400px] bg-white rounded-2xl overflow-hidden"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-[#111827]" style={{ fontSize: '18px', fontWeight: 600 }}>Выплата — {master.name}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F3F4F6]"><X className="w-5 h-5 text-[#6B7280]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-center bg-[#F9FAFB] rounded-xl p-4">
            <p className="text-[#6B7280]" style={{ fontSize: '12px' }}>Текущий баланс</p>
            <p className="text-[#059669]" style={{ fontSize: '28px', fontWeight: 700 }}>{formatPrice(master.balance)}</p>
          </div>
          <div>
            <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Сумма выплаты</label>
            <div className="relative">
              <input value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full px-4 py-3 pr-8 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none" style={{ fontSize: '16px', fontWeight: 600 }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">₸</span>
            </div>
          </div>
          <div>
            <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Способ</label>
            <div className="flex gap-2">
              {[['cash', 'Наличные'], ['kaspi', 'Kaspi']].map(([id, label]) => (
                <button key={id} onClick={() => setMethod(id)}
                  className={`flex-1 py-2.5 rounded-lg border-2 ${method === id ? 'border-[#2D6BE4] bg-[#EBF0F9] text-[#2D6BE4]' : 'border-[#E5E7EB] text-[#6B7280]'}`}
                  style={{ fontSize: '13px', fontWeight: 500 }}>{label}</button>
              ))}
            </div>
          </div>
          <button onClick={() => { toast.success(`Выплата ${master.name}: ${formatPrice(Number(amount))} зафиксирована`); onClose(); }}
            className="w-full py-3 rounded-lg bg-[#2D6BE4] text-white" style={{ fontSize: '14px', fontWeight: 600 }}>
            Подтвердить выплату
          </button>
        </div>
      </motion.div>
    </div>
  );
}
