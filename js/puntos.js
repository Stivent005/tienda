
/* PUNTOS Y RULETA (lado del cliente).
   Los puntos los suma la BASE DE DATOS cuando el administrador confirma el pago.
   El premio de la ruleta también lo sortea la base de datos.
   Esta página muestra la cuenta y anima la ruleta con el resultado del servidor.
   La animación no decide ni modifica los premios.
*/

function ptsCfg() {
  var p = cfg.pts || {};

  return {
    cada: Number(p.cada) || 0,
    objetivo: Number(p.objetivo) || 0
  };
}

function ruletaOn() {
  var c = ptsCfg();

  return REMOTO &&
    c.cada > 0 &&
    c.objetivo > 0 &&
    Array.isArray(cfg.ruleta) &&
    cfg.ruleta.length >= 2;
}

function ptsAviso(total) {
  if (!ruletaOn()) return "";

  var c = ptsCfg();
  var g = Math.floor(Number(total) / c.cada);

  return '<p class="meta">🎁 ' +
    (g > 0
      ? 'Cuando confirmemos tu pago ganarás <b>' + g + ' punto(s)</b>. '
      : '') +
    'Guarda tu número de pedido y tu celular: con ellos consultas tus puntos y giras la ruleta desde "Mis puntos".</p>';
}

var COLORES = [
  "#22d3ee",
  "#e0457b",
  "#ffcf4a",
  "#8a5cf6",
  "#2dbd85",
  "#3b82f6"
];

var rueda = {
  rot: 0,
  cuenta: null,
  girando: false
};

/* ==========================================
   ABRIR MIS PUNTOS
   ========================================== */

function abrirPuntos() {
  var b = $("dbox");

  if (!ruletaOn()) {
    b.innerHTML =
      '<h2>🎁 Mis puntos</h2>' +
      '<p class="meta">El programa de puntos aún no está disponible.</p>' +
      '<div class="foot">' +
        '<button class="btn" data-x="close">Cerrar</button>' +
      '</div>';

    $("dlg").showModal();
    return;
  }

  var c = ptsCfg();
  var sd = Cookies.ok("preferencias")
    ? lsGet("tienda_datos", {})
    : {};

  b.innerHTML =
    '<h2>🎁 Mis puntos</h2>' +
    '<p class="meta">Ganas <b>1 punto por cada ' +
      fmt.format(c.cada) +
    '</b> de tus compras pagadas. Con <b>' +
      c.objetivo +
    ' puntos</b> giras la ruleta y ganas un premio.</p>' +

    '<div class="f">' +
      '<input id="pt-tel" inputmode="tel" maxlength="20" ' +
        'placeholder="Tu celular" value="' + esc(sd.t || "") + '">' +
      '<input id="pt-ped" maxlength="12" ' +
        'placeholder="Número de un pedido tuyo (ej: A1B2C3)">' +
    '</div>' +

    '<div class="err" id="pt-err"></div>' +

    '<div class="foot">' +
      '<button class="btn" data-x="close">Cerrar</button>' +
      '<button class="btn primary" id="pt-ver">Ver mis puntos</button>' +
    '</div>';

  $("pt-ver").addEventListener("click", verPuntos);
  $("dlg").showModal();
}

/* ==========================================
   CONSULTAR CUENTA
   ========================================== */

function verPuntos() {
  var tel = $("pt-tel").value.trim();
  var ped = $("pt-ped").value.trim().replace(/^#/, "");

  if (!tel || ped.length < 4) {
    $("pt-err").textContent =
      "Escribe tu celular y el número de tu pedido.";
    return;
  }

  $("pt-err").textContent = "Consultando…";

  Backend.rpc("mi_cuenta", {
    p_tel: tel,
    p_pedido: ped
  })
    .then(function (r) {
      if (!r || r.error) {
        $("pt-err").textContent =
          (r && r.error) || "No se pudo consultar.";
        return;
      }

      rueda.cuenta = {
        tel: tel,
        ped: ped,
        puntos: r.puntos | 0,
        premios: r.premios || []
      };

      pintarCuenta();
    })
    .catch(function () {
      $("pt-err").textContent =
        "No se pudo consultar. Inténtalo de nuevo.";
    });
}

/* ==========================================
   PERFIL Y RULETA
   ========================================== */

function pintarCuenta(msg) {
  var a = rueda.cuenta;
  var c = ptsCfg();

  var pct = Math.min(
    100,
    Math.round(a.puntos * 100 / c.objetivo)
  );

  var puede = a.puntos >= c.objetivo;

  $("dbox").innerHTML =
    '<h2>PLAYER PROFILE</h2>' +
    perfilHUD(a, c, pct, puede) +

    '<div class="wheelbox">' +
      '<div class="pointer"></div>' +
      '<canvas id="wheel" width="600" height="600" ' +
        'aria-label="Ruleta de premios"></canvas>' +
    '</div>' +

    '<div id="pt-res" class="pres">' +
      (msg || "") +
    '</div>' +

    (a.premios.length
      ? '<div class="meta">Tus cupones disponibles (úsalos en el carrito):</div>' +
        a.premios.map(function (p) {
          return '<div class="line">' +
            '<span><b>' + esc(p.codigo) + '</b> ' +
              '<span class="meta">' + esc(p.nombre) + '</span>' +
            '</span>' +
            '<button class="btn sm" data-copy="' +
              esc(p.codigo) +
            '">Copiar</button>' +
          '</div>';
        }).join("")
      : "") +

    '<div class="foot">' +
      '<button class="btn" data-x="close">Cerrar</button>' +
      '<button class="btn primary" id="pt-girar"' +
        (puede ? "" : " disabled") +
      '>🎰 Girar ruleta</button>' +
    '</div>';

  dibujarRueda();

  $("pt-girar").addEventListener("click", girarRuleta);
}

/* ==========================================
   DIBUJAR RULETA — NEÓN GAMING
   ========================================== */

function dibujarRueda() {
  var cv = $("wheel");

  if (!cv) return;

  var g = cv.getContext("2d");
  var R = cfg.ruleta || [];
  var n = R.length;

  if (!g || !n) return;

  var r = 300;
  var s = (Math.PI * 2) / n;
  var total = Math.PI * 2;

  cv.style.transform = "rotate(" + rueda.rot + "deg)";

  g.clearRect(0, 0, 600, 600);

  // Base oscura con profundidad.
  g.save();

  g.beginPath();
  g.arc(r, r, 296, 0, total);

  g.fillStyle = "#080d1b";
  g.shadowColor = "#8b5cf6";
  g.shadowBlur = 24;
  g.fill();

  g.restore();

  // Segmentos con degradados y separación luminosa.
  R.forEach(function (p, i) {
    var a0 = -Math.PI / 2 + i * s;
    var a1 = a0 + s;
    var color = COLORES[i % COLORES.length];

    g.save();

    g.beginPath();
    g.moveTo(r, r);
    g.arc(r, r, 278, a0, a1);
    g.closePath();

    var grad = g.createRadialGradient(
      r, r, 35,
      r, r, 280
    );

    grad.addColorStop(0, color);
    grad.addColorStop(0.65, color);
    grad.addColorStop(1, "#101629");

    g.fillStyle = grad;
    g.fill();

    g.strokeStyle = "rgba(255,255,255,.72)";
    g.lineWidth = 2.5;
    g.stroke();

    // Línea luminosa interior.
    g.beginPath();

    g.moveTo(
      r + Math.cos(a0) * 48,
      r + Math.sin(a0) * 48
    );

    g.lineTo(
      r + Math.cos(a0) * 272,
      r + Math.sin(a0) * 272
    );

    g.strokeStyle = "rgba(255,255,255,.2)";
    g.lineWidth = 1;
    g.stroke();

    // Texto orientado para facilitar su lectura.
    g.translate(r, r);

    var medio = a0 + s / 2;
    var invertido = Math.cos(medio) < 0;

    g.rotate(medio);

    if (invertido) {
      g.rotate(Math.PI);
    }

    var nombre = String(p.nombre || "Premio").trim();
    var max = n > 10 ? 12 : n > 7 ? 15 : 19;

    var texto = nombre.length > max
      ? nombre.slice(0, max - 1) + "…"
      : nombre;

    g.textAlign = invertido ? "left" : "right";
    g.textBaseline = "middle";

    g.font =
      "700 " + (n > 9 ? 18 : 23) +
      "px Rajdhani, sans-serif";

    g.lineJoin = "round";
    g.strokeStyle = "rgba(0,0,0,.8)";
    g.lineWidth = 5;

    g.strokeText(
      texto,
      invertido ? -248 : 248,
      0,
      190
    );

    g.fillStyle = "#ffffff";
    g.shadowColor = "rgba(0,0,0,.8)";
    g.shadowBlur = 7;

    g.fillText(
      texto,
      invertido ? -248 : 248,
      0,
      190
    );

    g.restore();
  });

  // Aro exterior oscuro y borde de neón.
  g.save();

  g.beginPath();
  g.arc(r, r, 291, 0, total);
  g.strokeStyle = "#050812";
  g.lineWidth = 16;
  g.stroke();

  g.beginPath();
  g.arc(r, r, 289, 0, total);
  g.strokeStyle = "#22d3ee";
  g.lineWidth = 3;
  g.shadowColor = "#22d3ee";
  g.shadowBlur = 18;
  g.stroke();

  g.beginPath();
  g.arc(r, r, 278, 0, total);
  g.strokeStyle = "rgba(255,255,255,.6)";
  g.lineWidth = 2;
  g.shadowBlur = 0;
  g.stroke();

  g.restore();

  // Pequeñas luces alrededor de la ruleta.
  for (var j = 0; j < 36; j++) {
    var ang = (j / 36) * total;
    var radio = j % 3 === 0 ? 285 : 286;

    var x = r + Math.cos(ang) * radio;
    var y = r + Math.sin(ang) * radio;

    g.save();

    g.beginPath();
    g.arc(
      x,
      y,
      j % 3 === 0 ? 3 : 1.5,
      0,
      total
    );

    g.fillStyle = j % 3 === 0
      ? "#ffffff"
      : "#22d3ee";

    g.shadowColor = "#22d3ee";
    g.shadowBlur = 8;
    g.fill();

    g.restore();
  }

  // Centro metálico.
  g.save();

  var centro = g.createRadialGradient(
    280, 276, 2,
    r, r, 48
  );

  centro.addColorStop(0, "#ffffff");
  centro.addColorStop(0.16, "#22d3ee");
  centro.addColorStop(0.42, "#263b60");
  centro.addColorStop(0.76, "#080d1b");
  centro.addColorStop(1, "#8b5cf6");

  g.beginPath();
  g.arc(r, r, 46, 0, total);

  g.fillStyle = centro;
  g.shadowColor = "#8b5cf6";
  g.shadowBlur = 22;
  g.fill();

  g.strokeStyle = "#ffffff";
  g.lineWidth = 3;
  g.stroke();

  g.beginPath();
  g.arc(r, r, 32, 0, total);

  g.strokeStyle = "#22d3ee";
  g.lineWidth = 2;
  g.shadowColor = "#22d3ee";
  g.shadowBlur = 12;
  g.stroke();

  g.shadowBlur = 0;
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "900 17px Rajdhani, sans-serif";
  g.fillText("SPIN", r, r);

  g.restore();
}

/* ==========================================
   GIRAR RULETA
   El resultado siempre viene de Supabase.
   ========================================== */

function girarRuleta() {
  var a = rueda.cuenta;

  if (!a || rueda.girando) return;

  rueda.girando = true;

  $("pt-girar").disabled = true;
  $("pt-res").textContent = "Girando…";

  Backend.rpc("girar_ruleta", {
    p_tel: a.tel,
    p_pedido: a.ped
  })
    .then(function (r) {
      if (!r || r.error) {
        rueda.girando = false;

        pintarCuenta(
          '<span class="err">' +
          esc((r && r.error) || "No se pudo girar.") +
          '</span>'
        );

        return;
      }

      var cv = $("wheel");
      var n = cfg.ruleta.length;

      var seg = 360 / n;

      var i = Math.max(
        0,
        Math.min(n - 1, r.indice | 0)
      );

      var quieto = window.matchMedia &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;

      rueda.rot =
        (Math.floor(rueda.rot / 360) + 6) * 360 -
        (i + 0.5) * seg;

      var fin = function () {
        rueda.girando = false;

        a.puntos = r.puntos | 0;

        if (r.codigo) {
          a.premios.unshift({
            codigo: r.codigo,
            nombre: r.nombre
          });
        }

        var txt = r.tipo === "nada"
          ? "Esta vez no hubo premio. ¡Sigue acumulando puntos!"
          : r.tipo === "puntos"
            ? '¡Ganaste <b>' + esc(r.nombre) + '</b>!'
            : '¡Ganaste <b>' + esc(r.nombre) +
              '</b>! Tu cupón: <b>' + esc(r.codigo) +
              '</b> (úsalo en el carrito).';

        pintarCuenta(txt);
      };

      // Respeta la preferencia de movimiento reducido.
      if (quieto) {
        cv.style.transition = "none";
        cv.style.transform =
          "rotate(" + rueda.rot + "deg)";

        fin();
        return;
      }

      var hecho = false;

      var una = function () {
        if (hecho) return;

        hecho = true;
        fin();
      };

      cv.addEventListener("transitionend", una, {
        once: true
      });

      // Respaldo por si el navegador no dispara transitionend.
      setTimeout(una, 5200);

      requestAnimationFrame(function () {
        cv.style.transform =
          "rotate(" + rueda.rot + "deg)";
      });
    })
    .catch(function () {
      rueda.girando = false;

      pintarCuenta(
        '<span class="err">' +
        'No se pudo girar. Inténtalo de nuevo.' +
        '</span>'
      );
    });
}