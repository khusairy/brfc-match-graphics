const state = {
  videoUrl: null,
  homeLogoUrl: null,
  awayLogoUrl: null,
  events: [],
  format: 'halves-90',
};

const $ = (id) => document.getElementById(id);
const video = $('matchVideo');

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60).toString().padStart(2, '0');
  const secs = (safe % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

function parseTime(value) {
  const parts = String(value || '').trim().split(':').map((part) => Number(part));
  if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0)) return 0;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function matchSettings() {
  const format = $('formatInput').value;
  const total = format === 'halves-90' || format === 'three-30' ? 90 : format === 'halves-60' ? 60 : format === 'straight-15' ? 15 : format === 'straight-20' ? 20 : Number($('customDurationInput').value || 45);
  return { format, totalMinutes: Math.max(1, total), halfMinutes: format.startsWith('halves') ? total / 2 : null, threePeriods: format === 'three-30', periodMinutes: format === 'three-30' ? 30 : null };
}

function currentMatchSecond(videoSecond) {
  const kickoff = state.events.find((e) => e.type === 'kickoff');
  if (!kickoff || videoSecond < kickoff.videoSecond) return 0;
  const settings = matchSettings();
  const halftime = state.events.find((e) => e.type === 'halftime');
  const secondHalf = state.events.find((e) => e.type === 'second-half');
  const secondBreak = state.events.find((e) => e.type === 'second-break');
  const thirdHalf = state.events.find((e) => e.type === 'third-half');
  if (settings.threePeriods) {
    const period = settings.periodMinutes * 60;
    if (halftime && videoSecond >= halftime.videoSecond) {
      if (!secondHalf || videoSecond < secondHalf.videoSecond) return period;
      if (secondBreak && videoSecond >= secondBreak.videoSecond) {
        if (!thirdHalf || videoSecond < thirdHalf.videoSecond) return period * 2;
        return Math.min(settings.totalMinutes * 60, period * 2 + (videoSecond - thirdHalf.videoSecond));
      }
      return Math.min(period * 2, period + (videoSecond - secondHalf.videoSecond));
    }
    return Math.min(period, videoSecond - kickoff.videoSecond);
  }
  if (settings.halfMinutes && halftime && videoSecond >= halftime.videoSecond) {
    if (!secondHalf || videoSecond < secondHalf.videoSecond) return settings.halfMinutes * 60;
    return Math.min(settings.totalMinutes * 60, settings.halfMinutes * 60 + (videoSecond - secondHalf.videoSecond));
  }
  return Math.min(settings.totalMinutes * 60, videoSecond - kickoff.videoSecond);
}

function scoreAt(videoSecond) {
  return state.events.reduce((score, event) => {
    if (event.videoSecond > videoSecond) return score;
    if (event.type === 'goal-home') score.home += 1;
    if (event.type === 'goal-away') score.away += 1;
    return score;
  }, { home: 0, away: 0 });
}

function statusAt(videoSecond) {
  const kickoff = state.events.find((e) => e.type === 'kickoff');
  const halftime = state.events.find((e) => e.type === 'halftime');
  const secondHalf = state.events.find((e) => e.type === 'second-half');
  const secondBreak = state.events.find((e) => e.type === 'second-break');
  const thirdHalf = state.events.find((e) => e.type === 'third-half');
  const fulltime = state.events.find((e) => e.type === 'fulltime');
  if (!kickoff || videoSecond < kickoff.videoSecond) return 'PRE-MATCH';
  if (fulltime && videoSecond >= fulltime.videoSecond) return 'FULL-TIME';
  if ($('formatInput').value === 'three-30') {
    if (secondBreak && videoSecond >= secondBreak.videoSecond && (!thirdHalf || videoSecond < thirdHalf.videoSecond)) return 'BREAK 2';
    if (halftime && videoSecond >= halftime.videoSecond && (!secondHalf || videoSecond < secondHalf.videoSecond)) return 'BREAK 1';
    return 'LIVE';
  }
  if (halftime && videoSecond >= halftime.videoSecond && (!secondHalf || videoSecond < secondHalf.videoSecond)) return 'HALF-TIME';
  return 'LIVE';
}

function render() {
  const position = Number(video.currentTime || 0);
  const score = scoreAt(position);
  $('homeScorePreview').textContent = score.home;
  $('awayScorePreview').textContent = score.away;
  $('clockPreview').textContent = formatTime(currentMatchSecond(position));
  $('matchStatusPreview').textContent = statusAt(position);
  $('videoTimeReadout').textContent = `${formatTime(position)} / ${formatTime(video.duration)}`;
  $('currentPosition').textContent = `Video position: ${formatTime(position)}`;
  $('videoScrubber').value = position;
  $('scorebug').style.setProperty('--home-colour', $('homeColourInput').value);
  $('scorebug').style.setProperty('--away-colour', $('awayColourInput').value);
  $('scorebug').style.setProperty('background', $('homeColourInput').value);
  renderEvents();
}

function renderEvents() {
  const threePeriods = $('formatInput').value === 'three-30';
  const labels = { kickoff: 'Kick-off', 'goal-home': `Goal — ${$('homeNameInput').value}`, 'goal-away': `Goal — ${$('awayNameInput').value}`, halftime: threePeriods ? 'End period 1' : 'Half-time', 'second-half': threePeriods ? 'Start period 2' : 'Second-half kick-off', 'second-break': 'End period 2', 'third-half': 'Start period 3', fulltime: 'Full-time' };
  const list = $('eventList');
  list.innerHTML = '';
  if (!state.events.length) { list.innerHTML = '<div class="empty-events">No events marked yet. Move the video to the right moment and add an event.</div>'; return; }
  [...state.events].sort((a, b) => a.videoSecond - b.videoSecond).forEach((event) => {
    const row = document.createElement('div'); row.className = 'event-row';
    row.innerHTML = `<span class="event-time">${formatTime(event.videoSecond)}</span><span class="event-label">${labels[event.type]}</span><button class="delete-event" aria-label="Delete event">Remove</button>`;
    row.querySelector('button').addEventListener('click', () => { state.events = state.events.filter((item) => item.id !== event.id); render(); });
    list.appendChild(row);
  });
}

function syncPeriodControls() {
  const threePeriods = $('formatInput').value === 'three-30';
  $('periodOneEndButton').textContent = threePeriods ? 'End period 1' : 'Half-time';
  $('periodTwoStartButton').textContent = threePeriods ? 'Start period 2' : 'Second-half kick-off';
  document.querySelectorAll('.three-period-event').forEach((button) => { button.hidden = !threePeriods; });
}

function bindText(inputId, outputId, target = 'textContent') {
  $(inputId).addEventListener('input', () => { $(outputId)[target] = $(inputId).value || ''; render(); });
}

function addEvent(type) {
  const manualPosition = parseTime($('eventTimeInput').value);
  const videoSecond = manualPosition || Number(video.currentTime || 0);
  const duplicate = state.events.find((event) => event.type === type);
  if (['kickoff', 'halftime', 'second-half', 'fulltime'].includes(type) && duplicate) state.events = state.events.filter((event) => event.type !== type);
  state.events.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, type, videoSecond: Math.round(videoSecond * 100) / 100 });
  render();
}

function drawScoreboard(ctx, timelineSecond) {
  const score = scoreAt(timelineSecond);
  const title = $('titleInput').value || 'FRIENDLY MATCH';
  const homeName = $('homeNameInput').value || 'HOME';
  const awayName = $('awayNameInput').value || 'AWAY';
  const homeColour = $('homeColourInput').value || '#e54646';
  const awayColour = $('awayColourInput').value || '#2879d8';
  const x = 530; const y = 68; const width = 860; const titleHeight = 38; const mainHeight = 102; const footerHeight = 38; const scoreWidth = 190;
  ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, 1920, 1080);
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 11;
  ctx.fillStyle = '#151f30'; roundedRect(ctx, x, y, width, titleHeight + mainHeight + footerHeight, 11); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#1b2739'; roundedRect(ctx, x, y, width, titleHeight, 11, true, true, false, false); ctx.fill();
  ctx.fillStyle = '#f4f6fa'; ctx.fillRect(x, y + titleHeight, width, mainHeight);
  ctx.fillStyle = homeColour; ctx.fillRect(x, y + titleHeight, 7, mainHeight);
  ctx.fillStyle = awayColour; ctx.fillRect(x + width - 7, y + titleHeight, 7, mainHeight);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + 25, y + 19, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#dce5f4'; ctx.font = '900 15px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(title.toUpperCase(), x + 40, y + 19);
  ctx.fillStyle = '#91a3be'; ctx.font = '800 12px Arial'; ctx.textAlign = 'right'; ctx.fillText('BRFC MATCHDAY', x + width - 18, y + 19);
  ctx.fillStyle = '#111827'; ctx.font = '900 28px Arial'; ctx.textAlign = 'left'; ctx.fillText(homeName.toUpperCase(), x + 37, y + titleHeight + mainHeight / 2);
  ctx.textAlign = 'right'; ctx.fillText(awayName.toUpperCase(), x + width - 37, y + titleHeight + mainHeight / 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + (width - scoreWidth) / 2, y + titleHeight, scoreWidth, mainHeight);
  ctx.strokeStyle = '#d4dbe5'; ctx.lineWidth = 1; ctx.strokeRect(x + (width - scoreWidth) / 2, y + titleHeight, scoreWidth, mainHeight);
  ctx.fillStyle = '#101827'; ctx.font = '900 55px Arial'; ctx.textAlign = 'center'; ctx.fillText(`${score.home}  :  ${score.away}`, x + width / 2, y + titleHeight + mainHeight / 2 + 1);
  ctx.fillStyle = '#101827'; roundedRect(ctx, x, y + titleHeight + mainHeight, width, footerHeight, 0, false, false, true, true); ctx.fill();
  ctx.fillStyle = '#e94b54'; ctx.beginPath(); ctx.arc(x + 24, y + titleHeight + mainHeight + footerHeight / 2, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d7dfec'; ctx.font = '900 13px Arial'; ctx.textAlign = 'left'; ctx.fillText(statusAt(timelineSecond), x + 37, y + titleHeight + mainHeight + footerHeight / 2);
  ctx.fillStyle = '#ffffff'; ctx.font = '900 24px monospace'; ctx.textAlign = 'center'; ctx.fillText(formatTime(currentMatchSecond(timelineSecond)), x + width / 2, y + titleHeight + mainHeight + footerHeight / 2);
  ctx.fillStyle = '#90a0b8'; ctx.font = '800 11px Arial'; ctx.textAlign = 'right'; ctx.fillText('MATCH TIME', x + width - 18, y + titleHeight + mainHeight + footerHeight / 2);
}

function roundedRect(ctx, x, y, width, height, radius, topLeft = true, topRight = true, bottomRight = true, bottomLeft = true) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + (topLeft ? r : 0), y);
  ctx.lineTo(x + width - (topRight ? r : 0), y);
  if (topRight) ctx.quadraticCurveTo(x + width, y, x + width, y + r); else ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + height - (bottomRight ? r : 0));
  if (bottomRight) ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height); else ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + (bottomLeft ? r : 0), y + height);
  if (bottomLeft) ctx.quadraticCurveTo(x, y + height, x, y + height - r); else ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + (topLeft ? r : 0));
  if (topLeft) ctx.quadraticCurveTo(x, y, x + r, y); else ctx.lineTo(x, y);
  ctx.closePath();
}

async function renderOverlay() {
  const duration = parseTime($('overlayDurationInput').value);
  if (!duration) { $('renderStatus').textContent = 'Enter a valid final video duration first, for example 62:30.'; return; }
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { $('renderStatus').textContent = 'This browser does not support local video rendering. Use the latest Chrome or Edge.'; return; }
  const button = $('renderOverlay'); button.disabled = true; button.textContent = 'Rendering…';
  $('renderStatus').textContent = `Rendering ${formatTime(duration)} in real time. Keep this tab open.`;
  const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  const chunks = []; const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });
  recorder.addEventListener('stop', () => {
    const blob = new Blob(chunks, { type: 'video/webm' }); const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `${$('homeNameInput').value || 'home'}-vs-${$('awayNameInput').value || 'away'}-scoreboard-greenscreen.webm`; link.click(); URL.revokeObjectURL(url);
    button.disabled = false; button.textContent = 'Render green-screen overlay'; $('renderStatus').textContent = 'Overlay downloaded. Import it above the match in CapCut, then apply Chroma Key to the green background.';
    stream.getTracks().forEach((track) => track.stop());
  });
  recorder.start(1000); const startedAt = performance.now();
  const renderFrame = (now) => {
    const second = Math.min(duration, (now - startedAt) / 1000); drawScoreboard(ctx, second);
    $('renderStatus').textContent = `Rendering ${formatTime(second)} / ${formatTime(duration)}. Keep this tab open.`;
    if (second < duration) requestAnimationFrame(renderFrame); else recorder.stop();
  };
  drawScoreboard(ctx, 0); requestAnimationFrame(renderFrame);
}

$('videoInput').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; if (state.videoUrl) URL.revokeObjectURL(state.videoUrl); state.videoUrl = URL.createObjectURL(file); video.src = state.videoUrl; $('emptyVideo').hidden = true; video.load(); });
video.addEventListener('loadedmetadata', () => { $('videoScrubber').max = video.duration; render(); });
video.addEventListener('timeupdate', render);
$('videoScrubber').addEventListener('input', (event) => { video.currentTime = Number(event.target.value); render(); });
document.querySelectorAll('[data-event]').forEach((button) => button.addEventListener('click', () => addEvent(button.dataset.event)));
bindText('titleInput', 'overlayTitle'); bindText('homeNameInput', 'homeNamePreview'); bindText('awayNameInput', 'awayNamePreview');
$('formatInput').addEventListener('change', () => { state.format = $('formatInput').value; $('customDurationWrap').hidden = state.format !== 'custom'; syncPeriodControls(); render(); }); $('customDurationInput').addEventListener('input', render);
$('eventTimeInput').addEventListener('input', render); $('overlayDurationInput').addEventListener('input', render);
$('homeColourInput').addEventListener('input', render); $('awayColourInput').addEventListener('input', render);

function loadLogo(inputId, imageId, side) { $(inputId).addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; if (state[`${side}LogoUrl`]) URL.revokeObjectURL(state[`${side}LogoUrl`]); state[`${side}LogoUrl`] = URL.createObjectURL(file); const image = $(imageId); image.src = state[`${side}LogoUrl`]; image.hidden = false; }); }
loadLogo('homeLogoInput', 'homeLogoPreview', 'home'); loadLogo('awayLogoInput', 'awayLogoPreview', 'away');

function projectData() { return { version: 1, type: 'brfc-match-graphics-project', match: { title: $('titleInput').value, homeName: $('homeNameInput').value, awayName: $('awayNameInput').value, homeColour: $('homeColourInput').value, awayColour: $('awayColourInput').value, format: $('formatInput').value, customDuration: $('customDurationInput').value }, events: state.events.sort((a, b) => a.videoSecond - b.videoSecond), videoFileName: $('videoInput').files[0]?.name || null, exportedAt: new Date().toISOString() }; }
function downloadProject() { const blob = new Blob([JSON.stringify(projectData(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${$('homeNameInput').value}-${$('awayNameInput').value}-graphics.json`; anchor.click(); URL.revokeObjectURL(url); }
$('downloadProject').addEventListener('click', downloadProject); $('downloadProjectSecondary').addEventListener('click', downloadProject);
$('renderOverlay').addEventListener('click', renderOverlay);
$('clearEvents').addEventListener('click', () => { if (state.events.length && !confirm('Clear all marked events?')) return; state.events = []; render(); });
$('overlayToggle').addEventListener('click', () => { document.body.classList.toggle('overlay-only'); $('overlayToggle').textContent = document.body.classList.contains('overlay-only') ? 'Exit overlay' : 'Overlay only'; });
syncPeriodControls();
render();
