import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Phone, Car, MessageCircle, Edit3, Save, Check, X, Send } from 'lucide-react';
import { useStore } from '../../lib/store';
import { formatPrice, STATUS_LABELS, STATUS_COLORS } from '../../lib/mock-data';
import { toast } from 'sonner';

const WA_MESSAGES = [
  { id: 1, text: 'Здравствуйте! Напоминаем о записи сегодня в 13:00 — Мойка кузова. AutoBliss Almaty', sent: '11 апр 12:00', status: 'delivered' },
  { id: 2, text: 'Ваша запись подтверждена на 09:00, 10 апр. Ждём вас! AutoBliss Almaty', sent: '9 апр 18:00', status: 'read' },
  { id: 3, text: 'Спасибо за визит! Оцените качество обслуживания: saba.kz/review/ab123', sent: '9 апр 10:45', status: 'read' },
];

export function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, appointments, services, updateClient } = useStore();
  const client = clients.find(c => c.id === id);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(client?.notes || '');
  const [activeTab, setActiveTab] = useState<'visits' | 'wa'>('visits');

  if (!client) return (
    <div className="p-8 text-center">
      <p className="text-[#6B7280]" style={{ fontSize: '16px' }}>Клиент не найден</p>
      <button onClick={() => navigate('/clients')} className="mt-3 text-[#2D6BE4]" style={{ fontSize: '14px' }}>← Назад к списку</button>
    </div>
  );

  const clientAppointments = appointments.filter(a => a.clientId === client.id);
  const avgCheck = client.totalVisits > 0 ? Math.round(client.totalSpent / client.totalVisits) : 0;

  const handleSaveNotes = () => {
    updateClient(client.id, { notes });
    setEditingNotes(false);
    toast.success('Заметки сохранены');
  };

  return (
    <div className="p-4 lg:p-8 max-w-[800px] mx-auto">
      <button onClick={() => navigate('/clients')} className="flex items-center gap-2 text-[#6B7280] mb-4 hover:text-[#111827] transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span style={{ fontSize: '14px' }}>Клиенты</span>
      </button>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#EBF0F9] flex items-center justify-center shrink-0">
              <span className="text-[#1B4F8A]" style={{ fontSize: '20px', fontWeight: 700 }}>{client.name[0]}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[#111827]" style={{ fontSize: '20px', fontWeight: 700 }}>{client.name}</h1>
                {client.totalVisits >= 10 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706]" style={{ fontSize: '11px', fontWeight: 600 }}>VIP</span>
                )}
              </div>
              <p className="text-[#6B7280]" style={{ fontSize: '14px' }}>{client.phone}</p>
            </div>
          </div>
          <a href={`tel:${client.phone}`} className="p-3 rounded-xl bg-[#EBF0F9] hover:bg-[#D6E4FA] transition-colors">
            <Phone className="w-5 h-5 text-[#1B4F8A]" />
          </a>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-5 border-t border-[#E5E7EB]">
          {[
            { label: 'Визиты', value: client.totalVisits.toString(), big: true },
            { label: 'Потрачено', value: formatPrice(client.totalSpent), big: true },
            { label: 'Средний чек', value: formatPrice(avgCheck) },
            { label: 'С нами с', value: client.lastVisitAt },
          ].map(stat => (
            <div key={stat.label}>
              <p className="text-[#9CA3AF]" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>{stat.label}</p>
              <p className="text-[#111827] mt-0.5" style={{ fontSize: stat.big ? '18px' : '15px', fontWeight: 600 }}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Car Info */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center">
          <Car className="w-5 h-5 text-[#6B7280]" />
        </div>
        <div className="flex-1">
          <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{client.carBrand}</p>
          <p className="text-[#6B7280]" style={{ fontSize: '13px' }}>{client.carNumber || 'Номер не указан'}</p>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[#6B7280] uppercase" style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.05em' }}>Внутренние заметки</h3>
          {!editingNotes ? (
            <button onClick={() => setEditingNotes(true)} className="flex items-center gap-1 text-[#2D6BE4]" style={{ fontSize: '12px', fontWeight: 500 }}>
              <Edit3 className="w-3.5 h-3.5" /> Редактировать
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={handleSaveNotes} className="flex items-center gap-1 text-[#059669]" style={{ fontSize: '12px', fontWeight: 500 }}>
                <Save className="w-3.5 h-3.5" /> Сохранить
              </button>
              <button onClick={() => { setNotes(client.notes); setEditingNotes(false); }} className="ml-2 text-[#6B7280]" style={{ fontSize: '12px' }}>Отмена</button>
            </div>
          )}
        </div>
        {editingNotes ? (
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Заметки о клиенте (скрыто от клиента)..."
            className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:border-[#2D6BE4] focus:outline-none resize-none" style={{ fontSize: '14px' }} />
        ) : (
          <p className="text-[#111827]" style={{ fontSize: '14px' }}>{client.notes || <span className="text-[#9CA3AF]">Нет заметок</span>}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button onClick={() => setActiveTab('visits')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'visits' ? 'bg-[#0D1F3C] text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280]'}`}
          style={{ fontSize: '13px', fontWeight: 500 }}>
          История визитов ({clientAppointments.length})
        </button>
        <button onClick={() => setActiveTab('wa')}
          className={`px-4 py-2 rounded-lg flex items-center gap-1.5 ${activeTab === 'wa' ? 'bg-[#0D1F3C] text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280]'}`}
          style={{ fontSize: '13px', fontWeight: 500 }}>
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </button>
      </div>

      {activeTab === 'visits' ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          {clientAppointments.length === 0 ? (
            <div className="p-8 text-center text-[#9CA3AF]" style={{ fontSize: '14px' }}>Нет записей</div>
          ) : (
            <div>
              {clientAppointments.map(apt => {
                const svc = services.find(s => s.id === apt.serviceId);
                return (
                  <div key={apt.id} className="px-4 py-3 border-b border-[#F3F4F6] last:border-0 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-8 rounded-full" style={{ backgroundColor: STATUS_COLORS[apt.status] }} />
                      <div>
                        <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 500 }}>{svc?.name}</p>
                        <p className="text-[#6B7280]" style={{ fontSize: '12px' }}>{apt.startAt} – {apt.endAt} · {svc?.durationMin} мин</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[#111827]" style={{ fontSize: '14px', fontWeight: 600 }}>{formatPrice(apt.price)}</p>
                      <span className="inline-block px-2 py-0.5 rounded-full text-white mt-0.5"
                        style={{ fontSize: '10px', fontWeight: 600, backgroundColor: STATUS_COLORS[apt.status] }}>
                        {STATUS_LABELS[apt.status]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="p-3 border-b border-[#E5E7EB] flex items-center justify-between">
            <span className="text-[#6B7280]" style={{ fontSize: '13px' }}>{WA_MESSAGES.length} сообщений</span>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] text-white" style={{ fontSize: '12px', fontWeight: 500 }}>
              <Send className="w-3.5 h-3.5" /> Отправить
            </button>
          </div>
          {WA_MESSAGES.map(msg => (
            <div key={msg.id} className="px-4 py-3 border-b border-[#F3F4F6] last:border-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#6B7280]" style={{ fontSize: '12px' }}>{msg.sent}</span>
                <span className={`flex items-center gap-1 ${msg.status === 'read' ? 'text-[#3B82F6]' : 'text-[#9CA3AF]'}`} style={{ fontSize: '11px' }}>
                  {msg.status === 'read' ? <><Check className="w-3 h-3" /><Check className="w-3 h-3 -ml-2" /> Прочитано</> : <><Check className="w-3 h-3" /> Доставлено</>}
                </span>
              </div>
              <p className="text-[#111827] bg-[#ECFDF5] rounded-lg p-3" style={{ fontSize: '13px' }}>{msg.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
