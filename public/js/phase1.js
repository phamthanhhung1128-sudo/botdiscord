/* ==========================================================================
   public/js/phase1.js
   --------------------------------------------------------------------------
   ⚠️ FILE TẠM CỦA GIAI ĐOẠN 1.
   Giai đoạn 2 sẽ tách thành: js/core/bus.js, js/transitions.js, js/motion.js,
   js/app.js + các module theo trang. Tất cả dùng ES module và được `defer`.

   Quy tắc đang áp dụng ngay từ bây giờ:
     - Không dùng `window.onscroll` → IntersectionObserver.
     - Mọi listener đều có hàm cleanup để tránh rò rỉ bộ nhớ.
     - Không đọc/ghi layout trong vòng lặp animation (tránh layout thrashing).
   ========================================================================== */
(function () {
  'use strict';

  // Đánh dấu JS đã chạy → CSS biết có thể ẩn/hiện phần tử an toàn
  document.documentElement.classList.add('js');

  /* ------------------------------------------------------------------ *
   * 1. Menu mobile
   * ------------------------------------------------------------------ */
  function initNavToggle() {
    const toggle = document.querySelector('[data-nav-toggle]');
    const nav = document.querySelector('[data-nav]');
    if (!toggle || !nav) return function () {};

    function onClick() {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isOpen));
      nav.classList.toggle('is-open', !isOpen);
    }

    // Đóng menu khi bấm phím Escape (dễ dùng bằng bàn phím)
    function onKeydown(e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
        toggle.focus();
      }
    }

    // Đóng menu sau khi chọn 1 liên kết (mobile)
    function onNavClick(e) {
      if (e.target.closest('a') && window.matchMedia('(max-width: 719px)').matches) {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    }

    toggle.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    nav.addEventListener('click', onNavClick);

    return function cleanup() {
      toggle.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeydown);
      nav.removeEventListener('click', onNavClick);
    };
  }

  /* ------------------------------------------------------------------ *
   * 2. Đóng thông báo flash
   * ------------------------------------------------------------------ */
  function initFlash() {
    const handler = function (e) {
      const btn = e.target.closest('[data-flash-close]');
      if (!btn) return;
      const flash = btn.closest('.flash');
      if (!flash) return;
      // Chỉ animate opacity/transform → chạy trên GPU
      flash.style.transition = 'opacity .2s ease, transform .2s ease';
      flash.style.opacity = '0';
      flash.style.transform = 'translate3d(0,-6px,0)';
      window.setTimeout(() => flash.remove(), 210);
    };
    document.addEventListener('click', handler);
    return function cleanup() {
      document.removeEventListener('click', handler);
    };
  }

  /* ------------------------------------------------------------------ *
   * 3. Scroll reveal bằng IntersectionObserver
   *    (KHÔNG dùng window.onscroll → không gây jank)
   * ------------------------------------------------------------------ */
  function initReveal() {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = document.querySelectorAll('.panel, .hero-panel, .stat, .roadmap__item');
    if (!targets.length) return function () {};

    // Máy yếu / người dùng muốn giảm chuyển động → hiện luôn
    if (prefersReduced || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-visible'));
      return function () {};
    }

    targets.forEach((el, i) => {
      el.classList.add('reveal');
      // Delay nhỏ theo thứ tự để tạo nhịp (tối đa 300ms)
      el.style.transitionDelay = `${Math.min(i * 40, 300)}ms`;
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target); // reveal 1 lần rồi thôi → nhẹ CPU
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );

    targets.forEach((el) => io.observe(el));

    return function cleanup() {
      io.disconnect();
    };
  }

  /* ------------------------------------------------------------------ *
   * 4. Khởi động + dọn dẹp
   * ------------------------------------------------------------------ */
  const cleanups = [];

  function boot() {
    cleanups.push(initNavToggle(), initFlash(), initReveal());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Dọn listener khi rời trang (hữu ích khi dùng View Transitions ở Giai đoạn 2)
  window.addEventListener('pagehide', function () {
    cleanups.forEach((fn) => typeof fn === 'function' && fn());
    cleanups.length = 0;
  });
})();
