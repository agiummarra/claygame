/* ClayGame - avvio dell'applicazione: schermata iniziale, caricamento, audio, schermo intero, PWA. */
(function () {
  'use strict';
  var G = window.Game, $ = function (id) { return document.getElementById(id); };
  var started = false;

  G.init();

  // barra di caricamento tra una scena e l'altra
  var loadTimer = null;
  G.onProgress = function (p) {
    $('loading-bar').style.width = Math.round(p * 100) + '%';
    if (p >= 1) { clearTimeout(loadTimer); $('loading').classList.add('hidden'); }
    else if (!loadTimer) loadTimer = setTimeout(function () { $('loading').classList.remove('hidden'); }, 250);
    if (p >= 1) loadTimer = null;
  };

  // il primo tocco sblocca l'audio (richiesto dai browser mobili) e fa partire il menu
  $('start-btn').addEventListener('click', function () {
    if (started) return; started = true;
    G.Snd.unlock();
    G.show('menu', window.ClayGameScenes.menu, false).then(function () { $('start').classList.add('hidden'); });
    ['s1', 's2', 's3', 's4'].reduce(function (p, k) { return p.then(function () { return G.preload(k); }); }, Promise.resolve());
  });

  window.ClayGameApp = {
    quit: function () {            // "Esci" dal menu: si torna alla schermata iniziale
      started = false;
      if (window.Edu) window.Edu.closeAll();
      if (G.scene) { G.scene.destroy(); }
      $('start').classList.remove('hidden');
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    }
  };

  // audio on/off
  var bs = $('btn-sound');
  function paintSound() { bs.textContent = G.Snd.muted ? '🔇' : '🔊'; bs.classList.toggle('off', G.Snd.muted); }
  bs.addEventListener('click', function () { G.Snd.setMuted(!G.Snd.muted); paintSound(); });
  paintSound();

  // schermo intero (dove supportato)
  var bf = $('btn-full'), root = document.documentElement;
  var reqFs = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!reqFs) bf.style.display = 'none';
  bf.addEventListener('click', function () {
    var el = document.fullscreenElement || document.webkitFullscreenElement;
    if (el) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else { var p = reqFs.call(root); if (p && p.catch) p.catch(function () { }); }
  });

  // suggerimento di rotazione sugli schermi piccoli in verticale
  function checkOrientation() {
    var portrait = window.innerHeight > window.innerWidth * 1.15, small = Math.min(window.innerWidth, window.innerHeight) < 600;
    $('rotate').classList.toggle('hidden', !(portrait && small));
  }
  window.addEventListener('resize', checkOrientation);
  checkOrientation();

  // niente zoom / scroll accidentali durante il gioco
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });

  // installabile e giocabile offline
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
  }
})();
