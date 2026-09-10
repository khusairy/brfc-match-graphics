import { createCanvas, loadImage } from '@napi-rs/canvas';
import ffmpegPath from 'ffmpeg-static';
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const projectPath = process.argv[2];
if (!projectPath) throw new Error('Usage: npm run render -- path/to/render-project.json');

const project = JSON.parse(await readFile(projectPath, 'utf8'));
const { match, events = [], assets = {} } = project;
const duration = parseTime(match.overlayDuration);
if (!duration) throw new Error('The render project needs a final video duration, for example 82:31.');
if (!ffmpegPath) throw new Error('FFmpeg could not be found. Run npm install again.');

const width = 400;
const height = 154;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');
const homeLogo = await loadDataUrlImage(assets.homeLogoDataUrl);
const awayLogo = await loadDataUrlImage(assets.awayLogoDataUrl);
const orderedEvents = [...events].sort((a, b) => a.videoSecond - b.videoSecond);
const outputPath = resolve(dirname(projectPath), `${basename(projectPath, '.json')}-greenscreen.mp4`);

const ffmpeg = spawn(ffmpegPath, [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${width}x${height}`, '-framerate', '1', '-i', 'pipe:0',
  '-f', 'lavfi', '-i', `color=c=0x00ff00:s=1920x1080:r=30:d=${duration}`,
  '-filter_complex', '[1:v][0:v]overlay=70:65:shortest=1,format=yuv420p',
  '-t', String(duration), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-movflags', '+faststart', outputPath,
], { stdio: ['pipe', 'inherit', 'inherit'] });

for (let second = 0; second < duration; second += 1) {
  drawScorebug(second);
  if (!ffmpeg.stdin.write(canvas.toBuffer('raw'))) await new Promise((resolveDrain) => ffmpeg.stdin.once('drain', resolveDrain));
  if (second % 30 === 0 || second === duration - 1) process.stdout.write(`\rRendering ${formatTime(second + 1)} / ${formatTime(duration)}`);
}
ffmpeg.stdin.end();
await new Promise((resolveDone, reject) => ffmpeg.once('close', (code) => code === 0 ? resolveDone() : reject(new Error(`FFmpeg stopped with code ${code}`))));
console.log(`\nDone: ${outputPath}`);

function drawScorebug(second) {
  const homeColour = validColour(match.homeColour, '#e54646');
  const awayColour = validColour(match.awayColour, '#2879d8');
  const score = scoreAt(second);
  const titleHeight = 30;
  const mainHeight = 86;
  const footerHeight = 38;
  const teamWidth = width / 2;
  const codeWidth = 20;
  const scoreWidth = 60;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#121b2c'; roundRect(0, 0, width, titleHeight, 6, true, true, false, false); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 14px Arial'; ctx.fillText(String(match.title || 'FRIENDLY MATCH').toUpperCase(), width / 2, titleHeight / 2);
  ctx.fillStyle = homeColour; ctx.fillRect(0, titleHeight, teamWidth, mainHeight);
  ctx.fillStyle = awayColour; ctx.fillRect(teamWidth, titleHeight, teamWidth, mainHeight);
  ctx.fillStyle = '#fff'; ctx.font = '900 10px Arial'; ctx.fillText(String(match.homeName || 'HOME').toUpperCase(), codeWidth / 2, titleHeight + mainHeight / 2);
  ctx.fillText(String(match.awayName || 'AWAY').toUpperCase(), width - codeWidth / 2, titleHeight + mainHeight / 2);
  ctx.font = '900 54px Arial'; ctx.fillText(String(score.home), codeWidth + scoreWidth / 2, titleHeight + mainHeight / 2 + 1);
  ctx.fillText(String(score.away), width - codeWidth - scoreWidth / 2, titleHeight + mainHeight / 2 + 1);
  if (homeLogo) drawContained(homeLogo, codeWidth + scoreWidth, titleHeight, teamWidth - codeWidth - scoreWidth, mainHeight);
  if (awayLogo) drawContained(awayLogo, teamWidth, titleHeight, teamWidth - codeWidth - scoreWidth, mainHeight);
  ctx.fillStyle = '#e53946'; roundRect(0, titleHeight + mainHeight, width, footerHeight, 0, false, false, true, true); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '900 24px monospace'; ctx.fillText(formatTime(second), width / 2, titleHeight + mainHeight + footerHeight / 2);
}

function scoreAt(second) {
  return orderedEvents.reduce((score, event) => {
    if (event.videoSecond > second) return score;
    if (event.type === 'goal-home') score.home += 1;
    if (event.type === 'goal-away') score.away += 1;
    return score;
  }, { home: 0, away: 0 });
}

async function loadDataUrlImage(dataUrl) {
  if (!dataUrl) return null;
  return loadImage(Buffer.from(dataUrl.split(',')[1], 'base64'));
}

function drawContained(image, x, y, w, h) {
  const padding = 6;
  const scale = Math.min((w - padding * 2) / image.width, (h - padding * 2) / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, x + (w - drawWidth) / 2, y + (h - drawHeight) / 2, drawWidth, drawHeight);
}

function parseTime(value) { const parts = String(value || '').split(':').map(Number); return parts.length === 2 ? parts[0] * 60 + parts[1] : Number(parts[0]) || 0; }
function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function validColour(value, fallback) { return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback; }
function roundRect(x, y, w, h, r, tl = true, tr = true, br = true, bl = true) { ctx.beginPath(); ctx.moveTo(x + (tl ? r : 0), y); ctx.lineTo(x + w - (tr ? r : 0), y); if (tr) ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - (br ? r : 0)); if (br) ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + (bl ? r : 0), y + h); if (bl) ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + (tl ? r : 0)); if (tl) ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
