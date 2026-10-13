// drift.js - 简化海洋塑料漂流演示模块
// 设计目标：
// 1. 纯前端、零依赖、单文件可嵌入 (file:// 兼容)
// 2. 使用二维噪声流场 (改良 Perlin) 生成 pseudo 洋流向量
// 3. 粒子具备拖拽阻尼、循环边界 (torus wrap)；不同批次使用 HSL 色环区分
// 4. 与主平台其他动画 (Three.js 地球 / Chart.js) 解耦：独立 rAF 循环，可暂停/销毁
// 5. 面板隐藏时默认继续保留轨迹；如需真正停更可调用 destroy()
//
// Public API (返回对象)：
//   restart()    - 清空并按默认数量重新注入粒子
//   randomize()  - 重建噪声流场 (新的 seed)
//   togglePause()- 暂停/恢复绘制 (轨迹保留在缓慢 alpha 覆盖下逐渐淡化)
//   inject()     - 追加一批粒子 (120 默认)
//   faster()     - speedFactor +0.5 (<=6)
//   slower()     - speedFactor -0.5 (>=0.5)
//   destroy()    - 停止循环 + 移除 resize 监听
//   root / canvas - DOM 引用
//
// Usage:
//   const inst = DriftSimulation.init('#drift-host');
//   inst.inject(); inst.faster();
//
// 性能建议：大量其他动画运行时，可在隐藏面板时调用 togglePause() 节流。
// ---------------------------------------------------------------------------

(function(global){
  function createNoise(seed=Date.now()%100000){
    function mulberry32(a){return function(){var t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296;}};
    const rand = mulberry32(seed);
    const grid = {}; function key(x,y){return x+','+y;} function g(x,y){const k=key(x,y); if(!(k in grid)) grid[k]=rand()*2-1; return grid[k];}
    function lerp(a,b,t){return a+(b-a)*t;} function fade(t){return t*t*t*(t*(t*6-15)+10);} // Perlin fade
    return { get(x,y){ x/=140; y/=140; const xi=Math.floor(x), yi=Math.floor(y); const xf=x-xi, yf=y-yi; const tl=g(xi,yi), tr=g(xi+1,yi), bl=g(xi,yi+1), br=g(xi+1,yi+1); const u=fade(xf), v=fade(yf); return lerp(lerp(tl,tr,u), lerp(bl,br,u), v); } };
  }

  function initDriftSimulation(container){
    // 容器结构：外部传入一个 div，我们内部创建 canvas + legend + log + controls
    const root = typeof container === 'string'? document.querySelector(container): container;
    if(!root) throw new Error('DriftSimulation: container not found');

    root.classList.add('drift-sim-root');
    root.innerHTML = `
      <div class="drift-canvas-wrap">
        <canvas class="drift-canvas"></canvas>
      </div>
      <div class="drift-control-bar">
        <button data-act="restart">♻ 重置</button>
        <button data-act="pause" id="driftPauseBtn">⏸ 暂停</button>
        <button data-act="inject">🌐 注入漂浮物</button>
        <button data-act="faster">⏩ 加速</button>
        <button data-act="slower">🐢 减速</button>
      </div>
      <div class="drift-legend" ></div>
      <div class="drift-log"></div>
      <div class="drift-notice">此演示基于二维噪声流场的简化模型，粒子完整轨迹显示，每15秒自动随机洋流。</div>
    `;

    const canvas = root.querySelector('.drift-canvas');
    const ctx = canvas.getContext('2d');
    const legendEl = root.querySelector('.drift-legend');
    const logEl = root.querySelector('.drift-log');
    let W=0,H=0; function resize(){ W=canvas.width=canvas.clientWidth; H=canvas.height=canvas.clientHeight; }
    window.addEventListener('resize', resize);
    // 初始放在下一个宏任务保证已布局
    setTimeout(resize, 0);

    let noise = createNoise();
    let particles=[]; let batches=0;
    let paused=false; let speedFactor=1; let running=true; let frameReq=null; let last=performance.now();
    
    // 自动15秒随机洋流
    let autoRandomInterval = setInterval(() => {
      if(!paused && running) {
        randomize();
      }
    }, 15000);

    function log(msg){ const time=new Date().toLocaleTimeString(); logEl.textContent = `[${time}] ${msg}\n` + logEl.textContent.split('\n').slice(0,140).join('\n'); }

    function updateLegend(){ legendEl.innerHTML=''; const used=[...new Set(particles.map(p=>p.color))]; used.slice(-8).forEach(c=>{ const item=document.createElement('div'); item.className='drift-legend-item'; item.innerHTML=`<div class="drift-legend-color" style="background:${c}"></div><span>${c}</span>`; legendEl.appendChild(item); }); }

    function addParticles(n=180){ 
      const color = `hsl(${(batches*53)%360} 75% 60%)`;
      for(let i=0;i<n;i++){ 
        var newParticle = {
          x:Math.random()*W, 
          y:Math.random()*H, 
          vx:0, vy:0, 
          life:0, 
          maxLife: 300 + Math.random() * 200, 
          color, 
          drag:0.92+Math.random()*0.05, 
          trail: [], 
          trailCounter: 0
        };
        // 初始化轨迹
        newParticle.trail.push({x: newParticle.x, y: newParticle.y});
        particles.push(newParticle);
      } 
      batches++; 
      updateLegend(); 
      log(`注入 ${n} 个粒子 (批次 #${batches})`); 
    }

    function stepParticle(p,dt){ 
      const f = noise.get(p.x,p.y); const angle=f*Math.PI*2; const speed=18+22*Math.abs(f); 
      p.vx+=Math.cos(angle)*speed*dt; p.vy+=Math.sin(angle)*speed*dt; p.vx*=p.drag; p.vy*=p.drag; 
      
      // 保存旧位置用于边界跳跃检测
      const oldX = p.x;
      const oldY = p.y;
      
      p.x+=p.vx*dt; p.y+=p.vy*dt; 
      
      // 检测边界跳跃
      let wrapped = false;
      if(p.x<0) { p.x+=W; wrapped = true; }
      else if(p.x>W) { p.x-=W; wrapped = true; }
      if(p.y<0) { p.y+=H; wrapped = true; }
      else if (p.y>H) { p.y-=H; wrapped = true; }
      
      // 记录轨迹（每3帧记录一次，保持更长的轨迹）
      if(!p.trailCounter) p.trailCounter = 0;
      p.trailCounter++;
      if(p.trailCounter % 3 === 0) {
        if(!p.trail) p.trail = [];
        p.trail.push({x: p.x, y: p.y});
        // 大幅增加轨迹长度限制，让轨迹更持久
        if(p.trail.length > 800) {
          p.trail.shift();
        }
      }
      
      p.life+=dt; 
    }

    function loop(now){ if(!running) return; const dt = Math.min(0.05,(now-last)/1000)*speedFactor; last=now; if(!paused){ 
      // 使用更淡的背景覆盖，让轨迹保留更久
      ctx.fillStyle='rgba(4,20,31,0.08)'; ctx.fillRect(0,0,W,H); 
      particles.forEach(p=>stepParticle(p,dt)); 
    
      // 移除死亡粒子并在随机位置重新生成
      for(let i = particles.length - 1; i >= 0; i--){
        const p = particles[i];
        if(p.life > p.maxLife){
          particles.splice(i, 1);
          // 在随机位置生成新粒子，保持轨迹系统
          var newParticle = {
            x:Math.random()*W, 
            y:Math.random()*H, 
            vx:0, vy:0, 
            life:0, 
            maxLife: 300 + Math.random() * 200, 
            color: p.color, 
            drag:0.92+Math.random()*0.05, 
            trail: [], 
            trailCounter: 0
          };
          // 初始化轨迹
          newParticle.trail.push({x: newParticle.x, y: newParticle.y});
          particles.push(newParticle);
        }
      }
    
      // 绘制粒子和轨迹
      particles.forEach(p=>{
        // 绘制轨迹线（智能分段避免跳跃连线）
        if(p.trail && p.trail.length > 1){
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          
          // 绘制渐变透明度的轨迹
          for(let i = 1; i < p.trail.length; i++){
            const prev = p.trail[i-1];
            const curr = p.trail[i];
            
            // 计算距离，如果距离太大说明是边界跳跃，跳过这段连线
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // 如果距离小于画布的1/3，认为是正常移动，绘制连线
            if(distance < Math.min(W, H) / 3) {
              // 轨迹透明度渐变：越新的越不透明
              const alpha = 0.3 + (i / p.trail.length) * 0.5;
              ctx.globalAlpha = alpha;
              
              ctx.beginPath();
              ctx.moveTo(prev.x, prev.y);
              ctx.lineTo(curr.x, curr.y);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
        }
        
        // 绘制粒子本体
        ctx.fillStyle=p.color; 
        ctx.beginPath(); 
        ctx.arc(p.x,p.y,2.5,0,Math.PI*2); // 稍微增大粒子尺寸
        ctx.fill(); 
      }); 
    } frameReq=requestAnimationFrame(loop); }

    function restart(){ particles=[]; addParticles(280); log('重置模拟'); }
    function randomize(){ noise=createNoise(Math.random()*999999|0); log('重新生成流场'); }
    function togglePause(){ paused=!paused; const btn=root.querySelector('#driftPauseBtn'); if(btn) btn.textContent = paused? '▶ 恢复':'⏸ 暂停'; log(paused? '暂停':'继续'); }
    function inject(){ addParticles(120); }
    function faster(){ speedFactor=Math.min(6,speedFactor+0.5); log('速度 x'+speedFactor.toFixed(1)); }
    function slower(){ speedFactor=Math.max(0.5,speedFactor-0.5); log('速度 x'+speedFactor.toFixed(1)); }
    function destroy(){ running=false; if(frameReq) cancelAnimationFrame(frameReq); if(autoRandomInterval) clearInterval(autoRandomInterval); window.removeEventListener('resize', resize); log('已销毁'); }

    root.addEventListener('click', (e)=>{
      const act = e.target.getAttribute('data-act'); if(!act) return;
      switch(act){ case 'restart': restart(); break; case 'pause': togglePause(); break; case 'inject': inject(); break; case 'faster': faster(); break; case 'slower': slower(); break; }
    });

    // 启动
    addParticles(280); log('初始化完成'); frameReq=requestAnimationFrame(loop);

    return { restart, randomize, togglePause, inject, faster, slower, destroy, root, canvas };
  }

  // 导出
  global.DriftSimulation = { init: initDriftSimulation };
})(window);
