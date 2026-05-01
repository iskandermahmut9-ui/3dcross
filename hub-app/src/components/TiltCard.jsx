import React, { useRef, useState } from 'react';

const TiltCard = ({ children, style, onClick }) => {
  const cardRef = useRef(null);
  const [transform, setTransform] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)');
  const [transition, setTransition] = useState('transform 0.3s ease-out');

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const divisor = 40; 
    
    const rotateX = -1 * (y - centerY) / divisor;
    const rotateY = (x - centerX) / divisor;

    setTransition('transform 0.1s ease-out'); 
    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`);
  };

  const handleMouseLeave = () => {
    setTransition('transform 0.4s ease-out');
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)');
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transition: transition,
        transform: transform,
        cursor: 'pointer',
        ...style
      }}
    >
      {children}
    </div>
  );
};

export default TiltCard;