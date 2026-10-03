/* PUNTOS Y RULETA (lado del cliente).
   Los puntos los suma la BASE DE DATOS cuando el administrador confirma el pago; el premio de la ruleta también lo sortea la base de datos.
   Esta página solo muestra la cuenta y anima la ruleta con el resultado que le responde el servidor: no puede hacer trampa. */
function ptsCfg(){var p=cfg.pts||{};return{cada:Number(p.cada)||0,objetivo:Number(p.objetivo)||0}}
function ruletaOn(){var c=ptsCfg();return REMOTO&&c.cada>0&&c.objetivo>0&&Array.isArray(cfg.ruleta)&&cfg.ruleta.length>=2}
function ptsAviso(total){
  if(!ruletaOn())return"";var c=ptsCfg(),g=Math.floor(Number(total)/c.cada);
  return'<p class="meta">🎁 '+(g>0?'Cuando confirmemos tu pago ganarás <b>'+g+' punto(s)</b>. ':'')+'Guarda tu número de pedido y tu celular: con ellos consultas tus puntos y giras la ruleta desde "Mis puntos".</p>';
}
var COLORES=["#ff7a3d","#e0457b","#ffb020","#8a5cf6","#2dbd85","#3b82f6"],rueda={rot:0,cuenta:null,girando:false};
function abrirPuntos(){
  var b=$("dbox");
  if(!ruletaOn()){b.innerHTML='<h2>🎁 Mis puntos</h2><p class="meta">El programa de puntos aún no está disponible.</p><div class="foot"><button class="btn" data-x="close">Cerrar</button></div>';$("dlg").showModal();return}
  var c=ptsCfg(),sd=Cookies.ok("preferencias")?lsGet("tienda_datos",{}):{};
  b.innerHTML='<h2>🎁 Mis puntos</h2><p class="meta">Ganas <b>1 punto por cada '+fmt.format(c.cada)+'</b> de tus compras pagadas. Con <b>'+c.objetivo+' puntos</b> giras la ruleta y ganas un premio.</p>'
   +'<div class="f"><input id="pt-tel" inputmode="tel" maxlength="20" placeholder="Tu celular" value="'+esc(sd.t||"")+'"><input id="pt-ped" maxlength="12" placeholder="Número de un pedido tuyo (ej: A1B2C3)"></div><div class="err" id="pt-err"></div>'
   +'<div class="foot"><button class="btn" data-x="close">Cerrar</button><button class="btn primary" id="pt-ver">Ver mis puntos</button></div>';
  $("pt-ver").addEventListener("click",verPuntos);$("dlg").showModal();
}
function verPuntos(){
  var tel=$("pt-tel").value.trim(),ped=$("pt-ped").value.trim().replace(/^#/,"");
  if(!tel||ped.length<4){$("pt-err").textContent="Escribe tu celular y el número de tu pedido.";return}
  $("pt-err").textContent="Consultando…";
  Backend.rpc("mi_cuenta",{p_tel:tel,p_pedido:ped}).then(function(r){
    if(!r||r.error){$("pt-err").textContent=(r&&r.error)||"No se pudo consultar.";return}
    rueda.cuenta={tel:tel,ped:ped,puntos:r.puntos|0,premios:r.premios||[]};pintarCuenta();
  }).catch(function(){$("pt-err").textContent="No se pudo consultar. Inténtalo de nuevo."});
}
function pintarCuenta(msg){
  var a=rueda.cuenta,c=ptsCfg(),pct=Math.min(100,Math.round(a.puntos*100/c.objetivo)),puede=a.puntos>=c.objetivo;
  $("dbox").innerHTML='<h2>🎁 Mis puntos</h2><div class="paytotal"><span>Puntos acumulados</span><b>'+a.puntos+'</b></div>'
   +'<div class="pbar"><i style="width:'+pct+'%"></i></div><div class="meta">'+(puede?'¡Ya puedes girar la ruleta!':'Te faltan '+(c.objetivo-a.puntos)+' puntos para girar.')+'</div>'
   +'<div class="wheelbox"><div class="pointer"></div><canvas id="wheel" width="600" height="600" aria-label="Ruleta de premios"></canvas></div>'
   +'<div id="pt-res" class="pres">'+(msg||"")+'</div>'
   +(a.premios.length?'<div class="meta">Tus cupones disponibles (úsalos en el carrito):</div>'+a.premios.map(function(p){return'<div class="line"><span><b>'+esc(p.codigo)+'</b> <span class="meta">'+esc(p.nombre)+'</span></span><button class="btn sm" data-copy="'+esc(p.codigo)+'">Copiar</button></div>'}).join(""):"")
   +'<div class="foot"><button class="btn" data-x="close">Cerrar</button><button class="btn primary" id="pt-girar"'+(puede?'':' disabled')+'>🎰 Girar ruleta</button></div>';
  dibujarRueda();$("pt-girar").addEventListener("click",girarRuleta);
}
function dibujarRueda(){
  var cv=$("wheel"),g=cv.getContext("2d"),R=cfg.ruleta,n=R.length,s=2*Math.PI/n,r=300;
  cv.style.transform="rotate("+rueda.rot+"deg)";
  g.clearRect(0,0,600,600);
  R.forEach(function(p,i){
    var a0=-Math.PI/2+i*s;g.beginPath();g.moveTo(r,r);g.arc(r,r,r-4,a0,a0+s);g.closePath();g.fillStyle=COLORES[i%COLORES.length];g.fill();g.strokeStyle="rgba(255,255,255,.55)";g.lineWidth=3;g.stroke();
    g.save();g.translate(r,r);g.rotate(a0+s/2);g.textAlign="right";g.fillStyle="#fff";g.shadowColor="rgba(0,0,0,.6)";g.shadowBlur=4;g.font="700 26px Rajdhani, sans-serif";
    var t=String(p.nombre||"").slice(0,18);g.fillText(t,r-28,9);g.restore();
  });
  g.beginPath();g.arc(r,r,34,0,2*Math.PI);g.fillStyle="#1f130e";g.fill();g.strokeStyle="#fff";g.lineWidth=4;g.stroke();
}
function girarRuleta(){
  var a=rueda.cuenta;if(!a||rueda.girando)return;rueda.girando=true;$("pt-girar").disabled=true;$("pt-res").textContent="Girando…";
  Backend.rpc("girar_ruleta",{p_tel:a.tel,p_pedido:a.ped}).then(function(r){
    if(!r||r.error){rueda.girando=false;pintarCuenta('<span class="err">'+esc((r&&r.error)||"No se pudo girar.")+'</span>');return}
    var cv=$("wheel"),n=cfg.ruleta.length,seg=360/n,i=Math.max(0,Math.min(n-1,r.indice|0)),quieto=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
    rueda.rot=(Math.floor(rueda.rot/360)+6)*360-(i+0.5)*seg;
    var fin=function(){
      rueda.girando=false;a.puntos=r.puntos|0;if(r.codigo)a.premios.unshift({codigo:r.codigo,nombre:r.nombre});
      var txt=r.tipo==="nada"?"Esta vez no hubo premio. ¡Sigue acumulando puntos!":r.tipo==="puntos"?'¡Ganaste <b>'+esc(r.nombre)+'</b>!':'¡Ganaste <b>'+esc(r.nombre)+'</b>! Tu cupón: <b>'+esc(r.codigo)+'</b> (úsalo en el carrito).';
      pintarCuenta(txt);
    };
    if(quieto){cv.style.transition="none";cv.style.transform="rotate("+rueda.rot+"deg)";fin();return}
    var hecho=false,una=function(){if(hecho)return;hecho=true;fin()};
    cv.addEventListener("transitionend",una,{once:true});setTimeout(una,5200);
    requestAnimationFrame(function(){cv.style.transform="rotate("+rueda.rot+"deg)"});
  }).catch(function(){rueda.girando=false;pintarCuenta('<span class="err">No se pudo girar. Inténtalo de nuevo.</span>')});
}
