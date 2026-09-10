const state = { events: [], homeLogo: null, awayLogo: null };

const $ = (id) => document.getElementById(id);

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`;
}

function parseTime(value) {
  const parts = String(value || '').trim().split(':').map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0)) return 0;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function settings() {
  const format = $('formatInput').value;
  const total = format === 'halves-90' ? 90 : format === 'halves-60' ? 60 : format === 'straight-15' ? 15 : format === 'straight-20' ? 20 : Number($('customDurationInput').value || 45);
  return { halves: format.startsWith('halves'), totalSeconds: total * 60, halfSeconds: total * 30 };
}

function eventOf(type) { return state.events.find((event) => event.type === type); }

function scoreAt(second) {
  return state.events.reduce((score, event) => {
    if (event.second <= second && event.type === 'goal-home') score.home += 1;
    if (event.second <= second && event.type === 'goal-away') score.away += 1;
    return score;
  }, { home: 0, away: 0 });
}

function matchTimeAt(second) {
  const kickoff = eventOf('kickoff');
  if (!kickoff || second < kickoff.second) return 0;
  const config = settings();
  const halftime = eventOf('halftime');
  const secondHalf = eventOf('second-half');
  if (config.halves && halftime && second >= halftime.second) {
    if (!secondHalf || second < secondHalf.second) return config.halfSeconds;
    return Math.min(config.totalSeconds, config.halfSeconds + second - secondHalf.second);
  }
  return Math.min(config.totalSeconds, second - kickoff.second);
}

function statusAt(second) {
  const kickoff = eventOf('kickoff');
  const halftime = eventOf('halftime');
  const secondHalf = eventOf('second-half');
  const fulltime = eventOf('fulltime');
  if (!kickoff || second < kickoff.second) return 'PRE-MATCH';
  if (fulltime && second >= fulltime.second) return 'FULL-TIME';
  if (halftime && second >= halftime.second && (!secondHalf || second < secondHalf.second)) return 'HALF-TIME';
  return 'LIVE';
}

function previewSecond() { return parseTime($('eventTimeInput').value); }

function renderPreview() {
  const second = previewSecond();
  const score = scoreAt(second);
  $('overlayTitle').textContent = $('titleInput').value || 'FRIENDLY MATCH';
  $('homeNamePreview').textContent = $('homeNameInput').value || 'HOME';
  $('awayNamePreview').textContent = $('awayNameInput').value || 'AWAY';
  $('homeScorePreview').textContent = score.home;
  $('awayScorePreview').textContent = score.away;
  $('clockPreview').textContent = formatTime(matchTimeAt(second));
  $('matchStatusPreview').textContent = statusAt(second);
  renderEvents();
}

function renderEvents() {
  const labels = { kickoff: 'Kick-off', 'goal-home': `Goal — ${$('homeNameInput').value || 'Home'}`, 'goal-away': `Goal — ${$('awayNameInput').value || 'Away'}`, halftime: 'Half-time', 'second-half': 'Second-half kick-off', fulltime: 'Full-time' };
  const list = $('eventList'); list.innerHTML = '';
  if (!state.events.length) { list.innerHTML = '<div class="empty-events">Enter a CapCut timeline position, then mark your first event.</div>'; return; }
  [...state.events].sort((a, b) => a.second - b.second).forEach((event) => {
    const row = document.createElement('div'); row.className = 'event-row';
    row.innerHTML = `<span class="event-time">${formatTime(event.second)}</span><span class="event-label">${labels[event.type]}</span><button class="delete-event">Remove</button>`;
    row.querySelector('button').onclick = () => { state.events = state.events.filter((item) => item.id !== event.id); renderPreview(); };
    list.appendChild(row);
  });
}

function addEvent(type) {
  const second = previewSecond();
  if (['kickoff', 'halftime', 'second-half', 'fulltime'].includes(type)) state.events = state.events.filter((event) => event.type !== type);
  state.events.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, type, second });
  renderPreview();
}

function loadLogo(inputId, imageId, property) {
  $(inputId).addEventListener('change', (event) => {
    const file = event.target.files[0]; if (!file) return;
    const image = new Image(); image.onload = () => { state[property] = image; renderPreview(); };
    image.src = URL.createObjectURL(file); $(imageId).src = image.src; $(imageId).hidden = false;
  });
}

function drawOverlay(ctx, second) {
  const score = scoreAt(second); const title = $('titleInput').value || 'FRIENDLY MATCH';
  const home = $('homeNameInput').value || 'HOME'; const away = $('awayNameInput').value || 'AWAY';
  const homeColour = $('homeColourInput').value || '#e54646'; const awayColour = $('awayColourInput').value || '#2879d8';
  const x = 540; const y = 80; const width = 840; const titleHeight = 46; const mainHeight = 100; const footerHeight = 38;
  ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, 1920, 1080);
  ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#1a1928'; ctx.fillRect(x, y, width, titleHeight);
  ctx.fillStyle = '#f7f9fc'; ctx.fillRect(x, y + titleHeight, width, mainHeight); ctx.shadowColor = 'transparent';
  ctx.fillStyle = homeColour; ctx.fillRect(x, y + titleHeight + mainHeight, width / 2, footerHeight);
  ctx.fillStyle = awayColour; ctx.fillRect(x + width / 2, y + titleHeight + mainHeight, width / 2, footerHeight);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '800 19px Arial'; ctx.fillText(title.toUpperCase(), 960, y + titleHeight / 2);
  if (state.homeLogo) ctx.drawImage(state.homeLogo, x + 26, y + titleHeight + 27, 45, 45);
  if (state.awayLogo) ctx.drawImage(state.awayLogo, x + width - 71, y + titleHeight + 27, 45, 45);
  ctx.fillStyle = '#111827'; ctx.font = '800 25px Arial'; ctx.textAlign = 'left'; ctx.fillText(home.toUpperCase(), x + (state.homeLogo ? 84 : 30), y + titleHeight + mainHeight / 2);
  ctx.textAlign = 'right'; ctx.fillText(away.toUpperCase(), x + width - (state.awayLogo ? 84 : 30), y + titleHeight + mainHeight / 2);
  ctx.textAlign = 'center'; ctx.font = '900 48px Arial'; ctx.fillText(`${score.home}  –  ${score.away}`, 960, y + titleHeight + mainHeight / 2);
  ctx.fillStyle = '#fff'; ctx.font = '800 14px Arial'; ctx.textAlign = 'left'; ctx.fillText(statusAt(second), x + 24, y + titleHeight + mainHeight + footerHeight / 2);
  ctx.textAlign = 'right'; ctx.font = '900 22px Arial'; ctx.fillText(formatTime(matchTimeAt(second)), x + width - 24, y + titleHeight + mainHeight + footerHeight / 2);
}

async function renderOverlay() {
  const duration = parseTime($('overlayDurationInput').value);
  const status = $('renderStatus'); const button = $('renderOverlay');
  if (!duration) { status.textContent = 'Enter the final video duration first, for example 62:30.'; return; }
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { status.textContent = 'Use the latest Chrome or Edge to render locally.'; return; }
  button.disabled = true; button.textContent = 'Rendering…';
  const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080;
  const ctx = canvas.getContext('2d'); const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  const chunks = []; const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' }); const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `${$('homeNameInput').value || 'home'}-vs-${$('awayNameInput').value || 'away'}-scoreboard-greenscreen.webm`; link.click(); URL.revokeObjectURL(url);
    stream.getTracks().forEach((track) => track.stop()); button.disabled = false; button.textContent = 'Render green-screen overlay';
    status.textContent = 'Downloaded. In CapCut, place it above the match and apply Chroma Key to #00FF00.';
  };
  recorder.start(1000); const startedAt = performance.now();
  const frame = (now) => {
    const second = Math.min(duration, (now - startedAt) / 1000); drawOverlay(ctx, second);
    status.textContent = `Rendering ${formatTime(second)} / ${formatTime(duration)}. Keep this tab open.`;
    if (second < duration) requestAnimationFrame(frame); else recorder.stop();
  };
  drawOverlay(ctx, 0); requestAnimationFrame(frame);
}

function projectData() {
  return { version: 2, type: 'brfc-match-graphics-project', match: { title: $('titleInput').value, homeName: $('homeNameInput').value, awayName: $('awayNameInput').value, homeColour: $('homeColourInput').value, awayColour: $('awayColourInput').value, format: $('formatInput').value, customDuration: $('customDurationInput').value, overlayDuration: $('overlayDurationInput').value }, events: [...state.events].sort((a, b) => a.second - b.second), exportedAt: new Date().toISOString() };
}

function downloadProject() {
  const blob = new Blob([JSON.stringify(projectData(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `${$('homeNameInput').value || 'match'}-graphics.json`; link.click(); URL.revokeObjectURL(url);
}

['titleInput', 'homeNameInput', 'awayNameInput', 'homeColourInput', 'awayColourInput', 'eventTimeInput', 'overlayDurationInput', 'customDurationInput'].forEach((id) => $(id).addEventListener('input', renderPreview));
$('formatInput').addEventListener('change', () => { $('customDurationWrap').hidden = $('formatInput').value !== 'custom'; renderPreview(); });
document.querySelectorAll('[data-event]').forEach((button) => button.onclick = () => addEvent(button.dataset.event));
$('downloadProject').onclick = downloadProject; $('downloadProjectSecondary').onclick = downloadProject; $('renderOverlay').onclick = renderOverlay;
$('clearEvents').onclick = () => { state.events = []; renderPreview(); };
loadLogo('homeLogoInput', 'homeLogoPreview', 'homeLogo'); loadLogo('awayLogoInput', 'awayLogoPreview', 'awayLogo');
renderPreview();
