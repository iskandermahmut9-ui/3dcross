import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { User, Phone, Send, Save, Loader2 } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 1. Прячем функцию внутрь эффекта и жестко привязываем к ID
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return; // Защита: нет ID - нет запроса

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('name, phone, telegram, role')
          .eq('id', user.id)
          .maybeSingle(); // 2. ОБЯЗАТЕЛЬНО maybeSingle, чтобы не было ошибки 406

        if (error) throw error;
        
        if (data) {
          setName(data.name || '');
          setPhone(data.phone || '');
          setTelegram(data.telegram || '');
        }
      } catch (error) {
        console.error('Ошибка загрузки профиля:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id]); // 3. Следим ТОЛЬКО за ID (текстом), а не за объектом!

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name, phone, telegram })
        .eq('id', user.id);

      if (error) throw error;
      alert('Профиль успешно обновлен!');
    } catch (error) {
      alert('Ошибка при сохранении: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0a0a0a', color: 'white', fontFamily: 'Manrope, sans-serif' }}>
      
      <Sidebar />

      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <h1 style={{ margin: '0 0 40px 0', fontWeight: '300', fontSize: '2rem' }}>Личный кабинет</h1>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#555' }}>
            <Loader2 size={20} style={{ animation: 'spin 2s linear infinite' }} /> Загрузка данных...
          </div>
        ) : (
          <div style={{ 
            maxWidth: '600px', 
            background: 'rgba(26, 26, 26, 0.4)', /* Умное стекло */
            backdropFilter: 'blur(12px)', 
            padding: '40px', /* Чуть увеличил отступы для "воздуха" */
            borderRadius: '16px', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' 
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.4rem', fontWeight: '600', color: '#fff', letterSpacing: '0.5px' }}>
              Основная информация
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Поле: Имя */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', marginBottom: '10px', fontSize: '0.85rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <User size={16} color="#00ff88" /> Имя или название студии
                </label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Например, Иван Иванов"
                  style={{ 
                    width: '100%', padding: '14px 16px', 
                    background: 'rgba(0, 0, 0, 0.3)', /* Темный полупрозрачный фон */
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '8px', color: 'white', boxSizing: 'border-box',
                    transition: 'all 0.2s ease', outline: 'none', fontSize: '1rem'
                  }} 
                  onFocus={(e) => { e.target.style.borderColor = '#00ff88'; e.target.style.background = 'rgba(0, 0, 0, 0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(0, 255, 136, 0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.target.style.background = 'rgba(0, 0, 0, 0.3)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {/* Поле: Телефон */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', marginBottom: '10px', fontSize: '0.85rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Phone size={16} color="#00ff88" /> Телефон
                </label>
                <input 
                  type="text" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="+7 (999) 000-00-00"
                  style={{ 
                    width: '100%', padding: '14px 16px', 
                    background: 'rgba(0, 0, 0, 0.3)', 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '8px', color: 'white', boxSizing: 'border-box',
                    transition: 'all 0.2s ease', outline: 'none', fontSize: '1rem'
                  }} 
                  onFocus={(e) => { e.target.style.borderColor = '#00ff88'; e.target.style.background = 'rgba(0, 0, 0, 0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(0, 255, 136, 0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.target.style.background = 'rgba(0, 0, 0, 0.3)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {/* Поле: Telegram */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', marginBottom: '10px', fontSize: '0.85rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Send size={16} color="#00ff88" /> Ник в Telegram
                </label>
                <input 
                  type="text" 
                  value={telegram} 
                  onChange={(e) => setTelegram(e.target.value)} 
                  placeholder="@username"
                  style={{ 
                    width: '100%', padding: '14px 16px', 
                    background: 'rgba(0, 0, 0, 0.3)', 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '8px', color: 'white', boxSizing: 'border-box',
                    transition: 'all 0.2s ease', outline: 'none', fontSize: '1rem'
                  }} 
                  onFocus={(e) => { e.target.style.borderColor = '#00ff88'; e.target.style.background = 'rgba(0, 0, 0, 0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(0, 255, 136, 0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.target.style.background = 'rgba(0, 0, 0, 0.3)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {/* Кнопка сохранения */}
              <div style={{ marginTop: '16px' }}>
                <button 
                  onClick={handleSave} 
                  disabled={saving}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '10px', 
                    background: '#00ff88', color: '#000', border: 'none', 
                    padding: '14px 28px', borderRadius: '8px', 
                    fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', 
                    opacity: saving ? 0.7 : 1, transition: 'all 0.2s ease',
                    boxShadow: '0 4px 15px rgba(0, 255, 136, 0.2)'
                  }}
                  onMouseEnter={(e) => { if(!saving) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 255, 136, 0.4)'; } }}
                  onMouseLeave={(e) => { if(!saving) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 255, 136, 0.2)'; } }}
                >
                  {saving ? <Loader2 size={20} style={{ animation: 'spin 2s linear infinite' }} /> : <Save size={20} />}
                  {saving ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}