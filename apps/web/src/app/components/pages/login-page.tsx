import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { ApiError } from '../../lib/api';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('+7');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    setBusy(true);
    try {
      if (mode === 'login') {
        const u = await login(cleanPhone, password);
        navigate(u.role === 'superadmin' ? '/admin' : '/schedule');
      } else {
        if (!companyName.trim()) { toast.error('Укажите название компании'); return; }
        await register(companyName.trim(), cleanPhone, password, name.trim() || undefined);
        toast.success('Аккаунт создан! 14 дней Business-триала активированы');
        navigate('/onboarding');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Ошибка соединения');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center px-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#0D1F3C] flex items-center justify-center">
          <span className="text-white" style={{ fontSize: '18px', fontWeight: 700 }}>S</span>
        </div>
        <span className="text-[#0D1F3C]" style={{ fontSize: '28px', fontWeight: 700 }}>saba</span>
      </div>

      <div className="w-full max-w-[400px] bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
        <div className="flex rounded-lg bg-[#F3F4F6] p-1 mb-6">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-md transition-colors ${mode === m ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'}`}
              style={{ fontSize: '14px', fontWeight: 600 }}
            >
              {m === 'login' ? 'Вход' : 'Регистрация'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Название мойки *</label>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="AutoBliss Almaty"
                  className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:border-[#2D6BE4] focus:outline-none" style={{ fontSize: '14px' }} />
              </div>
              <div>
                <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Ваше имя</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Аслан"
                  className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:border-[#2D6BE4] focus:outline-none" style={{ fontSize: '14px' }} />
              </div>
            </>
          )}
          <div>
            <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Телефон *</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+77011234567"
              className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:border-[#2D6BE4] focus:outline-none" style={{ fontSize: '14px' }} />
          </div>
          <div>
            <label className="text-[#6B7280] block mb-1.5" style={{ fontSize: '12px', fontWeight: 500 }}>Пароль * {mode === 'register' && <span className="text-[#9CA3AF]">(мин. 8 символов)</span>}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-[#111827] focus:border-[#2D6BE4] focus:outline-none" style={{ fontSize: '14px' }} />
          </div>
          <button type="submit" disabled={busy}
            className="w-full py-3.5 rounded-lg bg-[#2D6BE4] text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ fontSize: '14px', fontWeight: 600 }}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? 'Войти' : 'Создать аккаунт — 14 дней бесплатно'}
          </button>
        </form>

        {mode === 'register' && (
          <p className="text-center text-[#9CA3AF] mt-4" style={{ fontSize: '12px' }}>
            Регистрируясь, вы получаете триал плана Business на 14 дней
          </p>
        )}
      </div>
    </div>
  );
}
