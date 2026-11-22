/* ClayGame - motore minimale: stage scalabile, sprite, tween (stile Tweener), audio, input touch/mouse.
   Nessuna dipendenza esterna: funziona su qualsiasi browser moderno (desktop, tablet, smartphone). */
(function () {
  'use strict';

  var STAGE_W = 1280, STAGE_H = 1024;
  var IMG_DIR = 'assets/img/', AUDIO_DIR = 'assets/audio/';

  // ---------------------------------------------------------------- easing
  function outElastic(t) {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
  }
  function inElastic(t) { return 1 - outElastic(1 - t); }
  function outBounce(t) {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
    if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
    t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
  }
  var EASE = {
    linear: function (t) { return t; },
    easeoutelastic: outElastic,
    easeinelastic: inElastic,
    easeoutinelastic: function (t) { return t < 0.5 ? outElastic(2 * t) / 2 : inElastic(2 * t - 1) / 2 + 0.5; },
    easeoutbounce: outBounce,
    easeinbounce: function (t) { return 1 - outBounce(1 - t); },
    easeinsine: function (t) { return 1 - Math.cos(t * Math.PI / 2); }
  };

  // curva di Bezier come in caurina CurveModifiers
  function bezier(b, e, t, p) {
    if (p.length === 1) return b + t * (2 * (1 - t) * (p[0] - b) + t * (e - b));
    var ip = Math.min(Math.floor(t * p.length), p.length - 1);
    var it = (t - ip / p.length) * p.length, p1, p2;
    if (ip === 0) { p1 = b; p2 = (p[0] + p[1]) / 2; }
    else if (ip === p.length - 1) { p1 = (p[ip - 1] + p[ip]) / 2; p2 = e; }
    else { p1 = (p[ip - 1] + p[ip]) / 2; p2 = (p[ip] + p[ip + 1]) / 2; }
    return p1 + it * (2 * (1 - it) * (p[ip] - p1) + it * (p2 - p1));
  }

  // ---------------------------------------------------------------- tween
  var tweens = [];
  var RESERVED = { time: 1, delay: 1, transition: 1, onStart: 1, onComplete: 1, _bezier: 1 };

  function addTween(obj, o, owner) {
    var props = [];
    for (var k in o) if (!RESERVED[k]) props.push(k);
    // un nuovo tween sostituisce quelli in corso sulle stesse proprieta'
    tweens.forEach(function (t) {
      if (t.obj === obj) t.props = t.props.filter(function (p) { return props.indexOf(p) < 0; });
    });
    var now = performance.now();
    tweens.push({
      obj: obj, to: o, props: props, owner: owner || null,
      t0: now + (o.delay || 0) * 1000, dur: Math.max((o.time || 0) * 1000, 1),
      ease: EASE[String(o.transition || 'linear').toLowerCase()] || EASE.linear,
      from: null
    });
  }
  function killTweens(owner) { tweens = tweens.filter(function (t) { return t.owner !== owner; }); }

  function tick(now) {
    var list = tweens.slice(), done = [];
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (tweens.indexOf(t) < 0 || now < t.t0) continue;
      if (!t.from) {
        t.from = {};
        t.props.forEach(function (p) { t.from[p] = t.obj[p]; });
        if (t.to.onStart) t.to.onStart();
      }
      var r = Math.min((now - t.t0) / t.dur, 1), e = t.ease(r);
      for (var j = 0; j < t.props.length; j++) {
        var p = t.props[j], b = t.from[p], end = t.to[p];
        if (t.to._bezier && (p === 'x' || p === 'y')) {
          t.obj[p] = bezier(b, end, e, t.to._bezier.map(function (q) { return q[p]; }));
        } else t.obj[p] = b + (end - b) * e;
      }
      if (r >= 1) done.push(t);
    }
    done.forEach(function (t) {
      var k = tweens.indexOf(t);
      if (k >= 0) tweens.splice(k, 1);
      if (t.to.onComplete && t.props.length) t.to.onComplete();
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------------------------------------------------------------- sprite
  function Sprite(def, el) {
    this.def = def; this.el = el; this.name = def.name;
    this._x = def.ox; this._y = def.oy;
    this._sx = def.sx; this._sy = def.sy;
    this._rz = 0; this._ry = 0; this._rx = 0;
    this._a = def.alpha === undefined ? 1 : def.alpha;
    this._v = true;
    el.style.transformOrigin = (def.ox - def.x) + 'px ' + (def.oy - def.y) + 'px';
    if (def.blend) el.style.mixBlendMode = def.blend;
    this._apply();
  }
  Sprite.prototype._apply = function () {
    var d = this.def, s = this.el.style;
    var t = 'translate(' + (this._x - d.ox) + 'px,' + (this._y - d.oy) + 'px)';
    if (this._rz) t += ' rotate(' + this._rz + 'deg)';
    if (this._ry) t += ' rotateY(' + this._ry + 'deg)';
    if (this._rx) t += ' rotateX(' + this._rx + 'deg)';
    if (this._sx !== d.sx || this._sy !== d.sy) t += ' scale(' + (this._sx / d.sx) + ',' + (this._sy / d.sy) + ')';
    s.transform = t;
    s.opacity = this._a < 0 ? 0 : this._a;
    s.display = this._v ? '' : 'none';
  };
  function prop(name, field) {
    Object.defineProperty(Sprite.prototype, name, {
      get: function () { return this[field]; },
      set: function (v) { this[field] = v; this._apply(); }
    });
  }
  prop('x', '_x'); prop('y', '_y'); prop('scaleX', '_sx'); prop('scaleY', '_sy');
  prop('rotationZ', '_rz'); prop('rotationY', '_ry'); prop('rotationX', '_rx');
  prop('alpha', '_a'); prop('visible', '_v');
  Sprite.prototype.reset = function () {
    var d = this.def;
    this._x = d.ox; this._y = d.oy; this._sx = d.sx; this._sy = d.sy;
    this._rz = this._ry = this._rx = 0; this._a = d.alpha === undefined ? 1 : d.alpha;
    this._apply();
  };
  // rettangolo attuale in coordinate stage
  Sprite.prototype.rect = function () {
    var r = this.el.getBoundingClientRect(), s = Stage.rect();
    return {
      x: (r.left - s.left) / Stage.scale, y: (r.top - s.top) / Stage.scale,
      w: r.width / Stage.scale, h: r.height / Stage.scale
    };
  };

  // ---------------------------------------------------------------- stage
  var Stage = {
    el: null, scale: 1,
    init: function () {
      this.el = document.getElementById('stage');
      window.addEventListener('resize', this.fit.bind(this));
      window.addEventListener('orientationchange', this.fit.bind(this));
      if (window.visualViewport) window.visualViewport.addEventListener('resize', this.fit.bind(this));
      this.fit();
    },
    fit: function () {
      var vw = window.innerWidth, vh = window.innerHeight;
      var s = Math.min(vw / STAGE_W, vh / STAGE_H);
      this.scale = s;
      this.el.style.transform = 'translate(' + ((vw - STAGE_W * s) / 2) + 'px,' + ((vh - STAGE_H * s) / 2) + 'px) scale(' + s + ')';
    },
    rect: function () { return this.el.getBoundingClientRect(); },
    point: function (ev) {
      var r = this.rect();
      return { x: (ev.clientX - r.left) / this.scale, y: (ev.clientY - r.top) / this.scale };
    }
  };

  // ---------------------------------------------------------------- immagini
  var imgCache = {};
  function loadImage(src) {
    if (!imgCache[src]) {
      imgCache[src] = new Promise(function (res) {
        var im = new Image();
        im.onload = function () { res(im); };
        im.onerror = function () { console.warn('immagine mancante', src); res(im); };
        im.src = IMG_DIR + src;
      });
    }
    return imgCache[src];
  }
  function preload(key, onProgress) {
    var defs = window.SCENES[key], n = 0;
    return Promise.all(defs.map(function (d) {
      return loadImage(d.src).then(function () { n++; if (onProgress) onProgress(n / defs.length); });
    }));
  }

  // mappa alpha (per ignorare i click sulle zone trasparenti); non disponibile da file://
  var alphaCache = {};
  function alphaAt(sprite, u, v) {
    var src = sprite.def.src, a = alphaCache[src];
    if (a === undefined) {
      a = null;
      try {
        var im = sprite.el, c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(sprite.def.w / 2)); c.height = Math.max(1, Math.round(sprite.def.h / 2));
        var g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
        a = { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
      } catch (e) { a = null; }
      alphaCache[src] = a;
    }
    if (!a) return 255;
    var x = Math.min(a.w - 1, Math.max(0, Math.floor(u * a.w))), y = Math.min(a.h - 1, Math.max(0, Math.floor(v * a.h)));
    return a.d[(y * a.w + x) * 4 + 3];
  }

  // ---------------------------------------------------------------- scena
  function Scene(key) {
    this.key = key; this.s = {}; this.timers = []; this.handlers = []; this.dead = false;
    var root = this.root = document.createElement('div');
    root.className = 'scene';
    var self = this, order = 0;
    window.SCENES[key].forEach(function (d) {
      var im = document.createElement('img');
      im.src = IMG_DIR + d.src; im.draggable = false; im.alt = '';
      im.style.left = d.x + 'px'; im.style.top = d.y + 'px';
      im.style.width = d.w + 'px'; im.style.height = d.h + 'px';
      if (d.name) {
        if (self.s[d.name]) self.s[d.name].el.remove();   // residui della scena precedente
        var sp = new Sprite(d, im); sp.order = order++;
        self.s[d.name] = sp;
      }
      root.appendChild(im);
    });
  }
  Scene.prototype.after = function (sec, fn) {
    var self = this;
    this.timers.push(setTimeout(function () { if (!self.dead) fn(); }, sec * 1000));
  };
  Scene.prototype.tween = function (name, o) {
    var sp = typeof name === 'string' ? this.s[name] : name;
    if (sp) addTween(sp, o, this);
  };
  // registra un'area cliccabile (o trascinabile se opts.drag)
  Scene.prototype.on = function (name, fn, opts) {
    this.off(name);
    var sp = this.s[name];
    if (!sp) { console.warn('sprite assente', name); return; }
    this.handlers.push({ sp: sp, fn: fn, opts: opts || {} });
    sp.el.classList.add('hot');
  };
  Scene.prototype.off = function (name) {
    var sp = this.s[name];
    this.handlers = this.handlers.filter(function (h) { return h.sp !== sp; });
    if (sp) sp.el.classList.remove('hot');
  };
  Scene.prototype.hit = function (pt) {
    var cands = this.handlers.filter(function (h) {
      if (!h.sp.visible || h.sp.alpha <= 0.01 || !h.sp.el.isConnected) return false;
      var r = h.sp.rect();
      h._u = (pt.x - r.x) / r.w; h._v = (pt.y - r.y) / r.h;
      return h._u >= 0 && h._u <= 1 && h._v >= 0 && h._v <= 1;
    }).sort(function (a, b) { return b.sp.order - a.sp.order; });
    for (var i = 0; i < cands.length; i++) if (alphaAt(cands[i].sp, cands[i]._u, cands[i]._v) > 12) return cands[i];
    return cands[0] || null;
  };
  Scene.prototype.destroy = function () {
    this.dead = true; this.timers.forEach(clearTimeout); killTweens(this); this.handlers = [];
    this.root.remove();
  };

  // input centralizzato (pointer events: mouse, touch, penna)
  var current = null, drag = null, locked = false;
  function onDown(ev) {
    if (!current || locked || drag || (ev.button !== undefined && ev.button > 0)) return;
    if (ev.target.closest && ev.target.closest('.edu')) return;   // finestre didattiche: gestite da edu.js
    var pt = Stage.point(ev), h = current.hit(pt);
    if (!h) return;
    ev.preventDefault();
    if (h.opts.drag) {
      drag = { h: h, id: ev.pointerId, dx: pt.x - h.sp.x, dy: pt.y - h.sp.y, x0: h.sp.x, y0: h.sp.y };
      h.sp.el.classList.add('dragging');
      try { Stage.el.setPointerCapture(ev.pointerId); } catch (e) { }
    } else h.fn(h.sp);
  }
  function onMove(ev) {
    if (!drag || ev.pointerId !== drag.id) {
      if (current && ev.pointerType === 'mouse' && !(ev.target.closest && ev.target.closest('.edu'))) Stage.el.style.cursor = current.hit(Stage.point(ev)) ? 'pointer' : '';
      return;
    }
    var pt = Stage.point(ev);
    pt.x = Math.max(0, Math.min(STAGE_W, pt.x)); pt.y = Math.max(0, Math.min(STAGE_H, pt.y));
    drag.h.sp.x = pt.x - drag.dx; drag.h.sp.y = pt.y - drag.dy;
  }
  function onUp(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    var d = drag; drag = null;
    d.h.sp.el.classList.remove('dragging');
    var back = function () { addTween(d.h.sp, { x: d.x0, y: d.y0, time: 0.25, transition: 'linear' }, current); };
    if (ev.type === 'pointercancel') back(); else d.h.fn(d.h.sp, back);
  }

  // centro dello sprite a dentro il rettangolo (allargato) dello sprite b ?
  function over(a, b, margin) {
    var ra = a.rect(), rb = b.rect(), m = margin || 0;
    var cx = ra.x + ra.w / 2, cy = ra.y + ra.h / 2;
    return cx > rb.x - m && cx < rb.x + rb.w + m && cy > rb.y - m && cy < rb.y + rb.h + m;
  }

  // cambio scena: la nuova entra da destra come nel filmato originale
  function show(key, logic, slide) {
    locked = true;
    return preload(key, Game.onProgress).then(function () {
      var old = current, sc = new Scene(key);
      Stage.el.appendChild(sc.root);
      current = sc;
      logic(sc);
      if (old && slide) {
        var o = { v: 0 };
        Object.defineProperty(o, 'p', {
          get: function () { return this.v; },
          set: function (v) {
            this.v = v;
            old.root.style.transform = 'translateX(' + (-STAGE_W * v) + 'px)';
            sc.root.style.transform = 'translateX(' + (STAGE_W * (1 - v)) + 'px)';
          }
        });
        o.p = 0;
        old.handlers = [];
        addTween(o, { p: 1, time: 1, transition: 'linear', onComplete: function () { sc.root.style.transform = ''; old.destroy(); locked = false; } }, null);
      } else {
        if (old) old.destroy();
        locked = false;
      }
      return sc;
    });
  }

  // ---------------------------------------------------------------- audio
  var Snd = {
    ctx: null, gain: null, musicGain: null, musicVol: 1, buffers: {}, html: {}, loopNode: null, loopName: null, muted: false, useHtml: false,
    init: function () {
      try { this.muted = localStorage.getItem('claygame.muted') === '1'; } catch (e) { }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || location.protocol === 'file:') { this.useHtml = true; return; }
      this.ctx = new AC(); this.gain = this.ctx.createGain(); this.gain.connect(this.ctx.destination);
      this.gain.gain.value = this.muted ? 0 : 1;
      // la musica di sottofondo ha un volume a parte, per poterla abbassare durante la lettura ad alta voce
      this.musicGain = this.ctx.createGain(); this.musicGain.connect(this.gain);
    },
    unlock: function () { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); },
    load: function (name) {
      var self = this;
      if (this.useHtml) return Promise.resolve(null);
      if (!this.buffers[name]) {
        this.buffers[name] = fetch(AUDIO_DIR + name + '.mp3')
          .then(function (r) { return r.arrayBuffer(); })
          .then(function (b) { return new Promise(function (res, rej) { self.ctx.decodeAudioData(b, res, rej); }); })
          .catch(function (e) { console.warn('audio', name, e); return null; });
      }
      return this.buffers[name];
    },
    preload: function (names) { var self = this; names.forEach(function (n) { self.load(n); }); },
    play: function (name, opts) {
      opts = opts || {};
      var self = this;
      if (this.useHtml) {
        var a = new Audio(AUDIO_DIR + name + '.mp3');
        a.loop = !!opts.loop; a.muted = this.muted;
        if (opts.loop) a.volume = this.musicVol;
        if (opts.onended) a.onended = opts.onended;
        a.play().catch(function () { });
        if (opts.loop) { this.stopLoop(); this.loopNode = a; this.loopName = name; }
        return;
      }
      var token = opts.loop ? (this.loopToken = {}) : null;
      if (opts.loop) { this.stopLoop(); this.loopToken = token; this.loopName = name; }
      this.load(name).then(function (buf) {
        if (!buf || (opts.loop && self.loopToken !== token)) return;
        var src = self.ctx.createBufferSource();
        src.buffer = buf; src.loop = !!opts.loop; src.connect(opts.loop ? self.musicGain : self.gain);
        if (opts.onended) src.onended = opts.onended;
        src.start(0);
        if (opts.loop) self.loopNode = src;
      });
    },
    loop: function (name) { if (this.loopName !== name) this.play(name, { loop: true }); },
    stopLoop: function () {
      this.loopToken = null; this.loopName = null;
      var n = this.loopNode; this.loopNode = null;
      if (!n) return;
      try { if (n.stop) { n.onended = null; n.stop(); } else n.pause(); } catch (e) { }
    },
    // abbassa (true) o ripristina (false) la musica di sottofondo, con una dissolvenza
    duck: function (on) {
      var v = on ? 0.15 : 1;
      if (v === this.musicVol) return;
      this.musicVol = v;
      if (this.musicGain) {
        var g = this.musicGain.gain, now = this.ctx.currentTime;
        g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(v, now + (on ? 0.3 : 0.8));
      } else if (this.loopNode && this.loopNode.pause) this.loopNode.volume = v;
    },
    setMuted: function (m) {
      this.muted = m;
      try { localStorage.setItem('claygame.muted', m ? '1' : '0'); } catch (e) { }
      if (this.gain) this.gain.gain.value = m ? 0 : 1;
      if (this.loopNode && this.loopNode.pause) this.loopNode.muted = m;
    }
  };
  document.addEventListener('visibilitychange', function () {
    if (!Snd.ctx) { if (Snd.loopNode && Snd.loopNode.pause) { document.hidden ? Snd.loopNode.pause() : Snd.loopNode.play().catch(function () { }); } return; }
    if (document.hidden) Snd.ctx.suspend(); else Snd.ctx.resume();
  });

  var Game = {
    STAGE_W: STAGE_W, STAGE_H: STAGE_H, Stage: Stage, Snd: Snd, show: show, over: over, preload: preload, onProgress: null,
    init: function () {
      Stage.init(); Snd.init();
      Stage.el.addEventListener('pointerdown', onDown);
      Stage.el.addEventListener('pointermove', onMove);
      Stage.el.addEventListener('pointerup', onUp);
      Stage.el.addEventListener('pointercancel', onUp);
      Stage.el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    },
    get scene() { return current; }
  };
  window.Game = Game;
})();
