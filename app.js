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

function matchSettings() {
  const format = $('formatInput').value;
  const total = format === 'halves-90' ? 90 : format === 'halves-60' ? 60 : format === 'straight-15' ? 15 : format === 'straight-20' ? 20 : Number($('customDurationInput').value || 45);
  return { format, totalMinutes: Math.max(1, total), halfMinutes: format.startsWith('halves') ? total / 2 : null };
}

function currentMatchSecond(videoSecond) {
  const kickoff = state.events.find((e) => e.type === 'kickoff');
  if (!kickoff || videoSecond < kickoff.videoSecond) return 0;
  const settings = matchSettings();
  const halftime = state.events.find((e) => e.type === 'halftime');
  const secondHalf = state.events.find((e) => e.type === 'second-half');
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
  const fulltime = state.events.find((e) => e.type === 'fulltime');
  if (!kickoff || videoSecond < kickoff.videoSecond) return 'PRE-MATCH';
  if (fulltime && videoSecond >= fulltime.videoSecond) return 'FULL-TIME';
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
  const labels = { kickoff: 'Kick-off', 'goal-home': `Goal — ${$('homeNameInput').value}`, 'goal-away': `Goal — ${$('awayNameInput').value}`, halftime: 'Half-time', 'second-half': 'Second-half kick-off', fulltime: 'Full-time' };
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

function bindText(inputId, outputId, target = 'textContent') {
  $(inputId).addEventListener('input', () => { $(outputId)[target] = $(inputId).value || ''; render(); });
}

function addEvent(type) {
  const videoSecond = Number(video.currentTime || 0);
  const duplicate = state.events.find((event) => event.type === type);
  if (['kickoff', 'halftime', 'second-half', 'fulltime'].includes(type) && duplicate) state.events = state.events.filter((event) => event.type !== type);
  state.events.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, type, videoSecond: Math.round(videoSecond * 100) / 100 });
  render();
}

$('videoInput').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; if (state.videoUrl) URL.revokeObjectURL(state.videoUrl); state.videoUrl = URL.createObjectURL(file); video.src = state.videoUrl; $('emptyVideo').hidden = true; video.load(); });
video.addEventListener('loadedmetadata', () => { $('videoScrubber').max = video.duration; render(); });
video.addEventListener('timeupdate', render);
$('videoScrubber').addEventListener('input', (event) => { video.currentTime = Number(event.target.value); render(); });
document.querySelectorAll('[data-event]').forEach((button) => button.addEventListener('click', () => addEvent(button.dataset.event)));
bindText('titleInput', 'overlayTitle'); bindText('homeNameInput', 'homeNamePreview'); bindText('awayNameInput', 'awayNamePreview');
$('formatInput').addEventListener('change', () => { state.format = $('formatInput').value; $('customDurationWrap').hidden = state.format !== 'custom'; render(); }); $('customDurationInput').addEventListener('input', render);
$('homeColourInput').addEventListener('input', render); $('awayColourInput').addEventListener('input', render);

function loadLogo(inputId, imageId, side) { $(inputId).addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; if (state[`${side}LogoUrl`]) URL.revokeObjectURL(state[`${side}LogoUrl`]); state[`${side}LogoUrl`] = URL.createObjectURL(file); const image = $(imageId); image.src = state[`${side}LogoUrl`]; image.hidden = false; }); }
loadLogo('homeLogoInput', 'homeLogoPreview', 'home'); loadLogo('awayLogoInput', 'awayLogoPreview', 'away');

function projectData() { return { version: 1, type: 'brfc-match-graphics-project', match: { title: $('titleInput').value, homeName: $('homeNameInput').value, awayName: $('awayNameInput').value, homeColour: $('homeColourInput').value, awayColour: $('awayColourInput').value, format: $('formatInput').value, customDuration: $('customDurationInput').value }, events: state.events.sort((a, b) => a.videoSecond - b.videoSecond), videoFileName: $('videoInput').files[0]?.name || null, exportedAt: new Date().toISOString() }; }
function downloadProject() { const blob = new Blob([JSON.stringify(projectData(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${$('homeNameInput').value}-${$('awayNameInput').value}-graphics.json`; anchor.click(); URL.revokeObjectURL(url); }
$('downloadProject').addEventListener('click', downloadProject); $('downloadProjectSecondary').addEventListener('click', downloadProject);
$('clearEvents').addEventListener('click', () => { if (state.events.length && !confirm('Clear all marked events?')) return; state.events = []; render(); });
$('overlayToggle').addEventListener('click', () => { document.body.classList.toggle('overlay-only'); $('overlayToggle').textContent = document.body.classList.contains('overlay-only') ? 'Exit overlay' : 'Overlay only'; });
render();
