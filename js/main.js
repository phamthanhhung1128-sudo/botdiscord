/* ============================================================
   MÁY CHỦ LÁ ĐU ĐỦ — LOGIC & HIỆU ỨNG
   👉 Chỉnh thông tin máy chủ tại CONFIG bên dưới
   ============================================================ */
const CONFIG = {
  serverIp: 'play.ladudu.vn',   // (giữ lại cho tương thích)
  baseOnline: 248,              // Số học viên online cơ bản hiển thị
  discord: 'https://discord.gg/ladudu',
};

/* ---------- Preloader ---------- */
window.addEventListener('load', () => {
  setTimeout(() => document.getElementById('preloader').classList.add('done'), 500);
});
setTimeout(() => document.getElementById('preloader').classList.add('done'), 3500); // dự phòng

/* ---------- Lá đu đủ rơi (Canvas) ---------- */
(() => {
  const canvas = document.getElementById('leaves-canvas');
  const ctx = canvas.getContext('2d');
  const LEAF = ['🍃', '🍂', '🌿'];
  let W, H, leaves = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    W = canvas.width = innerWidth;
    H = canvas.height = innerHeight;
  }
  resize();
  addEventListener('resize', resize);

  class Leaf {
    constructor() { this.reset(true); }
    reset(init) {
      this.x = Math.random() * W;
      this.y = init ? Math.random() * H : -40;
      this.size = 14 + Math.random() * 20;
      this.speed = .5 + Math.random() * 1.1;
      this.swing = Math.random() * Math.PI * 2;
      this.swingSpeed = .008 + Math.random() * .02;
      this.rot = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - .5) * .02;
      this.emoji = LEAF[Math.floor(Math.random() * LEAF.length)];
      this.alpha = .35 + Math.random() * .45;
    }
    update() {
      this.y += this.speed;
      this.swing += this.swingSpeed;
      this.x += Math.sin(this.swing) * .8;
      this.rot += this.rotSpeed;
      if (this.y > H + 40) this.reset(false);
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.globalAlpha = this.alpha;
      ctx.font = this.size + 'px serif';
      ctx.fillText(this.emoji, -this.size / 2, this.size / 2);
      ctx.restore();
    }
  }

  if (!reduced) {
    const COUNT = Math.min(26, Math.floor(innerWidth / 60));
    leaves = Array.from({ length: COUNT }, () => new Leaf());
    (function loop() {
      ctx.clearRect(0, 0, W, H);
      leaves.forEach(l => { l.update(); l.draw(); });
      requestAnimationFrame(loop);
    })();
  }
})();

/* ---------- Thanh tiến trình cuộn + Navbar + Nút lên đầu ---------- */
const navbar = document.getElementById('navbar');
const progress = document.getElementById('scroll-progress');
const backTop = document.getElementById('back-top');
addEventListener('scroll', () => {
  const y = scrollY;
  navbar.classList.toggle('scrolled', y > 40);
  backTop.classList.toggle('show', y > 600);
  const h = document.documentElement.scrollHeight - innerHeight;
  progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
}, { passive: true });
backTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

/* ---------- Menu mobile ---------- */
const menuBtn = document.getElementById('menu-btn');
const navLinks = document.getElementById('nav-links');
menuBtn.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  menuBtn.textContent = open ? '✕' : '☰';
});
navLinks.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', () => { navLinks.classList.remove('open'); menuBtn.textContent = '☰'; })
);

/* ---------- Reveal khi cuộn + Link active ---------- */
const revealIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealIO.unobserve(e.target); }
  });
}, { threshold: .12 });
document.querySelectorAll('.reveal, .ranking').forEach(el => revealIO.observe(el));

const sectionIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      document.querySelectorAll('.nav-link').forEach(l =>
        l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });
['trang-chu', 'gioi-thieu', 'tinh-nang', 'che-do', 'tham-gia', 'bxh', 'faq'].forEach(id => {
  const s = document.getElementById(id);
  if (s) sectionIO.observe(s);
});

/* ---------- Đếm số liệu ---------- */
const counterIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, target = +el.dataset.target, dur = 1600, t0 = performance.now();
    (function tick(t) {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.floor(target * (1 - Math.pow(1 - p, 3))).toLocaleString('vi-VN');
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
    counterIO.unobserve(el);
  });
}, { threshold: .6 });
document.querySelectorAll('.counter').forEach(el => counterIO.observe(el));

/* ---------- Số người chơi "trực tiếp" ---------- */
(() => {
  const el = document.getElementById('online-count');
  let n = CONFIG.baseOnline;
  setInterval(() => {
    n = Math.max(800, n + Math.floor((Math.random() - .45) * 24));
    el.textContent = n.toLocaleString('vi-VN');
  }, 4000);
})();

/* ---------- Parallax chuột ở Hero ---------- */
(() => {
  const hero = document.querySelector('.hero');
  const layers = document.querySelectorAll('[data-parallax]');
  const fine = matchMedia('(pointer: fine)').matches;
  if (!fine) return;
  hero.addEventListener('mousemove', e => {
    const cx = (e.clientX / innerWidth - .5), cy = (e.clientY / innerHeight - .5);
    layers.forEach(l => {
      const f = +l.dataset.parallax;
      l.style.transform = `translate(${cx * f}px, ${cy * f}px)`;
    });
  });
})();

/* ---------- Thẻ 3D Tilt + Vệt sáng ---------- */
(() => {
  const fine = matchMedia('(pointer: fine)').matches;
  if (!fine) return;
  document.querySelectorAll('.tilt').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.transform = `perspective(800px) rotateY(${(x - .5) * 10}deg) rotateX(${(.5 - y) * 10}deg) translateY(-4px)`;
      card.style.setProperty('--mx', x * 100 + '%');
      card.style.setProperty('--my', y * 100 + '%');
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
})();

/* ---------- Nút nam châm (Magnetic) ---------- */
(() => {
  const fine = matchMedia('(pointer: fine)').matches;
  if (!fine) return;
  document.querySelectorAll('.magnetic').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .22}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  });
})();

/* ---------- Copy IP + Toast + Pháo giấy ---------- */
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function confettiBurst(x, y) {
  const colors = ['#84cc16', '#34d399', '#fb923c', '#fbbf24', '#fff'];
  for (let i = 0; i < 36; i++) {
    const p = document.createElement('div');
    p.textContent = ['🍃', '✨', '🎉'][Math.floor(Math.random() * 3)];
    p.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:2000;pointer-events:none;font-size:${12 + Math.random() * 14}px;`;
    document.body.appendChild(p);
    const ang = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 130;
    p.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist + 120}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
    ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => p.remove();
  }
}

async function copyIp(e) {
  const ip = CONFIG.serverIp;
  try {
    await navigator.clipboard.writeText(ip);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = ip; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove();
  }
  showToast(`✅ Đã sao chép IP: ${ip} — vào game thôi!`);
  if (e && e.clientX) confettiBurst(e.clientX, e.clientY);
}
document.querySelectorAll('[data-copy-ip]').forEach(el =>
  el.addEventListener('click', copyIp)
);

/* ---------- Tabs chế độ chơi ---------- */
const tabs = document.querySelectorAll('.tab');
tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'panel-' + tab.dataset.tab));
}));

/* ---------- FAQ Accordion ---------- */
document.querySelectorAll('.faq-item').forEach(item => {
  const q = item.querySelector('.faq-q'), a = item.querySelector('.faq-a');
  q.addEventListener('click', () => {
    const open = item.classList.toggle('open');
    a.style.maxHeight = open ? a.scrollHeight + 'px' : '0px';
  });
});

/* ---------- Khởi tạo IP từ CONFIG ---------- */
document.querySelectorAll('#server-ip, .ip-box code').forEach(el => el.textContent = CONFIG.serverIp);
