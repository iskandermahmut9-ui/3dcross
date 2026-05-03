import React, { useRef, useState, useEffect } from 'react';

// 🟢 Добавили onPinClick в пропсы
export default function CanvasViewer({ activeTool, comments, onAddPin, imageUrl, initialLines, onSaveLines, userRole, onPinClick, undoSignal }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [isDrawing, setIsDrawing] = useState(false);
  const [lines, setLines] = useState(initialLines || []);
  const [currentLine, setCurrentLine] = useState(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  
  // 🟢 Стейт для зума двумя пальцами на телефоне
  const [initialPinchDistance, setInitialPinchDistance] = useState(null);

  const drawColor = userRole === 'admin' ? '#00ff88' : '#ff0000';

  // 🟢 Улучшенная защита: не дергаем холст, если сервер прислал то же самое количество линий
  useEffect(() => {
    setLines(prevLines => {
      const incomingLines = initialLines || [];
      if (prevLines.length >= incomingLines.length) {
        return prevLines; 
      }
      return incomingLines;
    });
  }, [initialLines]);

  // 🟢 --- А ВОТ ЭТОТ БЛОК ТЕБЕ НУЖНО ВСТАВИТЬ ПРЯМО СЮДА ---
  useEffect(() => {
    if (undoSignal > 0) {
      setLines(initialLines || []); // Принудительно стираем линию по сигналу
    }
  }, [undoSignal]);
  const initCanvasSize = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgRef.current;

    if (canvas && container && img && img.complete && img.naturalWidth > 0) {
      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }

      const contW = container.clientWidth || window.innerWidth;
      const contH = container.clientHeight || window.innerHeight;

      const scaleW = contW / img.naturalWidth;
      const scaleH = contH / img.naturalHeight;
      const initialScale = Math.min(scaleW, scaleH, 1); 

      if (!imageLoaded) {
        setScale(initialScale);
        setPosition({ x: 0, y: 0 });
        setImageLoaded(true);
      }
    }
  };

  useEffect(() => {
    setImageLoaded(false);
    initCanvasSize(); 
    const timer = setTimeout(initCanvasSize, 150); 
    return () => clearTimeout(timer);
  }, [imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return; 

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4 / scale; 

    lines.forEach(line => {
      if (line.points.length === 0) return;
      ctx.strokeStyle = line.color || '#ff0000'; 
      ctx.beginPath();
      ctx.moveTo(line.points[0].x, line.points[0].y);
      line.points.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    });

    if (currentLine && currentLine.points.length > 0) {
      ctx.strokeStyle = currentLine.color;
      ctx.beginPath();
      ctx.moveTo(currentLine.points[0].x, currentLine.points[0].y);
      currentLine.points.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    }
  }, [lines, currentLine, scale, imageLoaded]); 

  // --- ЛОГИКА ДЛЯ МЫШИ (ПК) ---
  const getCanvasCoordinates = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;
    return { x, y };
  };

  const handleMouseDown = (e) => {
    if (!imageLoaded) return; 
    if (activeTool === 'cursor') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    } else if (activeTool === 'draw') {
      setIsDrawing(true);
      setCurrentLine({ color: drawColor, points: [getCanvasCoordinates(e.clientX, e.clientY)] });
    } else if (activeTool === 'pin') {
      const coords = getCanvasCoordinates(e.clientX, e.clientY);
      const canvas = canvasRef.current;
      onAddPin({ x: (coords.x / canvas.width) * 100, y: (coords.y / canvas.height) * 100 });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && activeTool === 'cursor') {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else if (isDrawing && activeTool === 'draw' && currentLine) {
      setCurrentLine({ ...currentLine, points: [...currentLine.points, getCanvasCoordinates(e.clientX, e.clientY)] });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) setIsDragging(false);
    if (isDrawing) {
      setIsDrawing(false);
      if (currentLine) {
        const newLines = [...lines, currentLine];
        setLines(newLines);
        setCurrentLine(null);
        if (onSaveLines) onSaveLines(newLines); 
      }
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.1, scale * (1 + scaleAmount)), 5);
    setScale(newScale);
  };

  // --- 🟢 ЛОГИКА ДЛЯ СЕНСОРНЫХ ЭКРАНОВ (Мобилки) ---
  const handleTouchStart = (e) => {
    if (!imageLoaded) return;
    
    // Зум двумя пальцами (только если выбран курсор)
    if (e.touches.length === 2 && activeTool === 'cursor') {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      setInitialPinchDistance(dist);
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (activeTool === 'cursor') {
        setIsDragging(true);
        setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
      } else if (activeTool === 'draw') {
        setIsDrawing(true);
        setCurrentLine({ color: drawColor, points: [getCanvasCoordinates(touch.clientX, touch.clientY)] });
      } else if (activeTool === 'pin') {
        const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
        const canvas = canvasRef.current;
        onAddPin({ x: (coords.x / canvas.width) * 100, y: (coords.y / canvas.height) * 100 });
      }
    }
  };

  const handleTouchMove = (e) => {
    // Движение двумя пальцами (Зум)
    if (e.touches.length === 2 && activeTool === 'cursor' && initialPinchDistance) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const scaleAmount = (dist - initialPinchDistance) * 0.005; // Чувствительность зума
      const newScale = Math.min(Math.max(0.1, scale + scaleAmount), 5);
      setScale(newScale);
      setInitialPinchDistance(dist); // Обновляем дистанцию для плавности
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (isDragging && activeTool === 'cursor') {
        setPosition({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
      } else if (isDrawing && activeTool === 'draw' && currentLine) {
        setCurrentLine({ ...currentLine, points: [...currentLine.points, getCanvasCoordinates(touch.clientX, touch.clientY)] });
      }
    }
  };

  const handleTouchEnd = () => {
    setInitialPinchDistance(null); // Сбрасываем зум
    handleMouseUp(); // Логика завершения такая же, как на мышке
  };

  const safeImageUrl = imageUrl ? imageUrl.replace(
    'https://bbaoigykxjsrgkthsuiu.supabase.co', 
    import.meta.env.VITE_SUPABASE_URL
  ) : '';

  return (
    <div 
      ref={containerRef}
      onWheel={handleWheel}
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden', 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        touchAction: 'none', // 🟢 Отключает скролл страницы браузером, отдавая все свайпы холсту
        cursor: activeTool === 'cursor' ? (isDragging ? 'grabbing' : 'grab') : 'crosshair' 
      }}
    >
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`, 
        transformOrigin: 'center center', 
        display: 'inline-block' 
      }}>
        
        <img 
          ref={imgRef} 
          src={safeImageUrl} 
          alt="Render" 
          draggable="false"
          onLoad={initCanvasSize} 
          style={{ display: 'block', maxWidth: 'none', userSelect: 'none' }}
        />
        
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          // 🟢 Подключаем слушатели мобильных касаний
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
        
        {comments.map((comment) => {
          const isVis = comment.author === 'Визуализатор';
          const isResolved = comment.is_resolved; 

          const bgColor = isResolved ? 'rgba(80, 80, 80, 0.7)' : (isVis ? '#00ff88' : '#ffffff');
          const textColor = isResolved ? '#aaaaaa' : '#000000';
          const borderColor = isResolved ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.8)';

          return (
            <div 
              key={comment.id}
              // 🟢 Вызываем открытие карточки комментария
              onClick={(e) => { 
                e.stopPropagation(); 
                if (onPinClick) onPinClick(comment.id); 
              }}
              style={{ 
                position: 'absolute', left: `${comment.pos_x}%`, top: `${comment.pos_y}%`, transform: `translate(-50%, -50%) scale(${1 / scale})`, 
                width: '32px', height: '32px', 
                backgroundColor: bgColor, 
                color: textColor, 
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 'bold', 
                border: `3px solid ${borderColor}`, 
                boxShadow: isResolved ? 'none' : '0 4px 10px rgba(0,0,0,0.5)', 
                pointerEvents: 'auto', // 🟢 ВЕРНУЛИ КЛИКАБЕЛЬНОСТЬ ПИНАМ!
                cursor: 'pointer',     // 🟢 Курсор пальца при наведении
                zIndex: isResolved ? 5 : 10 
              }}
            >
              {comment.number}
            </div>
          );
        })}
      </div>
    </div>
  );
}