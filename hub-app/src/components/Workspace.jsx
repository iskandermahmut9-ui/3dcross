import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Pencil, MousePointer2, Trash2, ArrowLeft, Upload, Loader2, FileText, Image as ImageIcon, Save, Link as LinkIcon, Plus, X, ImagePlus, FileArchive, Maximize2, Download, Check, ArrowLeftRight, MessageCircle, Send, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import CanvasViewer from './CanvasViewer';
import { supabase } from '../supabaseClient';

export default function Workspace() {
  
  const navigate = useNavigate();
  const { roomId } = useParams(); 
  const isSendingRef = useRef(false);
  
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tz'); 

  const [roomData, setRoomData] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [designerData, setDesignerData] = useState(null);

  const [activeTool, setActiveTool] = useState('cursor');
  
  const [renders, setRenders] = useState([]); 
  const [activeRender, setActiveRender] = useState(null); 
  const [activeVersion, setActiveVersion] = useState(1);
  const [comments, setComments] = useState([]); 

  const [uploadedImage, setUploadedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [userRole, setUserRole] = useState(null); 
  const isDesigner = userRole !== 'admin'; 

  const [tzDescription, setTzDescription] = useState('');
  const [tzLinks, setTzLinks] = useState([]);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [tzImages, setTzImages] = useState([]);
  const [isUploadingTz, setIsUploadingTz] = useState(false);
  const [isDraggingTz, setIsDraggingTz] = useState(false);
  const [tzFiles, setTzFiles] = useState([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  
  const [saveStatus, setSaveStatus] = useState('idle');
  const isFirstRender = useRef(true);

  // СТЕЙТЫ ДЛЯ ШТОРКИ
  const [isComparing, setIsComparing] = useState(false);
  const [compareLeft, setCompareLeft] = useState(null);
  const [compareRight, setCompareRight] = useState(null);
  const [sliderPos, setSliderPos] = useState(50); 

  // ==========================================
  // 🟢 СТЕЙТЫ И ЛОГИКА ДЛЯ ЧАТА
  // ==========================================
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // 🟢 Новые переменные для уведомлений
  const [unreadCount, setUnreadCount] = useState(0);
  const isChatOpenRef = useRef(isChatOpen);

  // Синхронизируем Ref и сбрасываем счетчик, когда чат открывают
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  // Автоскролл чата вниз при новых сообщениях
  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  // 🟢 Загрузка сообщений и "фейковый Realtime" (Поллинг)
  useEffect(() => {
    if (!projectData?.id) return;

    let isFirstLoad = true; 
    let localMessageCount = 0; 

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', projectData.id)
        .order('created_at', { ascending: true });
        
      if (data) {
        // 🛑 ЗАЩИТА: Если мы прямо сейчас отправляем сообщение, запрещаем таймеру затирать чат!
        if (isSendingRef.current) return;

        if (isFirstLoad) {
          isFirstLoad = false;
          localMessageCount = data.length;
          setChatMessages(data);
          return;
        }

        if (!isChatOpenRef.current && data.length > localMessageCount) {
          const diff = data.length - localMessageCount;
          setUnreadCount(prev => prev + diff);
        }

        localMessageCount = data.length;
        setChatMessages(data);
      }
    };

    fetchMessages();
    const channelInterval = setInterval(fetchMessages, 3000);
    return () => clearInterval(channelInterval);
  }, [projectData?.id]);

  // 🟢 Отправка сообщений (с блокировкой таймера)
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !projectData?.id) return;
    const authorName = userRole === 'admin' ? 'Визуализатор' : 'Дизайнер';
    const msgText = newMessage.trim();

    try {
      isSendingRef.current = true; // 🔴 1. Ставим фоновое обновление на паузу
      setNewMessage(''); // Мгновенно очищаем поле ввода

      // Мгновенно рисуем у себя
      const optimisticMsg = {
        id: `temp-${Date.now()}`, 
        project_id: projectData.id,
        author: authorName,
        text: msgText,
        room_title: roomData?.title || 'Общее',
        created_at: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, optimisticMsg]);

      // Отправляем в базу
      await supabase.from('messages').insert([{
        project_id: projectData.id,
        author: authorName,
        text: msgText,
        room_title: roomData?.title || 'Общее' 
      }]);

      // 🔴 2. Сами принудительно запрашиваем свежий чат с настоящими ID из базы
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', projectData.id)
        .order('created_at', { ascending: true });

      if (data) setChatMessages(data);

    } finally {
      isSendingRef.current = false; // 🔴 3. Снимаем таймер с паузы в любом случае
    }
  };
  // 🟢 Поллинг для обновления итераций (вместо сломанных сокетов)
  useEffect(() => {
    if (!roomId) return;

    // Функция, которая тихо запрашивает свежие рендеры у базы
    const fetchIterationsUpdates = async () => {
      const { data } = await supabase
        .from('iterations')
        .select('*')
        .eq('room_id', roomId); // Если там была какая-то хитрая сортировка, добавь её сюда

      if (data) {
        setRenders(data);
        
        // Если обновился статус именно того рендера, на который мы сейчас смотрим — меняем и его
        setActiveRender(prevActive => {
          if (!prevActive) return null;
          return data.find(r => r.id === prevActive.id) || prevActive;
        });
      }
    };

    // Опрашиваем базу каждые 3 секунды
    const interval = setInterval(fetchIterationsUpdates, 3000);

    return () => clearInterval(interval);
  }, [roomId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsInitialLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (user.email === '3d_cross@mail.ru') setUserRole('admin');
          else setUserRole('designer');
        }

        if (!roomId) return;
        let currentRoom = null;

        const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
        if (room) {
          currentRoom = room;
          setRoomData(room);
          if (room.tz_data) {
            setTzDescription(room.tz_data.description || '');
            setTzImages(room.tz_data.images || []);
            setTzFiles(room.tz_data.files || []);
            const loadedLinks = room.tz_data.links || [];
            setTzLinks(loadedLinks.map(l => typeof l === 'string' ? { url: l, title: 'Ссылка' } : l));
          }

          const { data: proj } = await supabase.from('projects').select('*').eq('id', room.project_id).single();
          if (proj) {
            setProjectData(proj);
            const { data: des } = await supabase.from('profiles').select('*').eq('id', proj.designer_id).single();
            if (des) setDesignerData(des);
          }
        }

        const { data: allRenders } = await supabase.from('iterations').select('*').eq('room_id', roomId).order('created_at', { ascending: true }); 
        
        if (allRenders && allRenders.length > 0) {
          setRenders(allRenders);
          const latestRender = allRenders[allRenders.length - 1];
          setActiveVersion(latestRender.version);
          setActiveRender(latestRender);
          setUploadedImage(latestRender.image_url);
          const { data: comms } = await supabase.from('comments').select('*').eq('iteration_id', latestRender.id).order('number', { ascending: true });
          setComments(comms || []);
          if (currentRoom && !currentRoom.is_general) setActiveTab('renders');
        } else {
          setActiveTab('tz');
        }
      } catch (error) {
        console.error('Ошибка загрузки:', error.message);
      } finally {
        setIsInitialLoading(false);
      }
    };
    fetchData();
  }, [roomId]);

  const handleSaveTz = async (isAutoSave = false) => {
    setSaveStatus('saving');
    try {
      const newTzData = { description: tzDescription, links: tzLinks, images: tzImages, files: tzFiles };
      const { error } = await supabase.from('rooms').update({ tz_data: newTzData }).eq('id', roomId);
      if (error) throw error;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000); 
      if (!isAutoSave) alert('ТЗ успешно сохранено!');
    } catch (error) { 
      setSaveStatus('idle');
      if (!isAutoSave) alert('Ошибка при сохранении: ' + error.message); 
    }
  };

  useEffect(() => {
    if (isInitialLoading) return;
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const timer = setTimeout(() => { handleSaveTz(true); }, 1500);
    return () => clearTimeout(timer);
  }, [tzDescription, tzLinks, tzImages, tzFiles]); 

  const uploadToCloud = async (filesArray) => {
    try {
      setIsUploading(true);
      const newRenders = [];
      for (const file of filesArray) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `projects/${fileName}`; 
        const { error: uploadError } = await supabase.storage.from('renders').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('renders').getPublicUrl(filePath);
        const { data: newRender, error: iterError } = await supabase.from('iterations').insert([{ room_id: roomId, version: activeVersion, image_url: publicUrlData.publicUrl, status: 'Ждет проверки' }]).select().single();
        if (iterError) throw iterError;
        newRenders.push(newRender);
      }
      setRenders([...renders, ...newRenders]);
      const lastRender = newRenders[newRenders.length - 1];
      if (lastRender) { setActiveRender(lastRender); setUploadedImage(lastRender.image_url); setComments([]); }
    } catch (error) { alert('Ошибка загрузки: ' + error.message); } 
    finally { setIsUploading(false); }
  };

  const handleCreateNewIteration = () => { const maxVersion = renders.length > 0 ? Math.max(...renders.map(r => r.version)) : 0; setActiveVersion(maxVersion + 1); setActiveRender(null); setUploadedImage(null); setComments([]); };
  const handleSelectRender = async (render) => { setActiveRender(render); setUploadedImage(render.image_url); setActiveTool('cursor'); const { data: comms } = await supabase.from('comments').select('*').eq('iteration_id', render.id).order('number', { ascending: true }); setComments(comms || []); };
  const handleFileUpload = (e) => { const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/')); if (files.length > 0) uploadToCloud(files); };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); if (files.length > 0) uploadToCloud(files); };
  
  const handleAddPin = async (coords) => { 
    if (!activeRender) return; 
    
    // 🟢 Блокировка: если утверждено, запрещаем ставить пины
    if (activeRender.status === 'Утверждено') {
      alert('Этот ракурс уже утвержден. Добавление новых правок заблокировано.');
      return;
    }

    const authorName = userRole === 'admin' ? 'Визуализатор' : 'Дизайнер';
    const { data: newComment, error } = await supabase.from('comments').insert([{ iteration_id: activeRender.id, pos_x: coords.x, pos_y: coords.y, number: comments.length + 1, text: '', author: authorName }]).select().single(); 
    if (!error) { setComments([...comments, newComment]); setActiveTool('cursor'); } 
  };
  
  const handleTextChange = (id, newText) => setComments(comments.map(c => c.id === id ? { ...c, text: newText } : c));
  const handleTextSave = async (id, finalString) => await supabase.from('comments').update({ text: finalString }).eq('id', id);
  const handleSaveLines = async (newLines) => { if (!activeRender) return; const { error } = await supabase.from('iterations').update({ lines: newLines }).eq('id', activeRender.id); if (!error) { setRenders(prev => prev.map(r => r.id === activeRender.id ? { ...r, lines: newLines } : r)); setActiveRender(prev => ({ ...prev, lines: newLines })); } };
  // Функция переключения статуса правки (Выполнено / Не выполнено)
  const handleToggleResolve = async (id, currentStatus) => {
    // Меняем статус локально для скорости
    setComments(comments.map(c => c.id === id ? { ...c, is_resolved: !currentStatus } : c));
    // Отправляем изменения в базу
    await supabase.from('comments').update({ is_resolved: !currentStatus }).eq('id', id);
  };
  // Функция утверждения итерации (Approve)
  const handleApproveRender = async () => {
    if (!activeRender) return;
    
    // Спрашиваем подтверждение, так как действие серьезное
    const confirmApprove = window.confirm('Вы уверены, что хотите утвердить этот ракурс? После этого добавление новых правок будет заблокировано.');
    
    if (confirmApprove) {
      try {
        // 1. Обновляем статус в базе
        const { error } = await supabase.from('iterations').update({ status: 'Утверждено' }).eq('id', activeRender.id);
        if (error) throw error;

        // 2. Обновляем статус локально
        setRenders(prev => prev.map(r => r.id === activeRender.id ? { ...r, status: 'Утверждено' } : r));
        setActiveRender(prev => ({ ...prev, status: 'Утверждено' }));
        
        // Переключаем инструмент на курсор (чтобы случайно не тыкнуть пин)
        setActiveTool('cursor');
        
      } catch (err) {
        alert('Ошибка при утверждении: ' + err.message);
      }
    }
  };
  const handleDeleteComment = async (id) => { try { await supabase.from('comments').delete().eq('id', id); const filtered = comments.filter(c => c.id !== id); const renumbered = filtered.map((c, index) => ({ ...c, number: index + 1 })); setComments(renumbered); for (const comment of renumbered) { await supabase.from('comments').update({ number: comment.number }).eq('id', comment.id); } } catch (error) { alert('Не удалось удалить правку.'); } };

  const handleDownloadCleanImage = async () => {
    if (!uploadedImage || !activeRender) return;
    const rendersInVersion = renders.filter(r => r.version === activeVersion);
    const renderIndex = rendersInVersion.findIndex(r => r.id === activeRender.id) + 1;
    const safeProjectName = (projectData?.title || 'Проект').replace(/\s+/g, '_');
    const safeRoomName = (roomData?.title || 'Помещение').replace(/\s+/g, '_');
    const fileName = `${safeProjectName}_${safeRoomName}_${activeVersion}_${renderIndex}.jpg`;

    try {
      const response = await fetch(uploadedImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName; 
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      window.open(uploadedImage, '_blank');
    }
  };
  // 🟢 1. Функция удаления ОДНОГО ракурса
  const handleDeleteRender = async () => {
    if (!activeRender) return;
    if (!window.confirm('Точно удалить этот ракурс?')) return;

    // Удаляем из базы
    await supabase.from('iterations').delete().eq('id', activeRender.id);

    // Убираем из стейта на экране
    const updatedRenders = renders.filter(r => r.id !== activeRender.id);
    setRenders(updatedRenders);

    // Пытаемся переключиться на соседний ракурс в этой же итерации
    const nextRender = updatedRenders.find(r => r.version === activeVersion);
    if (nextRender) {
      handleSelectRender(nextRender);
    } else {
      // Если это был последний ракурс - очищаем экран
      setActiveRender(null);
      setUploadedImage(null);
    }
  };

  // 🟢 2. Функция удаления ВСЕЙ итерации
  const handleDeleteIteration = async (versionToDelete) => {
    if (!window.confirm(`Точно удалить всю Итерацию ${versionToDelete}? Это удалит все ракурсы внутри неё.`)) return;

    // Удаляем из базы все ракурсы с этой версией для этой комнаты
    await supabase.from('iterations').delete().eq('room_id', roomId).eq('version', versionToDelete);

    // Убираем из стейта
    const updatedRenders = renders.filter(r => r.version !== versionToDelete);
    setRenders(updatedRenders);

    // Если мы удалили ту итерацию, на которой сейчас находились, переключаемся на предыдущую
    if (activeVersion === versionToDelete) {
      // Ищем какие версии еще остались
      const remainingVersions = Array.from(new Set(updatedRenders.map(r => r.version))).sort((a, b) => b - a);
      if (remainingVersions.length > 0) {
        const newVersion = remainingVersions[0]; // Берем самую свежую из оставшихся
        setActiveVersion(newVersion);
        const nextRender = updatedRenders.find(r => r.version === newVersion);
        handleSelectRender(nextRender || null);
      } else {
        // Если вообще ничего не осталось
        setActiveVersion(1);
        setActiveRender(null);
        setUploadedImage(null);
      }
    }
  };

  const handleStartCompare = () => {
    if (renders.length < 2) {
      alert('Для сравнения необходимо загрузить хотя бы два рендера!');
      return;
    }
    const rendersInCurrent = renders.filter(r => r.version === activeRender.version);
    const currentIndex = rendersInCurrent.findIndex(r => r.id === activeRender.id);
    const prevVersion = activeRender.version > 1 ? activeRender.version - 1 : activeRender.version;
    const rendersInPrev = renders.filter(r => r.version === prevVersion);
    const autoLeftRender = rendersInPrev[currentIndex] || rendersInPrev[0] || renders[0];
    setCompareLeft(autoLeftRender);
    setCompareRight(activeRender);
    setSliderPos(50);
    setIsComparing(true);
  };

  const getRenderName = (render) => {
    if (!render) return '';
    const rendersInVersion = renders.filter(r => r.version === render.version);
    const index = rendersInVersion.findIndex(r => r.id === render.id) + 1;
    return `Итерация ${render.version} - Ракурс ${index}`;
  };

  const handleAddLink = () => { if (!newLinkUrl.trim()) return; setTzLinks([...tzLinks, { url: newLinkUrl.trim(), title: newLinkTitle.trim() || 'Ссылка без названия' }]); setNewLinkUrl(''); setNewLinkTitle(''); };
  const handleRemoveLink = (idx) => setTzLinks(tzLinks.filter((_, i) => i !== idx));
  const processTzImages = async (files) => {
    try {
      setIsUploadingTz(true);
      const newImages = [];
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `tz-img-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `projects/${fileName}`; 
        const { error: uploadError } = await supabase.storage.from('renders').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('renders').getPublicUrl(filePath);
        newImages.push({ url: publicUrlData.publicUrl, note: '' });
      }
      setTzImages(prev => [...prev, ...newImages]);
    } catch (error) {
      if (error.message === 'Failed to fetch') alert('Ошибка сети. Провайдер блокирует загрузку, включите VPN.');
      else alert('Ошибка при загрузке картинки: ' + error.message);
    } finally { setIsUploadingTz(false); }
  };
  const handleTzImageUpload = (e) => { const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/')); if (files.length > 0) processTzImages(files); };
  const handleTzDragOver = (e) => { e.preventDefault(); setIsDraggingTz(true); };
  const handleTzDragLeave = (e) => { e.preventDefault(); setIsDraggingTz(false); };
  const handleTzDrop = (e) => { e.preventDefault(); setIsDraggingTz(false); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); if (files.length > 0) processTzImages(files); };
  const handleUpdateImageNote = (index, newNote) => { const updatedImages = [...tzImages]; updatedImages[index].note = newNote; setTzImages(updatedImages); };
  const handleRemoveTzImage = (idx) => setTzImages(tzImages.filter((_, i) => i !== idx));

  const processTzFiles = async (files) => {
    try {
      setIsUploadingFiles(true);
      const newFiles = [];
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `tz-file-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `projects/${fileName}`; 
        const { error: uploadError } = await supabase.storage.from('renders').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('renders').getPublicUrl(filePath);
        newFiles.push({ url: publicUrlData.publicUrl, name: file.name, size: (file.size / 1024 / 1024).toFixed(2) });
      }
      setTzFiles(prev => [...prev, ...newFiles]);
    } catch (error) {
      alert('Ошибка при загрузке файла: ' + error.message);
    } finally { setIsUploadingFiles(false); }
  };
  const handleTzFilesUpload = (e) => { const files = Array.from(e.target.files); if (files.length > 0) processTzFiles(files); };
  const handleFilesDragOver = (e) => { e.preventDefault(); setIsDraggingFiles(true); };
  const handleFilesDragLeave = (e) => { e.preventDefault(); setIsDraggingFiles(false); };
  const handleFilesDrop = (e) => { e.preventDefault(); setIsDraggingFiles(false); const files = Array.from(e.dataTransfer.files); if (files.length > 0) processTzFiles(files); };
  const handleRemoveTzFile = (idx) => setTzFiles(tzFiles.filter((_, i) => i !== idx));

  const getBtnStyle = (toolName) => ({ background: activeTool === toolName ? '#333' : 'transparent', border: 'none', color: activeTool === toolName ? '#fff' : '#888', cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: '0.2s' });

  if (isInitialLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0a0a0a', color: 'white', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={48} color="#00ff88" style={{ animation: 'spin 1.5s linear infinite', marginBottom: '20px' }} />
        <h2 style={{ fontWeight: '400', color: '#aaa', margin: 0 }}>Входим в комнату...</h2>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0a0a0a', color: 'white', fontFamily: 'Manrope, sans-serif', overflow: 'hidden' }}>
      
      {/* ==========================================
          🟢 ВЫЕЗЖАЮЩАЯ ПАНЕЛЬ ЧАТА
          ========================================== */}
      <div style={{
        position: 'fixed', top: 0, right: isChatOpen ? 0 : '-400px', width: '400px', height: '100vh',
        background: '#161616', borderLeft: '1px solid #333', zIndex: 9999, transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column', boxShadow: isChatOpen ? '-5px 0 30px rgba(0,0,0,0.6)' : 'none'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem' }}>
            <MessageCircle size={22} color="#00ff88" /> 
            Обсуждение проекта
          </h3>
          <button onClick={() => setIsChatOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {chatMessages.map(msg => {
            const isMe = (userRole === 'admin' && msg.author === 'Визуализатор') || (userRole === 'designer' && msg.author === 'Дизайнер');
            
            // 🟢 Форматируем время в красивый вид (например: 14:35)
            const timeString = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                 
                 {/* Шапка сообщения: Имя + Тэг комнаты */}
                 <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '6px' }}>
                    {isMe && msg.room_title && (
                      <span style={{ background: '#222', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', color: '#aaa', border: '1px solid #333', whiteSpace: 'nowrap' }}>
                        {msg.room_title}
                      </span>
                    )}
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>{msg.author}</span>
                    {!isMe && msg.room_title && (
                      <span style={{ background: '#222', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', color: '#aaa', border: '1px solid #333', whiteSpace: 'nowrap' }}>
                        {msg.room_title}
                      </span>
                    )}
                 </div>

                 {/* Текст сообщения */}
                 <div style={{ 
                    background: isMe ? '#00ff88' : '#222', 
                    color: isMe ? '#000' : '#fff', 
                    padding: '12px 16px', 
                    borderRadius: '12px', 
                    borderBottomRightRadius: isMe ? '2px' : '12px', 
                    borderBottomLeftRadius: isMe ? '12px' : '2px',
                    fontSize: '0.95rem',
                    lineHeight: '1.4'
                 }}>
                    {msg.text}
                 </div>

                 {/* Время под сообщением */}
                 <div style={{ fontSize: '0.7rem', color: '#555', marginTop: '4px', textAlign: isMe ? 'right' : 'left' }}>
                    {timeString}
                 </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid #333', background: '#111', display: 'flex', gap: '10px' }}>
          <input 
            type="text" value={newMessage} onChange={(e)=>setNewMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} 
            placeholder="Написать сообщение..." 
            style={{ flex: 1, background: '#222', border: '1px solid #444', color: '#fff', padding: '12px 15px', borderRadius: '8px', outline: 'none', fontSize: '0.95rem' }} 
          />
          <button onClick={handleSendMessage} style={{ background: '#00ff88', color: '#000', border: 'none', width: '45px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}>
            <Send size={20} />
          </button>
        </div>
      </div>
      {/* ========================================== */}


      {viewingImage && (
        <div onClick={() => setViewingImage(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={viewingImage} alt="Fullscreen View" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
          <button style={{ position: 'absolute', top: '30px', right: '30px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s' }}><X size={24} /></button>
        </div>
      )}

      {/* ШАПКА */}
      <div style={{ padding: '15px 20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a0a', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
          <button onClick={() => navigate(projectData ? `/project/${projectData.id}` : '/')} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '5px' }}><ArrowLeft size={20} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '0.9rem' }}>
            {!isDesigner && designerData && (<><span style={{ cursor: 'pointer', color: '#888' }}>{designerData.name}</span><span>/</span></>)}
            {projectData && (<><span style={{ cursor: 'pointer', color: '#888' }}>{projectData.title}</span><span>/</span></>)}
            {roomData && (<span style={{ fontWeight: '600', color: '#fff' }}>{roomData.title}</span>)}
          </div>
        </div>

        {!roomData?.is_general && (
          <div style={{ display: 'flex', background: '#1a1a1a', padding: '4px', borderRadius: '8px', border: '1px solid #333' }}>
            <button onClick={() => setActiveTab('tz')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', borderRadius: '6px', background: activeTab === 'tz' ? '#333' : 'transparent', color: activeTab === 'tz' ? '#fff' : '#888', border: 'none', cursor: 'pointer', fontWeight: '500', transition: '0.2s', fontSize: '0.9rem' }}><FileText size={16} /> Локальное ТЗ</button>
            <button onClick={() => setActiveTab('renders')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', borderRadius: '6px', background: activeTab === 'renders' ? '#333' : 'transparent', color: activeTab === 'renders' ? '#fff' : '#888', border: 'none', cursor: 'pointer', fontWeight: '500', transition: '0.2s', fontSize: '0.9rem' }}><ImageIcon size={16} /> Рендеры и правки</button>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '15px', alignItems: 'center' }}>
          {activeTab === 'tz' && (
            <button onClick={() => handleSaveTz(false)} disabled={saveStatus === 'saving'} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: saveStatus === 'saved' ? '#00ff88' : '#fff', color: '#000', border: 'none', borderRadius: '4px', cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 'bold', transition: '0.3s' }}>
              {saveStatus === 'saving' && <Loader2 size={16} style={{ animation: 'spin 2s linear infinite' }} />}
              {saveStatus === 'saved' && <Check size={16} />}
              {saveStatus === 'idle' && <Save size={16} />}
              {saveStatus === 'saving' && 'Сохранение...'}
              {saveStatus === 'saved' && 'Сохранено'}
              {saveStatus === 'idle' && 'Сохранить ТЗ'}
            </button>
          )}

          {activeTab === 'renders' && !isDesigner && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: isUploading ? '#111' : '#222', color: isUploading ? '#555' : 'white', border: '1px solid #444', borderRadius: '4px', cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
              {isUploading ? <Loader2 size={16} style={{ animation: 'spin 2s linear infinite' }} /> : <Upload size={16} />} Загрузить рендер
              <input type="file" multiple hidden onChange={handleFileUpload} accept="image/*" disabled={isUploading} />
            </label>
          )}

          {/* 🟢 КНОПКА ОТКРЫТИЯ ЧАТА (С уведомлениями) */}
          <button 
            onClick={() => {
              setIsChatOpen(!isChatOpen); // Открываем/закрываем чат
              setUnreadCount(0);          // 🔴 Сбрасываем красный бейдж!
            }} 
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: isChatOpen ? '#333' : '#1a1a1a', color: '#00ff88', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', transition: '0.2s' }}
          >
            <MessageCircle size={18} /> Чат проекта
            
            {/* Красный кружочек с цифрой (показывается только если больше 0) */}
            {unreadCount > 0 && (
              <span style={{ 
                position: 'absolute', top: '-8px', right: '-8px', 
                background: '#ff0044', color: '#fff', fontSize: '11px', fontWeight: 'bold', 
                minWidth: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                borderRadius: '10px', border: '2px solid #0a0a0a', boxShadow: '0 2px 5px rgba(255,0,68,0.4)' 
              }}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* РАБОЧАЯ ОБЛАСТЬ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {isComparing && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#0a0a0a', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: '#111', borderBottom: '1px solid #333' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ color: '#888', fontWeight: 'bold', fontSize: '0.9rem' }}>БЫЛО:</span>
                <select value={compareLeft?.id || ''} onChange={(e) => setCompareLeft(renders.find(r => r.id === e.target.value))} style={{ background: '#222', color: '#fff', border: '1px solid #444', padding: '8px 12px', borderRadius: '6px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {renders.map(r => <option key={`left-${r.id}`} value={r.id}>{getRenderName(r)}</option>)}
                </select>
              </div>
              <button onClick={() => setIsComparing(false)} style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', transition: '0.2s' }}><X size={18} /> Закрыть сравнение</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '0.9rem' }}>СТАЛО:</span>
                <select value={compareRight?.id || ''} onChange={(e) => setCompareRight(renders.find(r => r.id === e.target.value))} style={{ background: '#222', color: '#fff', border: '1px solid #444', padding: '8px 12px', borderRadius: '6px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {renders.map(r => <option key={`right-${r.id}`} value={r.id}>{getRenderName(r)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {compareRight && <img src={compareRight.image_url} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} alt="After" />}
              {compareLeft && <img src={compareLeft.image_url} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }} alt="Before" />}
              <input type="range" min="0" max="100" value={sliderPos} onChange={(e) => setSliderPos(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize', zIndex: 10 }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`, width: '2px', background: '#00ff88', pointerEvents: 'none', zIndex: 5 }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '40px', height: '40px', background: '#00ff88', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
                  <ArrowLeftRight size={20} color="#000" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tz' ? (
          
          <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
            <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '30px' }}>
              <div style={{ flex: '1 1 600px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
                <div style={{ background: '#111', padding: '25px', borderRadius: '12px', border: '1px solid #333' }}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}><FileText size={20} color="#00ff88" /> Базовое описание</h3>
                  <textarea placeholder="Подробно опишите задачу..." value={tzDescription} onChange={(e) => setTzDescription(e.target.value)} style={{ width: '100%', padding: '15px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px', color: 'white', boxSizing: 'border-box', minHeight: '400px', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: '1.6' }} />
                </div>
                <div onDragOver={handleFilesDragOver} onDragLeave={handleFilesDragLeave} onDrop={handleFilesDrop} style={{ background: '#111', padding: '25px', borderRadius: '12px', border: isDraggingFiles ? '2px dashed #00ff88' : '1px solid #333', transition: '0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}><FileArchive size={20} color="#00ff88" /> Чертежи и документы</h3>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: isUploadingFiles ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
                      {isUploadingFiles ? <Loader2 size={16} style={{ animation: 'spin 2s linear infinite' }} /> : <Plus size={16} />} Загрузить файл
                      <input type="file" multiple hidden onChange={handleTzFilesUpload} disabled={isUploadingFiles} />
                    </label>
                  </div>
                  {isUploadingFiles ? ( <div style={{ padding: '30px', textAlign: 'center', color: '#00ff88' }}><Loader2 size={32} style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 10px' }} /><p style={{ margin: 0 }}>Загружаем файлы...</p></div> ) : tzFiles.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {tzFiles.map((file, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1a1a', padding: '12px 15px', borderRadius: '8px', border: '1px solid #333' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                            <FileArchive size={24} color="#aaa" style={{ flexShrink: 0 }} />
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{file.name}</div>
                              <div style={{ fontSize: '0.8rem', color: '#666' }}>{file.size} MB</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                            <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ background: '#222', color: '#fff', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}><Download size={14} /></a>
                            <button onClick={() => handleRemoveTzFile(idx)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}><Trash2 size={18} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : ( <div style={{ padding: '30px', textAlign: 'center', border: '2px dashed #222', borderRadius: '8px', color: '#555', backgroundColor: isDraggingFiles ? 'rgba(0, 255, 136, 0.05)' : 'transparent' }}><p style={{ margin: 0, fontSize: '0.95rem', color: isDraggingFiles ? '#00ff88' : '#666' }}>Перетащите сюда PDF, DWG или архивы</p></div> )}
                </div>
                <div style={{ background: '#111', padding: '25px', borderRadius: '12px', border: '1px solid #333' }}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <LinkIcon size={20} color="#00ff88" /> Спецификация ссылок
                  </h3>
                  
                  {/* 🟢 НОВЫЙ БЛОК: База моделей (быстрые ссылки) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', color: '#888', marginRight: '5px' }}>Базы моделей:</span>
                    {[
                      { name: '3ddd', url: 'https://3ddd.ru/' },
                      { name: 'CGKit', url: 'https://cgkit.pro/catalog/producers' }
                    ].map(site => (
                      <a 
                        key={site.name} 
                        href={site.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ background: '#1a1a1a', border: '1px solid #444', padding: '6px 12px', borderRadius: '6px', color: '#00ff88', textDecoration: 'none', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500', transition: '0.2s' }}
                      >
                        {site.name} <ExternalLink size={14} />
                      </a>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                    <input type="text" placeholder="Название (напр: Стул)" value={newLinkTitle} onChange={(e) => setNewLinkTitle(e.target.value)} style={{ flex: '1 1 150px', padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px', color: 'white', boxSizing: 'border-box' }} />
                    <input type="text" placeholder="URL ссылка (https://...)" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddLink()} style={{ flex: '2 1 200px', padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px', color: 'white', boxSizing: 'border-box' }} />
                    <button onClick={handleAddLink} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px', height: '42px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}><Plus size={18} /> Добавить</button>
                  </div>
                  
                  {tzLinks.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {tzLinks.map((link, index) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1a1a', padding: '12px 15px', borderRadius: '8px', border: '1px solid #333' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                            <span style={{ fontWeight: '600', fontSize: '0.95rem', color: '#fff' }}>{link.title}</span>
                            <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ color: '#00ff88', textDecoration: 'none', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.url}</a>
                          </div>
                          <button onClick={() => handleRemoveLink(index)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '5px' }}><Trash2 size={18} /></button>
                        </div>
                      ))}
                    </div>
                  ) : <p style={{ color: '#666', margin: 0, fontSize: '0.9rem' }}>Добавьте ссылки на модели или магазины.</p>}
                </div>
              </div>

              <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column' }}>
                <div onDragOver={handleTzDragOver} onDragLeave={handleTzDragLeave} onDrop={handleTzDrop} style={{ background: '#111', padding: '25px', borderRadius: '12px', border: isDraggingTz ? '2px dashed #00ff88' : '1px solid #333', flex: 1, display: 'flex', flexDirection: 'column', transition: '0.2s', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}><ImagePlus size={20} color="#00ff88" /> Мудборд и референсы</h3>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: isUploadingTz ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
                      {isUploadingTz ? <Loader2 size={16} style={{ animation: 'spin 2s linear infinite' }} /> : <Plus size={16} />} Добавить
                      <input type="file" multiple hidden onChange={handleTzImageUpload} accept="image/*" disabled={isUploadingTz} />
                    </label>
                  </div>
                  {isUploadingTz ? ( <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#00ff88' }}><Loader2 size={48} style={{ animation: 'spin 1.5s linear infinite', marginBottom: '15px' }} /><p>Загружаем...</p></div> ) : tzImages.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                      {tzImages.map((img, idx) => (
                        <div key={idx} style={{ background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ position: 'relative', height: '160px', width: '100%', cursor: 'zoom-in' }} onClick={() => setViewingImage(img.url)}>
                            <img src={img.url} alt={`ref-${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <a href={img.url} target="_blank" rel="noopener noreferrer" download onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '8px', right: '45px', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}><Download size={14} /></a>
                            <button onClick={(e) => { e.stopPropagation(); handleRemoveTzImage(idx); }} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={16} /></button>
                          </div>
                          <input type="text" placeholder="Комментарий" value={img.note} onChange={(e) => handleUpdateImageNote(idx, e.target.value)} style={{ padding: '10px', background: 'transparent', border: 'none', borderTop: '1px solid #333', color: 'white', width: '100%', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                        </div>
                      ))}
                    </div>
                  ) : ( <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', border: '2px dashed #222', borderRadius: '8px', color: '#555', backgroundColor: isDraggingTz ? 'rgba(0, 255, 136, 0.05)' : 'transparent' }}><ImageIcon size={64} style={{ marginBottom: '15px', color: isDraggingTz ? '#00ff88' : '#333' }} /><p style={{ margin: 0, fontSize: '1.1rem', color: isDraggingTz ? '#00ff88' : '#555' }}>Перетащите картинки сюда</p></div> )}
                </div>
              </div>
            </div>
          </div>

        ) : (

          /* === ВКЛАДКА РЕНДЕРОВ === */
          <>
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {renders.length > 0 && (
                <div style={{ padding: '10px 20px', display: 'flex', gap: '10px', background: '#0a0a0a', borderBottom: '1px solid #333', alignItems: 'center' }}>
                  {Array.from(new Set(renders.map(r => r.version))).sort((a, b) => a - b).map(v => (
                    // 🟢 Обновленный блок вкладки Итерации с крестиком
                    <div key={v} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <button 
                        onClick={() => { setActiveVersion(v); const firstOfVersion = renders.find(r => r.version === v); if (firstOfVersion) handleSelectRender(firstOfVersion); }} 
                        style={{ 
                          padding: '6px 12px', 
                          paddingRight: (!isDesigner && activeVersion === v) ? '28px' : '12px', // Делаем отступ под крестик
                          borderRadius: '4px', border: '1px solid #333', 
                          background: activeVersion === v ? '#00ff88' : '#1a1a1a', 
                          color: activeVersion === v ? '#000' : '#888', 
                          cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', transition: '0.2s' 
                        }}
                      >
                        Итерация {v}
                      </button>
                      
                      {/* Крестик удаления (виден только Админу на активной вкладке) */}
                      {!isDesigner && activeVersion === v && (
                        <div 
                          onClick={(e) => { e.stopPropagation(); handleDeleteIteration(v); }}
                          style={{ position: 'absolute', right: '6px', cursor: 'pointer', color: '#000', display: 'flex' }}
                          title="Удалить всю итерацию"
                        >
                          <X size={16} />
                        </div>
                      )}
                    </div>
                  ))}
                  {!isDesigner && (
                    <button onClick={handleCreateNewIteration} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px dashed #555', background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', transition: '0.2s' }}>+ Новая итерация</button>
                  )}
                </div>
              )}

              <div style={{ flex: 1, background: '#111', position: 'relative' }} onDragOver={!isDesigner ? handleDragOver : undefined} onDragLeave={!isDesigner ? handleDragLeave : undefined} onDrop={!isDesigner ? handleDrop : undefined}>
                {isUploading ? (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={64} color="#00ff88" style={{ animation: 'spin 1.5s linear infinite', marginBottom: '20px' }} /><h2 style={{ margin: 0, fontWeight: '400' }}>Отправляем в облако...</h2></div>
                ) : uploadedImage ? (
                  <>
                    <CanvasViewer 
                      key={activeRender?.id} 
                      activeTool={activeTool} 
                      comments={comments} 
                      onAddPin={handleAddPin} 
                      imageUrl={uploadedImage} 
                      initialLines={activeRender?.lines || []} 
                      onSaveLines={handleSaveLines}
                      userRole={userRole} 
                    />
                    {renders.filter(r => r.version === activeVersion).length > 0 && (
                      <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', background: 'rgba(26, 26, 26, 0.9)', padding: '10px', borderRadius: '12px', border: '1px solid #444', zIndex: 30, boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
                        {renders.filter(r => r.version === activeVersion).map((r, idx) => {
                          // 🟢 Подменяем ссылку
                          const safeThumbUrl = r.image_url ? r.image_url.replace(
                            'https://bbaoigykxjsrgkthsuiu.supabase.co', 
                            import.meta.env.VITE_SUPABASE_URL
                          ) : '';

                          return (
                            <div key={r.id} onClick={() => handleSelectRender(r)} style={{ width: '65px', height: '65px', borderRadius: '8px', overflow: 'hidden', border: activeRender?.id === r.id ? '2px solid #00ff88' : '2px solid #333', cursor: 'pointer', opacity: activeRender?.id === r.id ? 1 : 0.6, transition: '0.2s', position: 'relative' }}>
                              <img src={safeThumbUrl} alt="render" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '9px', textAlign: 'center', padding: '2px 0' }}>Ракурс {idx + 1}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: !isDesigner && isDragging ? '2px dashed #00ff88' : '2px dashed #222', backgroundColor: !isDesigner && isDragging ? 'rgba(0, 255, 136, 0.05)' : 'transparent', margin: '20px', borderRadius: '15px' }}>
                    {!isDesigner ? ( <> <Upload size={56} color={isDragging ? "#00ff88" : "#333"} /> <p style={{ color: isDragging ? '#00ff88' : '#555', marginTop: '15px', fontSize: '1.1rem' }}>Перетащите сюда рендер или нажмите кнопку выше</p> </> ) : ( <> <ImageIcon size={56} color="#333" /> <p style={{ color: '#555', marginTop: '15px', fontSize: '1.1rem' }}>Визуализатор еще не загрузил рендеры для этой комнаты.</p> </> )}
                  </div>
                )}
              </div>

              {uploadedImage && !isUploading && (
                <div style={{ position: 'absolute', left: '20px', top: '140px', display: 'flex', flexDirection: 'column', gap: '5px', background: '#1a1a1a', padding: '8px', borderRadius: '8px', border: '1px solid #333', zIndex: 20 }}>
                  <button style={getBtnStyle('cursor')} onClick={() => setActiveTool('cursor')} title="Перемещение"><MousePointer2 size={20} /></button>
                  {/* 🟢 КНОПКА УДАЛЕНИЯ ТЕКУЩЕГО РАКУРСА (Только для Визуализатора) */}
                  {!isDesigner && (
                    <button 
                      style={{ background: 'transparent', border: 'none', color: '#ff0044', cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: '0.2s', display: 'flex', justifyContent: 'center' }} 
                      onClick={handleDeleteRender} 
                      title="Удалить текущий ракурс"cd hub-app
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  {/* Если утверждено - кнопка пина становится серой и неактивной */}
                  <button 
                    style={{ ...getBtnStyle('pin'), opacity: activeRender?.status === 'Утверждено' ? 0.3 : 1, cursor: activeRender?.status === 'Утверждено' ? 'not-allowed' : 'pointer' }} 
                    onClick={() => activeRender?.status !== 'Утверждено' && setActiveTool('pin')} 
                    title={activeRender?.status === 'Утверждено' ? "Ракурс утвержден (правки заблокированы)" : "Поставить правку"}
                  >
                    <MessageSquare size={20} />
                  </button>
                  
                  <button 
                    style={{ ...getBtnStyle('draw'), opacity: activeRender?.status === 'Утверждено' ? 0.3 : 1, cursor: activeRender?.status === 'Утверждено' ? 'not-allowed' : 'pointer' }} 
                    onClick={() => activeRender?.status !== 'Утверждено' && setActiveTool('draw')} 
                    title={activeRender?.status === 'Утверждено' ? "Ракурс утвержден" : "Карандаш"}
                  >
                    <Pencil size={20} />
                  </button>
                  
                  <div style={{ width: '100%', height: '1px', background: '#333', margin: '5px 0' }} />
                  
                  <button style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: '0.2s', display: 'flex', justifyContent: 'center' }} onClick={handleStartCompare} title="Сравнить (Шторка)"><ArrowLeftRight size={20} /></button>
                  <button style={{ background: 'transparent', border: 'none', color: '#00ff88', cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: '0.2s', display: 'flex', justifyContent: 'center' }} onClick={handleDownloadCleanImage} title="Скачать чистый рендер"><Download size={20} /></button>
                  
                  <div style={{ width: '100%', height: '1px', background: '#333', margin: '5px 0' }} />
                  
                  {/* 🟢 КНОПКА "УТВЕРДИТЬ" (ПРОДАКШН ЛОГИКА) */}
                  {activeRender?.status === 'Утверждено' ? (
                    <div style={{ background: 'rgba(0, 255, 136, 0.1)', color: '#00ff88', padding: '8px', borderRadius: '6px', display: 'flex', justifyContent: 'center', border: '1px solid #00ff88', cursor: 'default' }} title="Ракурс утвержден Дизайнером">
                      <Check size={20} />
                    </div>
                  ) : (
                    // Показываем кнопку согласования ТОЛЬКО дизайнеру
                    isDesigner && (
                      <button 
                        style={{ background: '#00ff88', border: 'none', color: '#000', cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: '0.2s', display: 'flex', justifyContent: 'center', boxShadow: '0 0 10px rgba(0, 255, 136, 0.3)' }} 
                        onClick={handleApproveRender} 
                        title="Утвердить ракурс (Блокирует правки)"
                      >
                        <Check size={20} />
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            <div style={{ width: '350px', background: '#1a1a1a', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column', zIndex: 20 }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #333' }}><h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '400' }}>Правки ({comments.length})</h3></div>
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {comments.map((comment) => {
                  const isVis = comment.author === 'Визуализатор';
                  const isResolved = comment.is_resolved; // Проверяем статус правки
                  
                  return (
                    <div key={comment.id} style={{ 
                      background: '#252525', 
                      padding: '15px', 
                      borderRadius: '8px', 
                      position: 'relative', 
                      borderLeft: isVis ? '3px solid #00ff88' : '3px solid transparent',
                      opacity: isResolved ? 0.6 : 1, // Если выполнено - делаем чуть прозрачнее
                      transition: '0.3s'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ 
                            width: '24px', height: '24px', borderRadius: '50%', 
                            background: isResolved ? '#555' : (isVis ? '#00ff88' : '#fff'), // Серая кнопка, если выполнено
                            color: isResolved ? '#aaa' : '#000', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' 
                          }}>
                            {comment.number}
                          </div>
                          <span style={{ 
                            fontSize: '0.9rem', 
                            color: isVis ? '#00ff88' : '#aaa', 
                            fontWeight: isVis ? 'bold' : 'normal',
                            textDecoration: isResolved ? 'line-through' : 'none' // Зачеркиваем имя, если выполнено
                          }}>
                            {comment.author || 'Дизайнер'}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '5px' }}>
                          {/* 🟢 КНОПКА "ВЫПОЛНЕНО" (Доступна только Визуализатору или админу) */}
                          {(!isDesigner) && (
                            <button 
                              onClick={() => handleToggleResolve(comment.id, isResolved)} 
                              style={{ background: 'transparent', border: 'none', color: isResolved ? '#00ff88' : '#888', cursor: 'pointer', padding: '0 5px' }}
                              title={isResolved ? "Отметить как невыполненное" : "Отметить как выполненное"}
                            >
                              {isResolved ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                            </button>
                          )}
                          
                          {/* Кнопка удаления */}
                          {(!isDesigner || !isVis) && ( 
                            <button onClick={() => handleDeleteComment(comment.id)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '0 5px' }}>
                              <Trash2 size={16} />
                            </button> 
                          )}
                        </div>
                      </div>
                      
                      <textarea 
                        autoFocus={comment.text === ''} 
                        placeholder="Опишите правку..." 
                        value={comment.text || ''} 
                        onChange={(e) => handleTextChange(comment.id, e.target.value)} 
                        onBlur={(e) => handleTextSave(comment.id, e.target.value)} 
                        readOnly={isResolved} // Запрещаем редактировать текст выполненной правки
                        style={{ 
                          width: '100%', padding: '10px', 
                          background: isResolved ? 'transparent' : '#111', // Убираем фон у выполненных
                          border: isResolved ? 'none' : '1px solid #333', 
                          borderRadius: '6px', color: isResolved ? '#888' : 'white', 
                          boxSizing: 'border-box', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit',
                          textDecoration: isResolved ? 'line-through' : 'none' // Зачеркиваем текст
                        }} 
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}