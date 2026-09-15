import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Search, ChevronRight, ChevronDown, ChevronUp, Plus, X, UserPlus, Phone, SlidersHorizontal } from 'lucide-react';
import { useStore } from '../../lib/store';
import { formatPrice, maskPhone, type Client } from '../../lib/mock-data';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

type SortKey = 'name' | 'totalVisits' | 'totalSpent' | 'lastVisitAt';

export function ClientsPage() {
  const { clients, addClient } = useStore();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('lastVisitAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showAdd, setShowAdd] = useState(false);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    let list = clients.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.carBrand.toLowerCase().includes(search.toLowerCase())
    );
    list.sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [clients, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
    : <ChevronDown className="w-3 h-3 opacity-30" />;

  const totalSpent = clients.reduce((s, c) => s + c.totalSpent, 0);
  const totalVisits = clients.reduce((s, c) => s + c.totalVisits, 0);

  return (
    <div className="p-4 lg:p-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[#111827]" style={{ fontSize: '24px', fontWeight: 700 }}>Клиенты</h1>
          <p className="text-[#6B7280] mt-0.5" style={{ fontSize: '13px' }}>{clients.length} клиентов · {totalVisits} визитов · {formatPrice(totalSpent)} выручки</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2D6BE4] text-white" style={{ fontSize: '13px', fontWeight: 600 }}>
          <UserPlus className="w-4 h-4" /> <span className="hidden lg:inline">Добавить</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени, телефону или авто..."
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] focus:border-[#2D6BE4] focus:outline-none" style={{ fontSize: '14px' }} />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-[#9CA3AF]" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-[#E5E7EB]">
          <UserPlus className="w-12 h-12 text-[#E5E7EB] mx-auto mb-3" />
          <p className="text-[#6B7280]" style={{ fontSize: '16px', fontWeight: 500 }}>
            {search ? 'Ничего не найдено' : 'Нет клиентов'}
          </p>
          <p className="text-[#9CA3AF] mt-1" style={{ fontSize: '14px' }}>
            {search ? 'Попробуйте изменить запрос' : 'Клиенты появятся после первой записи'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  {([
                    { key: 'name' as SortKey, label: 'Клиент' },
                    { key: null, label: 'Телефон' },
                    { key: null, label: 'Авто' },
                    { key: 'totalVisits' as SortKey, label: 'Визиты' },
                    { key: 'totalSpent' as SortKey, label: 'Потрачено' },
                    { key: 'lastVisitAt' as SortKey, label: 'Последний визит' },
                  ]).map(col => (
                    <th key={col.label} className="text-left px-4 py-3">
                      {col.key ? (
                        <button onClick={() => toggleSort(col.key!)} className="flex items-center gap-1 text-[#6B7280] hover:text-[#111827]"
                          style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '0.04em' }}>
                          {col.label} <SortIcon k={col.key} />
                        </button>
                      ) : (
                        <span className="text-[#6B7280]" style={{ fontSize: '12px', fontWeight: 500 }}>{col.label}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(client => (
                  <tr key={client.id} onClick={() => navigate(`/clients/${client.id}`)}
                    className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#EBF0F9] flex items-center justify-center shrink-0">
                          <span className="text-[#1B4F8A]" style={{ fontSize: '12px', fontWeight: 600 }}>{client.name[0]}</span>
                        </div>
                        <span className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{client.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]" style={{ fontSize: '14px' }}>{maskPhone(client.phone)}</td>
                    <td className="px-4 py-3 text-[#111827]" style={{ fontSize: '14px' }}>{client.carBrand}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[#111827] ${client.totalVisits >= 10 ? '' : ''}`} style={{ fontSize: '14px', fontWeight: 500 }}>{client.totalVisits}</span>
                      {client.totalVisits >= 10 && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#D97706]" style={{ fontSize: '10px', fontWeight: 600 }}>VIP</span>}
                    </td>
                    <td className="px-4 py-3 text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{formatPrice(client.totalSpent)}</td>
                    <td className="px-4 py-3 text-[#6B7280]" style={{ fontSize: '14px' }}>{client.lastVisitAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-2">
            {filtered.map(client => (
              <div key={client.id} onClick={() => navigate(`/clients/${client.id}`)}
                className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center justify-between cursor-pointer active:bg-[#F9FAFB]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#EBF0F9] flex items-center justify-center shrink-0">
                    <span className="text-[#1B4F8A]" style={{ fontSize: '14px', fontWeight: 600 }}>{client.name[0]}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[#111827] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>{client.name}</p>
                      {client.totalVisits >= 10 && <span className="px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#D97706]" style={{ fontSize: '9px', fontWeight: 600 }}>VIP</span>}
                    </div>
                    <p className="text-[#6B7280]" style={{ fontSize: '12px' }}>{client.carBrand} · {client.totalVisits} визитов</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[#111827]" style={{ fontSize: '13px', fontWeight: 600 }}>{formatPrice(client.totalSpent)}</span>
                  <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add Client Modal */}
      <AnimatePresence>
        {showAdd && <AddClientModal onClose={() => setShowAdd(false)} addClient={addClient} />}
      </AnimatePresence>
    </div>
  );
}

function AddClientModal({ onClose, addClient }: { onClose: () => void; addClient: (c: Client) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [car, setCar] = useState('');
  const [carNum, setCarNum] = useState('');

  const handleSave = () => {
    if (!name || !phone) { toast.error('Укажите имя и телефон'); return; }
    addClient({
      id: `c${Date.now()}`, phone: `+7 ${phone}`, name, carBrand: car || 'Не указано',
      carNumber: carNum, totalVisits: 0, totalSpent: 0, lastVisitAt: '-', notes: '',
    });
    toast.success('Клиент добавлен');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div className="relative w-full lg:w-[440px] bg-white rounded-t-2xl lg:rounded-2xl overflow-hidden"
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}>
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-[#111827]" style={{ fontSize: '18px', fontWeight: 600 }}>Новый клиент</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F3F4F6]"><X className="w-5 h-5 text-[#6B7280]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Имя *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Алишер Б."
              className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:border-[#2D6BE4] focus:outline-none" style={{ fontSize: '14px' }} />
          </div>
          <div>
            <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Телефон *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" style={{ fontSize: '14px' }}>+7</span>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(701) 234-56-78"
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
            </div>
          </div>
          <div>
            <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Марка авто</label>
            <input value={car} onChange={e => setCar(e.target.value)} placeholder="Toyota Camry"
              className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
          </div>
          <div>
            <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Гос. номер</label>
            <input value={carNum} onChange={e => setCarNum(e.target.value)} placeholder="123ABC01"
              className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:outline-none" style={{ fontSize: '14px' }} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-[#E5E7EB] text-[#6B7280]" style={{ fontSize: '14px', fontWeight: 500 }}>Отмена</button>
            <button onClick={handleSave} className="flex-1 py-3 rounded-lg bg-[#2D6BE4] text-white" style={{ fontSize: '14px', fontWeight: 600 }}>Сохранить</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
