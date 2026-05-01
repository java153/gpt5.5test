const KEYS = ["w", "e", "d", "j", "i", "o"];
const LANES = KEYS.map((k, i) => ({
  key: k,
  x: 90 + i * 170,
  color: ["#59f6ff", "#ff4eb8", "#ffd36e", "#7afc93", "#8ecbff", "#ffa7ee"][i],
  freq: [261.63, 329.63, 392.0, 440.0, 523.25, 659.25][i],
}));

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const bpmSlider = document.getElementById("bpm");
const bpmValue = document.getElementById("bpmValue");
const glowSlider = document.getElementById("glow");
const startBtn = document.getElementById("startBtn");

let audioCtx;
let master;
let started = false;
let pulse = 0;
let beatTime = 0;
let notes = [];
let particles = [];
let hitFlash = new Array(LANES.length).fill(0);
let aiSprites = {};

function loadSprites() {
  KEYS.forEach((k) => {
    const img = new Image();
    img.src = `assets/gpt/${k}.png`;
    img.onload = () => (aiSprites[k] = img);
  });
}

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  master = audioCtx.createGain();
  master.gain.value = 0.2;
  master.connect(audioCtx.destination);
}

function playTone(freq, length = 0.2, volume = 0.25, wave = "triangle") {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

function beatLoop() {
  if (!started || !audioCtx) return;
  const bpm = Number(bpmSlider.value);
  const beatDur = 60 / bpm;
  const now = audioCtx.currentTime;

  while (beatTime < now + 0.2) {
    const isKick = Math.round(beatTime / beatDur) % 4 === 0;
    playTone(isKick ? 90 : 140, 0.09, isKick ? 0.2 : 0.1, "sine");
    spawnNote(Math.floor(Math.random() * LANES.length));
    beatTime += beatDur;
  }

  requestAnimationFrame(beatLoop);
}

function spawnNote(laneIndex) {
  notes.push({ laneIndex, y: -20, speed: 130 + Math.random() * 50 });
}

function hitLane(key) {
  const idx = LANES.findIndex((l) => l.key === key);
  if (idx < 0) return;
  const lane = LANES[idx];
  playTone(lane.freq, 0.22, 0.28, "square");
  hitFlash[idx] = 1;

  const targetY = canvas.height - 90;
  const best = notes
    .map((n, i) => ({ i, err: Math.abs(n.y - targetY), n }))
    .filter((x) => x.n.laneIndex === idx)
    .sort((a, b) => a.err - b.err)[0];

  if (best && best.err < 70) {
    notes.splice(best.i, 1);
    for (let p = 0; p < 16; p++) {
      particles.push({
        x: lane.x + 35,
        y: targetY,
        dx: (Math.random() - 0.5) * 6,
        dy: -Math.random() * 4 - 1,
        life: 1,
        color: lane.color,
      });
    }
  }
}

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (KEYS.includes(key)) hitLane(key);
});

startBtn.onclick = async () => {
  ensureAudio();
  if (audioCtx.state === "suspended") await audioCtx.resume();
  if (!started) {
    started = true;
    beatTime = audioCtx.currentTime;
    beatLoop();
  }
};

bpmSlider.oninput = () => (bpmValue.textContent = bpmSlider.value);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  pulse += dt * 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const glow = Number(glowSlider.value) / 100;
  for (let i = 0; i < LANES.length; i++) {
    const lane = LANES[i];
    const alpha = 0.08 + Math.sin(pulse + i) * 0.03;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(lane.x, 20, 70, canvas.height - 40);

    hitFlash[i] *= 0.88;
    ctx.fillStyle = lane.color;
    ctx.globalAlpha = 0.2 + hitFlash[i] * glow;
    ctx.fillRect(lane.x, canvas.height - 120, 70, 80);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#fff";
    ctx.font = "bold 26px monospace";
    ctx.fillText(lane.key.toUpperCase(), lane.x + 25, canvas.height - 70);

    const sprite = aiSprites[lane.key];
    if (sprite) {
      ctx.drawImage(sprite, lane.x + 10, 28, 50, 50);
    } else {
      ctx.strokeStyle = lane.color;
      ctx.strokeRect(lane.x + 10, 28, 50, 50);
    }
  }

  notes.forEach((n) => (n.y += n.speed * dt));
  notes = notes.filter((n) => n.y < canvas.height + 30);

  for (const n of notes) {
    const lane = LANES[n.laneIndex];
    ctx.fillStyle = lane.color;
    ctx.fillRect(lane.x + 16, n.y, 38, 20);
  }

  particles.forEach((p) => {
    p.x += p.dx;
    p.y += p.dy;
    p.dy += 0.12;
    p.life -= 0.025;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 4, 4);
  });
  ctx.globalAlpha = 1;
  particles = particles.filter((p) => p.life > 0);

  requestAnimationFrame(frame);
}

loadSprites();
requestAnimationFrame(frame);
