import React, { useRef, useState, useEffect } from 'react';

export default function CanvasViewer({ activeTool, comments, onAddPin, imageUrl, initialLines, onSaveLines, userRole }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null); // Добавили ссылку на саму картинку

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [isDrawing, setIsDrawing] = useState(false);
  const [lines, setLines] = useState(initialLines || []);
  const [currentLine, setCurrentLine] = useState(null);

  const [imageLoaded, setImageLoaded] = useState(false);

  const drawColor = userRole === 'admin' ? '#00ff88' : '#ff0000';

  // 1. Обновляем линии при переключении итераций
  useEffect(() => {
    setLines(initialLines || []);
  }, [initialLines]);

  // 2. Бронебойная инициализация холста (даже если картинка из кэша)
  const initCanvasSize = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgRef.current;

    // Проверяем, загрузилась ли картинка и есть ли у нее размеры
    if (canvas && container && img && img.complete && img.naturalWidth > 0) {
      
      // Задаем размер только если он изменился (чтобы не стирать холст просто так)
      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }

      const padding = 100; 
      const contW = container.clientWidth || window.innerWidth;
      const contH = container.clientHeight || window.innerHeight;

      const scaleW = contW / img.naturalWidth;
      const scaleH = contH / img.naturalHeight;
      const initialScale = Math.min(scaleW, scaleH, 1); 

      // Если это первая загрузка - центрируем
      if (!imageLoaded) {
        setScale(initialScale);
        setPosition({ x: 0, y: 0 });
        setImageLoaded(true);
      }
    }
  };

  // Вызываем проверку при смене картинки
  useEffect(() => {
    setImageLoaded(false);
    initCanvasSize(); // Пробуем сразу (если кэш)
    const timer = setTimeout(initCanvasSize, 150); // Пробуем чуть позже (когда DOM построится)
    return () => clearTimeout(timer);
  }, [imageUrl]);

  // 3. Главный эффект отрисовки
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

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    return { x, y };
  };

  const handleMouseDown = (e) => {
    if (!imageLoaded) return; // Защита от кликов до загрузки
    if (activeTool === 'cursor') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    } else if (activeTool === 'draw') {
      setIsDrawing(true);
      setCurrentLine({ color: drawColor, points: [getCanvasCoordinates(e)] });
    } else if (activeTool === 'pin') {
      const coords = getCanvasCoordinates(e);
      const canvas = canvasRef.current;
      onAddPin({ x: (coords.x / canvas.width) * 100, y: (coords.y / canvas.height) * 100 });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && activeTool === 'cursor') {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else if (isDrawing && activeTool === 'draw' && currentLine) {
      setCurrentLine({ ...currentLine, points: [...currentLine.points, getCanvasCoordinates(e)] });
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

  // 🔴 1. ВСТАВЛЯЕМ ЭТОТ БЛОК ПРЯМО ПЕРЕД return
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
          ref={imgRef} // Привязали Ref
          src={safeImageUrl} 
          alt="Render" 
          draggable="false"
          onLoad={initCanvasSize} // Вызываем нашу умную функцию
          style={{ display: 'block', maxWidth: 'none', userSelect: 'none' }}
        />
        
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
        
        {comments.map((comment) => {
          const isVis = comment.author === 'Визуализатор';
          const isResolved = comment.is_resolved; // 🟢 Читаем статус из базы

          // 🟢 Если выполнено - серый цвет. Если нет - стандартные цвета.
          const bgColor = isResolved ? 'rgba(80, 80, 80, 0.7)' : (isVis ? '#00ff88' : '#ffffff');
          const textColor = isResolved ? '#aaaaaa' : '#000000';
          const borderColor = isResolved ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.8)';

          return (
            <div 
              key={comment.id}
              style={{ 
                position: 'absolute', left: `${comment.pos_x}%`, top: `${comment.pos_y}%`, transform: `translate(-50%, -50%) scale(${1 / scale})`, 
                width: '32px', height: '32px', 
                backgroundColor: bgColor, 
                color: textColor, 
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 'bold', 
                border: `3px solid ${borderColor}`, 
                boxShadow: isResolved ? 'none' : '0 4px 10px rgba(0,0,0,0.5)', // Убираем тень у выполненных
                pointerEvents: 'none', 
                zIndex: isResolved ? 5 : 10 // Выполненные пины уходят на задний план
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