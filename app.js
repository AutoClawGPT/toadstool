(function(){
  var start = Date.now();
  var timer = document.getElementById('timer');
  function pad(n){return n<10?'0'+n:''+n}
  function tick(){
    var s = Math.floor((Date.now()-start)/1000);
    var h = Math.floor(s/3600), m = Math.floor(s%3600/60);
    timer.textContent = pad(h)+':'+pad(m)+':'+pad(s%60);
  }
  tick(); setInterval(tick,1000);

  var lines = [
    'Bartender, one more fly.',
    'Bid noted. The toad nods once.',
    'Bartender, one more fly.',
    'The stool did not move. Good stool.',
    'Bartender, one more fly.',
    'Still on the stool. Feeling great about it.'
  ];
  var bell = document.getElementById('bell');
  var hero = document.querySelector('.hero');
  var neon = document.querySelector('.neon');
  var toast = document.getElementById('toast');
  var rings = document.getElementById('rings');
  var n = 0, tTimer, rTimer;
  bell.addEventListener('click', function(){
    toast.textContent = lines[n % lines.length];
    n++; rings.textContent = n;
    hero.classList.remove('is-reacting'); bell.classList.remove('is-ringing'); neon.classList.remove('is-hot');
    void hero.offsetWidth;
    hero.classList.add('is-reacting'); bell.classList.add('is-ringing'); neon.classList.add('is-hot');
    toast.classList.add('is-on');
    clearTimeout(tTimer); clearTimeout(rTimer);
    tTimer = setTimeout(function(){toast.classList.remove('is-on')}, 2600);
    rTimer = setTimeout(function(){hero.classList.remove('is-reacting'); bell.classList.remove('is-ringing'); neon.classList.remove('is-hot')}, 1300);
  });

  var box = document.getElementById('lightbox');
  var big = document.getElementById('lightbox-img');
  document.querySelectorAll('.card').forEach(function(c){
    c.addEventListener('click', function(){
      big.src = c.dataset.src; big.alt = c.dataset.alt;
      if (box.showModal) box.showModal(); else window.open(c.dataset.src,'_blank');
    });
  });
  box.addEventListener('click', function(e){ if (e.target === box) box.close(); });
})();
