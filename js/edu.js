/* ClayGame - contenuti didattici aggiunti alla versione originale:
   schede "Lo sapevi?", essiccazione, smaltatura e seconda cottura, quiz finale, attestato stampabile.
   Le finestre sono elementi HTML dentro lo stage, quindi si adattano a LIM, tablet e smartphone. */
(function () {
  'use strict';
  var G = window.Game, Snd = G.Snd, IMG = 'assets/img/';
  var state = { color: null, decor: null, score: null, total: 0, name: '' };
  var open = [];

  // ------------------------------------------------------------------ contenuti
  var FACTS = {
    impasto: {
      title: "L'impasto",
      items: [
        "🟤 L'<b>argilla</b> è una terra finissima. Si è formata in milioni di anni dalle rocce, consumate lentamente da acqua e vento.",
        "💧 L'<b>acqua</b> rende l'argilla morbida e plastica: si può modellare senza che si rompa.",
        "⚪ <b>Quarzo</b> e <b>sabbia</b> fanno da “scheletro”: aiutano il vaso a non deformarsi e a non creparsi.",
        "✨ In forno il <b>feldspato</b> si scioglie e incolla i granelli tra loro; l'<b>allumina</b> rende l'impasto più resistente al calore.",
        "🔴 L'<b>ossido di ferro</b> dà alla terracotta il suo tipico colore rossastro."
      ]
    },
    tornio: {
      title: 'Il tornio',
      items: [
        "🌀 Il <b>tornio</b> è una ruota che gira. È stato inventato più di 5000 anni fa, in Mesopotamia.",
        "🤲 Il vasaio: 1) mette l'argilla al centro, 2) ci fa un buco con i pollici, 3) tira su le pareti, 4) dà la forma finale e rifinisce il bordo. Ecco perché i pulsanti andavano premuti in ordine!",
        "💦 Mentre lavora si bagna spesso le mani, così l'argilla scivola e non si attacca.",
        "🐍 Prima del tornio i vasi si facevano a mano, sovrapponendo tanti “salsicciotti” di argilla: è la tecnica del <b>colombino</b>."
      ]
    },
    cottura: {
      title: 'La cottura',
      items: [
        "🔥 Il forno arriva a circa <b>900-1000 gradi</b>: quasi quattro volte più caldo del forno di casa!",
        "🌡️ La temperatura deve salire e scendere piano piano: un cambio brusco può far crepare il vaso. Per questo dovevi tenere il cursore nel riquadro giallo.",
        "🪨 Con il calore l'argilla cambia per sempre: diventa dura come una pietra e, se la bagni, non torna più molle. Il vaso cotto una volta si chiama <b>biscotto</b>.",
        "🏛️ Gli antichi usavano forni a legna: i resti di alcuni si vedono ancora negli scavi archeologici."
      ]
    }
  };
  var DRY_MSG = [
    'Giorno 1: il vaso è ancora morbido e scuro, pieno d’acqua.',
    'Giorno 2: si sta indurendo, ma dentro è ancora umido.',
    '<b>Giorno 3: è asciutto!</b> È diventato più chiaro e un po’ più piccolo: perdendo l’acqua, l’argilla si restringe.'
  ];
  var GLAZE_PRE = [
    "🎨 Il vaso è stato decorato con lo <b>smalto</b>: polvere di vetro mescolata con acqua e con metalli che danno i colori.",
    "🔵 Il <b>cobalto</b> dà il blu, il <b>rame</b> il verde, il <b>ferro</b> il giallo e il marrone.",
    "🌫️ Prima della cottura lo smalto è opaco e pallido: i colori veri compaiono solo in forno!"
  ];
  var GLAZE_POST = [
    "✨ In forno lo smalto si è sciolto ed è diventato uno <b>strato di vetro</b>: il vaso ora è colorato, lucido e non fa passare l'acqua.",
    "🇮🇹 Questa ceramica smaltata si chiama <b>maiolica</b>. In Italia sono famose quelle di Faenza, Deruta e Caltagirone.",
    "🏺 I Greci dipingevano i vasi con figure nere e rosse: grazie a loro sappiamo tante cose sulla vita di 2500 anni fa."
  ];
  // la prima risposta e' quella giusta (l'ordine viene mescolato)
  var QUIZ = [
    { q: "Perché si aggiunge l'acqua all'impasto?", a: ['Per renderlo morbido e modellabile', 'Per cambiargli colore', 'Per farlo cuocere più in fretta'],
      why: "L'acqua rende l'argilla plastica: si può modellare senza che si rompa." },
    { q: 'Quale ingrediente dà alla terracotta il colore rossastro?', a: "L'ossido di ferro|Il quarzo|L'acqua".split('|'),
      why: "È l'ossido di ferro, lo stesso che fa diventare rossa la ruggine." },
    { q: 'Come si chiama la ruota che gira su cui si modella il vaso?', a: ['Il tornio', 'Il forno', "L'impastatrice"],
      why: 'Il tornio è stato inventato più di 5000 anni fa.' },
    { q: 'Cosa succede se metti in forno un vaso ancora bagnato?', a: ['Si può crepare o rompere', 'Diventa più colorato', 'Cuoce più in fretta'],
      why: "L'acqua diventa vapore e spacca il vaso: prima bisogna farlo asciugare." },
    { q: 'Dopo la cottura, se bagni il vaso…', a: ['Resta duro come una pietra', 'Torna morbido come prima', 'Si scioglie'],
      why: 'Il calore trasforma l’argilla per sempre: non torna più indietro.' },
    { q: 'Cosa diventa lo smalto nella seconda cottura?', a: ['Uno strato di vetro lucido', 'Polvere colorata', 'Plastica'],
      why: 'Lo smalto si scioglie e diventa vetro: per questo il vaso è lucido e impermeabile.' },
    { q: 'Quale popolo antico è famoso per i vasi a figure nere e rosse?', a: ['I Greci', 'I Vichinghi', 'Gli Aztechi'],
      why: 'I vasi greci ci raccontano miti, sport e vita quotidiana di 2500 anni fa.' }
  ];

  // ------------------------------------------------------------------ utilita'
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function btn(label, cls, fn) {
    var b = el('button', 'edu-btn ' + (cls || ''), label); b.type = 'button';
    b.addEventListener('click', function (e) { e.stopPropagation(); if (!b.disabled) fn(e); });
    return b;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function plain(html) {
    var d = document.createElement('div'); d.innerHTML = html;
    return d.textContent.replace(/[\u{1F300}-\u{1FAFF}☀-➿️⃣]/gu, ' ');
  }

  function overlay(cls) {
    var o = el('div', 'edu ' + (cls || ''));
    G.Stage.el.appendChild(o); open.push(o);
    requestAnimationFrame(function () { o.classList.add('in'); });
    return o;
  }
  function close(o) {
    stopSpeak();
    var i = open.indexOf(o); if (i >= 0) open.splice(i, 1);
    o.classList.remove('in');
    setTimeout(function () { o.remove(); }, 250);
  }
  function closeAll() { open.slice().forEach(close); }
  function panel(o, title, kicker) {
    var p = el('div', 'edu-panel');
    if (kicker) p.appendChild(el('div', 'edu-kicker', kicker));
    p.appendChild(el('h2', 'edu-title', title));
    o.appendChild(p); return p;
  }
  function factList(items) { var u = el('ul', 'edu-facts'); items.forEach(function (t) { u.appendChild(el('li', null, t)); }); return u; }
  function actions(p, list) { var a = el('div', 'edu-actions'); list.forEach(function (b) { if (b) a.appendChild(b); }); p.appendChild(a); return a; }

  // lettura ad alta voce (sintesi vocale del dispositivo, se disponibile)
  var voice = null, synth = window.speechSynthesis;
  function pickVoice() { if (!synth) return; var v = synth.getVoices().filter(function (x) { return /^it/i.test(x.lang); }); voice = v[0] || null; }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
  // mentre la voce legge, la musica di sottofondo si abbassa; torna al volume normale quando la voce finisce
  var current = null, watch = null;
  function speak(t) {
    if (!synth || Snd.muted) return;
    current = null; synth.cancel();
    var u = new SpeechSynthesisUtterance(t); u.lang = 'it-IT'; if (voice) u.voice = voice; u.rate = 0.95;
    u.onend = u.onerror = function () { if (current === u) done(); };
    current = u;                       // riferimento tenuto vivo: alcuni browser altrimenti perdono l'evento "end"
    Snd.duck(true);
    synth.speak(u);
    // controllo di riserva, per i browser che non segnalano la fine della lettura
    clearInterval(watch);
    watch = setInterval(function () { if (current === u && !synth.speaking && !synth.pending) done(); }, 700);
  }
  function done() { current = null; clearInterval(watch); Snd.duck(false); }
  function stopSpeak() { if (synth) { current = null; synth.cancel(); } done(); }
  function speakBtn(getText) { return synth ? btn('🔊 Leggi', 'edu-speak', function () { speak(getText()); }) : null; }

  // immagini del gioco riusate nelle finestre
  function def(scene, name) { return (window.SCENES[scene] || []).filter(function (d) { return d.name === name; })[0]; }
  function vaseDefs() {
    var l = [state.color ? def('s4', 'Vaso' + state.color) : def('s4', 'Grezzo')];
    if (state.color && state.decor) l.push(def('s4', 'DecVaso' + state.decor));
    return l.filter(Boolean);
  }
  function compose(defs, h) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    defs.forEach(function (d) { x0 = Math.min(x0, d.x); y0 = Math.min(y0, d.y); x1 = Math.max(x1, d.x + d.w); y1 = Math.max(y1, d.y + d.h); });
    var s = h / (y1 - y0), box = el('div', 'edu-pic');
    box.style.width = ((x1 - x0) * s) + 'px'; box.style.height = h + 'px';
    defs.forEach(function (d, k) {
      var im = el('img'); im.src = IMG + d.src; im.alt = ''; im.draggable = false;
      im.style.left = ((d.x - x0) * s) + 'px'; im.style.top = ((d.y - y0) * s) + 'px';
      im.style.width = (d.w * s) + 'px'; im.style.height = (d.h * s) + 'px';
      box.appendChild(im);
      if (k === 0 && state.color) {            // riflesso dello smalto, ritagliato sulla forma del vaso
        var sh = el('div', 'edu-shine'); sh.style.cssText = im.style.cssText;
        sh.style.webkitMaskImage = sh.style.maskImage = 'url("' + IMG + d.src + '")';
        box.appendChild(sh);
      }
    });
    box._geom = { x0: x0, y0: y0, w: x1 - x0, h: y1 - y0 };
    return box;
  }

  // ------------------------------------------------------------------ schede "Lo sapevi?"
  function fact(key, done) {
    var f = FACTS[key], o = overlay(), p = panel(o, f.title, '💡 Lo sapevi?');
    p.appendChild(factList(f.items));
    actions(p, [
      speakBtn(function () { return f.title + '. ' + f.items.map(plain).join(' '); }),
      btn('Ho capito! 👍', 'primary', function () { close(o); Snd.play('ClickOk'); if (done) done(); })
    ]);
    Snd.play('Swish');
  }

  // ------------------------------------------------------------------ essiccazione (tra modellazione e cottura)
  function essiccazione(done) {
    var o = overlay(), p = panel(o, "L'essiccazione", '☀️ Prima di cuocere');
    var intro = el('p', 'edu-text', "Il vaso appena modellato è pieno d'acqua. Prima di cuocerlo deve asciugare lentamente, all'ombra, per alcuni giorni.");
    var row = el('div', 'edu-row'), box = el('div', 'edu-vase-box');
    var vase = compose([def('s2', 'Modellato')], 300); vase.classList.add('drying'); box.appendChild(vase);
    var side = el('div', 'edu-side'), cal = el('div', 'edu-calendar', '📅 Giorno <b>0</b>');
    var msg = el('p', 'edu-msg', 'Fai passare i giorni e guarda come cambia il vaso.');
    side.appendChild(cal); side.appendChild(msg); row.appendChild(box); row.appendChild(side);
    p.appendChild(intro); p.appendChild(row);
    var day = 0, DAYS = DRY_MSG.length;
    var bDay = btn('☀️ Fai passare un giorno', '', function () {
      if (day >= DAYS) return;
      day++; Snd.play('Swish');
      cal.innerHTML = '📅 Giorno <b>' + day + '</b>';
      vase.style.setProperty('--dry', day / DAYS);
      msg.className = 'edu-msg'; msg.innerHTML = DRY_MSG[day - 1];
      if (day >= DAYS) { bDay.disabled = true; Snd.play('Yahoo'); }
    });
    var bOven = btn('🔥 Metti nel forno', 'primary', function () {
      if (day < DAYS) {
        Snd.play('No');
        msg.innerHTML = '<b>Attenzione!</b> Il vaso è ancora umido: nel forno l’acqua diventerebbe vapore e il vaso si potrebbe crepare o rompere. Aspetta ancora!';
        msg.className = 'edu-msg'; void msg.offsetWidth; msg.className = 'edu-msg warn';
        vase.classList.remove('shake'); void vase.offsetWidth; vase.classList.add('shake');
        return;
      }
      close(o); Snd.play('ClickOk'); if (done) done();
    });
    actions(p, [speakBtn(function () { return plain(intro.innerHTML + ' ' + msg.innerHTML); }), bDay, bOven]);
    Snd.play('Swish');
  }

  // ------------------------------------------------------------------ smaltatura e seconda cottura
  function secondaCottura(done) {
    var o = overlay(), p = panel(o, 'Smalto e seconda cottura', '🔥 Ultimo passaggio');
    var row = el('div', 'edu-row'), box = el('div', 'edu-vase-box oven');
    var vase = compose(vaseDefs(), 330); vase.classList.add('glaze-raw'); box.appendChild(vase);
    var side = el('div', 'edu-side'); side.appendChild(factList(GLAZE_PRE));
    row.appendChild(box); row.appendChild(side); p.appendChild(row);
    var items = GLAZE_PRE, acts;
    var fire = btn('🔥 Accendi il forno', 'primary', function () {
      fire.disabled = true; stopSpeak();
      Snd.play('Forno'); box.classList.add('firing');
      setTimeout(function () {
        box.classList.remove('firing');
        vase.classList.remove('glaze-raw'); vase.classList.add('glazed');
        Snd.play('Sfornato'); Snd.play('Yahoo');
        items = GLAZE_POST;
        side.replaceChildren(factList(GLAZE_POST));
        acts.replaceChildren.apply(acts, [speakBtn(read), btn('Vedi il tuo vaso finito! 🎉', 'primary', function () { close(o); if (done) done(); })].filter(Boolean));
      }, 3500);
    });
    function read() { return items.map(plain).join(' '); }
    acts = actions(p, [speakBtn(read), fire]);
    Snd.play('Swish');
  }

  // ------------------------------------------------------------------ quiz
  function quiz() {
    var o = overlay('quiz'), p = panel(o, '', '🧠 Quiz: mettiti alla prova');
    var i = 0, score = 0, dots = el('div', 'edu-dots');
    QUIZ.forEach(function () { dots.appendChild(el('i')); });
    var qEl = el('p', 'edu-q'), ans = el('div', 'edu-answers'), why = el('p', 'edu-why');
    p.appendChild(dots); p.appendChild(qEl); p.appendChild(ans); p.appendChild(why);
    var next = btn('Avanti ▶', 'primary', function () { i++; if (i < QUIZ.length) show(); else end(); });
    var exit = btn('Esci', 'ghost', function () { close(o); });
    actions(p, [speakBtn(function () {
      var Q = QUIZ[i]; return Q.q + ' ' + [].map.call(ans.children, function (b) { return b.textContent; }).join('? Oppure: ') + '?';
    }), exit, next]);
    function show() {
      var Q = QUIZ[i];
      p.querySelector('.edu-title').textContent = 'Domanda ' + (i + 1) + ' di ' + QUIZ.length;
      qEl.textContent = Q.q; why.innerHTML = ''; next.style.visibility = 'hidden'; ans.innerHTML = '';
      shuffle(Q.a.map(function (t, k) { return { t: t, ok: k === 0 }; })).forEach(function (a) {
        var b = btn(a.t, 'answer', function () {
          [].forEach.call(ans.children, function (x) { x.disabled = true; if (x._ok) x.classList.add('right'); });
          if (!a.ok) b.classList.add('wrong'); else score++;
          dots.children[i].className = a.ok ? 'ok' : 'ko';
          why.innerHTML = (a.ok ? '✅ <b>Esatto!</b> ' : '❌ <b>Non proprio.</b> ') + Q.why;
          Snd.play(a.ok ? 'ClickOk' : 'No'); if (a.ok) Snd.play('Yahoo');
          next.textContent = i === QUIZ.length - 1 ? 'Vedi il risultato 🏁' : 'Avanti ▶';
          next.style.visibility = '';
        });
        b._ok = a.ok; ans.appendChild(b);
      });
    }
    function end() {
      state.score = score; state.total = QUIZ.length;
      var stars = score >= QUIZ.length - 1 ? 3 : score >= Math.ceil(QUIZ.length / 2) ? 2 : 1;
      var msg = stars === 3 ? 'Fantastico! Sei un vero esperto di ceramica!' : stars === 2 ? 'Bravo! Sai già tante cose sulla ceramica.' : 'Ben fatto! Rigioca e scoprirai ancora di più.';
      p.replaceChildren(el('div', 'edu-kicker', '🏁 Risultato'), el('h2', 'edu-title', score + ' risposte esatte su ' + QUIZ.length),
        el('div', 'edu-stars', '⭐'.repeat(stars) + '<span>' + '⭐'.repeat(3 - stars) + '</span>'), el('p', 'edu-text center', msg));
      actions(p, [
        btn('🔁 Rifai il quiz', 'ghost', function () { close(o); quiz(); }),
        btn('🏅 Crea il tuo attestato', 'primary', function () { close(o); attestato(); })
      ]);
      Snd.play('Applausi'); Snd.play('Congratulations');
    }
    show(); Snd.play('Swish');
  }

  // ------------------------------------------------------------------ attestato
  var STEPS = 'impastatura · modellazione · essiccazione · cottura · smaltatura · seconda cottura';
  function today() { try { return new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return new Date().toDateString(); } }
  function certEl() {
    var c = el('div', 'cert');
    c.innerHTML = '<div class="cert-text"><div class="cert-k">ClayGame</div><h3>Attestato di<br>Piccolo Ceramista</h3>' +
      '<p>Si attesta che</p><div class="cert-name">' + (esc(state.name) || '____________________') + '</div>' +
      '<p>ha realizzato il suo vaso di ceramica seguendo tutte le fasi:</p><p class="cert-steps">' + STEPS + '</p>' +
      (state.score != null ? '<p class="cert-quiz">Quiz: ' + state.score + ' risposte esatte su ' + state.total + ' ' + '⭐'.repeat(state.score >= state.total - 1 ? 3 : state.score >= Math.ceil(state.total / 2) ? 2 : 1) + '</p>' : '') +
      '<p class="cert-date">' + today() + '</p></div>';
    var pic = el('div', 'cert-pic'); pic.appendChild(compose(vaseDefs(), 360)); c.appendChild(pic);
    return c;
  }
  function attestato() {
    var o = overlay(), p = panel(o, 'Il tuo attestato', '🏅 Piccolo ceramista');
    var label = el('label', 'edu-text', 'Scrivi il tuo nome:');
    var input = el('input', 'edu-input'); input.type = 'text'; input.maxLength = 28; input.value = state.name; input.autocomplete = 'off';
    label.appendChild(input); p.appendChild(label);
    var go = btn('Crea attestato ✨', 'primary', create);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') create(); });
    actions(p, [btn('Chiudi', 'ghost', function () { close(o); }), go]);
    setTimeout(function () { try { input.focus(); } catch (e) { } }, 300);
    function create() {
      state.name = input.value.trim();
      input.blur();
      p.replaceChildren(certEl());
      actions(p, [
        btn('✏️ Cambia nome', 'ghost', function () { close(o); attestato(); }),
        btn('🖨️ Stampa', '', printCert),
        btn('💾 Salva immagine', '', savePng),
        btn('Chiudi', 'primary', function () { close(o); })
      ]);
      Snd.play('Applausi1');
    }
  }
  function printCert() {
    var area = document.getElementById('print-area') || document.body.appendChild(el('div', null));
    area.id = 'print-area'; area.replaceChildren(certEl());
    var imgs = [].slice.call(area.querySelectorAll('img'));
    Promise.all(imgs.map(function (im) { return im.complete ? 0 : new Promise(function (r) { im.onload = im.onerror = r; }); }))
      .then(function () { window.print(); });
  }
  function savePng() {
    var W = 1600, H = 1131, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), F = '"Comic Sans MS","Chalkboard SE","Comic Neue","Trebuchet MS",sans-serif';
    g.fillStyle = '#fff8e6'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#d9772b'; g.lineWidth = 18; g.strokeRect(30, 30, W - 60, H - 60);
    g.strokeStyle = '#7a4526'; g.lineWidth = 4; g.strokeRect(60, 60, W - 120, H - 120);
    g.fillStyle = '#7a4526'; g.textAlign = 'center';
    var cx = 560;
    g.font = 'bold 44px ' + F; g.fillText('ClayGame', cx, 170);
    g.fillStyle = '#d9772b'; g.font = 'bold 76px ' + F; g.fillText('Attestato di', cx, 270); g.fillText('Piccolo Ceramista', cx, 355);
    g.fillStyle = '#333'; g.font = '38px ' + F; g.fillText('Si attesta che', cx, 450);
    g.fillStyle = '#1b1b1b'; g.font = 'bold 70px ' + F; g.fillText(state.name || '____________________', cx, 545);
    g.fillStyle = '#333'; g.font = '34px ' + F;
    g.fillText('ha realizzato il suo vaso di ceramica', cx, 625); g.fillText('seguendo tutte le fasi:', cx, 670);
    g.font = 'italic 28px ' + F; g.fillText('impastatura · modellazione · essiccazione', cx, 730); g.fillText('cottura · smaltatura · seconda cottura', cx, 770);
    if (state.score != null) { g.font = '32px ' + F; g.fillText('Quiz: ' + state.score + ' risposte esatte su ' + state.total, cx, 850); }
    g.font = '30px ' + F; g.fillText(today(), cx, 960);
    var defs = vaseDefs(), pic = compose(defs, 1), gm = pic._geom, h = 640, s = h / gm.h, ox = 1200 - gm.w * s / 2, oy = (H - h) / 2;
    Promise.all(defs.map(function (d) {
      return new Promise(function (r) { var im = new Image(); im.onload = function () { r(im); }; im.onerror = function () { r(null); }; im.src = IMG + d.src; });
    })).then(function (ims) {
      ims.forEach(function (im, k) { var d = defs[k]; if (im) g.drawImage(im, ox + (d.x - gm.x0) * s, oy + (d.y - gm.y0) * s, d.w * s, d.h * s); });
      try {
        c.toBlob(function (b) {
          if (!b) return toast();
          var a = document.createElement('a'), slug = (state.name || 'vaso').toLowerCase().replace(/[^a-z0-9]+/gi, '-');
          a.download = 'attestato-' + slug + '.png'; a.href = URL.createObjectURL(b);
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        }, 'image/png');
      } catch (e) { toast(); }
    });
  }
  function toast() {
    var t = el('div', 'edu-toast', 'Per salvare usa “🖨️ Stampa” e scegli “Salva come PDF”.');
    G.Stage.el.appendChild(t); setTimeout(function () { t.remove(); }, 4000);
  }

  // ------------------------------------------------------------------ menu finale
  function endMenu(onMenu) {
    var o = el('div', 'edu edu-bar in');
    o.appendChild(btn('🧠 Quiz', 'primary', quiz));
    o.appendChild(btn('🏅 Attestato', '', attestato));
    o.appendChild(btn('🏠 Menu', 'ghost', function () { closeAll(); onMenu(); }));
    G.Stage.el.appendChild(o); open.push(o);
  }

  window.Edu = {
    state: state, fact: fact, essiccazione: essiccazione, secondaCottura: secondaCottura,
    quiz: quiz, attestato: attestato, endMenu: endMenu, closeAll: closeAll,
    reset: function () { state.color = state.decor = state.score = null; state.total = 0; }
  };
})();
