/* ============================================================
   LÁ ĐU ĐỦ HỌC TẬP — Logic 4 tính năng
   1. Tính điểm rèn luyện   2. Video học   3. Đăng bài   4. Chat
   Dữ liệu lưu bằng localStorage (trên trình duyệt của bạn)
   ============================================================ */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = name => name.trim().split(/\s+/).map(w => w[0]).slice(-2).join('').toUpperCase() || '?';
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return Math.floor(s / 60) + ' phút trước';
  if (s < 86400) return Math.floor(s / 3600) + ' giờ trước';
  return Math.floor(s / 86400) + ' ngày trước';
}
const nowTime = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/* ============================================================
   1. ĐIỂM RÈN LUYỆN (thang 100 — Bộ GD&ĐT)
   ============================================================ */
const RL_CATS = [
  { id: 'hoctap',  name: '📚 Ý thức học tập', max: 20, desc: 'Kết quả học tập, chuyên cần, thái độ học tập.', tip: 'Đi học đầy đủ, nộp bài đúng hạn và giữ GPA tốt sẽ đạt điểm cao mục này.' },
  { id: 'noiquy',  name: '⚖️ Chấp hành nội quy, pháp luật', max: 25, desc: 'Tuân thủ quy định nhà trường, pháp luật, không vi phạm kỷ luật.', tip: 'Không vi phạm kỷ luật, giữ gìn tài sản chung và tôn trọng giảng viên.' },
  { id: 'xahoi',   name: '🤝 Hoạt động xã hội', max: 20, desc: 'Tham gia tình nguyện, hoạt động xã hội, phong trào của trường/lớp.', tip: 'Tham gia hiến máu, tình nguyện, ngày hội việc làm... mỗi hoạt động đều có điểm.' },
  { id: 'congdong',name: '🏘️ Công dân trong cộng đồng', max: 20, desc: 'Ý thức cộng đồng, giúp đỡ bạn bè, giữ gìn môi trường, văn hóa ứng xử.', tip: 'Giúp đỡ bạn học, tham gia dọn dẹp, ứng xử văn minh nơi công cộng.' },
  { id: 'vanthe',  name: '🏃 Văn hóa, thể thao', max: 15, desc: 'Tham gia hoạt động văn nghệ, thể thao, hội thi của trường.', tip: 'Tham gia hội thao, văn nghệ, câu lạc bộ thể thao để cộng điểm.' },
];
const RL_RATING = [
  { min: 90, label: '🌟 XUẤT SẮC', cls: 'xs', hint: 'Tuyệt vời! Bạn là tấm gương rèn luyện cho mọi người. Tiếp tục phát huy nhé!' },
  { min: 80, label: '👍 TỐT', cls: 'tot', hint: 'Rất tốt! Chỉ cần cố gắng thêm một chút ở mục còn thấp để đạt Xuất sắc.' },
  { min: 65, label: '🙂 KHÁ', cls: 'kha', hint: 'Khá tốt. Hãy tham gia thêm hoạt động xã hội và văn thể để nâng điểm lên Tốt.' },
  { min: 50, label: '😐 TRUNG BÌNH', cls: 'tb', hint: 'Mức trung bình. Bạn nên tích cực tham gia hoạt động của lớp/trường hơn nữa.' },
  { min: 0,  label: '⚠️ YẾU', cls: 'yeu', hint: 'Cần cải thiện nhiều. Hãy bắt đầu từ việc đi học đầy đủ và tham gia hoạt động lớp!' },
];

const rlWrap = $('#rl-categories');
RL_CATS.forEach(c => {
  const div = document.createElement('div');
  div.className = 'rl-cat';
  div.innerHTML = `
    <div class="rl-cat-head"><strong>${c.name}</strong><span class="max">tối đa ${c.max} điểm</span></div>
    <p>${c.desc}</p>
    <div class="rl-slider-row">
      <input type="range" min="0" max="${c.max}" value="0" data-rl="${c.id}" aria-label="${c.name}" />
      <span class="rl-val" id="rl-val-${c.id}">0</span>
    </div>`;
  rlWrap.appendChild(div);
});

const CIRC = 540.4; // chu vi vòng tròn điểm
function rlCalc() {
  let total = 0, lowest = null;
  RL_CATS.forEach(c => {
    const v = +document.querySelector(`[data-rl="${c.id}"]`).value;
    document.getElementById('rl-val-' + c.id).textContent = v;
    total += v;
    if (!lowest || v / c.max < lowest.ratio) lowest = { ...c, v, ratio: v / c.max };
  });
  $('#rl-total').textContent = total;
  const fg = $('#ring-fg');
  fg.style.strokeDashoffset = CIRC - (CIRC * total) / 100;
  fg.style.stroke = total >= 80 ? 'var(--green)' : total >= 65 ? '#60a5fa' : total >= 50 ? 'var(--orange)' : '#f87171';
  const r = RL_RATING.find(x => total >= x.min);
  const badge = $('#rl-rating');
  badge.textContent = total === 0 ? 'Chưa xếp loại' : r.label;
  badge.className = 'rl-rating' + (total === 0 ? '' : ' ' + r.cls);
  let hint = r.hint;
  if (total > 0 && lowest && lowest.ratio < 0.6)
    hint += ` 💡 Gợi ý: mục "${lowest.name}" đang thấp (${lowest.v}/${lowest.max}) — ${lowest.tip}`;
  $('#rl-hint').textContent = hint;
  return total;
}
$$('[data-rl]').forEach(el => el.addEventListener('input', rlCalc));
rlCalc();

$('#rl-sample').addEventListener('click', () => {
  const sample = { hoctap: 17, noiquy: 23, xahoi: 15, congdong: 16, vanthe: 11 };
  RL_CATS.forEach(c => document.querySelector(`[data-rl="${c.id}"]`).value = sample[c.id]);
  rlCalc(); showToast('✨ Đã điền điểm mẫu — hãy chỉnh theo thực tế của bạn!');
});
$('#rl-reset').addEventListener('click', () => {
  RL_CATS.forEach(c => document.querySelector(`[data-rl="${c.id}"]`).value = 0);
  rlCalc();
});

function rlRenderHistory() {
  const list = store.get('ladudu_rl_history', []);
  const box = $('#rl-history');
  if (!list.length) { box.innerHTML = '<p class="muted">Chưa có kết quả nào được lưu.</p>'; return; }
  box.innerHTML = list.slice().reverse().map(h => `
    <div class="rl-hist-item">
      <span>${esc(h.name)} • ${esc(h.semester)}<br><small class="muted">${h.date}</small></span>
      <strong>${h.total} đ</strong>
    </div>`).join('');
}
$('#rl-save').addEventListener('click', () => {
  const total = rlCalc();
  const name = $('#rl-name').value.trim() || 'Sinh viên';
  const semester = $('#rl-semester').value;
  const list = store.get('ladudu_rl_history', []);
  list.push({ name, semester, total, date: new Date().toLocaleDateString('vi-VN') });
  store.set('ladudu_rl_history', list);
  rlRenderHistory();
  showToast(`💾 Đã lưu: ${name} — ${total} điểm (${semester})`);
});
$('#rl-clear-history').addEventListener('click', () => {
  store.set('ladudu_rl_history', []);
  rlRenderHistory(); showToast('🗑️ Đã xóa lịch sử điểm rèn luyện.');
});
rlRenderHistory();

/* ============================================================
   2. VIDEO HỌC (nhúng YouTube — chế độ không cookie)
   ============================================================ */
const VIDEOS = [
  { id: 'z2DM6-P6CE8', cat: 'toan', catName: '📐 Toán', title: 'Toán 12 — Cực trị của hàm số (Tiết 1)', desc: 'Đại số chương 1: nắm vững kiến thức cực trị hàm số.' },
  { id: 'QM9oJGuq58g', cat: 'toan', catName: '📐 Toán', title: 'Toán 12 — Khảo sát sự biến thiên & vẽ đồ thị hàm số', desc: 'Bài 5 chương 1: phương pháp khảo sát hàm số đầy đủ.' },
  { id: 'h0smy5vG8Ik', cat: 'toan', catName: '📐 Toán', title: 'Toán 12 — Cộng, trừ và nhân số phức', desc: 'Chương 4 số phức: phép toán cơ bản dễ hiểu.' },
  { id: 'pHBS-uFNdOA', cat: 'van', catName: '📖 Văn', title: 'Ngữ văn 12 — Viết đoạn văn 200 chữ phân tích tác phẩm thơ', desc: 'Lớp văn thầy Nhật: kỹ năng viết đoạn văn phân tích thơ.' },
  { id: 'Tst42if_o1E', cat: 'van', catName: '📖 Văn', title: 'Ngữ văn 12 — Phân tích tác phẩm kí (chương trình mới)', desc: 'Hướng dẫn viết đoạn văn phân tích tác phẩm kí.' },
  { id: 'bIqzTnEl9cg', cat: 'van', catName: '📖 Văn', title: 'Ngữ văn 12 — Phân tích tác phẩm thơ (chương trình mới)', desc: 'Phương pháp phân tích thơ hiệu quả cho kỳ thi.' },
  { id: 'JY9NZ70tHgk', cat: 'ly', catName: '⚛️ Vật lý', title: 'Vật lý 12 — Đại cương về dao động điều hòa', desc: 'Bài mở đầu chương dao động: khái niệm và phương trình.' },
  { id: 'Lr8xrZ8mANo', cat: 'ly', catName: '⚛️ Vật lý', title: 'Vật lý 12 — Tính chất của sóng ánh sáng', desc: 'Chương sóng ánh sáng: tán sắc, giao thoa, nhiễu xạ.' },
  { id: 'UHrJr-RVphU', cat: 'ly', catName: '⚛️ Vật lý', title: 'Vật lý 12 — Dao động tắt dần, duy trì, cưỡng bức, cộng hưởng', desc: 'Các loại dao động và hiện tượng cộng hưởng.' },
  { id: 'cZQ6m3W4OU4', cat: 'tin', catName: '💻 Tin học', title: 'Khóa học Lập trình Python cơ bản cho người mới', desc: 'Học Python từ con số 0 với bài tập thực hành.' },
  { id: 'zjpHyEfoCpc', cat: 'tin', catName: '💻 Tin học', title: 'Học Python cơ bản trong 10 phút', desc: 'Giới thiệu tổng quan Python bằng tiếng Việt.' },
  { id: 'zr5I4pn2GmA', cat: 'tin', catName: '💻 Tin học', title: 'Lập trình Python cơ bản cho người mới bắt đầu', desc: 'Cài đặt, biến, vòng lặp, hàm — đầy đủ cơ bản.' },
  { id: 'vtIwb0_H7aM', cat: 'anh', catName: '🗣️ Tiếng Anh', title: 'Tiếng Anh giao tiếp cơ bản cho người mới bắt đầu', desc: 'Luyện giao tiếp hàng ngày tại nhà hiệu quả.' },
  { id: '2dA4Ju0uV5s', cat: 'anh', catName: '🗣️ Tiếng Anh', title: '30 ngày tự học luyện nghe tiếng Anh giao tiếp', desc: 'Tuần 1: các đoạn hội thoại cơ bản cho người mới.' },
  { id: 'd16YA70ed1w', cat: 'kynang', catName: '🌱 Kỹ năng sống', title: 'Kỹ năng quản lý thời gian cho sinh viên', desc: 'Mẹo quản lý thời gian học tập và sinh hoạt hiệu quả.' },
  { id: 'i5psKJfOK8Q', cat: 'kynang', catName: '🌱 Kỹ năng sống', title: '12 mẹo quản lý thời gian cho học sinh, sinh viên', desc: 'Bí quyết cân bằng học tập và cuộc sống.' },
  { id: 'ALfG9w79hiM', cat: 'kynang', catName: '🌱 Kỹ năng sống', title: 'Tips for Time Management for College Students', desc: 'Lời khuyên quản lý thời gian từ chuyên gia kỹ năng sống.' },
];

const videoGrid = $('#video-grid');
function renderVideos(cat = 'all') {
  videoGrid.innerHTML = VIDEOS.filter(v => cat === 'all' || v.cat === cat).map(v => `
    <button class="video-card" data-video="${v.id}" data-title="${esc(v.title)}">
      <span class="video-thumb">
        <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="${esc(v.title)}" loading="lazy" />
        <span class="video-cat">${v.catName}</span>
        <span class="play-btn"><span>▶</span></span>
      </span>
      <span class="video-body">
        <h3>${esc(v.title)}</h3>
        <p>${esc(v.desc)}</p>
      </span>
    </button>`).join('');
}
renderVideos();
$('#video-filters').addEventListener('click', e => {
  const btn = e.target.closest('.vfilter'); if (!btn) return;
  $$('.vfilter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderVideos(btn.dataset.cat);
});

/* Modal phát video */
const modal = $('#video-modal'), frame = $('#vm-frame');
function openVideo(id, title) {
  $('#vm-title').textContent = title;
  frame.src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1`;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeVideo() {
  modal.hidden = true;
  frame.src = '';
  document.body.style.overflow = '';
}
videoGrid.addEventListener('click', e => {
  const card = e.target.closest('[data-video]');
  if (card) openVideo(card.dataset.video, card.dataset.title);
});
modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeVideo(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeVideo(); });

/* ============================================================
   3. ĐĂNG BÀI (lưu localStorage)
   ============================================================ */
const SEED_POSTS = [
  { id: 'seed1', name: 'Minh Anh', cat: 'Kinh nghiệm', title: 'Cách ôn thi cuối kỳ hiệu quả trong 2 tuần', body: 'Chia sẻ với các bạn cách mình ôn thi: chia nhỏ môn học theo ngày, học theo sơ đồ tư duy, và luôn ôn lại sau 1-2-4 ngày. Đừng học dồn, ngủ đủ giấc là rất quan trọng nhé!', ts: Date.now() - 86400000 * 2, likes: 24, mine: false },
  { id: 'seed2', name: 'Quốc Bảo', cat: 'Hỏi bài', title: 'Ai giải giúp mình bài số phức chương 4?', body: 'Mình đang học bài cộng trừ nhân số phức mà chưa hiểu phần mô-đun. Bạn nào có tài liệu hay video giải thích dễ hiểu thì chia sẻ với mình nhé. Cảm ơn mọi người!', ts: Date.now() - 86400000, likes: 8, mine: false },
  { id: 'seed3', name: 'Thu Hằng', cat: 'Tài liệu', title: 'Tổng hợp tài liệu Python cho người mới bắt đầu', body: 'Mình tổng hợp được bộ tài liệu Python cơ bản gồm bài giảng, bài tập và đáp án. Bạn nào cần thì nhắn tin trong phần chat, mình gửi nhé!', ts: Date.now() - 3600000 * 5, likes: 31, mine: false },
  { id: 'seed4', name: 'Đức Huy', cat: 'Chia sẻ', title: 'Kinh nghiệm đạt điểm rèn luyện loại Tốt', body: 'Điểm rèn luyện của mình học kỳ này là 86. Bí quyết: đi học đầy đủ, tham gia 2 hoạt động tình nguyện và 1 hội thao. Các bạn nhớ dùng công cụ tính điểm rèn luyện ở đầu trang để theo dõi nhé!', ts: Date.now() - 3600000 * 2, likes: 19, mine: false },
];
let posts = store.get('ladudu_posts', null) || SEED_POSTS;

function renderPosts() {
  const q = ($('#post-search').value || '').toLowerCase();
  const f = $('#post-filter').value;
  const list = posts.filter(p =>
    (f === 'all' || p.cat === f) &&
    (p.title + p.body + p.name).toLowerCase().includes(q)
  ).sort((a, b) => b.ts - a.ts);

  $('#posts-list').innerHTML = list.length ? list.map(p => `
    <article class="post-item">
      <div class="post-head">
        <span class="avatar">${esc(initials(p.name))}</span>
        <div class="post-meta"><strong>${esc(p.name)}</strong><span>${timeAgo(p.ts)}</span></div>
        <span class="post-cat">${esc(p.cat)}</span>
      </div>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.body)}</p>
      <div class="post-foot">
        <button class="like-btn ${p.liked ? 'liked' : ''}" data-like="${p.id}">❤️ ${p.likes}</button>
        ${p.mine ? `<button class="del-btn" data-del="${p.id}">🗑️ Xóa bài</button>` : ''}
      </div>
    </article>`).join('')
    : '<div class="empty-posts">📭 Chưa có bài viết nào. Hãy là người đầu tiên chia sẻ!</div>';
}
renderPosts();
$('#post-search').addEventListener('input', renderPosts);
$('#post-filter').addEventListener('change', renderPosts);

$('#post-form').addEventListener('submit', e => {
  e.preventDefault();
  posts.push({
    id: 'p' + Date.now(),
    name: $('#post-name').value.trim(),
    cat: $('#post-cat').value,
    title: $('#post-title').value.trim(),
    body: $('#post-body').value.trim(),
    ts: Date.now(), likes: 0, mine: true,
  });
  store.set('ladudu_posts', posts);
  e.target.reset();
  renderPosts();
  showToast('🚀 Đã đăng bài thành công!');
  $('#posts-list').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
$('#posts-list').addEventListener('click', e => {
  const like = e.target.closest('[data-like]');
  const del = e.target.closest('[data-del]');
  if (like) {
    const p = posts.find(x => x.id === like.dataset.like);
    p.liked = !p.liked; p.likes += p.liked ? 1 : -1;
    store.set('ladudu_posts', posts); renderPosts();
  }
  if (del) {
    posts = posts.filter(x => x.id !== del.dataset.del);
    store.set('ladudu_posts', posts); renderPosts();
    showToast('🗑️ Đã xóa bài viết.');
  }
});

/* ============================================================
   4. CHAT (demo — lưu localStorage + bạn học ảo trả lời)
   ============================================================ */
const CHAT_USERS = [
  { name: 'Minh Anh', role: 'Toán', on: true },
  { name: 'Quốc Bảo', role: 'Tin học', on: true },
  { name: 'Thu Hằng', role: 'Tiếng Anh', on: true },
  { name: 'Đức Huy', role: 'Vật lý', on: true },
  { name: 'Ngọc Linh', role: 'Văn', on: true },
  { name: 'Hoàng Nam', role: 'Kỹ năng', on: false },
  { name: 'Phương Thảo', role: 'Toán', on: true },
  { name: 'Tuấn Kiệt', role: 'Tin học', on: false },
];
$('#chat-users').innerHTML = CHAT_USERS.map(u =>
  `<li><span class="u-dot ${u.on ? '' : 'away'}"></span>${u.name}<small>${u.role}</small></li>`).join('');
$('#chat-online-n').textContent = CHAT_USERS.filter(u => u.on).length;

const BOT_REPLIES = [
  'Chào bạn! Bạn đang học môn gì thế? 📚',
  'Mình cũng đang ôn bài này, học nhóm cùng nhau không? 🤝',
  'Bạn thử xem video bài giảng ở mục Video học nhé, hay lắm!',
  'Điểm rèn luyện của bạn học kỳ này được bao nhiêu? Dùng công cụ tính ở trên thử xem 📊',
  'Có tài liệu gì hay thì đăng bài chia sẻ ở mục Đăng bài nhé!',
  'Học mệt thì nghỉ giải lao chút rồi học tiếp nhé 💪',
  'Bạn cần giúp bài nào không? Cứ hỏi thoải mái nhé!',
  'Cuối tuần này có học nhóm không? Rủ thêm bạn bè nhé 🎉',
  'Mẹo học: chia nhỏ bài ra học từng phần, đừng học dồn nhé!',
  'Cố lên! Học tập là cả một hành trình 🍃',
];
const BOT_GREET = [
  { name: 'Minh Anh', text: 'Chào mọi người! Hôm nay học bài số phức có ai hiểu không? 👋' },
  { name: 'Thu Hằng', text: 'Mình vừa đăng tài liệu Python ở mục Đăng bài, mọi người vào xem nhé 📚' },
  { name: 'Đức Huy', text: 'Điểm rèn luyện học kỳ này của mình được 86, vui quá! 🎉' },
];

const chatBox = $('#chat-messages');
let chatMsgs = store.get('ladudu_chat', null);
if (!chatMsgs) {
  chatMsgs = BOT_GREET.map((m, i) => ({ name: m.name, text: m.text, ts: Date.now() - (3 - i) * 60000, me: false }));
  store.set('ladudu_chat', chatMsgs);
}

function renderChat() {
  chatBox.innerHTML = chatMsgs.map(m => `
    <div class="msg ${m.me ? 'me' : ''}">
      <span class="avatar">${esc(initials(m.name))}</span>
      <div class="msg-body">
        <div class="msg-name">${esc(m.name)}${m.me ? ' (Bạn)' : ''}</div>
        <div class="msg-text">${esc(m.text)}</div>
        <div class="msg-time">${m.time || ''}</div>
      </div>
    </div>`).join('');
  chatBox.scrollTop = chatBox.scrollHeight;
}
renderChat();

function botReply() {
  const online = CHAT_USERS.filter(u => u.on);
  const bot = online[Math.floor(Math.random() * online.length)];
  const typing = $('#chat-typing');
  typing.hidden = false;
  typing.firstElementChild.style.background = 'var(--green)';
  setTimeout(() => {
    typing.hidden = true;
    chatMsgs.push({
      name: bot.name,
      text: BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)],
      time: nowTime(), me: false,
    });
    store.set('ladudu_chat', chatMsgs);
    renderChat();
  }, 1400 + Math.random() * 1200);
}

$('#chat-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = $('#chat-text');
  const text = input.value.trim();
  if (!text) return;
  chatMsgs.push({ name: 'Bạn', text, time: nowTime(), me: true });
  store.set('ladudu_chat', chatMsgs);
  input.value = '';
  renderChat();
  botReply();
});
$$('.chat-emojis button').forEach(b => b.addEventListener('click', () => {
  $('#chat-text').value += b.textContent;
  $('#chat-text').focus();
}));
$('#chat-clear').addEventListener('click', () => {
  chatMsgs = [];
  store.set('ladudu_chat', chatMsgs);
  renderChat();
  showToast('🗑️ Đã xóa lịch sử chat.');
});
