import React, { useState, useEffect, useRef } from 'react';
// 🟢 Добавили Undo в общий список иконок
import { MessageSquare, Pencil, MousePointer2, Trash2, ArrowLeft, Upload, Loader2, FileText, Image as ImageIcon, Save, Link as LinkIcon, Plus, X, ImagePlus, FileArchive, Maximize2, Download, Check, ArrowLeftRight, MessageCircle, Send, ExternalLink, CheckCircle2, Circle, Undo } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import CanvasViewer from './CanvasViewer';
import { supabase } from '../supabaseClient';

export default function Workspace() {
  // 🟢 ПРАВИЛЬНО: стейт undoSignal находится ВНУТРИ функции компонента!
  const [undoSignal, setUndoSignal] = useState(0);
  
  const navigate = useNavigate();
  const { roomId } = useParams(); 
  const isSendingRef = useRef(false);
  
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tz');
  // 1. СЛУШАТЕЛЬ МОБИЛЬНИКА
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. СНАЧАЛА ОБЪЯВЛЯЕМ ВСЕ ПЕРЕМЕННЫЕ (СТЕЙТЫ)
  const [roomData, setRoomData] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [designerData, setDesignerData] = useState(null);
  const [activeTool, setActiveTool] = useState('cursor');
  const isAddingPinRef = useRef(false);
  const [renders, setRenders] = useState([]); 
  const [activeRender, setActiveRender] = useState(null); 
  const [activeVersion, setActiveVersion] = useState(1);
  const [comments, setComments] = useState([]);

  // 🟢 Новые стейты для правок
  const [activeCommentId, setActiveCommentId] = useState(null);
  const iterationsContainerRef = useRef(null);

  // 3. И ТОЛЬКО ТЕПЕРЬ ЗАПУСКАЕМ ЭФФЕКТЫ, КОТОРЫЕ ИХ ИСПОЛЬЗУЮТ
  // 🟢 Авто-скролл до выбранной карточки правки на мобилке
  useEffect(() => {
    if (activeCommentId && isMobile) {
      const el = document.getElementById(`comment-card-${activeCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeCommentId, isMobile]);

  // 🟢 Автоматический скролл итераций в самый конец (к последней)
  useEffect(() => {
    if (iterationsContainerRef.current) {
      iterationsContainerRef.current.scrollLeft = iterationsContainerRef.current.scrollWidth;
    }
  }, [renders.length, activeTab]);

  // ... дальше у тебя идут другие стейты вроде uploadedImage и логика

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
  
  // 🟢 Автоматически прокручиваем карусель к нужной правке
  useEffect(() => {
    if (activeCommentId && isMobile) {
      const el = document.getElementById(`comment-card-${activeCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeCommentId, isMobile]);

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

    // Функция, которая тихо запрашивает свежие рендеры и комменты у базы
    const fetchIterationsUpdates = async () => {
      if (!roomId) return;

      // 1. Скачиваем рендеры и линии
      const { data: iters } = await supabase
        .from('iterations')
        .select('*')
        .eq('room_id', roomId)
        .order('version', { ascending: true }); // Сортировка по итерациям

      if (iters) {
        setRenders(prevRenders => prevRenders.map(pr => {
          const newIt = iters.find(i => i.id === pr.id);
          if (!newIt) return pr;
          const newLines = newIt.lines || [];
          const oldLines = pr.lines || [];
          // Если у нас локально нарисовано больше линий, оставляем наши (чтобы не моргало)
          return { ...newIt, lines: newLines.length > oldLines.length ? newLines : oldLines };
        }));

        setActiveRender(prevActive => {
          if (!prevActive) return null;
          const updatedActive = iters.find(i => i.id === prevActive.id);
          if (!updatedActive) return prevActive;
          const newLines = updatedActive.lines || [];
          const oldLines = prevActive.lines || [];
          return { ...updatedActive, lines: newLines.length > oldLines.length ? newLines : oldLines };
        });
      }

      // 2. Скачиваем пины (комментарии) только для активного рендера
      if (activeRender?.id) {
        const { data: comms } = await supabase
          .from('comments')
          .select('*')
          .eq('iteration_id', activeRender?.id);

        if (comms) {
          setComments(prevComms => {
            // 🟢 Жестко доверяем базе: если на сервере пина нет, значит он удален!
            const merged = comms.map(newC => {
              const oldC = prevComms.find(c => c.id === newC.id);
              // Защита текста: если этот коммент сейчас открыт, не затираем текст из базы!
              if (oldC && oldC.id === activeCommentId) {
                return { ...newC, text: oldC.text }; 
              }
              return newC;
            });
            
            // Если открытый коммент удалили с другого устройства, закрываем его панель
            if (activeCommentId && !merged.find(c => c.id === activeCommentId)) {
              setActiveCommentId(null);
            }
            
            return merged.sort((a, b) => a.number - b.number);
          });
        }
      }
    };

    // Опрашиваем базу каждые 3 секунды
    const interval = setInterval(fetchIterationsUpdates, 3000);

    return () => clearInterval(interval);
  }, [roomId, activeRender?.id, activeCommentId]); // 🟢 ОБЯЗАТЕЛЬНО добавили зависимости!

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
    if (activeRender.status === 'Утверждено') {
      alert('Ракурс утвержден. Правки заблокированы.');
      return;
    }

    // 🟢 ЗАЩИТА ОТ ДВОЙНИКОВ: Если функция уже выполняется, игнорируем второй клик!
    if (isAddingPinRef.current) return;
    isAddingPinRef.current = true; // Закрываем замок

    try {
      const authorName = userRole === 'admin' ? 'Визуализатор' : 'Дизайнер';
      const maxNumber = comments.length > 0 ? Math.max(...comments.map(c => c.number || 0)) : 0;
      const newNumber = maxNumber + 1;

      // Мгновенно отключаем инструмент пина, чтобы предотвратить дальнейшие клики
      setActiveTool('cursor'); 

      const { data: newComment, error } = await supabase.from('comments').insert([{ 
        iteration_id: activeRender.id, 
        pos_x: coords.x, 
        pos_y: coords.y, 
        number: newNumber, 
        text: '', 
        author: authorName 
      }]).select().single(); 

      if (error) {
        alert("Ошибка создания пина: " + error.message);
        return;
      }

      if (newComment) { 
        setComments(prev => [...prev, newComment].sort((a, b) => a.number - b.number)); 
        setActiveCommentId(newComment.id); 
      } 
    } finally {
      // 🟢 Снимаем замок через 500 миллисекунд (надежная защита от фантомных кликов браузера)
      setTimeout(() => {
        isAddingPinRef.current = false;
      }, 500);
    }
  };
  
  const handleTextChange = (id, newText) => setComments(comments.map(c => c.id === id ? { ...c, text: newText } : c));
  const handleTextSave = async (commentId, newText) => {
    // 1. Мгновенно обновляем интерфейс, чтобы текст не пропадал
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, text: newText } : c));

    // 2. Отправляем в базу
    const { error } = await supabase.from('comments').update({ text: newText }).eq('id', commentId);

    // 3. Ловушка на случай проблем с правами RLS
    if (error) {
      console.error("🚨 Ошибка базы данных:", error);
      alert("Текст не сохранился! Ошибка Supabase: " + error.message + " (Проверь RLS UPDATE для comments)");
    }
  };
  // 🟢 Принудительное сохранение текста перед закрытием окна
  const handleCloseComment = () => {
    if (activeCommentId) {
      const comment = comments.find(c => c.id === activeCommentId);
      if (comment) {
        handleTextSave(comment.id, comment.text); // Отправляем в базу!
      }
    }
    setActiveCommentId(null);
  };
  const handleSaveLines = async (newLines) => { 
    if (!activeRender) return; 

    // 1. Мгновенно обновляем картинку на экране у самого дизайнера
    setRenders(prev => prev.map(r => r.id === activeRender.id ? { ...r, lines: newLines } : r)); 
    setActiveRender(prev => ({ ...prev, lines: newLines })); 
    
    // 2. Пытаемся отправить данные в Supabase
    const { error } = await supabase.from('iterations').update({ lines: newLines }).eq('id', activeRender.id); 
    
    // 🟢 3. ЛОВУШКА ДЛЯ ОШИБКИ: Если Supabase отклонит запрос, мы это сразу увидим!
    if (error) {
      console.error("🚨 Ошибка сохранения в Supabase:", error);
      alert("Не удалось сохранить рисунок! Ошибка базы данных: " + error.message);
    }
  };
  // 🟢 Умный "Шаг назад": удаляет только линию текущего пользователя
  const handleUndoLine = async () => {
    if (!activeRender || !activeRender.lines || activeRender.lines.length === 0) return;

    // 1. Определяем наш цвет (дизайнер = зеленый, виз = красный)
    const myColor = userRole === 'admin' ? '#00ff88' : '#ff0000';

    // 2. Ищем с конца массива ПОСЛЕДНЮЮ линию с нашим цветом
    let lastMyLineIndex = -1;
    for (let i = activeRender.lines.length - 1; i >= 0; i--) {
      // Проверяем цвет линии (на всякий случай смотрим оба возможных названия свойства)
      const lineColor = activeRender.lines[i].color || activeRender.lines[i].brushColor; 
      if (lineColor === myColor) {
        lastMyLineIndex = i;
        break;
      }
    }

    // Если наших линий нет на холсте — ничего не делаем
    if (lastMyLineIndex === -1) {
      alert("На холсте нет ваших линий для отмены.");
      return;
    }

    // 3. Вырезаем именно НАШУ линию из массива
    const newLines = [...activeRender.lines];
    newLines.splice(lastMyLineIndex, 1);

    // 4. Мгновенно обновляем экран
    setRenders(prev => prev.map(r => r.id === activeRender.id ? { ...r, lines: newLines } : r));
    setActiveRender(prev => ({ ...prev, lines: newLines }));
    
    // Посылаем сигнал холсту
    setUndoSignal(prev => prev + 1);

    // 5. Отправляем в базу
    const { error } = await supabase.from('iterations').update({ lines: newLines }).eq('id', activeRender.id);
    if (error) console.error("Ошибка при отмене линии:", error);
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
  const handleDeleteComment = async (commentId) => {
    // 1. Мгновенно и безвозвратно убираем пин с экрана (Оптимистичное обновление)
    setComments(prev => prev.filter(c => c.id !== commentId));
    if (activeCommentId === commentId) {
      setActiveCommentId(null);
    }

    // 2. Тихо удаляем из базы данных
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      console.error("Ошибка удаления пина в Supabase:", error);
    }
  };

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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: '#0a0a0a', color: 'white', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={48} color="#00ff88" style={{ animation: 'spin 1.5s linear infinite', marginBottom: '20px' }} />
        <h2 style={{ fontWeight: '400', color: '#aaa', margin: 0 }}>Входим в комнату...</h2>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: '#0a0a0a', color: 'white', fontFamily: 'Manrope, sans-serif', overflow: 'hidden' }}>
      
      {/* 🟢 ВЫЕЗЖАЮЩАЯ ПАНЕЛЬ ЧАТА (100% ширины на мобилке) */}
      <div style={{ position: 'fixed', top: 0, right: isChatOpen ? 0 : (isMobile ? '-100%' : '-400px'), width: isMobile ? '100%' : '400px', height: '100dvh', background: '#161616', borderLeft: '1px solid #333', zIndex: 9999, transition: 'right 0.3s ease', display: 'flex', flexDirection: 'column', boxShadow: isChatOpen ? '-5px 0 30px rgba(0,0,0,0.6)' : 'none' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem' }}><MessageCircle size={22} color="#00ff88" /> Обсуждение</h3>
          <button onClick={() => setIsChatOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {chatMessages.map(msg => {
            const isMe = (userRole === 'admin' && msg.author === 'Визуализатор') || (userRole === 'designer' && msg.author === 'Дизайнер');
            const timeString = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                 <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '6px' }}>
                    {isMe && msg.room_title && ( <span style={{ background: '#222', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', color: '#aaa', border: '1px solid #333' }}>{msg.room_title}</span> )}
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>{msg.author}</span>
                    {!isMe && msg.room_title && ( <span style={{ background: '#222', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', color: '#aaa', border: '1px solid #333' }}>{msg.room_title}</span> )}
                 </div>
                 <div style={{ background: isMe ? '#00ff88' : '#222', color: isMe ? '#000' : '#fff', padding: '12px 16px', borderRadius: '12px', borderBottomRightRadius: isMe ? '2px' : '12px', borderBottomLeftRadius: isMe ? '12px' : '2px', fontSize: '0.95rem', lineHeight: '1.4' }}>{msg.text}</div>
                 <div style={{ fontSize: '0.7rem', color: '#555', marginTop: '4px', textAlign: isMe ? 'right' : 'left' }}>{timeString}</div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <div style={{ padding: '20px', borderTop: '1px solid #333', background: '#111', display: 'flex', gap: '10px' }}>
          <input type="text" value={newMessage} onChange={(e)=>setNewMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Сообщение..." style={{ flex: 1, background: '#222', border: '1px solid #444', color: '#fff', padding: '12px 15px', borderRadius: '8px', outline: 'none' }} />
          <button onClick={handleSendMessage} style={{ background: '#00ff88', color: '#000', border: 'none', width: '45px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={20} /></button>
        </div>
      </div>

      {viewingImage && (
        <div onClick={() => setViewingImage(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={viewingImage} alt="Fullscreen View" style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', borderRadius: '8px' }} />
          <button style={{ position: 'absolute', top: isMobile ? '10px' : '30px', right: isMobile ? '10px' : '30px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
        </div>
      )}

     {/* 🟢 НОВАЯ КОМПАКТНАЯ ШАПКА (1 строка) */}
      <div style={{ padding: '10px 15px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0a0a0a', zIndex: 20 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1, paddingRight: '15px' }}>
          
          {/* 🟢 ВОТ ОНА: Замененная кнопка */}
          <button 
            onClick={() => navigate(projectData ? `/project/${projectData.id}` : '/')} 
            style={{ 
              background: 'linear-gradient(145deg, #1a1a1a, #111)', 
              border: '1px solid #00ff88', 
              color: '#00ff88', 
              width: isMobile ? '36px' : '40px', 
              height: isMobile ? '36px' : '40px', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer', 
              padding: 0, 
              flexShrink: 0,
              boxShadow: '4px 4px 10px rgba(0,0,0,0.5), -2px -2px 10px rgba(255,255,255,0.02), 0 0 12px rgba(0, 255, 136, 0.4), inset 0 0 8px rgba(0, 255, 136, 0.15)' 
            }}
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: isMobile ? '1rem' : '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {/* Имя дизайнера показываем только на ПК */}
            {!isMobile && !isDesigner && designerData && (<><span style={{ cursor: 'pointer', flexShrink: 0 }}>{designerData.name}</span><span style={{flexShrink: 0}}>/</span></>)}
            
            {/* 🟢 Название проекта: вернули на мобилку. Если длинное — обрежется троеточием */}
            {projectData && (
              <>
                <span style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? '110px' : 'none', display: 'inline-block', verticalAlign: 'bottom' }}>
                  {projectData.title}
                </span>
                <span style={{flexShrink: 0}}>/</span>
              </>
            )}
            
            {/* Название комнаты */}
            {roomData && (<span style={{ fontWeight: '600', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', flexShrink: 1 }}>{roomData.title}</span>)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: isMobile ? '15px' : '20px', alignItems: 'center' }}>
          {!roomData?.is_general && (
            <>
              <button onClick={() => setActiveTab('tz')} style={{ color: activeTab === 'tz' ? '#00ff88' : '#888', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} title="Локальное ТЗ"><FileText size={isMobile ? 24 : 20} /></button>
              <button onClick={() => setActiveTab('renders')} style={{ color: activeTab === 'renders' ? '#00ff88' : '#888', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} title="Рендеры"><ImageIcon size={isMobile ? 24 : 20} /></button>
            </>
          )}
          {activeTab === 'renders' && !isDesigner && (
            <label style={{ color: isUploading ? '#555' : '#fff', cursor: isUploading ? 'not-allowed' : 'pointer', margin: 0, padding: 0, display: 'flex' }} title="Загрузить рендер">
              {isUploading ? <Loader2 size={isMobile ? 24 : 20} style={{ animation: 'spin 2s linear infinite' }} /> : <Upload size={isMobile ? 24 : 20} />}
              <input type="file" multiple hidden onChange={handleFileUpload} accept="image/*" disabled={isUploading} />
            </label>
          )}
          <button onClick={() => { setIsChatOpen(!isChatOpen); setUnreadCount(0); }} style={{ color: isChatOpen ? '#00ff88' : '#fff', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', position: 'relative', display: 'flex' }} title="Чат проекта">
            <MessageCircle size={isMobile ? 24 : 20} />
            {unreadCount > 0 && ( <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ff0044', width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #0a0a0a' }} /> )}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {isComparing && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#0a0a0a', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', padding: '15px 20px', background: '#111', borderBottom: '1px solid #333', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <span style={{ color: '#888', fontWeight: 'bold', fontSize: '0.9rem' }}>БЫЛО:</span>
                <select value={compareLeft?.id || ''} onChange={(e) => setCompareLeft(renders.find(r => r.id === e.target.value))} style={{ flex: 1, background: '#222', color: '#fff', border: '1px solid #444', padding: '8px 12px', borderRadius: '6px' }}>
                  {renders.map(r => <option key={`left-${r.id}`} value={r.id}>{getRenderName(r)}</option>)}
                </select>
              </div>
              <button onClick={() => setIsComparing(false)} style={{ order: isMobile ? 3 : 2, background: '#333', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}><X size={18} /> Закрыть</button>
              <div style={{ order: isMobile ? 2 : 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <span style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '0.9rem' }}>СТАЛО:</span>
                <select value={compareRight?.id || ''} onChange={(e) => setCompareRight(renders.find(r => r.id === e.target.value))} style={{ flex: 1, background: '#222', color: '#fff', border: '1px solid #444', padding: '8px 12px', borderRadius: '6px' }}>
                  {renders.map(r => <option key={`right-${r.id}`} value={r.id}>{getRenderName(r)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {compareRight && <img src={compareRight.image_url} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} alt="After" />}
              {compareLeft && <img src={compareLeft.image_url} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }} alt="Before" />}
              <input type="range" min="0" max="100" value={sliderPos} onChange={(e) => setSliderPos(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize', zIndex: 10 }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`, width: '2px', background: '#00ff88', pointerEvents: 'none', zIndex: 5 }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '40px', height: '40px', background: '#00ff88', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeftRight size={20} color="#000" /></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tz' ? (
  <div style={{ flex: 1, padding: isMobile ? '15px' : '30px', paddingBottom: '120px', overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box', width: '100%' }}>
    <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: isMobile ? '15px' : '30px', boxSizing: 'border-box', width: '100%' }}>
      {/* 🟢 Заменили 600px на 100% для мобилок и добавили minWidth: 0, чтобы flex-блоки не распирало */}
      <div style={{ flex: isMobile ? '1 1 100%' : '1 1 600px', display: 'flex', flexDirection: 'column', gap: isMobile ? '15px' : '25px', boxSizing: 'border-box', minWidth: 0, width: '100%' }}>
        <div style={{ background: '#111', padding: isMobile ? '15px' : '25px', borderRadius: '12px', border: '1px solid #333', boxSizing: 'border-box', width: '100%' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
             <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}><FileText size={20} color="#00ff88" /> Описание</h3>
             <button onClick={() => handleSaveTz(false)} disabled={saveStatus === 'saving'} style={{ background: saveStatus === 'saved' ? '#00ff88' : '#222', color: saveStatus === 'saved' ? '#000' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
               {saveStatus === 'saving' ? '...' : saveStatus === 'saved' ? 'Сохранено' : 'Сохранить'}
             </button>
          </div>
                  <textarea placeholder="Подробно опишите задачу..." value={tzDescription} onChange={(e) => setTzDescription(e.target.value)} style={{ width: '100%', padding: '15px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px', color: 'white', boxSizing: 'border-box', minHeight: '300px', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.95rem' }} />
                </div>
                
                <div onDragOver={handleFilesDragOver} onDragLeave={handleFilesDragLeave} onDrop={handleFilesDrop} style={{ background: '#111', padding: isMobile ? '15px' : '25px', borderRadius: '12px', border: isDraggingFiles ? '2px dashed #00ff88' : '1px solid #333' }}>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: '15px', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}><FileArchive size={20} color="#00ff88" /> Документы</h3>
                    <label style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: isUploadingFiles ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                      {isUploadingFiles ? <Loader2 size={16} style={{ animation: 'spin 2s linear infinite' }} /> : <Plus size={16} />} Загрузить
                      <input type="file" multiple hidden onChange={handleTzFilesUpload} disabled={isUploadingFiles} />
                    </label>
                  </div>
                  {isUploadingFiles ? ( <div style={{ padding: '20px', textAlign: 'center', color: '#00ff88' }}><Loader2 size={32} style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 10px' }} /></div> ) : tzFiles.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {tzFiles.map((file, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1a1a', padding: '12px 15px', borderRadius: '8px', border: '1px solid #333' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                            <FileArchive size={24} color="#aaa" style={{ flexShrink: 0 }} />
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{file.name}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                            <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ background: '#222', color: '#fff', padding: '6px 10px', borderRadius: '6px' }}><Download size={14} /></a>
                            <button onClick={() => handleRemoveTzFile(idx)} style={{ background: 'transparent', border: 'none', color: '#888' }}><Trash2 size={18} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : ( <div style={{ padding: '20px', textAlign: 'center', border: '2px dashed #222', borderRadius: '8px' }}><p style={{ margin: 0, color: '#666' }}>Перетащите сюда файлы</p></div> )}
                </div>

                <div style={{ background: '#111', padding: isMobile ? '15px' : '25px', borderRadius: '12px', border: '1px solid #333' }}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}><LinkIcon size={20} color="#00ff88" /> Ссылки</h3>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', marginBottom: '20px' }}>
                    <input type="text" placeholder="Название" value={newLinkTitle} onChange={(e) => setNewLinkTitle(e.target.value)} style={{ flex: 1, padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px', color: 'white' }} />
                    <input type="text" placeholder="URL ссылка" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddLink()} style={{ flex: 2, padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px', color: 'white' }} />
                    <button onClick={handleAddLink} style={{ padding: '12px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '8px', fontWeight: 'bold' }}><Plus size={18} /></button>
                  </div>
                  {tzLinks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {tzLinks.map((link, index) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1a1a', padding: '12px 15px', borderRadius: '8px', border: '1px solid #333' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                            <span style={{ fontWeight: '600', fontSize: '0.95rem', color: '#fff' }}>{link.title}</span>
                            <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ color: '#00ff88', textDecoration: 'none', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.url}</a>
                          </div>
                          <button onClick={() => handleRemoveLink(index)} style={{ background: 'transparent', border: 'none', color: '#888' }}><Trash2 size={18} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column' }}>
                <div onDragOver={handleTzDragOver} onDragLeave={handleTzDragLeave} onDrop={handleTzDrop} style={{ background: '#111', padding: isMobile ? '15px' : '25px', borderRadius: '12px', border: isDraggingTz ? '2px dashed #00ff88' : '1px solid #333', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: '20px', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}><ImagePlus size={20} color="#00ff88" /> Мудборд</h3>
                    <label style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: isUploadingTz ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                      {isUploadingTz ? <Loader2 size={16} style={{ animation: 'spin 2s linear infinite' }} /> : <Plus size={16} />} Добавить
                      <input type="file" multiple hidden onChange={handleTzImageUpload} accept="image/*" disabled={isUploadingTz} />
                    </label>
                  </div>
                  {isUploadingTz ? ( <div style={{ flex: 1, display: 'flex', justifyContent: 'center', color: '#00ff88', padding: '40px' }}><Loader2 size={48} style={{ animation: 'spin 1.5s linear infinite' }} /></div> ) : tzImages.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '140px' : '200px'}, 1fr))`, gap: '15px' }}>
                      {tzImages.map((img, idx) => (
                        <div key={idx} style={{ background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333', overflow: 'hidden' }}>
                          <div style={{ position: 'relative', height: isMobile ? '120px' : '160px', width: '100%' }} onClick={() => setViewingImage(img.url)}>
                            <img src={img.url} alt={`ref-${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button onClick={(e) => { e.stopPropagation(); handleRemoveTzImage(idx); }} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                          </div>
                          <input type="text" placeholder="Комментарий" value={img.note} onChange={(e) => handleUpdateImageNote(idx, e.target.value)} style={{ padding: '10px', background: 'transparent', border: 'none', borderTop: '1px solid #333', color: 'white', width: '100%', boxSizing: 'border-box', fontSize: '0.85rem' }} />
                        </div>
                      ))}
                    </div>
                  ) : ( <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', border: '2px dashed #222', borderRadius: '8px' }}><ImageIcon size={48} style={{ marginBottom: '15px', color: '#333' }} /><p style={{ margin: 0, color: '#555' }}>Перетащите картинки</p></div> )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* === 🟢 ВКЛАДКА РЕНДЕРОВ === */
          <>
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              {/* 🟢 ИТЕРАЦИИ (Скроллируемая строка) */}
              {renders.length > 0 && (
                <div ref={iterationsContainerRef} style={{ padding: '10px', display: 'flex', gap: '10px', background: '#0a0a0a', borderBottom: '1px solid #333', alignItems: 'center', overflowX: 'auto', whiteSpace: 'nowrap', scrollBehavior: 'smooth' }}>
                  {Array.from(new Set(renders.map(r => r.version))).sort((a, b) => a - b).map(v => (
                    <div key={v} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <button 
                        onClick={() => { setActiveVersion(v); const firstOfVersion = renders.find(r => r.version === v); if (firstOfVersion) handleSelectRender(firstOfVersion); }} 
                        style={{ padding: '8px 16px', paddingRight: (!isDesigner && activeVersion === v) ? '32px' : '16px', borderRadius: '6px', border: '1px solid #333', background: activeVersion === v ? '#00ff88' : '#1a1a1a', color: activeVersion === v ? '#000' : '#888', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold', transition: '0.2s' }}
                      >
                        Итерация {v}
                      </button>
                      {!isDesigner && activeVersion === v && (
                        <div onClick={(e) => { e.stopPropagation(); handleDeleteIteration(v); }} style={{ position: 'absolute', right: '8px', cursor: 'pointer', color: '#000' }}><X size={16} /></div>
                      )}
                    </div>
                  ))}
                  {!isDesigner && (
                    <button onClick={handleCreateNewIteration} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px dashed #555', background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>+ Новая</button>
                  )}
                </div>
              )}

              {/* 🟢 ХОЛСТ С КАРТИНКОЙ И ПРАВКАМИ */}
              {/* touchAction - решает проблему мобильного зума при рисовании! */}
              <div style={{ flex: 1, background: '#111', position: 'relative', touchAction: activeTool === 'cursor' ? 'auto' : 'none' }} onDragOver={!isDesigner ? handleDragOver : undefined} onDragLeave={!isDesigner ? handleDragLeave : undefined} onDrop={!isDesigner ? handleDrop : undefined}>
                {isUploading ? (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={64} color="#00ff88" style={{ animation: 'spin 1.5s linear infinite', marginBottom: '20px' }} /></div>
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
                      /* 🟢 Передаем клик по пину наверх, чтобы открыть модалку */
                      onPinClick={(id) => setActiveCommentId(id)}
                      undoSignal={undoSignal}
                    />
                    
                    {renders.filter(r => r.version === activeVersion).length > 0 && (
  <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', background: 'rgba(26, 26, 26, 0.9)', padding: '8px', borderRadius: '12px', border: '1px solid #444', zIndex: 10 }}>
    {renders.filter(r => r.version === activeVersion).map((r, idx) => {
      const safeThumbUrl = r.image_url ? r.image_url.replace('https://bbaoigykxjsrgkthsuiu.supabase.co', import.meta.env.VITE_SUPABASE_URL) : '';
      return (
        <div 
          key={r.id} 
          onClick={() => handleSelectRender(r)} 
          style={{ 
            position: 'relative', /* 🟢 ВОТ ОН - ГЛАВНЫЙ СЕКРЕТ! Теперь цифра не убежит */
            width: isMobile ? '50px' : '65px', 
            height: isMobile ? '50px' : '65px', 
            borderRadius: '8px', 
            overflow: 'hidden', 
            border: activeRender?.id === r.id ? '2px solid #00ff88' : '2px solid #333', 
            cursor: 'pointer', 
            opacity: activeRender?.id === r.id ? 1 : 0.6 
          }}
        >
          <img src={safeThumbUrl} alt="render" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          
          {/* 🟢 Улучшенная плашка с номером (теперь она точно появится внизу картинки) */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', color: 'white', fontSize: '10px', fontWeight: 'bold', textAlign: 'center', padding: '2px 0' }}>
            Р. {idx + 1}
          </div>
        </div>
      );
    })}
  </div>
)}
                  </>
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: !isDesigner && isDragging ? '2px dashed #00ff88' : '2px dashed #222', backgroundColor: !isDesigner && isDragging ? 'rgba(0, 255, 136, 0.05)' : 'transparent', margin: '20px', borderRadius: '15px' }}>
                    {!isDesigner ? ( <> <Upload size={56} color={isDragging ? "#00ff88" : "#333"} /> <p style={{ color: isDragging ? '#00ff88' : '#555', marginTop: '15px' }}>Перетащите сюда рендер</p> </> ) : ( <> <ImageIcon size={56} color="#333" /> <p style={{ color: '#555', marginTop: '15px', textAlign: 'center' }}>Рендеры еще не загружены.</p> </> )}
                  </div>
                )}
              </div>

              {/* 🟢 ПАНЕЛЬ ИНСТРУМЕНТОВ (Возвращена НАЛЕВО и для мобилок, и для ПК) */}
              {uploadedImage && !isUploading && (
                <div style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px', background: 'rgba(26,26,26,0.9)', padding: '6px', borderRadius: '8px', border: '1px solid #444', zIndex: 20
                }}>
                  <button style={getBtnStyle('cursor')} onClick={() => setActiveTool('cursor')}><MousePointer2 size={20} /></button>
                  {!isDesigner && ( <button style={{ background: 'transparent', border: 'none', color: '#ff0044', padding: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center' }} onClick={handleDeleteRender}><Trash2 size={20} /></button> )}
                  <button style={{ ...getBtnStyle('pin'), opacity: activeRender?.status === 'Утверждено' ? 0.3 : 1 }} onClick={() => activeRender?.status !== 'Утверждено' && setActiveTool('pin')}><MessageSquare size={20} /></button>
                  <button style={{ ...getBtnStyle('draw'), opacity: activeRender?.status === 'Утверждено' ? 0.3 : 1 }} onClick={() => activeRender?.status !== 'Утверждено' && setActiveTool('draw')}><Pencil size={20} /></button>
                  {/* 🟢 СЮДА ВСТАВЛЯЕМ НОВУЮ КНОПКУ ОТМЕНЫ */}
<button 
  onClick={handleUndoLine}
  disabled={!activeRender || !activeRender.lines || activeRender.lines.length === 0 || activeRender?.status === 'Утверждено'}
  title="Шаг назад (удалить последнюю линию)"
  style={{ 
    background: 'transparent', 
    border: 'none', 
    color: (!activeRender || !activeRender.lines || activeRender.lines.length === 0 || activeRender?.status === 'Утверждено') ? '#444' : '#fff', 
    padding: '8px', 
    cursor: (!activeRender || !activeRender.lines || activeRender.lines.length === 0 || activeRender?.status === 'Утверждено') ? 'default' : 'pointer', 
    display: 'flex', 
    justifyContent: 'center', 
    transition: '0.2s' 
  }}
>
  <Undo size={20} />
</button>

                  <div style={{ width: '100%', height: '1px', background: '#444', margin: '5px 0' }} />
                  
                  <button style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center' }} onClick={handleStartCompare}><ArrowLeftRight size={20} /></button>
                  <button style={{ background: 'transparent', border: 'none', color: '#00ff88', padding: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center' }} onClick={handleDownloadCleanImage}><Download size={20} /></button>
                  
                  <div style={{ width: '100%', height: '1px', background: '#444', margin: '5px 0' }} />
                  
                  {activeRender?.status === 'Утверждено' ? (
                    <div style={{ background: 'rgba(0, 255, 136, 0.1)', color: '#00ff88', padding: '8px', borderRadius: '6px', border: '1px solid #00ff88', display: 'flex', justifyContent: 'center' }}><Check size={20} /></div>
                  ) : (
                    isDesigner && <button style={{ background: '#00ff88', color: '#000', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center' }} onClick={handleApproveRender}><Check size={20} /></button>
                  )}
                </div>
              )}
            </div>

            {/* БОКОВОЙ БЛОК ПРАВОК - ПК ВЕРСИЯ */}
            {!isMobile && (
              <div style={{ width: '350px', background: '#1a1a1a', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column', zIndex: 20, flexShrink: 0 }}>
                <div style={{ padding: '15px 20px', borderBottom: '1px solid #333' }}><h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '400' }}>Правки ({comments.length})</h3></div>
                <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {comments.map((comment) => {
                    const isVis = comment.author === 'Визуализатор';
                    const isResolved = comment.is_resolved;
                    
                    // 🟢 Проверяем, активна ли сейчас эта карточка
                    const isActive = activeCommentId === comment.id;

                    return (
                      <div 
                        key={comment.id} 
                        onClick={() => setActiveCommentId(comment.id)} 
                        style={{ background: '#252525', padding: '15px', borderRadius: '8px', borderLeft: isVis ? '3px solid #00ff88' : '3px solid transparent', border: isActive ? '1px solid #555' : '1px solid transparent', opacity: isResolved ? 0.6 : 1, cursor: isActive ? 'default' : 'pointer', transition: '0.2s' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: isResolved ? '#555' : (isVis ? '#00ff88' : '#fff'), color: isResolved ? '#aaa' : '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>{comment.number}</div>
                            <span style={{ fontSize: '0.9rem', color: isVis ? '#00ff88' : '#aaa', textDecoration: isResolved ? 'line-through' : 'none' }}>{comment.author || 'Дизайнер'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            {!isDesigner && ( <button onClick={(e) => { e.stopPropagation(); handleToggleResolve(comment.id, isResolved); }} style={{ background: 'transparent', border: 'none', color: isResolved ? '#00ff88' : '#888', cursor: 'pointer' }}>{isResolved ? <CheckCircle2 size={18} /> : <Circle size={18} />}</button> )}
                            {(!isDesigner || !isVis) && ( <button onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id); setActiveCommentId(null); }} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}><Trash2 size={16} /></button> )}
                          </div>
                        </div>
                        
                        {/* 🟢 ЛОГИКА ВВОДА: Если карточка активна - показываем поле ввода, иначе - просто текст */}
                        {isActive ? (
                          <textarea 
                            autoFocus={comment.text === ''}
                            placeholder="Опишите правку..." 
                            value={comment.text || ''} 
                            onChange={(e) => handleTextChange(comment.id, e.target.value)} 
                            onBlur={(e) => handleTextSave(comment.id, e.target.value)} 
                            readOnly={isResolved} 
                            style={{ width: '100%', padding: '10px', background: isResolved ? 'transparent' : '#111', border: isResolved ? 'none' : '1px solid #333', borderRadius: '6px', color: isResolved ? '#888' : 'white', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical', fontSize: '0.9rem', outline: 'none', marginTop: '5px' }} 
                          />
                        ) : (
                          <div style={{ color: isResolved ? '#888' : 'white', fontSize: '0.95rem', textDecoration: isResolved ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {comment.text || 'Нет описания...'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 🟢 НОВОЕ ВСПЛЫВАЮЩЕЕ ОКНО КОММЕНТАРИЯ (Показывается при клике на пин) */}
      

      {/* 🟢 Для Мобильных: ГОРИЗОНТАЛЬНАЯ КАРУСЕЛЬ ПРАВОК ВНИЗУ */}
      {activeCommentId && isMobile && (
        <div style={{
          position: 'absolute',
          bottom: '90px', // Поднято над миниатюрами ракурсов
          left: 0, width: '100%', zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          pointerEvents: 'none' // Чтобы клики мимо карточек пролетали насквозь в холст
        }}>
          
          {/* Крестик закрытия панели правок */}
          <button 
            onClick={() => setActiveCommentId(null)} 
            style={{ 
              background: 'rgba(0,0,0,0.7)', border: '1px solid #444', color: '#fff', 
              borderRadius: '50%', width: '36px', height: '36px', marginBottom: '10px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              pointerEvents: 'auto', backdropFilter: 'blur(4px)'
            }}
          >
            <X size={20} />
          </button>

          {/* Сам скроллящийся контейнер */}
          <div style={{
            display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
            width: '100%', padding: '0 15px', gap: '15px', boxSizing: 'border-box',
            pointerEvents: 'auto', paddingBottom: '10px'
          }}>
            {comments.map((comment) => {
              const isVis = comment.author === 'Визуализатор';
              const isResolved = comment.is_resolved;
              
              return (
                <div 
                  key={comment.id} 
                  id={`comment-card-${comment.id}`} 
                  onClick={() => setActiveCommentId(comment.id)}
                  style={{
                    flexShrink: 0, width: '85%', maxWidth: '320px', scrollSnapAlign: 'center',
                    background: '#252525', padding: '15px', borderRadius: '16px',
                    borderTop: isVis ? '4px solid #00ff88' : '4px solid transparent',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.5)', transition: '0.3s',
                    opacity: activeCommentId === comment.id ? 1 : 0.6 // Неактивные карточки чуть прозрачные
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: isResolved ? '#555' : (isVis ? '#00ff88' : '#fff'), color: isResolved ? '#aaa' : '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>{comment.number}</div>
                      <span style={{ fontSize: '1rem', fontWeight: 'bold', color: isVis ? '#00ff88' : '#aaa', textDecoration: isResolved ? 'line-through' : 'none' }}>{comment.author || 'Дизайнер'}</span>
                    </div>
                  </div>
                  
                  <textarea 
                    autoFocus={comment.id === activeCommentId && comment.text === ''} 
                    placeholder="Опишите правку..." 
                    value={comment.text || ''} 
                    onChange={(e) => handleTextChange(comment.id, e.target.value)} 
                    onBlur={(e) => handleTextSave(comment.id, e.target.value)} 
                    readOnly={isResolved} 
                    style={{ width: '100%', padding: '12px', background: isResolved ? 'transparent' : '#111', border: isResolved ? 'none' : '1px solid #333', borderRadius: '8px', color: isResolved ? '#888' : 'white', boxSizing: 'border-box', minHeight: '80px', resize: 'none', fontSize: '0.95rem', textDecoration: isResolved ? 'line-through' : 'none', outline: 'none' }} 
                  />
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                    {!isDesigner && ( <button onClick={() => handleToggleResolve(comment.id, isResolved)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid #444', padding: '6px 10px', borderRadius: '8px', color: isResolved ? '#00ff88' : '#888', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>{isResolved ? <CheckCircle2 size={16} /> : <Circle size={16} />} {isResolved ? 'Выполнено' : 'Не выполнено'}</button> )}
                    {(!isDesigner || !isVis) && ( <button onClick={() => { handleDeleteComment(comment.id); setActiveCommentId(null); }} style={{ background: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.3)', padding: '6px 10px', borderRadius: '8px', color: '#ff4d4d', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={16} /></button> )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}