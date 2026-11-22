/* ClayGame - logica di gioco.
   Conversione dello script ActionScript 3 originale (Gioca.fla / ClayGame.fla, Giummarra Andrea):
   menu + 4 fasi di produzione della ceramica (impastatura, modellazione, cottura, decorazione). */
(function () {
  'use strict';
  var G = window.Game, Snd = G.Snd;

  // contenuti didattici (edu.js): se per qualunque motivo non partono, il gioco prosegue comunque
  function learn(method, arg, then) {
    try { if (window.Edu) { window.Edu[method].apply(null, arg === null ? [then] : [arg, then]); return; } }
    catch (e) { console.error('ClayGame edu', e); }
    then();
  }

  function vis(sc, map) { for (var k in map) if (sc.s[k]) sc.s[k].visible = map[k]; }
  function each(sc, names, fn) { names.forEach(function (n) { if (sc.s[n]) fn(sc.s[n], n); }); }

  // pannello delle istruzioni: scende dall'alto, risale con OK
  function instructions(sc, items, ok) {
    var open = false;
    function show() {
      if (open) return; open = true;
      items.forEach(function (it) { sc.tween(it[0], { y: it[1], time: 1, transition: 'easeOutElastic' }); });
      Snd.play('Attenzione_sound'); Snd.play('Swish');
      sc.on(ok, hide);
      sc.on(items[0][0], function () { });      // il pannello blocca i click sugli oggetti sottostanti
      sc.on(ok, hide);
    }
    function hide() {
      if (!open) return; open = false;
      sc.off(ok); sc.off(items[0][0]);
      items.forEach(function (it) { sc.tween(it[0], { y: sc.s[it[0]].def.oy, time: 1, transition: 'linear' }); });
    }
    show();
    return show;
  }

  // avviso "Attenzione!": compare con un rimbalzo e poi scorre via a sinistra
  function makeAlert(sc, panel, title, text, panelY, titleScale, textScale) {
    var busy = false;
    each(sc, [panel, title, text], function (s) { s.visible = false; });
    return function () {
      Snd.play('No'); Snd.play('Attenzione_sound');
      if (busy) return; busy = true;
      var P = sc.s[panel], T = sc.s[title], X = sc.s[text];
      [P, T, X].forEach(function (s) { s.reset(); s.visible = true; });
      sc.tween(P, { y: panelY, time: 1, transition: 'easeOutElastic' });
      sc.tween(T, { scaleX: T.def.sx * titleScale, scaleY: T.def.sy * titleScale, time: 1, transition: 'easeOutElastic' });
      sc.tween(X, { scaleX: X.def.sx * textScale, scaleY: X.def.sy * textScale, time: 1, transition: 'easeOutElastic' });
      sc.after(2, function () {
        [P, T, X].forEach(function (s) { sc.tween(s, { x: s.x - 1250, time: 3, transition: 'linear' }); });
      });
      sc.after(5.1, function () { [P, T, X].forEach(function (s) { s.reset(); s.visible = false; }); busy = false; });
    };
  }

  function lights(sc, suffix, working) {
    var m = {};
    m['RedOn' + suffix] = !working; m['RedOff' + suffix] = working;
    m['GreenOn' + suffix] = working; m['GreenOff' + suffix] = !working;
    vis(sc, m);
  }

  function exitToMenu() { if (window.Edu) window.Edu.closeAll(); Snd.stopLoop(); G.show('menu', menu, false); }

  // ------------------------------------------------------------------ MENU
  var introPlayed = false;
  function menu(sc) {
    var s = sc.s, X_IN = 846, X_OUT = 1886;
    Snd.preload(['Arrivo', 'Vai', 'Testo', 'MenuSound']);
    function startMusic() { if (G.scene === sc) Snd.loop('MenuSound'); }
    if (!introPlayed) { introPlayed = true; Snd.play('Intro', { onended: startMusic }); sc.after(12, startMusic); }
    else startMusic();

    each(sc, ['Logo', 'GiocaOn', 'CreditsOn', 'EsciOn', 'Ambiente'], function (o) { o.alpha = 0; });
    sc.tween('Ambiente', { alpha: 1, time: 3, transition: 'linear' });
    sc.tween('Logo', { alpha: 1, delay: 1, time: 3, transition: 'easeInBounce', onStart: function () { Snd.play('Rumore'); }, onComplete: buttonsIn });

    var btns = ['Gioca', 'Credits', 'Esci'];
    function buttonsIn(base) {
      base = typeof base === 'number' ? base : 1;
      if (s.Logo.x !== 116.2) sc.tween('Logo', { x: 116.2, time: 1, transition: 'linear' });
      btns.forEach(function (b, i) {
        var d = base + i * 0.5;
        sc.tween(b + 'Off', { x: X_IN, delay: d, time: 1, transition: 'easeOutBounce', onStart: function () { Snd.play('Arrivo'); } });
        sc.tween(b + 'On', { x: X_IN, delay: d, time: 1, transition: 'easeOutBounce', onComplete: function () { sc.tween(b + 'On', { alpha: 1, time: 2, transition: 'linear' }); } });
      });
    }
    function buttonsOut() {
      btns.forEach(function (b) {
        sc.tween(b + 'Off', { x: X_OUT, time: 1, transition: 'easeOutBounce' });
        sc.tween(b + 'On', { x: X_OUT, time: 1, transition: 'easeOutBounce', onComplete: function () { sc.tween(b + 'On', { alpha: 0, time: 1, transition: 'linear' }); } });
      });
      Snd.play('Arrivo');
    }

    sc.on('GiocaOff', function () {
      Snd.play('Vai'); Snd.stopLoop();
      G.show('s1', scene1, false).then(function () { Snd.loop('Background'); });
    });
    sc.on('CreditsOff', function () {
      buttonsOut();
      sc.tween('Ok', { x: 558, delay: 2.5, time: 1, transition: 'easeOutBounce', onStart: function () { Snd.play('Arrivo'); } });
      sc.tween('CreditsText', { y: 314.5, delay: 0.5, time: 3, transition: 'easeOutBounce', onStart: function () { Snd.play('Testo'); } });
    });
    sc.on('Ok', function () {
      buttonsIn(0.5);
      sc.tween('Ok', { x: X_OUT, time: 1, transition: 'easeOutBounce' });
      sc.tween('CreditsText', { y: s.CreditsText.def.oy, time: 1, transition: 'linear', onStart: function () { Snd.play('Testo'); } });
    });
    sc.on('EsciOff', function () { Snd.stopLoop(); introPlayed = false; window.ClayGameApp.quit(); });
  }

  // ------------------------------------------------------------------ FASE 1: IMPASTATURA
  function scene1(sc) {
    var s = sc.s, counter = 0, TOT = 8, kneading = false, done = false;
    if (window.Edu) window.Edu.reset();
    Snd.preload(['Spunte', 'Ingrediente', 'Acqua', 'Impasta', 'Scorrimento', 'No', 'Attenzione_sound', 'Swish']);
    var ING = {
      Fel: 'FeldspatoText', All: 'AlluminaText', Sab: 'SabbiaText', Arg: 'ArgillaText',
      Oss: 'OssidoText', Qua: 'QuarzoText', Acq1: 'AcquaText', Acq2: 'AcquaText1'
    };
    vis(sc, { Solido: false, RicOn: false, ImpOn: false, AvantiOn: false, IndietroOn: false, Livello1Off: false });
    each(sc, ['Livello2On', 'Livello3On', 'Livello4On', 'Livello5On', 'Livello6On'], function (o) { o.visible = false; });
    Object.keys(ING).forEach(function (k) { vis(sc, mk(k + '_check', false)); vis(sc, mk(ING[k], false)); });
    function mk(k, v) { var o = {}; o[k] = v; return o; }
    lights(sc, '', false);

    var alert = makeAlert(sc, 'Pannello', 'Attenzione', 'Inserisci', 80, 1.06, 1.0);
    var help = instructions(sc, [['PannelloIstruzioni1', 62.5], ['Istruzioni1', 107.2], ['AiutoText1', 203], ['AiutoText2', 363.9], ['AiutoText3', 534.3], ['OkAiuto1', 629.7]], 'OkAiuto1');
    sc.on('Aiuto1', help);
    sc.on('EsciOff', exitToMenu);

    Object.keys(ING).forEach(function (name) {
      sc.on(name, function (sp, back) {
        if (!G.over(sp, s.Imp, 45)) { back(); return; }
        // l'ingrediente entra nell'impastatrice: spunta sulla lavagna + nome che sale e svanisce
        sc.off(name); sp.visible = false;
        s[name + '_check'].visible = true;
        var t = s[ING[name]]; t.visible = true;
        sc.tween(t, { y: t.y - 40, alpha: 0, scaleX: t.scaleX + 1, scaleY: t.scaleY + 1, time: 0.85, transition: 'linear', onComplete: function () { t.visible = false; } });
        Snd.play('Spunte'); Snd.play(name.indexOf('Acq') === 0 ? 'Acqua' : 'Ingrediente');
        counter++;
      }, { drag: true });
    });

    sc.on('ImpOff', function () {
      if (kneading || done) return;
      if (counter < TOT) { alert(); return; }
      kneading = true;
      Snd.play('Impasta');
      vis(sc, { ImpOn: true, ImpOff: false }); lights(sc, '', true);
      sc.after(4, function () {
        done = true;
        vis(sc, { Solido: true, ImpOn: false, ImpOff: true }); lights(sc, '', false);
        sc.tween('Solido', { scaleX: 1.8, scaleY: 1.8, time: 3, transition: 'easeOutElastic' });
        sc.after(3, function () { Snd.play('Scorrimento'); });
        sc.tween('Solido', { x: 240, y: 710, _bezier: [{ x: 899, y: 700 }, { x: 360, y: 710 }], time: 3, delay: 3, transition: 'linear', onComplete: function () {
          // scheda "Lo sapevi?" sugli ingredienti, poi si puo' andare avanti
          learn('fact', 'impasto', function () {
            vis(sc, { AvantiOn: true, AvantiOff: false });
            sc.on('AvantiOn', function () { G.show('s2', scene2, true); });
          });
        } });
      });
    });
  }

  // ------------------------------------------------------------------ FASE 2: MODELLAZIONE AL TORNIO
  function scene2(sc) {
    var s = sc.s, step = 0, busy = false;
    Snd.preload(['Gira', 'Zip', 'Wobble']);
    var SOL = ['Solido2', 'Solido3', 'Solido4', 'Solido5', 'Modellato'];
    var LAN = ['Lancetta', 'Lancetta1', 'Lancetta2', 'Lancetta3'];
    lights(sc, '2', false);
    vis(sc, { AvantiOn2: false, IndietroOn2: false, Solido3: false, Solido4: false, Solido5: false, Modellato: false,
      Modella1Off: false, Modella2Off: false, Modella3Off: false, Modella4Off: false, Lancetta1: false, Lancetta2: false, Lancetta3: false });
    each(sc, ['Livello2On2', 'Livello3On2', 'Livello4On2', 'Livello5On2', 'Livello6On2'], function (o) { o.visible = false; });

    var alert = makeAlert(sc, 'Pannello', 'Attenzione', 'Rispetta', 80, 1.06, 1.1);
    var help = instructions(sc, [['PannelloIstruzioni2', 59.5], ['OkAiuto2', 634.7]], 'OkAiuto2');
    sc.on('Aiuto2', help);
    sc.on('EsciOff2', exitToMenu);

    [0, 1, 2, 3].forEach(function (i) {
      var btn = 'Modella' + (i + 1);
      sc.on(btn, function () {
        if (busy) return;
        if (step !== i) { alert(); return; }
        busy = true;
        Snd.play('Gira');
        sc.off(btn); s[btn].visible = false; s[btn + 'Off'].visible = true;
        lights(sc, '2', true);
        LAN.forEach(function (l, k) { s[l].visible = k === i; });
        sc.tween(LAN[i], { rotationZ: 2160, time: 6.5, transition: 'easeOutInElastic' });
        sc.tween(SOL[i], { rotationY: 2160, time: 6.5, transition: 'easeInSine' });
        sc.after(6.5, function () {
          lights(sc, '2', false);
          s[SOL[i]].visible = false;
          Snd.play('Zip'); Snd.play('Wobble');
          var nx = s[SOL[i + 1]], k = i === 3 ? 1.5 : 0.8;
          nx.visible = true;
          sc.tween(nx, { scaleX: k, scaleY: k, time: 3, transition: 'easeOutElastic' });
          step++; busy = false;
          if (i === 3) sc.after(2, function () {
            learn('fact', 'tornio', function () {
              s.AvantiOn2.visible = true;
              // prima della cottura il vaso deve asciugare (fase aggiunta)
              sc.on('AvantiOff2', function () { sc.off('AvantiOff2'); learn('essiccazione', null, function () { G.show('s3', scene3, true); }); });
            });
          });
        });
      });
    });
  }

  // ------------------------------------------------------------------ FASE 3: COTTURA
  function scene3(sc) {
    var s = sc.s, X0 = 222.7, X_IN = 491.9, X_OUT = 556.7, X_END = 597.8;
    var round = 0, inWindow = false, cooked = false, started = false;
    Snd.preload(['Inserito', 'Forno', 'ClickOk', 'Errore', 'Yahoo', 'Sfornato', 'Vola']);
    lights(sc, '3', false);
    vis(sc, { AvantiOn3: false, IndietroOn3: false, CursoreOn: false, FornoOn: false, Cotto: false });
    each(sc, ['Livello2On3', 'Livello3On3', 'Livello4On3', 'Livello5On3', 'Livello6On3'], function (o) { o.visible = false; });

    var alert = makeAlert(sc, 'Pannello3', 'Attenzione3', 'Ferma', 63, 1.1, 1.1);
    var help = instructions(sc, [['PannelloIstruzioni3', 50.6], ['AiutoText4', 205.2], ['AiutoText5', 329.6], ['AiutoText6', 452.4], ['AiutoText7', 574], ['OkAiuto3', 714.1]], 'OkAiuto3');
    sc.on('Aiuto3', help);
    sc.on('EsciOff3', exitToMenu);

    // 1) il vaso crudo va trascinato nella bocca del forno
    sc.on('Crudo', function (sp, back) {
      if (!G.over(sp, s.Bocca, 50)) { back(); return; }
      sc.off('Crudo'); sp.visible = false;
      Snd.play('Inserito');
      sc.on('FornoOff', startOven);
    }, { drag: true });

    // 2) accensione del forno
    function startOven() {
      if (started) return; started = true;
      sc.off('FornoOff');
      lights(sc, '3', true);
      vis(sc, { FornoOn: true, FornoOff: false });
      Snd.play('Forno');
      sc.tween('LancettaForno', { rotationZ: 180, time: 20, transition: 'linear', onComplete: function () { if (cooked) finish(); } });
      sc.on('CursoreOff', function () { alert(); Snd.play('ClickOk'); });
      sc.on('CursoreOn', bravo);
      run(3, 4);
    }

    // 3) il cursore della temperatura va fermato per 2 volte dentro il riquadro giallo
    function run(delay, time) {
      var myRound = round;
      inWindow = false;
      s.CursoreOff.x = X0; s.CursoreOn.x = X_IN;
      vis(sc, { CursoreOn: false, CursoreOff: true });
      sc.tween('CursoreOff', { x: X_IN, time: time, delay: delay, transition: 'linear', onComplete: function () {
        inWindow = true;
        vis(sc, { CursoreOn: true, CursoreOff: false });
        sc.tween('CursoreOn', { x: X_OUT, time: 2, transition: 'linear', onComplete: function () {
          if (round !== myRound) return;
          inWindow = false;                 // finestra mancata: la cottura fallisce
          s.CursoreOff.x = X_OUT;
          vis(sc, { CursoreOn: false, CursoreOff: true });
          sc.tween('CursoreOff', { x: X_END, time: 1, transition: 'linear', onComplete: retry });
        } });
      } });
    }
    function bravo() {
      if (!inWindow) return;
      inWindow = false; round++;
      Snd.play('ClickOk'); Snd.play('Yahoo');
      if (round === 1) { run(1, 3); return; }
      cooked = true;
      sc.off('CursoreOn'); sc.off('CursoreOff');
      sc.tween('CursoreOn', { x: X_IN, time: 2, transition: 'linear', onComplete: function () {
        s.CursoreOff.x = X_IN;
        vis(sc, { CursoreOn: false, CursoreOff: true });
        sc.tween('CursoreOff', { x: X0, time: 6, transition: 'linear' });
      } });
      if (s.LancettaForno.rotationZ >= 180) finish();
    }
    function retry() {
      Snd.play('Errore');
      sc.after(1.2, function () { G.show('s3', scene3, false); });   // si ripete la cottura
    }

    // 4) fine cottura: il vaso cotto esce dal forno
    var finished = false;
    function finish() {
      if (finished) return; finished = true;
      lights(sc, '3', false);
      vis(sc, { FornoOn: false, FornoOff: true, Cotto: true });
      Snd.play('Sfornato');
      sc.tween('Cotto', { scaleX: 1.2, scaleY: 1.2, time: 3, transition: 'easeOutElastic' });
      sc.tween('Cotto', { rotationZ: 720, delay: 1, time: 4.5, transition: 'linear', onStart: function () { Snd.play('Vola'); } });
      sc.tween('Cotto', { x: 361.1, y: 680, _bezier: [{ x: 340, y: 300 }, { x: 350, y: 550 }], time: 4.5, delay: 1, transition: 'linear', onComplete: function () {
        learn('fact', 'cottura', function () {
          s.AvantiOn3.visible = true;
          sc.on('AvantiOff3', function () { G.show('s4', scene4, true); });
        });
      } });
    }
  }

  // ------------------------------------------------------------------ FASE 4: DECORAZIONE
  function scene4(sc) {
    var s = sc.s, colored = false, over = false;
    Snd.preload(['Splat', 'Reset', 'Applausi', 'Applausi1', 'Congratulations', 'Ooo', 'Ooo2', 'Yahoo2']);
    var COL = ['Bianco', 'Celeste', 'GialloScuro', 'GialloChiaro', 'Rosso', 'Arancio'];
    var DEC = [1, 2, 3, 4, 5, 6];
    var E = window.Edu ? window.Edu.state : {};
    function setColor(c) { E.color = c; COL.forEach(function (k) { s['Vaso' + k].visible = k === c; }); }
    function setDecor(d) { E.decor = d; DEC.forEach(function (k) { s['DecVaso' + k].visible = k === d; }); }
    function wobble(name) {
      sc.tween(name, { rotationZ: 30, time: 2, transition: 'easeOutElastic', onComplete: function () {
        sc.tween(name, { rotationZ: 0, time: 1, transition: 'easeOutElastic' });
      } });
    }
    setColor(null); setDecor(null);
    vis(sc, { AzzeraDecoriOn: false, AzzeraColoriOn: false });

    var help = instructions(sc, [['PannelloIstruzioni4', 49.7], ['AiutoText8', 203.8], ['AiutoText9', 390.9], ['AiutoText10', 580.4], ['OkAiuto4', 713]], 'OkAiuto4');
    sc.on('Aiuto4', help);
    sc.on('Esci4', exitToMenu);

    COL.forEach(function (c) {
      sc.on(c, function () {
        wobble(c); Snd.play('Splat');
        setColor(c); setDecor(null);
        vis(sc, { AzzeraColoriOn: true, AzzeraDecoriOn: false });
        colored = true;
      });
    });
    DEC.forEach(function (d) {
      sc.on('Decoro' + d, function () {
        if (!colored) return;          // prima il colore, poi il decoro
        wobble('Decoro' + d); Snd.play('Splat');
        setDecor(d);
        s.AzzeraDecoriOn.visible = true;
      });
    });
    sc.on('AzzeraColoriOff', function () {
      Snd.play('Reset'); setColor(null); setDecor(null);
      vis(sc, { AzzeraColoriOn: false, AzzeraDecoriOn: false });
      colored = false;
    });
    sc.on('AzzeraDecoriOff', function () {
      Snd.play('Reset'); setDecor(null); s.AzzeraDecoriOn.visible = false;
    });

    sc.on('OkOff', function () {
      if (over) return; over = true;
      COL.concat(DEC.map(function (d) { return 'Decoro' + d; }), ['AzzeraColoriOff', 'AzzeraDecoriOff', 'Aiuto4', 'OkOff']).forEach(function (n) { sc.off(n); });
      // smaltatura e seconda cottura (fase aggiunta), poi il finale originale
      learn('secondaCottura', null, finale);
    });
    function finale() {
      Snd.play('Applausi'); Snd.play('Applausi1'); Snd.play('Congratulations');
      COL.concat(DEC.map(function (d) { return 'Decoro' + d; }), ['AzzeraColoriOff', 'AzzeraDecoriOff', 'Aiuto4', 'OkOff']).forEach(function (n) { sc.off(n); });
      ['PannelloColori', 'AzzeraColoriOn', 'AzzeraColoriOff', 'PannelloDecori', 'AzzeraDecoriOn', 'AzzeraDecoriOff', 'Scaffali4']
        .concat(COL, DEC.map(function (d) { return 'Decoro' + d; }))
        .forEach(function (n) { sc.tween(n, { alpha: 0, time: 2, transition: 'linear' }); });
      sc.tween('Logo4', { scaleX: 3.2, scaleY: 3.2, delay: 1, time: 3, transition: 'easeInElastic' });
      sc.tween('Logo4', { rotationZ: 3600, time: 3, transition: 'linear' });
      sc.tween('Logo4', { rotationY: 3600, time: 2, transition: 'linear' });
      sc.tween('Logo4', { rotationX: 3600, time: 2, transition: 'linear' });
      sc.tween('Logo4', { x: 615, y: 350, time: 3, transition: 'linear' });
      sc.after(4.1, function () {
        Snd.play('Ooo'); Snd.play('Ooo2');
        sc.tween('Logo4', { rotationZ: 3600, time: 1, delay: 1, transition: 'easeOutElastic', onStart: function () { Snd.play('Yahoo2'); } });
      });
      sc.after(6.5, function () { if (window.Edu) window.Edu.endMenu(exitToMenu); });
    }
  }

  window.ClayGameScenes = { menu: menu, s1: scene1, s2: scene2, s3: scene3, s4: scene4 };
})();
