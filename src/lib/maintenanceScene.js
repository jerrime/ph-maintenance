// Animated sunny / rainy background for the maintenance page: a canvas scene plus synthesized sound
// (Web Audio, no files). Ported from the standalone "we've moved" page. The season comes from the
// visitor's locale and the calendar only — no location or weather service is called.

    // Months wrap around the year, e.g. span(11, 3) = Nov, Dec, Jan, Feb, Mar
    export const span = (a, b) => {
      const out = [];
      for (let m = a; ; m = (m % 12) + 1) { out.push(m); if (m === b) break; }
      return out;
    };

    // Tropical countries: only two seasons, rainy months listed (every other month is sunny)
    const RAINY_MONTHS = {};
    const tropical = (months, codes) => codes.split(' ').forEach(c => (RAINY_MONTHS[c] = months));
    tropical(span(6, 11),  'PH');
    tropical(span(5, 10),  'TH VN KH LA MM LK');
    tropical(span(6, 9),   'IN BD NP PK ML SN BF NE');
    tropical(span(11, 3),  'ID MY SG BN TL BR');
    tropical(span(4, 10),  'NG GH CI CM TG BJ LR SL GN');
    tropical(span(3, 5).concat(span(10, 11)), 'KE TZ UG RW BI');
    tropical(span(5, 10),  'CR PA NI HN GT SV BZ CU DO JM HT PR TT VE CO');

    // Hot desert countries: sunny all year
    const SUNNY_ALL = new Set('AE SA QA KW BH OM YE EG LY DJ'.split(' '));

    // Countries not listed above default to sunny when the live weather isn't clear or rainy
    export function seasonFor(cc, date) {
      const m = date.getMonth() + 1;
      if (cc && SUNNY_ALL.has(cc)) return 'sunny';
      if (cc && RAINY_MONTHS[cc]) return RAINY_MONTHS[cc].includes(m) ? 'rainy' : 'sunny';
      return 'sunny';
    }

    // Kept outside Alpine's reactive state: AudioContext objects break inside a Proxy
    export const sfx = { ctx: null, master: null, rain: null, wind: null, brown: null, on: false, season: 'sunny' };

    export function sfxInit() {
      if (sfx.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;

      const ctx = new AC();
      const len = ctx.sampleRate * 2;
      const white = ctx.createBuffer(1, len, ctx.sampleRate);
      const brown = ctx.createBuffer(1, len, ctx.sampleRate);
      const w = white.getChannelData(0), b = brown.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const n = Math.random() * 2 - 1;
        w[i] = n;
        last = (last + 0.02 * n) / 1.02;
        b[i] = last * 3.5;
      }
      const loop = (buf, nodes) => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        nodes.reduce((a, n) => (a.connect(n), n), src);
        src.start();
      };

      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      // rain: hissing white noise
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1000;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
      const rain = ctx.createGain(); rain.gain.value = 0;
      loop(white, [hp, lp, rain, master]);

      // wind: slowly swelling low noise
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.7;
      const wind = ctx.createGain(); wind.gain.value = 0;
      loop(brown, [bp, wind, master]);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15;
      const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.02;
      lfo.connect(lfoDepth); lfoDepth.connect(wind.gain); lfo.start();

      Object.assign(sfx, { ctx, master, rain, wind, brown });

      // birdsong for the sunny scene, every few seconds
      const chirpLoop = () => { if (sfx.ctx !== ctx) return; sfxChirp(); setTimeout(chirpLoop, 2000 + Math.random() * 5000); };
      chirpLoop();

      const onVisibility = () => {
        if (sfx.ctx !== ctx) return document.removeEventListener('visibilitychange', onVisibility);
        if (document.hidden) ctx.suspend(); else if (sfx.on) ctx.resume();
      };
      document.addEventListener('visibilitychange', onVisibility);
      return true;
    }

    export function sfxSet(on, season) {
      if (!sfx.ctx) return;
      const t = sfx.ctx.currentTime;
      sfx.on = on;
      sfx.season = season;
      sfx.master.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.3);
      sfx.rain.gain.setTargetAtTime(0, t, 0.8);
      sfx.wind.gain.setTargetAtTime(season === 'rainy' ? 0.07 : 0.09, t, 0.8);
    }

    function sfxChirp() {
      if (!sfx.on || sfx.season !== 'sunny') return;
      const ctx = sfx.ctx;
      const base = 2200 + Math.random() * 1800;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const t = ctx.currentTime + i * 0.16;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(base, t);
        o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.08);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g); g.connect(sfx.master);
        o.start(t); o.stop(t + 0.12);
      }
    }

    // Rolling thunder a moment after each lightning strike
    function sfxThunder() {
      if (!sfx.on || sfx.season !== 'rainy') return;
      const ctx = sfx.ctx;
      const t = ctx.currentTime + 0.4 + Math.random() * 0.8;
      const src = ctx.createBufferSource();
      src.buffer = sfx.brown;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(400, t);
      lp.frequency.exponentialRampToValueAtTime(70, t + 2.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1.3, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, t + 3);
      src.connect(lp); lp.connect(g); g.connect(sfx.master);
      src.start(t, Math.random()); src.stop(t + 3.2);
    }

/** Stops the sound and releases the audio context (the page is going away). */
export function sfxStop() {
  if (!sfx.ctx) return;
  try { sfx.ctx.close(); } catch (e) { /* already closed */ }
  Object.assign(sfx, { ctx: null, master: null, rain: null, wind: null, brown: null, on: false });
}

/** Draws the scene on `canvas`. `st()` returns { season, dark } so the scene follows the page. Returns a cleanup. */
export function startScene(canvas, st) {
          const ctx = canvas.getContext('2d');
          const mouse = { x: -2000, y: -2000 };
          let raf = 0;
          let alive = true;
          let w = 0, h = 0;
          let items = [];
          let particles = [];
          let current = null;
          let T = null;
          let switching = false; // true while the scene fades out/in for a season change
          let flash = 0;       // lightning flash brightness (0..1)
          let bolt = null;
          let nextStrike = 0;
          let echoAt = 0;
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

          const rand = ([a, b]) => a + Math.random() * (b - a);

          /* ---------- shapes (drawn around 0,0) ---------- */

          const drawDrop = (r, c) => {
            ctx.beginPath();
            ctx.moveTo(0, -r * 1.8);
            ctx.bezierCurveTo(r * 0.2, -r * 0.8, r, -r * 0.2, r, r * 0.5);
            ctx.arc(0, r * 0.5, r, 0, Math.PI, false);
            ctx.bezierCurveTo(-r, -r * 0.2, -r * 0.2, -r * 0.8, 0, -r * 1.8);
            const g = ctx.createLinearGradient(0, -r * 1.8, 0, r * 1.5);
            g.addColorStop(0, c.light);
            g.addColorStop(1, c.base);
            ctx.fillStyle = g;
            ctx.fill();
          };

          /* ---------- one theme per season ---------- */

          const themes = {
            // Sun with rotating rays, drifting clouds (two depth layers) and twinkling sparkles
            sunny: {
              sun: true,
              landscape: true,
              build: () => [
                ...Array.from({ length: 5 }, () => new Cloud(0)),
                ...Array.from({ length: 4 }, () => new Cloud(1)),
                ...Array.from({ length: 12 }, () => new Wind()),
                ...Array.from({ length: 14 }, () => new Leaf()),
                ...Array.from({ length: 6 }, () => new Bird()),
                ...Array.from({ length: 9 }, () => new Fish()),
                ...Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => new Crab()),
              ],
            },
            rainy: {
              // Night: moon with rays, white clouds and wind; no rain drops and no lightning
              storm: false,
              moon: true,
              landscape: true,
              build: () => [
                ...Array.from({ length: 110 }, () => new Star()),
                ...Array.from({ length: 8 }, () => new Wind()),
                ...Array.from({ length: 14 }, () => new StormCloud(1)),
                ...Array.from({ length: 14 }, () => new Leaf()),
                ...Array.from({ length: 9 }, () => new Fish()),
                ...Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => new Crab()),
              ],
              dir: 1, r: [3, 6], speed: [4.9, 9.1], sway: 0, swayF: 1, wind: 2,
              spin: [0, 0], wobble: [0, 0], rock: 0, alpha: 0.85, draw: drawDrop, tilt: true, hit: 2.5, pad: 12, pgrav: 0.25,
              colors: [
                { base: '#2563eb', light: '#93c5fd', dark: '#1e3a8a' },
                { base: '#0ea5e9', light: '#bae6fd', dark: '#075985' },
              ],
            },
          };

          /* ---------- particles & items ---------- */

          class Particle {
            constructor(x, y, color, gravity) {
              this.x = x; this.y = y; this.color = color;
              this.size = Math.random() * 3 + 1;
              this.speedX = (Math.random() - 0.5) * 12;
              this.speedY = (Math.random() - 0.5) * 12;
              this.gravity = gravity;
              this.opacity = 1;
            }
            update() {
              this.x += this.speedX;
              this.y += this.speedY;
              this.speedY += this.gravity;
              this.opacity -= 0.025;
            }
            draw() {
              ctx.save();
              ctx.globalAlpha = Math.max(0, this.opacity);
              ctx.fillStyle = this.color;
              ctx.beginPath();
              ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }

          class Item {
            constructor(theme, first) { this.T = theme; this.init(first); }

            init(first) {
              const T = this.T;
              this.r = rand(T.r);
              this.speed = rand(T.speed);
              this.x = Math.random() * (w + 200) - 100;
              this.y = first
                ? Math.random() * h
                : T.dir > 0
                  ? -this.r * 2 - Math.random() * 200
                  : h + this.r * 2 + Math.random() * 200;
              this.colorSet = T.colors[Math.floor(Math.random() * T.colors.length)];
              this.wobbleSpeed = rand(T.wobble);
              this.angle = Math.random() * Math.PI * 2;
              this.rot = T.tilt ? -Math.atan2(T.wind, this.speed) : Math.random() * Math.PI * 2;
              this.spin = rand(T.spin);
              this.popped = false;
            }

            pop() {
              if (this.popped) return;
              this.popped = true;
              const n = this.T.tilt ? 8 : 20;
              for (let i = 0; i < n; i++) {
                particles.push(new Particle(this.x, this.y, this.colorSet.base, this.T.pgrav ?? 0.2));
              }
              setTimeout(() => alive && this.init(false), 1000 + Math.random() * 1000);
            }

            update() {
              if (this.popped) return;
              const T = this.T;

              this.y += T.dir * this.speed;
              this.angle += this.wobbleSpeed;
              this.x += Math.sin(this.angle * T.swayF) * T.sway + T.wind;
              this.rot += this.spin;

              if (this.x > w + 120) this.x = -120;
              else if (this.x < -120) this.x = w + 120;

              const dx = this.x - mouse.x;
              const dy = this.y - mouse.y;
              if (Math.hypot(dx, dy) < this.r * (T.hit || 1.1) + (T.pad || 10)) this.pop();

              if (T.dir > 0 ? this.y > h + this.r * 2 + 40 : this.y < -this.r * 2 - 40) this.init(false);

              this.draw();
            }

            draw() {
              const T = this.T;
              ctx.save();
              ctx.translate(this.x, this.y);
              ctx.rotate(this.rot + Math.sin(this.angle) * T.rock);
              ctx.globalAlpha = T.alpha;
              T.draw(this.r, this.colorSet);
              ctx.restore();
            }
          }

          /* ---------- sunny: clouds, sparkles, sun ---------- */

          // [x, y, radius] puffs that make up a cloud outline
          const CLOUD_PUFFS = [
            [-50, 8, 18], [-24, 10, 22], [6, 10, 24], [34, 10, 22], [56, 10, 16],
            [-26, -6, 26], [4, -18, 32], [34, -6, 24],
          ];

          class Cloud {
            constructor(layer) { this.layer = layer; this.init(true); }

            init(first) {
              const back = this.layer === 0;
              this.s = back ? rand([0.25, 0.4]) : rand([0.45, 0.7]);
              this.speed = back ? rand([0.3, 0.7]) : rand([0.75, 1.4]);
              this.alpha = back ? 0.55 : 0.95;
              this.x = first ? Math.random() * w : -160 * this.s - Math.random() * 300;
              this.y = h * (0.06 + Math.random() * 0.5);
              this.phase = Math.random() * Math.PI * 2;
              this.popped = false;
            }

            pop() {
              if (this.popped) return;
              this.popped = true;
              for (let i = 0; i < 14; i++) {
                particles.push(new Particle(
                  this.x + (Math.random() - 0.5) * 60 * this.s, this.y,
                  st().dark ? '#e0f2fe' : '#60a5fa', 0.02
                ));
              }
              setTimeout(() => alive && this.init(false), 1500 + Math.random() * 1500);
            }

            update() {
              if (this.popped) return;
              this.x += this.speed;
              this.phase += 0.008;
              if (Math.hypot(this.x - mouse.x, this.y - mouse.y) < 48 * this.s + 10) this.pop();
              if (this.x > w + 180 * this.s) this.init(false);
              this.draw();
            }

            draw() {
              const dark = st().dark;
              ctx.save();
              ctx.translate(this.x, this.y + Math.sin(this.phase) * 4);
              ctx.scale(this.s, this.s);
              ctx.globalAlpha = this.alpha;
              const g = ctx.createLinearGradient(0, -34, 0, 24);
              g.addColorStop(0, dark ? '#f0f9ff' : '#ffffff');
              g.addColorStop(1, dark ? '#7dd3fc' : '#bfdbfe');
              ctx.fillStyle = g;
              ctx.shadowColor = dark ? 'rgba(125,211,252,.6)' : 'rgba(37,99,235,.25)';
              ctx.shadowBlur = 18;
              ctx.beginPath();
              CLOUD_PUFFS.forEach(([cx, cy, r]) => { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); });
              ctx.fill();
              ctx.restore();
            }
          }

          // Big dark storm clouds along the top of the screen; they light up during lightning
          class StormCloud extends Cloud {
            init(first) {
              this.s = rand([1.1, 1.9]);
              this.speed = rand([0.3, 0.75]);
              this.alpha = 0.97;
              this.x = Math.random() * w;            // always appears inside the screen
              this.fade = first ? 1 : 0;             // new clouds fade in instead of popping in
              this.y = h * Math.random() * 0.1;
              this.phase = Math.random() * Math.PI * 2;
              this.popped = false;
            }

            pop() {
              if (this.popped) return;
              this.popped = true;
              for (let i = 0; i < 24; i++) {
                particles.push(new Particle(
                  this.x + (Math.random() - 0.5) * 120 * this.s, this.y + Math.random() * 20,
                  Math.random() < 0.5 ? '#ffffff' : '#bae6fd', 0.15
                ));
              }
              setTimeout(() => alive && this.init(false), 2000 + Math.random() * 2000);
            }

            draw() {
              const dark = st().dark;
              ctx.save();
              ctx.translate(this.x, this.y + Math.sin(this.phase) * 3);
              ctx.scale(this.s, this.s);
              this.fade = Math.min(1, this.fade + 0.02);
              ctx.globalAlpha = this.alpha * this.fade;
              const g = ctx.createLinearGradient(0, -34, 0, 24);
              g.addColorStop(0, '#ffffff');
              g.addColorStop(1, '#e0f2fe');
              ctx.shadowColor = 'rgba(186,230,253,.6)';
              ctx.shadowBlur = 18;
              ctx.fillStyle = g;
              ctx.beginPath();
              CLOUD_PUFFS.forEach(([cx, cy, r]) => { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); });
              ctx.fill();
              if (flash > 0.05) {
                ctx.globalAlpha = Math.min(1, flash * 0.9);
                ctx.fillStyle = '#c7d2fe';
                ctx.fill();
              }
              ctx.restore();
            }
          }

          // Fast, thin wind swooshes that streak across the sky, some with a little curl
          class Wind {
            constructor() { this.init(true); }

            init(first) {
              this.len = rand([90, 220]);
              this.speed = rand([3, 6]);
              this.x = first ? Math.random() * w : -this.len - Math.random() * 400;
              this.y = h * (0.1 + Math.random() * 0.8);
              this.amp = rand([4, 10]);
              this.phase = Math.random() * Math.PI * 2;
              this.curl = Math.random() < 0.5;
              this.alpha = rand([0.25, 0.5]);
              this.lw = rand([1, 2]);
            }

            pop() {}

            update() {
              this.x += this.speed;
              this.phase += 0.05;
              if (this.x > w + 50) this.init(false);

              const p = Math.min(1, Math.max(0, (this.x + this.len / 2) / w));
              const wave = Math.sin(this.phase) * this.amp;
              const rgb = st().dark ? '224,242,254' : '59,130,246';

              ctx.save();
              ctx.translate(this.x, this.y);
              ctx.globalAlpha = this.alpha * Math.sin(p * Math.PI);
              const g = ctx.createLinearGradient(0, 0, this.len, 0);
              g.addColorStop(0, 'rgba(' + rgb + ',0)');
              g.addColorStop(0.5, 'rgba(' + rgb + ',1)');
              g.addColorStop(1, 'rgba(' + rgb + ',1)');
              ctx.strokeStyle = g;
              ctx.lineWidth = this.lw;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.bezierCurveTo(this.len * 0.3, -wave, this.len * 0.6, wave, this.len, 0);
              if (this.curl) {
                const e = this.len;
                ctx.bezierCurveTo(e + 14, -2, e + 16, -14, e + 6, -14);
                ctx.bezierCurveTo(e - 2, -14, e - 2, -6, e + 4, -6);
              }
              ctx.stroke();
              ctx.restore();
            }
          }

          class Star {
            constructor() { this.init(); }

            init() {
              this.x = Math.random() * w;
              this.y = Math.random() * h * 0.68;
              this.size = rand([0.6, 1.8]);
              this.phase = Math.random() * Math.PI * 2;
              this.rate = rand([0.015, 0.05]);
              this.big = Math.random() < 0.15;               // a few stars get a cross-shaped glint
            }

            pop() {}

            update() {
              this.phase += this.rate;
              const a = 0.35 + 0.65 * ((Math.sin(this.phase) + 1) / 2);
              ctx.save();
              ctx.translate(this.x, this.y);
              ctx.globalAlpha = a;
              ctx.fillStyle = '#f8fafc';
              ctx.shadowColor = '#bae6fd';
              ctx.shadowBlur = 6;
              ctx.beginPath();
              ctx.arc(0, 0, this.size, 0, Math.PI * 2);
              ctx.fill();
              if (this.big) {
                const L = this.size * 4 * a;
                ctx.strokeStyle = 'rgba(248,250,252,.8)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(-L, 0); ctx.lineTo(L, 0);
                ctx.moveTo(0, -L); ctx.lineTo(0, L);
                ctx.stroke();
              }
              ctx.restore();
            }
          }

          // Leaves blown from left to right by the wind: they sweep across the screen in gusts, riding up and
          // down on the air and tumbling as they go
          class Leaf {
            constructor() { this.init(true); }

            init(first) {
              this.size = rand([10.5, 21]);
              this.popped = false;
              this.x = first ? Math.random() * w : -this.size * 2 - Math.random() * 500;
              this.y = h * (0.08 + Math.random() * 0.8);
              this.vx = rand([1.6, 3.6]);             // base speed to the right
              this.vy = rand([0.1, 0.45]);            // slight sink
              this.gust = Math.random() * Math.PI * 2;
              this.gustRate = rand([0.01, 0.025]);
              this.wave = Math.random() * Math.PI * 2;
              this.waveRate = rand([0.03, 0.06]);
              this.amp = rand([0.8, 2.2]);            // how hard it rides the air up and down
              this.rot = Math.random() * Math.PI * 2;
              this.spin = rand([0.03, 0.09]);
              this.tumble = Math.random() * Math.PI * 2; // fake 3D flip: the leaf squashes as it turns over
              this.color = ['#4ade80', '#22c55e', '#86efac', '#facc15', '#f59e0b'][Math.floor(Math.random() * 5)];
            }

            pop() {
              if (this.popped) return;
              this.popped = true;
              for (let i = 0; i < 12; i++) particles.push(new Particle(this.x, this.y, this.color, 0.15));
              setTimeout(() => alive && this.init(false), 1000 + Math.random() * 1500);
            }

            update() {
              if (this.popped) return;
              this.gust += this.gustRate;
              this.wave += this.waveRate;
              this.tumble += 0.07;
              const gust = 1 + 0.7 * Math.sin(this.gust);   // the wind swells and eases
              this.x += this.vx * gust;
              this.y += this.vy + Math.sin(this.wave) * this.amp;
              this.rot += this.spin * gust;
              if (this.y > h + 30) this.y = -20;
              else if (this.y < -30) this.y = h + 20;
              if (this.x > w + 60) this.init(false);
              if (Math.hypot(this.x - mouse.x, this.y - mouse.y) < this.size + 12) this.pop();

              ctx.save();
              ctx.translate(this.x, this.y);
              ctx.rotate(this.rot);
              ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(this.tumble)));
              const L = this.size;
              ctx.globalAlpha = 0.9;
              ctx.fillStyle = this.color;
              ctx.beginPath();
              ctx.moveTo(0, -L);
              ctx.bezierCurveTo(L * 0.9, -L * 0.5, L * 0.8, L * 0.5, 0, L);
              ctx.bezierCurveTo(-L * 0.8, L * 0.5, -L * 0.9, -L * 0.5, 0, -L);
              ctx.fill();
              ctx.strokeStyle = 'rgba(21,128,61,.55)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(0, -L);
              ctx.lineTo(0, L + 3);
              ctx.stroke();
              ctx.restore();
            }
          }

          // Fish leaping out of the sea in an arc, with a little splash going out and coming back in
          class Fish {
            constructor() { this.init(true); }

            init(first) {
              this.wait = first ? rand([20, 300]) : rand([120, 420]);   // frames until the next leap
              this.t = -1;
            }

            launch() {
              this.t = 0;
              this.len = rand([46, 64]);                  // frames in the air
              this.x0 = w * (0.1 + Math.random() * 0.8);
              this.y0 = h * (0.825 + Math.random() * 0.06);
              this.dx = rand([70, 130]) * (Math.random() < 0.5 ? -1 : 1);
              this.hgt = rand([45, 85]);
              this.size = rand([9, 13]);
              this.splash(this.x0, this.y0);
            }

            splash(x, y) {
              for (let i = 0; i < 10; i++) particles.push(new Particle(x, y, '#bae6fd', 0.2));
            }

            update() {
              if (this.t < 0) {
                if (--this.wait <= 0) this.launch();
                return;
              }
              this.t += 1 / this.len;
              if (this.t >= 1) {
                this.splash(this.x0 + this.dx, this.y0);
                this.init(false);
                return;
              }
              const t = this.t;
              const x = this.x0 + this.dx * t;
              const y = this.y0 - 4 * this.hgt * t * (1 - t);
              // a mouse or finger on the fish bursts it; it is back after a short wait
              if (Math.hypot(x - mouse.x, y - mouse.y) < this.size * 1.6 + 12) {
                for (let i = 0; i < 14; i++) particles.push(new Particle(x, y, i % 2 ? '#e2e8f0' : '#7dd3fc', 0.2));
                this.init(false);
                return;
              }
              const ang = Math.atan2(-4 * this.hgt * (1 - 2 * t), this.dx);   // nose follows the arc

              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(ang);
              const L = this.size;
              ctx.fillStyle = T.moon ? '#e2e8f0' : '#f1f5f9';
              ctx.shadowColor = 'rgba(186,230,253,.8)';
              ctx.shadowBlur = 8;
              ctx.beginPath();
              ctx.ellipse(0, 0, L, L * 0.42, 0, 0, Math.PI * 2);
              ctx.fill();
              // tail trails behind the nose
              ctx.beginPath();
              ctx.moveTo(-L * 0.8, 0);
              ctx.lineTo(-L * 1.55, -L * 0.5);
              ctx.lineTo(-L * 1.55, L * 0.5);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = '#0f172a';
              ctx.beginPath();
              ctx.arc(L * 0.5, -L * 0.1, L * 0.09, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }

          // Crabs scuttling sideways along the beach, pausing now and then and turning around at the edges
          class Crab {
            constructor() {
              this.x = Math.random() * w;
              this.dir = Math.random() < 0.5 ? -1 : 1;
              this.size = rand([9, 14]);
              this.lane = rand([0.935, 0.975]);           // how far down the sand it walks
              this.speed = rand([0.5, 0.9]);
              this.pause = 0;
              this.step = Math.random() * Math.PI * 2;
              this.popped = false;
              this.born = performance.now();               // drives the 1 second fade-in
            }

            pop() {
              if (this.popped) return;
              this.popped = true;
              const y = h * this.lane;
              for (let i = 0; i < 16; i++) particles.push(new Particle(this.x, y, i % 2 ? '#ef4444' : '#fca5a5', 0.2));
              setTimeout(() => {
                if (!alive) return;
                this.x = Math.random() * w;
                this.popped = false;
                this.born = performance.now();
              }, 1500 + Math.random() * 2000);
            }

            y() { return h * this.lane; }

            update() {
              if (this.popped) return;
              if (Math.hypot(this.x - mouse.x, this.y() - mouse.y) < this.size * 1.4 + 12) { this.pop(); return; }
              if (this.pause > 0) this.pause--;
              else {
                this.x += this.dir * this.speed;
                this.step += 0.25;
                if (this.x < 20) this.dir = 1;
                else if (this.x > w - 20) this.dir = -1;
                if (Math.random() < 0.004) this.pause = rand([40, 160]);
                if (Math.random() < 0.003) this.dir = -this.dir;
              }
              const L = this.size;
              const y = this.y();
              const night = T.moon;
              ctx.save();
              ctx.translate(this.x, y);
              ctx.globalAlpha = Math.min(1, (performance.now() - this.born) / 1000);
              ctx.strokeStyle = night ? '#b91c1c' : '#dc2626';
              ctx.fillStyle = night ? '#dc2626' : '#ef4444';
              ctx.lineWidth = 1.5;
              ctx.lineCap = 'round';
              // legs: three a side, stepping in alternation
              for (let side = -1; side <= 1; side += 2) {
                for (let i = 0; i < 3; i++) {
                  const sw = Math.sin(this.step + i * 1.3 + (side > 0 ? Math.PI : 0)) * L * 0.18;
                  ctx.beginPath();
                  ctx.moveTo(side * L * 0.5, -L * 0.1 + i * L * 0.18);
                  ctx.lineTo(side * L * 0.95 + sw, L * 0.1 + i * L * 0.22);
                  ctx.stroke();
                }
              }
              // claws raised on either side
              const snap = Math.sin(this.step * 0.5) * 0.2;
              for (let side = -1; side <= 1; side += 2) {
                ctx.beginPath();
                ctx.moveTo(side * L * 0.45, -L * 0.2);
                ctx.lineTo(side * L * 0.8, -L * 0.7);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(side * L * 0.85, -L * 0.8, L * 0.26, snap, Math.PI * 1.7 + snap);
                ctx.fill();
              }
              // shell
              ctx.beginPath();
              ctx.ellipse(0, 0, L * 0.62, L * 0.42, 0, 0, Math.PI * 2);
              ctx.fill();
              // eyes on little stalks
              ctx.fillStyle = '#0f172a';
              ctx.beginPath();
              ctx.arc(-L * 0.2, -L * 0.5, L * 0.08, 0, Math.PI * 2);
              ctx.arc(L * 0.2, -L * 0.5, L * 0.08, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }

          // Birds gliding across the sky with flapping wings, bobbing as they go
          class Bird {
            constructor() { this.init(true); }

            init(first) {
              this.s = rand([0.7, 1.4]);
              this.speed = rand([1.2, 2.6]) * (0.6 + this.s * 0.4);
              this.x = first ? Math.random() * w : -60 - Math.random() * 500;
              this.baseY = h * (0.08 + Math.random() * 0.5);
              this.phase = Math.random() * Math.PI * 2;
              this.flap = rand([0.12, 0.2]);
              this.bob = Math.random() * Math.PI * 2;
            }

            pop() {}

            update() {
              this.x += this.speed;
              this.phase += this.flap;
              this.bob += 0.02;
              if (this.x > w + 60) this.init(false);

              const y = this.baseY + Math.sin(this.bob) * 14;
              const wing = Math.sin(this.phase);            // -1 (wings down) .. 1 (wings up)
              ctx.save();
              ctx.translate(this.x, y);
              ctx.scale(this.s, this.s);
              ctx.strokeStyle = st().dark ? '#e2e8f0' : '#334155';
              ctx.globalAlpha = 0.85;
              ctx.lineWidth = 2.2;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.beginPath();
              ctx.moveTo(-16, -wing * 9);
              ctx.quadraticCurveTo(-8, -wing * 9 - 6, 0, 0);
              ctx.quadraticCurveTo(8, -wing * 9 - 6, 16, -wing * 9);
              ctx.stroke();
              ctx.restore();
            }
          }

          const drawSun = () => {
            const t = performance.now();
            const dark = st().dark;
            const sx = w * 0.12;
            const sy = h * 0.14;
            const R = Math.max(36, Math.min(w, h) * 0.065) * (1 + 0.03 * Math.sin(t * 0.002));
            const L = Math.hypot(w, h) * 1.1;

            // soft halo
            let g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 7);
            g.addColorStop(0, 'rgba(253,224,71,' + (dark ? 0.38 : 0.55) + ')');
            g.addColorStop(1, 'rgba(253,224,71,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);

            // slowly rotating, pulsing rays
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(t * 0.00004);
            g = ctx.createLinearGradient(0, 0, L, 0);
            g.addColorStop(0, 'rgba(253,230,138,.9)');
            g.addColorStop(1, 'rgba(253,230,138,0)');
            ctx.fillStyle = g;
            const N = 14;
            for (let i = 0; i < N; i++) {
              const half = 0.045 + 0.02 * Math.sin(t * 0.0007 + i * 1.7);
              ctx.save();
              ctx.rotate((i * Math.PI * 2) / N);
              ctx.globalAlpha = (dark ? 0.2 : 0.3) * (0.55 + 0.45 * Math.sin(t * 0.0009 + i * 1.3));
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(L, -L * Math.tan(half));
              ctx.lineTo(L, L * Math.tan(half));
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }
            ctx.restore();

            // sun disc
            g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
            g.addColorStop(0, '#fffbe6');
            g.addColorStop(0.6, '#fde047');
            g.addColorStop(1, '#f59e0b');
            ctx.save();
            ctx.fillStyle = g;
            ctx.shadowColor = 'rgba(253,224,71,.9)';
            ctx.shadowBlur = 40;
            ctx.beginPath();
            ctx.arc(sx, sy, R, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          };

          // Night: a crescent moon with slowly turning, softly pulsing pale rays
          const drawMoon = () => {
            const t = performance.now();
            const mx = w * 0.12;
            const my = h * 0.14;
            const R = Math.max(32, Math.min(w, h) * 0.06) * (1 + 0.02 * Math.sin(t * 0.0015));
            const L = Math.hypot(w, h) * 1.1;

            let g = ctx.createRadialGradient(mx, my, 0, mx, my, R * 6);
            g.addColorStop(0, 'rgba(186,230,253,.4)');
            g.addColorStop(1, 'rgba(186,230,253,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);

            ctx.save();
            ctx.translate(mx, my);
            ctx.rotate(-t * 0.00004);
            g = ctx.createLinearGradient(0, 0, L, 0);
            g.addColorStop(0, 'rgba(224,242,254,.9)');
            g.addColorStop(1, 'rgba(224,242,254,0)');
            ctx.fillStyle = g;
            const N = 12;
            for (let i = 0; i < N; i++) {
              const half = 0.04 + 0.018 * Math.sin(t * 0.0007 + i * 1.7);
              ctx.save();
              ctx.rotate((i * Math.PI * 2) / N);
              ctx.globalAlpha = 0.22 * (0.55 + 0.45 * Math.sin(t * 0.0009 + i * 1.3));
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(L, -L * Math.tan(half));
              ctx.lineTo(L, L * Math.tan(half));
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }
            ctx.restore();

            // full moon, light gray at 80% opacity
            ctx.save();
            ctx.globalAlpha = 0.8;
            ctx.shadowColor = 'rgba(203,213,225,.9)';
            ctx.shadowBlur = 30;
            ctx.fillStyle = '#d1d5db';
            ctx.beginPath();
            ctx.arc(mx, my, R, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          };

          // Landscape along the bottom: dark hills on the horizon, a sea with drifting waves and the
          // sun's or moon's glittering reflection, and a sandy beach in front
          const drawLandscape = () => {
            const t = performance.now();
            const horizon = h * 0.8;
            const shore = h * 0.91;
            // colours: dusky at night, bright in the day; the hills carry a touch of green either way
            const P = T.moon
              ? { hillFar: '#1f5a3f', hillNear: '#14412f', mount: '#0e2f3f', mountSnow: 'rgba(226,232,240,.45)', treeLeaf: '#0b3a24', treeTrunk: '#3b2a1a', palmLeaf: '#166534', palmTrunk: '#6b4f3a', seaTop: '#0c4a6e', seaBottom: '#1e3a8a', glint: '226,232,240', sandTop: '#b8a98a', sandBottom: '#8a7b60' }
              : { hillFar: '#4f9d63', hillNear: '#2f7d4a', mount: '#7b9bb5', mountSnow: 'rgba(255,255,255,.85)', treeLeaf: '#1d6b3a', treeTrunk: '#6b4a2b', palmLeaf: '#22a04f', palmTrunk: '#8a6240', seaTop: '#38bdf8', seaBottom: '#0284c7', glint: '254,249,195', sandTop: '#f3e2b3', sandBottom: '#e0c98a' };

            // mountains on both sides, behind the hills: two peaks each with snowy tips
            const peak = (cx, half, height) => {
              ctx.fillStyle = P.mount;
              ctx.beginPath();
              ctx.moveTo(cx - half, horizon);
              ctx.lineTo(cx - half * 0.18, horizon - height * 0.86);
              ctx.lineTo(cx, horizon - height);
              ctx.lineTo(cx + half * 0.22, horizon - height * 0.84);
              ctx.lineTo(cx + half, horizon);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = P.mountSnow;
              ctx.beginPath();
              ctx.moveTo(cx - half * 0.18, horizon - height * 0.86);
              ctx.lineTo(cx, horizon - height);
              ctx.lineTo(cx + half * 0.22, horizon - height * 0.84);
              ctx.lineTo(cx + half * 0.08, horizon - height * 0.76);
              ctx.lineTo(cx - half * 0.02, horizon - height * 0.82);
              ctx.lineTo(cx - half * 0.1, horizon - height * 0.74);
              ctx.closePath();
              ctx.fill();
            };
            peak(w * 0.07, w * 0.2, h * 0.3);
            peak(w * 0.25, w * 0.17, h * 0.21);
            peak(w * 0.93, w * 0.2, h * 0.28);
            peak(w * 0.76, w * 0.17, h * 0.2);

            // hills: two layers, the far one lighter
            const hillY = (x, base, amp, f1, f2, ph) =>
              base - amp * (0.55 + 0.45 * Math.sin(x * f1 + ph)) * (0.7 + 0.3 * Math.sin(x * f2 + ph * 2));
            const hill = (base, amp, f1, f2, ph, color) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.moveTo(0, horizon);
              for (let x = 0; x <= w; x += 8) ctx.lineTo(x, hillY(x, base, amp, f1, f2, ph));
              ctx.lineTo(w, horizon);
              ctx.closePath();
              ctx.fill();
            };
            hill(horizon - 4, h * 0.11, 0.0042, 0.011, 1.2, P.hillFar);
            hill(horizon, h * 0.075, 0.0065, 0.017, 4.1, P.hillNear);

            // round trees on the left and right hills, standing on the near hill's crest
            const treeSize = Math.max(8, Math.min(w, h) * 0.018);
            const trees = [];
            for (let x = w * 0.02; x < w * 0.34; x += treeSize * 2.3) trees.push(x);
            for (let x = w * 0.66; x < w * 0.98; x += treeSize * 2.3) trees.push(x);
            for (const x of trees) {
              const jitter = Math.sin(x * 12.9898) * 0.25 + 1;           // steady per-position size variation
              const sz = treeSize * jitter;
              const by = hillY(x, horizon, h * 0.075, 0.0065, 0.017, 4.1) + 2;
              ctx.fillStyle = P.treeTrunk;
              ctx.fillRect(x - sz * 0.1, by - sz * 0.9, sz * 0.2, sz * 0.9);
              ctx.fillStyle = P.treeLeaf;
              ctx.beginPath();
              ctx.arc(x, by - sz * 1.25, sz * 0.75, 0, Math.PI * 2);
              ctx.arc(x - sz * 0.45, by - sz * 0.95, sz * 0.5, 0, Math.PI * 2);
              ctx.arc(x + sz * 0.45, by - sz * 0.95, sz * 0.5, 0, Math.PI * 2);
              ctx.fill();
            }

            // sea
            let g = ctx.createLinearGradient(0, horizon, 0, shore + 10);
            g.addColorStop(0, P.seaTop);
            g.addColorStop(1, P.seaBottom);
            ctx.fillStyle = g;
            ctx.fillRect(0, horizon, w, shore - horizon + 10);

            // sun / moon reflection: short bright dashes under it
            for (let i = 0; i < 9; i++) {
              const y = horizon + 6 + i * ((shore - horizon - 8) / 9);
              const half = (10 + i * 6) * (0.6 + 0.4 * Math.sin(t * 0.002 + i));
              ctx.strokeStyle = 'rgba(' + P.glint + ',' + (0.5 - i * 0.035) + ')';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(w * 0.12 - half, y);
              ctx.lineTo(w * 0.12 + half, y);
              ctx.stroke();
            }

            // waves rolling across
            ctx.lineWidth = 1.5;
            for (let k = 0; k < 4; k++) {
              const y0 = horizon + 8 + k * ((shore - horizon - 12) / 4);
              ctx.strokeStyle = 'rgba(186,230,253,' + (0.18 + k * 0.05) + ')';
              ctx.beginPath();
              for (let x = 0; x <= w; x += 10) {
                const y = y0 + Math.sin(x * 0.02 + t * 0.0016 * (1 + k * 0.25) + k * 2) * (1.5 + k * 0.6);
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
              }
              ctx.stroke();
            }

            // beach: a sandy shore curving along the bottom, with a line of foam where the water meets it
            const sandTop = (x) => shore + Math.sin(x * 0.006 + 0.8) * 6 + Math.sin(t * 0.0012 + x * 0.01) * 1.5;
            ctx.fillStyle = 'rgba(241,245,249,.55)';
            ctx.beginPath();
            ctx.moveTo(0, sandTop(0) - 3);
            for (let x = 0; x <= w; x += 10) ctx.lineTo(x, sandTop(x) - 3);
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            ctx.fill();
            g = ctx.createLinearGradient(0, shore, 0, h);
            g.addColorStop(0, P.sandTop);
            g.addColorStop(1, P.sandBottom);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(0, sandTop(0));
            for (let x = 0; x <= w; x += 10) ctx.lineTo(x, sandTop(x));
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            ctx.fill();

            // coconut palms on the beach: a leaning trunk topped with swaying fronds and a few coconuts
            const palm = (px, tall, lean) => {
              const by = sandTop(px) + (h - shore) * 0.45;
              const sway = Math.sin(t * 0.0012 + px) * tall * 0.03;
              const tx = px + lean * tall + sway;
              const ty = by - tall;
              ctx.strokeStyle = P.palmTrunk;
              ctx.lineCap = 'round';
              ctx.lineWidth = Math.max(4, tall * 0.07);
              ctx.beginPath();
              ctx.moveTo(px, by);
              ctx.quadraticCurveTo(px + lean * tall * 0.2, by - tall * 0.55, tx, ty);
              ctx.stroke();
              ctx.fillStyle = P.palmLeaf;
              for (let i = 0; i < 7; i++) {
                const a = -Math.PI / 2 + (i - 3) * 0.5 + Math.sin(t * 0.0015 + i + px) * 0.06;
                const len = tall * 0.55;
                const ex = tx + Math.cos(a) * len;
                const ey = ty + Math.sin(a) * len + len * 0.45;           // fronds arch and droop
                const cx = tx + Math.cos(a) * len * 0.55;
                const cy = ty + Math.sin(a) * len * 0.9 - len * 0.1;
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.quadraticCurveTo(cx, cy - 4, ex, ey);
                ctx.quadraticCurveTo(cx, cy + 6, tx, ty);
                ctx.fill();
              }
              ctx.fillStyle = P.palmTrunk;
              ctx.beginPath();
              ctx.arc(tx - 3, ty + 5, 3.5, 0, Math.PI * 2);
              ctx.arc(tx + 4, ty + 6, 3.5, 0, Math.PI * 2);
              ctx.fill();
            };
            const palmH = Math.max(70, Math.min(w, h) * 0.2);
            palm(w * 0.045, palmH, 0.18);
            palm(w * 0.93, palmH * 1.05, -0.2);
            palm(w * 0.86, palmH * 0.8, 0.12);
          };

          /* ---------- rainy: lightning ---------- */

          const strike = () => {
            let x = w * (0.15 + Math.random() * 0.7);
            let y = h * 0.06;
            const endY = h * (0.65 + Math.random() * 0.3);
            const pts = [[x, y]];
            const branches = [];
            while (y < endY) {
              y += rand([18, 40]);
              x += rand([-28, 28]);
              pts.push([x, y]);
              if (Math.random() < 0.3) {
                let bx = x, by = y;
                const b = [[bx, by]];
                const dirX = Math.random() < 0.5 ? -1 : 1;
                for (let k = 0; k < 4; k++) {
                  by += rand([14, 28]);
                  bx += rand([10, 35]) * dirX;
                  b.push([bx, by]);
                }
                branches.push(b);
              }
            }
            bolt = { pts, branches, life: 1 };
            flash = 1;
            echoAt = performance.now() + 120;
            sfxThunder();
          };

          const drawLightning = () => {
            if (!T.storm || reduceMotion) return;
            const now = performance.now();
            if (now > nextStrike) { strike(); nextStrike = now + rand([3500, 9000]); }
            if (echoAt && now > echoAt) { flash = Math.max(flash, 0.85); echoAt = 0; }

            if (flash > 0.01) {
              ctx.fillStyle = st().dark
                ? 'rgba(224,231,255,' + flash * 0.9 + ')'
                : 'rgba(255,255,255,' + flash * 0.97 + ')';
              ctx.fillRect(0, 0, w, h);
              flash *= 0.92;
            }

            if (bolt) {
              const trace = p => {
                ctx.beginPath();
                ctx.moveTo(p[0][0], p[0][1]);
                for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
                ctx.stroke();
              };
              ctx.save();
              ctx.globalAlpha = Math.min(1, bolt.life * 1.5);
              ctx.lineJoin = 'round';
              ctx.lineCap = 'round';
              ctx.shadowColor = '#a5b4fc';
              ctx.shadowBlur = 70;
              ctx.strokeStyle = '#c7d2fe';
              ctx.lineWidth = 8; trace(bolt.pts);
              ctx.lineWidth = 4; bolt.branches.forEach(trace);
              ctx.shadowBlur = 0;
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 3.5; trace(bolt.pts);
              ctx.lineWidth = 1.8; bolt.branches.forEach(trace);
              ctx.restore();
              bolt.life -= 0.06;
              if (bolt.life <= 0) bolt = null;
            }
          };

          /* ---------- loop ---------- */

          const rebuild = () => {
            current = st().season;
            T = themes[current];
            flash = 0;
            bolt = null;
            echoAt = 0;
            nextStrike = performance.now() + 1500;
            items = T.build ? T.build() : Array.from({ length: T.count }, () => new Item(T, true));
            particles = [];
          };

          const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            rebuild();
          };

          const animate = () => {
            if (!alive) return;
            // Fade out (.25s), swap the scene, fade back in (.25s) = .5s in total
            if (st().season !== current && !switching) {
              switching = true;
              canvas.style.opacity = '0';
              setTimeout(() => {
                rebuild();
                canvas.style.opacity = '1';
                switching = false;
              }, 250);
            }

            ctx.clearRect(0, 0, w, h);

            if (T.sun) drawSun();
            if (T.moon) drawMoon();
            if (T.landscape) drawLandscape();

            particles = particles.filter(p => p.opacity > 0);
            particles.forEach(p => { p.update(); p.draw(); });
            items.forEach(i => i.update());
            drawLightning();

            raf = requestAnimationFrame(animate);
          };

          const onMouse = e => { mouse.x = e.clientX; mouse.y = e.clientY; };
          const onTouch = e => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; };
          window.addEventListener('resize', resize);
          window.addEventListener('mousemove', onMouse);
          window.addEventListener('touchmove', onTouch, { passive: true });
          window.addEventListener('touchstart', onTouch, { passive: true });
          window.addEventListener('mousedown', onMouse);

          resize();
          animate();
          return () => {
            alive = false;
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', onMouse);
            window.removeEventListener('touchmove', onTouch);
            window.removeEventListener('touchstart', onTouch);
            window.removeEventListener('mousedown', onMouse);
          };
}
