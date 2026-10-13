// mini_bg.js 纯外部最小动画，验证 requestAnimationFrame/Canvas 是否被阻断
(function(){
  var tag=document.getElementById('mini-ext-debug');
  var cvs=document.getElementById('mini-ext-canvas');
  if(!cvs||!tag){return;}
  function resize(){cvs.width=innerWidth; cvs.height=innerHeight;} window.addEventListener('resize',resize); resize();
  var ctx=cvs.getContext('2d');
  var t=0, frames=0, lastFPS=performance.now();
  function loop(){
    requestAnimationFrame(loop);
    t+=0.03; frames++;
    ctx.clearRect(0,0,cvs.width,cvs.height);
    var r=60+Math.sin(t)*30;
    ctx.save(); ctx.translate(cvs.width/2,cvs.height/2); ctx.rotate(t*0.5);
    ctx.strokeStyle='#ffc857'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
    ctx.restore();
    var now=performance.now();
    if(now-lastFPS>1000){ tag.textContent='MINI-EXT fps~'+frames; frames=0; lastFPS=now; }
  }
  loop();
})();
