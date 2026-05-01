// --- 1. ЛОГИКА ГАЛЕРЕИ (LIGHTBOX) ---
let currentImages = []; 
let currentIndex = 0;   
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const cards = document.querySelectorAll('.project-card');

cards.forEach(card => {
    card.addEventListener('click', function() {
        const imagesRaw = this.getAttribute('data-images');
        if (!imagesRaw) {
            currentImages = [this.querySelector('img').src];
        } else {
            currentImages = imagesRaw.split(',').map(img => img.trim());
        }
        currentIndex = 0;
        updateImage();
        lightbox.classList.add('active');
    });

    // Эффект перелистывания при наведении (ПК)
    let hoverInterval;
    let hoverIndex = 0;
    const imgElement = card.querySelector('.card-img');
    const originalSrc = imgElement.src;
    const imagesRaw = card.getAttribute('data-images');
    
    if (imagesRaw) {
        const hoverImages = imagesRaw.split(',').map(img => img.trim());
        card.addEventListener('mouseenter', () => {
            if (window.innerWidth > 768) {
                hoverIndex = 0;
                hoverInterval = setInterval(() => {
                    hoverIndex = (hoverIndex + 1) % hoverImages.length;
                    imgElement.src = hoverImages[hoverIndex];
                }, 1000);
            }
        });
        card.addEventListener('mouseleave', () => {
            if (hoverInterval) {
                clearInterval(hoverInterval);
                imgElement.src = originalSrc;
            }
        });
    }
});

function changeSlide(direction, event) {
    if(event) event.stopPropagation(); 
    currentIndex += direction;
    if (currentIndex >= currentImages.length) currentIndex = 0;
    else if (currentIndex < 0) currentIndex = currentImages.length - 1;
    updateImage();
}

function updateImage() { lightboxImg.src = currentImages[currentIndex]; }

function closeLightbox(event) {
    if (!event || event.target === lightbox || event.target.classList.contains('close-btn')) {
        lightbox.classList.remove('active');
    }
}

// --- 2. МЕНЮ И СКРОЛЛ ---
function toggleMenu() {
    const menu = document.getElementById('overlay-menu');
    menu.classList.toggle('active');
}

function scrollToSection(selector) {
    const el = document.querySelector(selector);
    if(el) el.scrollIntoView({ behavior: 'smooth' });
}

// --- 3. ВИДЕО ---
function playVideo() {
    const video = document.getElementById('videoPlayer');
    const overlay = document.querySelector('.play-btn-overlay');
    if (video.paused) {
        video.play();
        overlay.style.opacity = '0'; 
        video.setAttribute('controls', 'controls'); 
    } else {
        video.pause();
        overlay.style.opacity = '1';
        video.removeAttribute('controls');
    }
}