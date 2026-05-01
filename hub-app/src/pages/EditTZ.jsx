import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, Save, ArrowLeft, Type, Image as ImageIcon, Link as LinkIcon, Palette } from 'lucide-react';

export default function EditTZ() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [tzData, setTzData] = useState({ blocks: [] });
  const [isSaving, setIsSaving] = useState(false);

  // Загружаем существующее ТЗ
  useEffect(() => {
    const fetchTZ = async () => {
      const { data } = await supabase.from('rooms').select('tz_data').eq('id', roomId).single();
      if (data?.tz_data) setTzData(data.tz_data);
    };
    fetchTZ();
  }, [roomId]);

  // Добавление нового блока
  const addBlock = (type) => {
    const newBlock = {
      id: Date.now(),
      type: type,
      content: type === 'colors' ? [] : type === 'images' ? [] : ''
    };
    setTzData({ ...tzData, blocks: [...tzData.blocks, newBlock] });
  };

  // Удаление блока
  const removeBlock = (id) => {
    setTzData({ ...tzData, blocks: tzData.blocks.filter(b => b.id !== id) });
  };

  // Изменение контента блока
  const updateBlock = (id, newContent) => {
    setTzData({
      ...tzData,
      blocks: tzData.blocks.map(b => b.id === id ? { ...b, content: newContent } : b)
    });
  };

  // Сохранение в базу
  const handleSave = async () => {
    setIsSaving(true);
    await supabase.from('rooms').update({ tz_data: tzData }).eq('id', roomId);
    setIsSaving(false);
    alert('ТЗ сохранено');
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <ArrowLeft size={18} /> Назад
        </button>
        <h2>Конструктор ТЗ</h2>
        <button onClick={handleSave} disabled={isSaving} style={{ background: '#00ff88', color: '#000', padding: '10px 20px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Save size={18} /> {isSaving ? 'Сохранение...' : 'Сохранить ТЗ'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {tzData.blocks.map((block) => (
          <div key={block.id} style={{ background: '#1a1a1a', padding: '20px', borderRadius: '12px', border: '1px solid #333', position: 'relative' }}>
            <button onClick={() => removeBlock(block.id)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}>
              <Trash2 size={18} />
            </button>

            {/* Тип: ТЕКСТ */}
            {block.type === 'text' && (
              <textarea
                placeholder="Напишите пожелания или описание..."
                value={block.content}
                onChange={(e) => updateBlock(block.id, e.target.value)}
                style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', resize: 'vertical', minHeight: '100px', outline: 'none' }}
              />
            )}

            {/* Тип: ССЫЛКА */}
            {block.type === 'link' && (
              <input
                type="text"
                placeholder="Вставьте ссылку на модель или магазин..."
                value={block.content}
                onChange={(e) => updateBlock(block.id, e.target.value)}
                style={{ width: '100%', background: 'transparent', border: 'none', color: '#00ff88', textDecoration: 'underline', outline: 'none' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ПАНЕЛЬ ДОБАВЛЕНИЯ БЛОКОВ */}
      <div style={{ marginTop: '30px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={() => addBlock('text')} style={addBtnStyle}><Type size={18} /> Текст</button>
        <button onClick={() => addBlock('link')} style={addBtnStyle}><LinkIcon size={18} /> Ссылка</button>
        <button onClick={() => addBlock('images')} style={addBtnStyle}><ImageIcon size={18} /> Галерея</button>
        <button onClick={() => addBlock('colors')} style={addBtnStyle}><Palette size={18} /> Цвета</button>
      </div>
    </div>
  );
}

const addBtnStyle = {
  background: '#222', color: '#aaa', border: '1px solid #333', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem'
};