(function(){
  'use strict';
  var $ = function(id){ return document.getElementById(id); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stats = { rings:0, flies:0, croaks:0, lastCalls:0 };

  /* ---------------- timer ---------------- */
  var start = Date.now(), timer = $('timer');
  function pad(n){ return n<10 ? '0'+n : ''+n; }
  function elapsed(){
    var s = Math.floor((Date.now()-start)/1000);
    return pad(Math.floor(s/3600))+':'+pad(Math.floor(s%3600/60))+':'+pad(s%60);
  }
  function tick(){ timer.textContent = elapsed(); }
  tick(); setInterval(tick, 1000);

  /* ---------------- sound (Web Audio, unlocked on first gesture) ---------------- */
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, noiseBuf = null;
  var soundOn = true;
  try { soundOn = localStorage.getItem('toad-sound') !== 'off'; } catch(e){}
  var soundBtn = $('soundBtn');

  function ensureAudio(){
    if (!AC) return null;
    if (!ctx){
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = soundOn ? 0.7 : 0;
        var comp = ctx.createDynamicsCompressor();
        master.connect(comp); comp.connect(ctx.destination);
      } catch(e){ ctx = null; return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(function(){});
    return ctx;
  }
  function ready(){ return soundOn && ensureAudio(); }
  function env(g, t, peak, attack, decay){
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t+attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t+attack+decay);
  }
  function getNoise(){
    if (noiseBuf) return noiseBuf;
    var len = ctx.sampleRate*2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0), last = 0;
    for (var i=0;i<len;i++){ var w = Math.random()*2-1; last = (last + 0.02*w)/1.02; d[i] = last*3.5; }
    return (noiseBuf = b);
  }

  function ding(delay, pitch){
    if (!ready()) return;
    var t = ctx.currentTime + (delay||0), f = pitch || 1568;
    [[1,1,1.8],[2.0,.3,1.1],[2.76,.45,.9],[4.07,.18,.5],[5.4,.12,.35]].forEach(function(p){
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f*p[0];
      env(g, t, 0.22*p[1], 0.004, p[2]);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+p[2]+0.05);
    });
  }
  function croakPulse(t, f0, f1, dur, vol){
    var o = ctx.createOscillator(), am = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
    var lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t+dur);
    lfo.type = 'square'; lfo.frequency.value = 34; depth.gain.value = 0.45; am.gain.value = 0.55;
    lfo.connect(depth); depth.connect(am.gain);
    lp.type = 'lowpass'; lp.frequency.value = 820; lp.Q.value = 7;
    env(g, t, vol, 0.012, dur);
    o.connect(am); am.connect(lp); lp.connect(g); g.connect(master);
    o.start(t); lfo.start(t); o.stop(t+dur+0.05); lfo.stop(t+dur+0.05);
  }
  function croak(){
    if (!ready()) return;
    var t = ctx.currentTime;
    croakPulse(t, 150, 105, 0.13, 0.55);
    croakPulse(t+0.19, 135, 82, 0.2, 0.6);
  }
  function gulp(){
    if (!ready()) return;
    var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(120, t+0.12);
    env(g, t, 0.35, 0.008, 0.13);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+0.2);
  }
  function buzz(dur){
    if (!ready()) return;
    var t = ctx.currentTime, d = dur || 0.7;
    var o = ctx.createOscillator(), vib = ctx.createOscillator(), vibG = ctx.createGain();
    var bp = ctx.createBiquadFilter(), g = ctx.createGain(), out = g;
    o.type = 'sawtooth'; o.frequency.value = 215;
    vib.frequency.value = 11; vibG.gain.value = 22; vib.connect(vibG); vibG.connect(o.frequency);
    bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 1.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t+0.08);
    g.gain.setValueAtTime(0.09, t+d-0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t+d);
    o.connect(bp); bp.connect(g);
    if (ctx.createStereoPanner){
      var pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(-0.6, t); pan.pan.linearRampToValueAtTime(0.6, t+d);
      g.connect(pan); out = pan;
    }
    out.connect(master);
    o.start(t); vib.start(t); o.stop(t+d+0.05); vib.stop(t+d+0.05);
  }

  /* ---- jukebox ambience: room hum + a quiet, far-away chord loop ---- */
  var juke = { on:false, nodes:null, timer:null, next:0, beat:0 };
  var jukeBtn = $('jukeBtn'), jukeLabel = $('jukeLabel');
  var BPM = 84, SPB = 60/BPM;
  var prog = [
    { bass:45, chord:[57,60,64,67] }, { bass:50, chord:[57,60,62,65] },
    { bass:45, chord:[57,60,64,67] }, { bass:40, chord:[56,59,62,64] }
  ];
  function mf(m){ return 440*Math.pow(2,(m-69)/12); }
  function note(dest, midi, t, dur, type, vol){
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = mf(midi);
    env(g, t, vol, 0.02, dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t+dur+0.05);
  }
  function scheduleJuke(){
    if (!juke.nodes) return;
    while (juke.next < ctx.currentTime + 0.4){
      var b = juke.beat, bar = prog[Math.floor(b/4) % prog.length], pos = b % 4, t = juke.next, out = juke.nodes.music;
      if (pos === 0) note(out, bar.bass, t, SPB*1.6, 'triangle', 0.5);
      if (pos === 2) note(out, bar.bass+7, t, SPB*1.4, 'triangle', 0.4);
      if (pos === 1 || pos === 3){
        bar.chord.forEach(function(m, i){ note(out, m, t + i*0.012, SPB*0.7, 'triangle', 0.12); });
      }
      if (pos === 3 && Math.random() < 0.5) note(out, bar.chord[3]+12, t+SPB*0.5, SPB*0.4, 'sine', 0.07);
      juke.beat++; juke.next += SPB;
    }
  }
  function startJuke(){
    if (!ensureAudio() || juke.nodes) return;
    var t = ctx.currentTime;
    var bus = ctx.createGain(); bus.gain.setValueAtTime(0.0001, t); bus.gain.exponentialRampToValueAtTime(1, t+1.5); bus.connect(master);
    var src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    var ng = ctx.createGain(); ng.gain.value = 0.05;
    src.connect(lp); lp.connect(ng); ng.connect(bus); src.start();
    var hum = ctx.createOscillator(), hg = ctx.createGain(); hum.frequency.value = 50; hg.gain.value = 0.012;
    hum.connect(hg); hg.connect(bus); hum.start();
    var music = ctx.createGain(); music.gain.value = 0.16;
    var tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1500;
    music.connect(tone); tone.connect(bus);
    juke.nodes = { bus:bus, src:src, hum:hum, music:music };
    juke.next = ctx.currentTime + 0.1; juke.beat = 0;
    scheduleJuke(); juke.timer = setInterval(scheduleJuke, 120);
  }
  function stopJuke(){
    if (!juke.nodes) return;
    var n = juke.nodes, t = ctx.currentTime;
    clearInterval(juke.timer); juke.nodes = null;
    n.bus.gain.cancelScheduledValues(t); n.bus.gain.setValueAtTime(n.bus.gain.value || 0.0001, t);
    n.bus.gain.exponentialRampToValueAtTime(0.0001, t+0.4);
    setTimeout(function(){ try { n.src.stop(); n.hum.stop(); n.bus.disconnect(); } catch(e){} }, 500);
  }
  function renderJuke(){
    jukeBtn.setAttribute('aria-pressed', String(juke.on));
    jukeLabel.textContent = juke.on ? 'Jukebox on' : 'Jukebox off';
    jukeBtn.setAttribute('aria-label', juke.on ? 'Jukebox on' : 'Jukebox off');
  }
  jukeBtn.addEventListener('click', function(){
    juke.on = !juke.on;
    if (juke.on){
      if (!soundOn){ soundOn = true; persistSound(); renderSound(); }
      startJuke(); toastMsg('The jukebox takes a fly. Low volume, as is tradition.');
    } else stopJuke();
    renderJuke();
  });

  function persistSound(){
    try { localStorage.setItem('toad-sound', soundOn ? 'on' : 'off'); } catch(e){}
    if (master) master.gain.setTargetAtTime(soundOn ? 0.7 : 0, ctx.currentTime, 0.03);
  }
  function renderSound(){
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off');
  }
  soundBtn.addEventListener('click', function(){
    soundOn = !soundOn; ensureAudio(); persistSound(); renderSound();
    if (!soundOn && juke.on){ juke.on = false; stopJuke(); renderJuke(); }
    if (soundOn) ding(0, 2093);
  });
  renderSound(); renderJuke();
  // first gesture anywhere unlocks audio (browser autoplay rules)
  function unlock(){ ensureAudio(); window.removeEventListener('pointerdown', unlock, true); window.removeEventListener('keydown', unlock, true); }
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  /* ---------------- toast ---------------- */
  var toast = $('toast'), toastTimer;
  function toastMsg(text, ms){
    toast.textContent = text; toast.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ toast.classList.remove('is-on'); }, ms || 2600);
  }

  /* ---------------- toad geometry (maps photo coords onto the screen) ---------------- */
  var hero = document.querySelector('.hero'), photo = document.querySelector('.hero__photo'), img = $('heroImg');
  var toadBtn = $('toad'), bubble = $('bubble'), tongue = $('tongue'), flyEl = $('fly');
  var IW = 1280, IH = 720;
  var TOAD = { x:612, y:345, w:360, h:300, mouthY:300 };   // in source-image pixels
  var geo = null;
  function measure(){
    var hr = hero.getBoundingClientRect(), pr = photo.getBoundingClientRect();
    var W = pr.width, H = pr.height, s = Math.max(W/IW, H/IH);
    var pos = getComputedStyle(img).objectPosition.split(' ').map(function(v){ return parseFloat(v)/100; });
    var px = isNaN(pos[0]) ? 0.5 : pos[0], py = isNaN(pos[1]) ? 0.5 : pos[1];
    var ox = (W - IW*s)*px + (pr.left - hr.left), oy = (H - IH*s)*py + (pr.top - hr.top);
    function map(x, y){ return { x: ox + x*s, y: oy + y*s }; }
    var c = map(TOAD.x, TOAD.y), m = map(TOAD.x, TOAD.mouthY);
    geo = {
      s:s, center:c, mouth:m, w:TOAD.w*s, h:TOAD.h*s,
      photo:{ left: Math.max(pr.left-hr.left, 0), top: Math.max(pr.top-hr.top, 0),
              right: Math.min(pr.right-hr.left, hr.width), bottom: Math.min(pr.bottom-hr.top, hr.height) },
      heroW: hr.width
    };
    toadBtn.style.left = (c.x - geo.w/2)+'px'; toadBtn.style.top = (c.y - geo.h/2)+'px';
    toadBtn.style.width = geo.w+'px'; toadBtn.style.height = geo.h+'px';
    img.style.transformOrigin = (TOAD.x/IW*100)+'% '+(TOAD.y/IH*100)+'%';
  }
  measure();
  window.addEventListener('resize', function(){ measure(); placeFlyInBounds(); });
  if (img.complete) measure(); else img.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* ---------------- toad: croak, puff, speech bubble ---------------- */
  var lines = [
    'Still here.', 'Not a mushroom.', 'Tab\u2019s open.', 'One more fly.',
    'I\u2019ve seen flatter charts. Not many.', 'The stool is warm. The stool stays.',
    'Ribbit. That\u2019s the whole statement.', 'I was here before the mushroom.',
    'Comfortable, thanks.', 'Bid whenever. I\u2019m sitting.', 'Yes, it\u2019s a real stool.',
    'Ask the bartender. He\u2019s seen it all.'
  ];
  var lastLine = -1, bubbleTimer, puffTimer;
  function say(text){
    var x = Math.min(Math.max(geo.center.x, 130), geo.heroW - 130);
    var y = Math.max(geo.center.y - geo.h*0.42, 70);
    bubble.style.left = x+'px'; bubble.style.top = y+'px';
    bubble.textContent = text;
    bubble.classList.remove('is-on'); void bubble.offsetWidth; bubble.classList.add('is-on');
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(function(){ bubble.classList.remove('is-on'); }, 2400);
  }
  function puff(){
    img.classList.remove('is-puffed'); void img.offsetWidth; img.classList.add('is-puffed');
    clearTimeout(puffTimer); puffTimer = setTimeout(function(){ img.classList.remove('is-puffed'); }, 340);
  }
  function randomLine(){
    var i; do { i = Math.floor(Math.random()*lines.length); } while (i === lastLine);
    lastLine = i; return lines[i];
  }
  toadBtn.addEventListener('click', function(){
    stats.croaks++; croak(); puff(); say(randomLine());
  });

  /* ---------------- the fly ---------------- */
  var fly = { x:0, y:0, a:Math.random()*6.28, v:110, alive:false, caught:false, last:0 };
  var flyLines = ['Excellent fly.', 'Put it on the tab.', 'Thank you. Another.', 'Gulp. Still here.', 'That one had notes.'];
  function bounds(){
    var p = geo.photo, m = 34;
    return { l:p.left+m, t:p.top+m+40, r:p.right-m, b:p.bottom-m };
  }
  function placeFlyInBounds(){
    if (!fly.alive) return;
    var b = bounds();
    fly.x = Math.min(Math.max(fly.x, b.l), b.r); fly.y = Math.min(Math.max(fly.y, b.t), b.b);
    drawFly();
  }
  function drawFly(){
    var deg = fly.a*180/Math.PI + 90;
    flyEl.style.transform = 'translate3d('+fly.x.toFixed(1)+'px,'+fly.y.toFixed(1)+'px,0)';
    flyEl.firstElementChild.style.transform = 'rotate('+deg.toFixed(0)+'deg)';
  }
  function spawnFly(){
    var b = bounds();
    var fromLeft = Math.random() < 0.5;
    fly.x = fromLeft ? b.l : b.r; fly.y = b.t + Math.random()*(b.b-b.t);
    fly.a = fromLeft ? (Math.random()-0.5) : Math.PI + (Math.random()-0.5);
    if (reduce){ fly.x = b.l + Math.random()*(b.r-b.l); fly.y = b.t + Math.random()*(b.b-b.t)*0.6; }
    fly.alive = true; fly.caught = false;
    flyEl.classList.remove('is-gone'); flyEl.disabled = false;
    drawFly();
  }
  function step(now){
    var dt = Math.min((now - (fly.last || now))/1000, 0.05); fly.last = now;
    if (fly.alive && !fly.caught && !reduce){
      var b = bounds();
      fly.a += (Math.random()-0.5)*7*dt + Math.sin(now/370)*1.6*dt;
      var sp = fly.v * (0.75 + 0.5*Math.abs(Math.sin(now/900)));
      fly.x += Math.cos(fly.a)*sp*dt; fly.y += Math.sin(fly.a)*sp*dt;
      if (fly.x < b.l){ fly.x = b.l; fly.a = Math.PI - fly.a; }
      if (fly.x > b.r){ fly.x = b.r; fly.a = Math.PI - fly.a; }
      if (fly.y < b.t){ fly.y = b.t; fly.a = -fly.a; }
      if (fly.y > b.b){ fly.y = b.b; fly.a = -fly.a; }
      // keep a polite distance from the toad's face
      var dx = fly.x - geo.center.x, dy = fly.y - geo.center.y, r = geo.w*0.55;
      if (dx*dx + dy*dy < r*r){ fly.a = Math.atan2(dy, dx); }
      drawFly();
    }
    requestAnimationFrame(step);
  }
  flyEl.addEventListener('click', function(){
    if (!fly.alive || fly.caught) return;
    fly.caught = true; flyEl.disabled = true;
    var mx = geo.mouth.x, my = geo.mouth.y, dx = fly.x - mx, dy = fly.y - my;
    tongue.style.left = mx+'px'; tongue.style.top = my+'px';
    tongue.style.width = Math.sqrt(dx*dx+dy*dy)+'px';
    tongue.style.setProperty('--a', Math.atan2(dy, dx)+'rad');
    tongue.classList.remove('is-out'); void tongue.offsetWidth; tongue.classList.add('is-out');
    setTimeout(function(){
      flyEl.classList.add('is-gone'); fly.alive = false;
      gulp(); setTimeout(croak, 140); puff();
      stats.flies++; $('eaten').textContent = stats.flies;
      say(flyLines[(stats.flies-1) % flyLines.length]);
    }, reduce ? 0 : 150);
    setTimeout(function(){ spawnFly(); buzz(0.8); }, 1900);
  });

  /* ---------------- bell + last call ---------------- */
  var ringLines = [
    'Bartender, one more fly.', 'Bid noted. The toad nods once.', 'Bartender, one more fly.',
    'The stool did not move. Good stool.'
  ];
  var bell = $('bell'), neon = document.querySelector('.neon'), neonText = $('neonText'), rings = $('rings');
  var reactTimer, neonTimer;
  bell.addEventListener('click', function(){
    stats.rings++; rings.textContent = stats.rings;
    hero.classList.remove('is-reacting'); bell.classList.remove('is-ringing'); neon.classList.remove('is-hot');
    void hero.offsetWidth;
    hero.classList.add('is-reacting'); bell.classList.add('is-ringing'); neon.classList.add('is-hot');
    clearTimeout(reactTimer);
    reactTimer = setTimeout(function(){ hero.classList.remove('is-reacting'); bell.classList.remove('is-ringing'); neon.classList.remove('is-hot'); }, 1300);
    if (stats.rings % 5 === 0) lastCall();
    else { ding(); toastMsg(ringLines[(stats.rings - 1 - Math.floor(stats.rings/5)) % ringLines.length]); }
  });
  function lastCall(){
    stats.lastCalls++;
    ding(0, 1568); ding(0.16, 1760); ding(0.32, 2093); setTimeout(croak, 650);
    toastMsg('Last call! Somebody bid. Bartender, one more fly.', 3800);
    say('Somebody bid.');
    puff();
    neonText.textContent = 'LAST CALL';
    neon.classList.remove('is-lastcall'); void neon.offsetWidth; neon.classList.add('is-lastcall');
    clearTimeout(neonTimer);
    neonTimer = setTimeout(function(){ neonText.textContent = 'TOADSTOOL'; neon.classList.remove('is-lastcall'); }, 3200);
    if (!reduce) fizz();
  }
  function fizz(){
    var box = $('fizz'), frag = document.createDocumentFragment();
    for (var i=0;i<34;i++){
      var el = document.createElement('i');
      if (i % 4 === 0) el.className = 'f';
      el.style.setProperty('--x', (Math.random()*100)+'%');
      el.style.setProperty('--s', (6 + Math.random()*14)+'px');
      el.style.setProperty('--d', (1.8 + Math.random()*1.8)+'s');
      el.style.setProperty('--dx', ((Math.random()-0.5)*160)+'px');
      el.style.animationDelay = (Math.random()*0.6)+'s';
      frag.appendChild(el);
    }
    box.appendChild(frag);
    setTimeout(function(){ box.innerHTML = ''; }, 4400);
  }

  /* ---------------- the tab (receipt easter egg) ---------------- */
  var receipt = $('receipt');
  $('tabBtn').addEventListener('click', function(){
    $('rTime').textContent = elapsed();
    $('rRings').textContent = stats.rings;
    $('rFlies').textContent = stats.flies;
    $('rCroaks').textContent = stats.croaks;
    $('rLast').textContent = stats.lastCalls;
    var total = stats.flies + stats.rings + stats.lastCalls*2;
    $('rTotal').textContent = total + (total === 1 ? ' fly' : ' flies');
    ding(0, 2637);
    if (receipt.showModal) receipt.showModal(); else receipt.setAttribute('open', '');
  });
  receipt.addEventListener('click', function(e){ if (e.target === receipt) receipt.close(); });

  /* ---------------- meme lightbox ---------------- */
  var box = $('lightbox'), big = $('lightbox-img');
  document.querySelectorAll('.card').forEach(function(c){
    c.addEventListener('click', function(){
      big.src = c.dataset.src; big.alt = c.dataset.alt;
      if (box.showModal) box.showModal(); else window.open(c.dataset.src, '_blank');
    });
  });
  box.addEventListener('click', function(e){ if (e.target === box) box.close(); });

  /* go */
  setTimeout(spawnFly, 600);
  requestAnimationFrame(step);
})();
