// Stomach panel: draws the stomach and animates it toward the latest report from gastric.py.
(function () {
  'use strict';
  const vscode = acquireVsCodeApi();
  const $ = id => document.getElementById(id);

  const SHAPE = 'M120 10 L150 10 L150 60 C165 35 230 30 255 80 C285 140 280 230 230 285 ' +
    'C190 320 120 320 90 295 C75 282 60 285 40 290 L22 292 L22 262 L40 262 ' +
    'C80 262 150 250 165 190 C175 140 125 110 120 60 Z';
  for (const id of ['wall', 'clipShape', 'gloss']) $(id).setAttribute('d', SHAPE);

  const svg = $('stomach'), sg = $('sg'), wall = $('wall'), liquid = $('liquid'), bubblesG = $('bubbles');
  const mouth = $('mouth'), eyeL = $('eyeL'), eyeR = $('eyeR'), cheekL = $('cheekL'), cheekR = $('cheekR');
  const rain = $('rain');

  const target = { fill: 0, gas: 0, heat: 0, severity: 0 };
  const cur = { fill: 0, gas: 0, heat: 0, severity: 0 };
  let stage = 'healthy';
  const bubbles = [];
  let t = 0, last = performance.now(), nextPoop = 0;

  const STOPS = [[247, 161, 181], [245, 213, 71], [134, 200, 74]]; // pink -> yellow -> green
  function colorAt(r) {
    r = Math.max(0, Math.min(1, r));
    const [a, b, k] = r < .5 ? [STOPS[0], STOPS[1], r * 2] : [STOPS[1], STOPS[2], (r - .5) * 2];
    return a.map((v, i) => Math.round(v + (b[i] - v) * k));
  }
  const rgb = (c, k = 1, a = 1) => `rgba(${c.map(v => Math.round(v * k)).join(',')},${a})`;
  const esc = s => String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);

  window.addEventListener('message', e => {
    const m = e.data;
    if (m.type !== 'state') return;
    const r = m.report;
    Object.assign(target, { fill: r.fill, gas: r.gas, heat: r.heat, severity: r.severity });
    stage = r.blocked ? 'refused'
      : r.stage === 'diarrhea' ? 'diarrhea'
      : r.severity >= 75 ? 'gurgling'
      : r.stage;
    document.body.dataset.stage = stage;
    $('pill').textContent = { healthy: 'Healthy', bloated: 'Bloated', gurgling: 'Gurgling', diarrhea: 'Diarrhea', refused: 'Refused' }[stage];
    $('file').textContent = m.file + (r.diets && r.diets.length ? ` · diet: ${r.diets.join(', ')}` : '');
    $('mFill').textContent = Math.round(r.fill);
    $('mGas').textContent = Math.round(r.gas);
    $('mHeat').textContent = Math.round(r.heat);
    $('caption').innerHTML = caption(r);
  });

  function caption(r) {
    if (r.blocked) {
      const p = r.problems.find(p => p.severity === 'error');
      return p ? `⚠ <b>${esc(p.kind)}</b>: ${esc(p.message)}` : '';
    }
    if (r.diarrhea) {
      return `💩 <b>DiarrheaError</b>: ${esc(r.diarrhea.cause)}.<br>Expelled: <code>${esc(r.diarrhea.expelled.join(', '))}</code>` +
        ` · try <code>${esc(r.diarrhea.hint)}</code>`;
    }
    if (r.severity >= 75) return '🤢 Your program is not feeling well. Output will contain 💩.';
    if (r.stage === 'bloated') return '😮‍💨 Bloated. The program will run, but expect some 💩 in the output.';
    return r.servings ? '😊 Healthy. The program runs exactly as written.' : '🍽️ Empty stomach. Declare some food.';
  }

  function spawnBubble() {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const r = 3 + Math.random() * 7;
    el.setAttribute('r', r);
    el.setAttribute('fill', 'rgba(255,255,240,.55)');
    el.setAttribute('stroke', 'rgba(255,255,255,.8)');
    el.setAttribute('stroke-width', '1.2');
    bubblesG.appendChild(el);
    bubbles.push({ el, r, x: 120 + Math.random() * 140, y: 305 - Math.random() * 30, v: 40 + Math.random() * 70, ph: Math.random() * 6 });
  }

  function spawnPoop() {
    const el = document.createElement('div');
    el.className = 'poop';
    el.textContent = '💩';
    el.style.left = Math.random() * 95 + '%';
    el.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
    el.style.setProperty('--r', ((Math.random() - .5) * 720) + 'deg');
    el.addEventListener('animationend', () => el.remove());
    rain.appendChild(el);
  }

  function drawFace() {
    let m, ry = 7, cheeks = 0;
    if (stage === 'healthy') m = 'M210 185 Q225 199 240 185';
    else if (stage === 'bloated') { m = 'M212 190 Q225 193 238 190'; cheeks = .7; ry = 5; }
    else if (stage === 'gurgling') { m = `M208 192 q4 ${-5 - Math.sin(t * 8) * 2} 8 0 t8 0 t8 0 t8 0`; cheeks = .4; ry = 2; }
    else if (stage === 'refused') { m = 'M212 192 L238 192'; ry = 6; }
    else { m = 'M218 190 a7 8 0 1 0 14 0 a7 8 0 1 0 -14 0'; ry = 9; } // diarrhea: gasp
    mouth.setAttribute('d', m);
    eyeL.setAttribute('ry', ry); eyeR.setAttribute('ry', ry);
    cheekL.setAttribute('opacity', cheeks); cheekR.setAttribute('opacity', cheeks);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    for (const k in cur) cur[k] += (target[k] - cur[k]) * 0.07;

    const sev = cur.severity / 100;
    const col = colorAt(sev);
    const swell = 1 + Math.min(0.3, 0.26 * Math.min(sev, 1.15)) + Math.sin(t * 2.2) * 0.012;
    const heat = Math.min(1.4, cur.heat / 100);
    const amp = heat * 9;
    const sx = (Math.random() - .5) * amp, sy = (Math.random() - .5) * amp;
    const swellX = swell * (1 + Math.min(.08, cur.gas / 1200));
    sg.setAttribute('transform', `translate(${180 + sx} ${175 + sy}) scale(${swellX} ${swell}) translate(-180 -175)`);
    svg.style.filter = stage !== 'refused' && heat > 0.05
      ? `drop-shadow(0 0 ${6 + heat * 18}px rgba(255,90,30,${Math.min(.85, heat * .8)}))` : '';

    wall.setAttribute('fill', rgb(col));
    wall.setAttribute('stroke', rgb(col, 0.55));

    const lvl = Math.min(1.12, cur.fill / 100);
    const y0 = 314 - lvl * 275;
    const waveAmp = 2.5 + Math.min(8, cur.gas / 12) + heat * 4;
    let d = `M0 ${y0}`;
    for (let x = 0; x <= 300; x += 10) {
      d += ` L${x} ${(y0 + Math.sin(x * 0.05 + t * 3) * waveAmp + Math.sin(x * 0.11 - t * 2.1) * waveAmp * .4).toFixed(1)}`;
    }
    liquid.setAttribute('d', d + ' L300 340 L0 340 Z');
    liquid.setAttribute('fill', rgb(col, 0.68, 0.92));

    if (Math.random() < Math.min(1.5, cur.gas / 60) * 0.6) spawnBubble();
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y -= b.v * dt; b.x += Math.sin(t * 6 + b.ph) * 0.4;
      if (b.y - b.r < Math.max(40, Math.min(y0, 300)) - 4) { b.el.remove(); bubbles.splice(i, 1); continue; }
      b.el.setAttribute('cx', b.x.toFixed(1)); b.el.setAttribute('cy', b.y.toFixed(1));
    }

    if (stage === 'diarrhea' && now > nextPoop) { spawnPoop(); nextPoop = now + 120 + Math.random() * 180; }

    drawFace();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  vscode.postMessage({ type: 'ready' });
})();
