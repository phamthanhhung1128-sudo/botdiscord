/* AutoSlide AI — giao tiếp API và điều khiển giao diện. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const state = { spec: null, fileId: null, busy: false, toastTimer: null };
  const input = $('#messageInput');
  const sendButton = $('#sendButton');
  const generateButton = $('#generateButton');
  const progressPanel = $('#progressPanel');
  const progressBar = $('#progressBar');
  const progressTitle = $('#progressTitle');
  const progressDescription = $('#progressDescription');
  const progressPercent = $('#progressPercent');

  function toast(message, isError = false) {
    const node = $('#toast');
    node.textContent = message;
    node.classList.toggle('error', isError);
    node.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => node.classList.remove('show'), 3500);
  }
  function addMessage(text, role = 'ai', html = '') {
    const list = $('#chatMessages');
    const row = document.createElement('div');
    row.className = `message-row ${role === 'user' ? 'user-row' : 'ai-row'}`;
    if (role !== 'user') {
      const avatar = document.createElement('div'); avatar.className = 'message-avatar';
      const icon = document.createElement('i'); icon.className = 'fa-solid fa-wand-magic-sparkles'; avatar.append(icon); row.append(avatar);
    }
    const bubble = document.createElement('div'); bubble.className = `message-bubble ${role === 'user' ? 'user-bubble' : 'ai-bubble'}`;
    const paragraph = document.createElement('p'); paragraph.textContent = text; bubble.append(paragraph);
    if (html) bubble.insertAdjacentHTML('beforeend', html);
    const time = document.createElement('span'); time.className = 'message-time'; time.textContent = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); bubble.append(time);
    row.append(bubble); list.append(row); list.scrollTop = list.scrollHeight;
    return row;
  }
  function showTyping() {
    const row = addMessage('', 'ai'); row.dataset.typing = 'true';
    const p = row.querySelector('.message-bubble p'); p.innerHTML = '<span class="typing-dots"><i></i><i></i><i></i></span>';
    return row;
  }
  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Có lỗi xảy ra (${response.status}).`);
    return data;
  }
  function setBusy(value) {
    state.busy = value;
    sendButton.disabled = value;
    generateButton.disabled = value || !state.spec;
    $('#uploadButton').disabled = value;
    $('#uploadButton').style.opacity = value ? '.5' : '1';
    $('#uploadButton').style.pointerEvents = value ? 'none' : '';
  }
  function showProgress(title, description) {
    progressPanel.classList.remove('hidden'); progressBar.style.width = '4%'; progressPercent.textContent = '4%';
    progressTitle.textContent = title; progressDescription.textContent = description;
  }
  function progressTo(percent, title, description) {
    progressBar.style.width = `${percent}%`; progressPercent.textContent = `${percent}%`;
    progressTitle.textContent = title; progressDescription.textContent = description;
  }
  function hideProgress() { progressPanel.classList.add('hidden'); }

  async function analyze(showReply = true) {
    const message = input.value.trim();
    if (!message && !state.fileId) { toast('Nhập yêu cầu hoặc tải tài liệu trước nhé.', true); input.focus(); return null; }
    if (state.busy) return null;
    setBusy(true); $('#resultCard').classList.add('hidden');
    const typing = showReply ? showTyping() : null;
    showProgress('Đang phân tích yêu cầu…', 'AI đang sắp xếp ý tưởng của bạn');
    progressTo(22, 'Đang đọc nội dung…', 'Xác định chủ đề và các ý chính');
    try {
      const data = await requestJson('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, file_id: state.fileId }) });
      progressTo(88, 'Đang dựng cấu trúc slide…', `${data.spec.slides.length} slide được lên khung`);
      state.spec = data.spec; renderPreview(state.spec); generateButton.disabled = false;
      if (typing) {
        typing.remove();
        const extra = data.ai_configured ? '' : '<span class="message-time">Đang dùng nội dung mẫu — thêm OPENAI_API_KEY để bật AI.</span>';
        addMessage(`Đã lên cấu trúc ${state.spec.slides.length} slide cho bạn. Chọn một thẻ để xem nội dung, hoặc tạo PowerPoint ngay nhé.`, 'ai', extra);
      }
      progressTo(100, 'Cấu trúc đã sẵn sàng', 'Bạn có thể xem từng slide hoặc tạo file ngay');
      setTimeout(hideProgress, 800);
      return state.spec;
    } catch (error) {
      if (typing) typing.remove();
      hideProgress(); toast(error.message, true); if (showReply) addMessage(`Mình chưa xử lý được yêu cầu: ${error.message}`, 'ai');
      return null;
    } finally { setBusy(false); }
  }
  window.sendMessage = () => analyze(true);

  function renderPreview(spec) {
    const container = $('#previewContent'); container.replaceChildren();
    const slides = spec.slides || [];
    slides.forEach((slide, index) => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'slide-card';
      const thumb = document.createElement('span'); thumb.className = 'slide-thumb';
      thumb.style.setProperty('--thumb-a', spec.meta?.primary_color || '#5856ad');
      const lines = document.createElement('span'); lines.className = 'slide-thumb-lines';
      for (let i = 0; i < 3; i++) lines.append(document.createElement('i'));
      const num = document.createElement('span'); num.className = 'slide-thumb-num'; num.textContent = `${index + 1}`;
      const icon = document.createElement('span'); icon.className = 'slide-kind';
      icon.innerHTML = `<i class="fa-solid ${iconFor(slide.type)}"></i>`;
      thumb.append(lines, num, icon);
      const copy = document.createElement('span'); copy.className = 'slide-card-copy';
      const title = document.createElement('strong'); title.textContent = slide.title || `Slide ${index + 1}`;
      const subtype = document.createElement('span'); subtype.textContent = `${String(slide.type || 'content').replaceAll('_', ' ')} · Slide ${index + 1}`;
      copy.append(title, subtype);
      const arrow = document.createElement('i'); arrow.className = 'fa-solid fa-chevron-right slide-arrow';
      card.append(thumb, copy, arrow); card.addEventListener('click', () => openModal(`Slide ${index + 1} · ${slide.title || ''}`, slide));
      container.append(card);
    });
    $('#previewSubtext').textContent = `${slides.length} slide${slides.length === 1 ? '' : 's'} · Nhấn vào thẻ để xem chi tiết`;
    $('#slideCount').textContent = `${slides.length} slide`;
    $('#themeLabel').textContent = spec.meta?.theme ? `Theme ${spec.meta.theme}` : 'Theme hiện đại';
    document.querySelector('.theme-swatch').style.background = spec.meta?.primary_color || '#7777ff';
    $('#jsonButton').disabled = false;
  }
  function iconFor(type) {
    return ({ title: 'fa-heading', closing: 'fa-flag-checkered', content: 'fa-list-ul', two_column: 'fa-columns', table: 'fa-table', chart: 'fa-chart-column', timeline: 'fa-timeline', org_chart: 'fa-sitemap', flowchart: 'fa-diagram-project', image_right: 'fa-image', image_full: 'fa-image', quote: 'fa-quote-left', section: 'fa-bookmark' })[type] || 'fa-list-ul';
  }
  function openModal(title, value, kicker = 'SLIDE DETAIL') {
    $('#modalTitle').textContent = title; $('#modalKicker').textContent = kicker;
    $('#modalContent').textContent = JSON.stringify(value, null, 2);
    $('#modalBackdrop').classList.remove('hidden');
  }
  $('#jsonButton').addEventListener('click', () => state.spec && openModal('Cấu trúc JSON', state.spec, 'PRESENTATION SPEC'));
  $('#closeModal').addEventListener('click', () => $('#modalBackdrop').classList.add('hidden'));
  $('#modalBackdrop').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });

  async function uploadFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['docx', 'pdf', 'txt'].includes(ext)) { toast('Chỉ hỗ trợ DOCX, PDF và TXT.', true); return; }
    if (file.size > 10 * 1024 * 1024) { toast('Tệp tối đa 10 MB.', true); return; }
    setBusy(true); showProgress('Đang tải tài liệu…', 'Đọc nội dung văn bản');
    try {
      const form = new FormData(); form.append('file', file);
      const result = await requestJson('/api/upload', { method: 'POST', body: form });
      state.fileId = result.file_id;
      $('#fileName').textContent = result.filename; $('#fileChip').classList.remove('hidden');
      const preview = $('#filePreview'); preview.textContent = result.text_preview || 'Không tìm thấy văn bản có thể trích xuất.'; preview.classList.remove('hidden');
      progressTo(100, 'Tài liệu đã sẵn sàng', `${result.characters.toLocaleString()} ký tự đã đọc`);
      setTimeout(hideProgress, 850); toast('Đã tải tài liệu thành công.');
      if (!input.value.trim()) input.value = `Tạo bài thuyết trình từ nội dung tài liệu${result.filename ? ` ${result.filename}` : ''}.`;
    } catch (error) { hideProgress(); toast(error.message, true); }
    finally { setBusy(false); $('#fileInput').value = ''; }
  }
  $('#uploadButton').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', e => uploadFile(e.target.files[0]));
  $('#removeFile').addEventListener('click', () => { state.fileId = null; $('#fileChip').classList.add('hidden'); $('#filePreview').classList.add('hidden'); toast('Đã gỡ tài liệu khỏi yêu cầu.'); });

  async function generatePPT() {
    if (state.busy) return;
    if (!state.spec) { const spec = await analyze(false); if (!spec) return; }
    setBusy(true); $('#resultCard').classList.add('hidden');
    showProgress('Đang chuẩn bị PowerPoint…', 'Đang kiểm tra nội dung và bố cục');
    const steps = [
      [28, 'Đang thiết kế slide…', `Chuẩn bị ${state.spec.slides.length} trang trình bày`],
      [57, 'Đang vẽ nội dung…', 'Biểu đồ, bảng và sơ đồ được kết xuất'],
      [82, 'Đang xuất file…', 'Hoàn tất định dạng PowerPoint'],
    ];
    let progress = 5;
    const timer = setInterval(() => { if (progress < 82) { progress = Math.min(progress + 4, 82); const stage = [...steps].reverse().find(s => progress >= s[0] - 24) || steps[0]; progressTo(progress, stage[1], stage[2]); } }, 280);
    try {
      const result = await requestJson('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: input.value.trim(), file_id: state.fileId, spec: state.spec }) });
      clearInterval(timer); progressTo(100, 'PowerPoint đã sẵn sàng', 'Tệp đã được tạo và lưu vào lịch sử');
      $('#resultFilename').textContent = result.filename;
      $('#resultSize').textContent = `${(result.size_bytes / 1024).toFixed(0)} KB`;
      const download = $('#downloadButton'); download.href = result.download_url; download.download = result.filename;
      $('#resultCard').classList.remove('hidden');
      download.click(); toast('✅ Đã tạo file PowerPoint thành công!');
      addMessage(`Hoàn tất rồi! Mình đã tạo ${result.filename} (${(result.size_bytes / 1024).toFixed(0)} KB). Bạn có thể tải lại ở nút màu xanh bên dưới.`, 'ai');
      setTimeout(hideProgress, 1500);
    } catch (error) { clearInterval(timer); hideProgress(); toast(error.message, true); addMessage(`Tạo file chưa thành công: ${error.message}`, 'ai'); }
    finally { clearInterval(timer); setBusy(false); }
  }
  window.generatePPT = generatePPT;
  sendButton.addEventListener('click', () => analyze(true));
  $('#previewButton').addEventListener('click', () => analyze(true));
  generateButton.addEventListener('click', generatePPT);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); analyze(true); } });
  document.querySelectorAll('.suggestion').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.prompt || ''; input.focus(); }));
  $('#clearButton').addEventListener('click', () => { state.spec = null; state.fileId = null; input.value = ''; $('#fileChip').classList.add('hidden'); $('#filePreview').classList.add('hidden'); $('#resultCard').classList.add('hidden'); $('#previewContent').innerHTML = '<div class="empty-preview"><div class="empty-icon"><i class="fa-regular fa-images"></i></div><h3>Chưa có slide nào</h3><p>Nhập yêu cầu và chọn <b>Xem trước</b> để bắt đầu.</p><div class="mini-skeleton"><span></span><span></span><span></span></div></div>'; $('#previewSubtext').textContent = 'Bản xem trước sẽ xuất hiện tại đây'; $('#slideCount').textContent = '0 slide'; $('#jsonButton').disabled = true; generateButton.disabled = true; toast('Đã làm mới không gian làm việc.'); });

  async function loadHistory() {
    $('#historyList').innerHTML = '<div class="history-empty">Đang tải lịch sử…</div>';
    $('#historyBackdrop').classList.remove('hidden');
    try {
      const data = await requestJson('/api/history'); const list = $('#historyList'); list.replaceChildren();
      if (!data.history.length) { list.innerHTML = '<div class="history-empty">Chưa có bản trình bày nào được tạo.</div>'; return; }
      data.history.forEach(item => {
        const row = document.createElement('div'); row.className = 'history-entry';
        const icon = document.createElement('span'); icon.className = 'assistant-avatar'; icon.innerHTML = '<i class="fa-solid fa-file-powerpoint"></i>';
        const info = document.createElement('div'); info.className = 'history-info';
        const name = document.createElement('strong'); name.textContent = item.user_input || item.filename;
        const meta = document.createElement('small'); meta.textContent = `${item.slide_count} slide · ${item.created_at ? new Date(item.created_at).toLocaleString('vi-VN') : 'Vừa tạo'}`;
        info.append(name, meta); const link = document.createElement('a'); link.href = item.download_url; link.download = item.filename; link.innerHTML = '<i class="fa-solid fa-download"></i>';
        row.append(icon, info, link); list.append(row);
      });
    } catch (error) { $('#historyList').innerHTML = `<div class="history-empty">${escapeHtml(error.message)}</div>`; }
  }
  function escapeHtml(value) { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; }
  $('#historyButton').addEventListener('click', loadHistory);
  $('#closeHistory').addEventListener('click', () => $('#historyBackdrop').classList.add('hidden'));
  $('#historyBackdrop').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#modalBackdrop').classList.add('hidden'); $('#historyBackdrop').classList.add('hidden'); } });
})();
