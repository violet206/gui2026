// policy_sim.js
// 从 education_walkthrough.html 中提取的模拟器脚本，负责：
// - 尝试从多个 CDN 加载 Chart.js，并发出 `chart-ready` 事件
// - 提供 computeSeries / buildChart / renderKpis / UI 绑定 和 CSV 导出

(function(){
  // Chart.js 多 CDN 加载（轻量重用 main.html 的策略）
  (function loadChart(){
    if(window.Chart){ document.dispatchEvent(new Event('chart-ready')); return; }
    const srcs = [
      'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
      'https://unpkg.com/chart.js@4.4.1/dist/chart.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
    ];
    let i = 0;
    function attempt(){
      if(window.Chart){ document.dispatchEvent(new Event('chart-ready')); return; }
      if(i>=srcs.length){ console.warn('[PolicySim] Chart.js CDN 全部失败'); window.__CHART_FAILED__ = true; const el = document.getElementById('chartFallback'); if(el) el.style.display='block'; return; }
      const s = document.createElement('script');
      s.src = srcs[i++];
      s.onload = ()=>{ console.log('[PolicySim] Chart.js 加载成功', s.src); document.dispatchEvent(new Event('chart-ready')); };
      s.onerror = ()=>{ console.warn('[PolicySim] Chart.js 加载失败', s.src); setTimeout(attempt, 200); };
      document.head.appendChild(s);
    }
    attempt();
  })();

  // 简单仿真模型与图表逻辑
  (function policySim(){
    const el = id=>document.getElementById(id);
  const baseInflow = el('baseInflow');
    const reduction = el('reduction'); const reductionVal = el('reductionVal');
    const calming = el('calming'); const calmingVal = el('calmingVal');
    const autoRefresh = el('autoRefresh'); const years = el('years');
    const applyBtn = el('applySim'); const resetBtn = el('resetSim'); const exportBtn = el('exportCSV');
  // 新增控件
  const playToggle = el('playToggle');
  const playYearInfo = el('playYearInfo');
  const chkContinuePlay = el('chkContinuePlay');
  const playSpeed = el('playSpeed');
  const stockSmoothingSel = el('stockSmoothing');
  const chkResumeOnLoad = el('chkResumeOnLoad');
  const exportPNG = el('exportPNG');
  const toggleAdvanced = el('toggleAdvanced');
  const advancedPanel = el('advancedPanel');
  const advRemoval = el('advRemoval'); const advRemovalVal = el('advRemovalVal');
  const advBoost = el('advBoost'); const advBoostVal = el('advBoostVal');
  const saveSnapshotBtn = el('saveSnapshot');
  const clearSnapshotsBtn = el('clearSnapshots');
  const snapshotList = el('snapshotList');
  const overlaySelect = el('overlaySelect');
  // 额外 KPI
  const kpiPeakYear = el('kpiPeakYear')?.querySelector('.kpi-value');
  const kpiAvgStock = el('kpiAvgStock')?.querySelector('.kpi-value');
    const kpiAdjusted = el('kpiAdjusted')?.querySelector('.kpi-value');
    const kpiAnnualRed = el('kpiAnnualRed')?.querySelector('.kpi-value');
    const kpiCumulative = el('kpiCumulative')?.querySelector('.kpi-value');
    const kpiFinalStock = el('kpiFinalStock')?.querySelector('.kpi-value');
    const fallback = el('chartFallback');
  let chart = null;
  let playbackTimer=null; let playbackIndex=0; let playbackActive=false;
  let lastComputed=null; // 缓存最近一次完整结果
  // 播放预分配缓冲，避免每帧 slice 导致视觉重绘回到 X 轴
  let inflowBuffer=null; let stockBuffer=null; // inflow 长度 = 年数 (不含初始), stock 长度 = 年数+1
  function initPlaybackBuffers(series){ if(!series) return; inflowBuffer = new Array(series.inflows.length).fill(null); stockBuffer = new Array(series.displayStock.length).fill(null); stockBuffer[0] = series.displayStock[0]; }
  // 轴范围缓存，避免播放逐点增加时上下抖动 (lock axis to prevent jitter)
  let cachedYMax=null; let cachedY2Max=null; let axisDirty=true;
  // 轴模式：lock(严格固定) / adaptive(缓慢跟随) 可切换
  const AXIS_MODE_KEY='policy_sim_axis_mode';
  let axisMode=(()=>{ try{ return localStorage.getItem(AXIS_MODE_KEY)||'lock'; }catch(e){ return 'lock'; } })();
  let currentYMax=null; let currentY2Max=null; // adaptive 模式下平滑用
  const AXIS_SMOOTH=0.18; // adaptive 模式插值系数
  function niceCeil(v){ if(!isFinite(v)||v<=0) return 1; const exp=Math.floor(Math.log10(v)); const base=Math.pow(10,exp); const n=v/base; let m; if(n<=1) m=1; else if(n<=2) m=2; else if(n<=5) m=5; else m=10; return m*base; }
  const SNAP_KEY='policy_sim_snapshots_v1';
  let snapshots=[];
  try{ const raw=localStorage.getItem(SNAP_KEY); if(raw) snapshots=JSON.parse(raw)||[]; }catch(e){}
  function persistSnaps(){ try{ localStorage.setItem(SNAP_KEY, JSON.stringify(snapshots.slice(0,50))); }catch(e){} }
  function paramColor(s){ // 简单 hash 基于关键参数
    const p = s.params; const seed = (Number(p.red)||0)*7 + (Number(p.calm)||0)*11 + (Number(p.auto)||0)*13 + (Number(p.rem)||0)*17 + (Number(p.boost)||0)*19;
    const h = seed % 360; return `hsl(${h},70%,55%)`;
  }
  function snapshotLabel(s){ const p=s.params; return `${s.name} R${p.red}% C${p.calm} A${p.auto} Rem${p.rem}`; }
  function renderSnapshots(){ if(!snapshotList) return; snapshotList.innerHTML=''; if(!snapshots.length){ snapshotList.innerHTML='<li style="opacity:.6;">(无)</li>'; if(overlaySelect) overlaySelect.innerHTML=''; computeDeltaRanking(); return; } if(overlaySelect) overlaySelect.innerHTML=''; snapshots.forEach((s,i)=>{ const li=document.createElement('li'); li.style.cssText='display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);padding:4px 6px;border-radius:8px;'; li.innerHTML='<span style="flex:1;">'+snapshotLabel(s)+'</span><button data-act="load" style="background:#0d3a50;color:#d8f3ff;border:1px solid #1d5f79;padding:2px 6px;border-radius:6px;cursor:pointer;font-size:10px;">载入</button><button data-act="del" style="background:#533030;color:#ffcece;border:1px solid #8a4a4a;padding:2px 6px;border-radius:6px;cursor:pointer;font-size:10px;">删</button>'; li.querySelectorAll('button').forEach(btn=>btn.onclick=(e)=>{ e.stopPropagation(); if(btn.dataset.act==='load'){ loadSnapshot(i);} else { snapshots.splice(i,1); persistSnaps(); renderSnapshots(); update(true); } }); snapshotList.appendChild(li); const wrap=document.createElement('label'); wrap.style.cssText='display:flex;align-items:center;gap:4px;'; const chk=document.createElement('input'); chk.type='checkbox'; chk.dataset.index=i; chk.onchange=()=>{ update(true); computeDeltaRanking(); }; wrap.appendChild(chk); const color=paramColor(s); const sw=document.createElement('span'); sw.style.cssText='width:10px;height:10px;border-radius:50%;background:'+color+';display:inline-block;'; wrap.appendChild(sw); const txt=document.createElement('span'); txt.textContent=snapshotLabel(s); txt.style.fontSize='10px'; wrap.appendChild(txt); if(overlaySelect) overlaySelect.appendChild(wrap); }); computeDeltaRanking(); }
  renderSnapshots();

    function format(num){ if(num===null||isNaN(num)) return '—'; if(Math.abs(num)>=1e6) return (num/1e6).toFixed(2)+'M'; return Math.round(num).toLocaleString(); }

    function computeSeries(){
      const B = Number(baseInflow?.value) || 0;
      const R = Number(reduction?.value)/100 || 0;
      const C = Number(calming?.value) || 0;
      const Y = Number(years?.value) || 25;
      const AR = Number(autoRefresh?.value) || 1;
      const boost = Number(advBoost?.value)||0; // 0-30 (% extra factor)
      const arFactor = 1 + (AR===1?0: (AR===4?0.05:0.12)) + boost/100;
      const effectiveReduction = Math.min(1, R * C * arFactor);
      const adjustedInflow = B * (1 - effectiveReduction);
      const removalRate = (Number(advRemoval?.value)||2) /100; // 可调
      let stock = B;
      const stockSeries = [stock];
      const inflows = [];
      for(let t=1;t<=Y;t++){
        const inflow = adjustedInflow;
        inflows.push(inflow);
        stock = stock + inflow - (stock * removalRate);
        stockSeries.push(stock);
      }
      // 平滑处理（仅改变展示，不影响 KPI 原始 stockSeries）
      let displayStock = stockSeries.slice();
      const mode = stockSmoothingSel?.value||'none';
      if(mode!=='none'){
        if(mode.startsWith('ma')){
          const win = mode==='ma3'?3:5;
          const arr=[]; for(let i=0;i<displayStock.length;i++){ const start=Math.max(0,i-win+1); const seg=displayStock.slice(start,i+1); arr.push(seg.reduce((a,b)=>a+b,0)/seg.length); } displayStock=arr;
        } else if(mode==='ema03'){
          const alpha=0.3; let prev=displayStock[0]; const arr=[prev]; for(let i=1;i<displayStock.length;i++){ prev = alpha*displayStock[i] + (1-alpha)*prev; arr.push(prev); } displayStock=arr;
        }
      }
      const cumulativeReduction = (B - adjustedInflow) * Y;
      const yearsArr = Array.from({length:Y+1},(_,i)=>i);
      const peak = Math.max(...stockSeries);
      const peakYear = stockSeries.indexOf(peak);
      const avg = stockSeries.reduce((a,b)=>a+b,0)/stockSeries.length;
      return { years: yearsArr, inflows, stockSeries, displayStock, adjustedInflow, cumulativeReduction, finalStock: stockSeries[stockSeries.length-1], peakYear, avgStock: avg };
    }

  function renderKpis(res){ if(kpiAdjusted) kpiAdjusted.textContent = format(res.adjustedInflow); if(kpiAnnualRed) kpiAnnualRed.textContent = format((Number(baseInflow?.value)||0) - res.adjustedInflow); if(kpiCumulative) kpiCumulative.textContent = format(res.cumulativeReduction); if(kpiFinalStock) kpiFinalStock.textContent = format(res.finalStock); if(kpiPeakYear) kpiPeakYear.textContent = res.peakYear; if(kpiAvgStock) kpiAvgStock.textContent = format(res.avgStock); }

  function buildChart(res){ const canvas = document.getElementById('policyChart'); if(!canvas) return; const ctx = canvas.getContext('2d'); const dsStock = res.displayStock||res.stockSeries; const labels = res.years; // 使用全量 labels，避免播放时重新布局
      // 如果标记脏或没有缓存，计算最大值并锁定 (recompute bounds when dirty)
      if(axisDirty || cachedYMax==null || cachedY2Max==null){
        const inflowMax = Math.max(...res.inflows, 0)*1.02;
        const stockMax = Math.max(...dsStock, 0)*1.02;
        cachedYMax = niceCeil(inflowMax);
        cachedY2Max = niceCeil(stockMax);
        axisDirty=false;
        currentYMax=cachedYMax; currentY2Max=cachedY2Max;
      }
      if(axisMode==='adaptive'){
        const inflowVis = Math.max(...res.inflows.slice(0, playbackActive? playbackIndex+1: res.inflows.length),0)*1.02;
        const stockVis = Math.max(...dsStock.slice(0, playbackActive? playbackIndex+1: dsStock.length),0)*1.02;
        const targetY = Math.min(niceCeil(inflowVis), cachedYMax*3); // 防止无限放大
        const targetY2 = Math.min(niceCeil(stockVis), cachedY2Max*3);
        currentYMax = lerp(currentYMax, targetY, AXIS_SMOOTH);
        currentY2Max = lerp(currentY2Max, targetY2, AXIS_SMOOTH);
      } else {
        // lock: 不做插值，直接使用缓存，彻底消除动画时上下轻微漂移
        currentYMax = cachedYMax;
        currentY2Max = cachedY2Max;
      }
      // 基础两个主数据集（播放时使用预分配缓冲内容）
      let inflowData = res.inflows; let stockData = dsStock;
      if(playbackActive && inflowBuffer && stockBuffer){ inflowData = inflowBuffer; stockData = stockBuffer; }
      const baseDatasets = [
        { id:'inflow', label:'Annual Inflow', data:inflowData, borderColor:'#49c4ff', backgroundColor:'rgba(73,196,255,0.08)', tension:0.25, fill:true },
        { id:'stock', label:'Stock (pollution)', data:stockData, borderColor:'#ffcf6b', backgroundColor:'rgba(255,207,107,0.06)', tension:0.25, fill:true, yAxisID:'y2' }
      ];
        // 改进差异阴影：分为“主大于快照”(正差) 与 “主小于快照”(负差) 两个半透明层
        let firstOverlayStock=null; let firstOverlayIdx=-1;
        if(overlaySelect){ const firstChecked = overlaySelect.querySelector('input[type=checkbox]:checked'); if(firstChecked){ firstOverlayIdx=Number(firstChecked.dataset.index); const snap=snapshots[firstOverlayIdx]; if(snap){ firstOverlayStock = (snap.result.displayStock||snap.result.stockSeries||[]); } } }
        if(firstOverlayStock){
          const mainData = dsStock; const len = Math.min(mainData.length, firstOverlayStock.length);
          const upper=[]; const lower=[]; // 分别用于填色
          for(let i=0;i<len;i++){
            const a=mainData[i]; const b=firstOverlayStock[i]; if(a==null||b==null){ upper.push(null); lower.push(null); continue; }
            if(a>=b){ upper.push(a); lower.push(b); } else { // 反向：交换放入以便第二层处理
              upper.push(b); lower.push(a); }
          }
          // 正差：主>快照 => 用暖色
          baseDatasets.push({ label:'Δ正(主>快照)', data:upper.slice(0, playbackActive ? (playbackIndex+1) : upper.length), type:'line', borderColor:'transparent', backgroundColor:'rgba(255,140,0,0.14)', fill:{target:'-1'}, pointRadius:0, yAxisID:'y2', order:0 });
          baseDatasets.push({ label:'Δ正-底', data:lower.slice(0, playbackActive ? (playbackIndex+1) : lower.length), type:'line', borderColor:'transparent', backgroundColor:'rgba(255,140,0,0.0)', fill:false, pointRadius:0, yAxisID:'y2', order:0 });
          // 负差：再插入一个独立数据集生成第二层阴影(主<快照时)——通过遍历构造专用数组
          const negTop=[]; const negBottom=[]; for(let i=0;i<len;i++){ const a=mainData[i]; const b=firstOverlayStock[i]; if(a==null||b==null){ negTop.push(null); negBottom.push(null); continue; } if(a<b){ negTop.push(b); negBottom.push(a);} else { negTop.push(null); negBottom.push(null);} }
          baseDatasets.push({ label:'Δ负(主<快照)', data:negTop.slice(0, playbackActive ? (playbackIndex+1) : negTop.length), type:'line', borderColor:'transparent', backgroundColor:'rgba(40,150,255,0.16)', fill:{target:'-1'}, pointRadius:0, yAxisID:'y2', order:0 });
          baseDatasets.push({ label:'Δ负-底', data:negBottom.slice(0, playbackActive ? (playbackIndex+1) : negBottom.length), type:'line', borderColor:'transparent', backgroundColor:'rgba(40,150,255,0)', fill:false, pointRadius:0, yAxisID:'y2', order:0 });
        }
      // 叠加快照数据集（只显示 stock 路径）
      if(overlaySelect){ const checks = overlaySelect.querySelectorAll('input[type=checkbox]:checked'); checks.forEach(ch=>{ const idx=Number(ch.dataset.index); const snap=snapshots[idx]; if(!snap) return; const color=paramColor(snap); const snapStock = (snap.result.displayStock||snap.result.stockSeries||[]); baseDatasets.push({ label:'🟢 '+snapshotLabel(snap), data:snapStock, borderColor:color, borderWidth:1.5, pointRadius:0, tension:0.25, fill:false, yAxisID:'y2' }); }); }
      // 峰值与终点标记（当前主 stock）
      if(res){ const pkY=res.peakYear; const finalY=res.years[res.years.length-1]; const markersData = new Array(res.years.length).fill(null); if(pkY>=0) markersData[pkY]=dsStock[pkY]; markersData[finalY]=dsStock[dsStock.length-1]; baseDatasets.push({ label:'Markers', data:markersData, type:'line', borderWidth:0, pointRadius:4, pointBackgroundColor:(ctx2)=>{ const i=ctx2.dataIndex; if(i===pkY) return '#ff5d5d'; if(i===finalY) return '#58ffa1'; return 'transparent'; }, pointBorderColor:'rgba(255,255,255,0.6)', showLine:false, yAxisID:'y2' }); }
        // 当前播放高亮点
        if(playbackActive){ const highlightData = new Array(dsStock.length).fill(null); if(dsStock[playbackIndex]!=null) highlightData[playbackIndex]=dsStock[playbackIndex]; baseDatasets.push({ label:'播放位置', data:highlightData, type:'line', pointRadius:6, pointHoverRadius:6, showLine:false, borderWidth:0, pointBackgroundColor:'#ffffff', pointBorderColor:'#ff9800', pointBorderWidth:2, yAxisID:'y2' }); }
  if(chart){ chart.data.labels = labels; chart.data.datasets = baseDatasets; chart.update('none'); return; }
      chart = new Chart(ctx, {
        type:'line',
        data:{ labels:labels, datasets:baseDatasets },
        options:{
          responsive:true,
          maintainAspectRatio:false,
            interaction:{mode:'nearest',axis:'x',intersect:false},
          scales:{
            y:{ title:{display:true,text:'Inflow (t)' }, beginAtZero:true, min:0, max:(currentYMax||cachedYMax) },
            y2:{ position:'right', grid:{drawOnChartArea:false}, title:{display:true,text:'Stock (t)' }, min:0, max:(currentY2Max||cachedY2Max) }
          },
          plugins:{
            tooltip:{
              callbacks:{
                label:(ctx2)=>{
                  const d=ctx2.dataset;
                  if(d.label && d.label.startsWith('🟢')){
                    return d.label+': '+(ctx2.parsed.y!=null?Math.round(ctx2.parsed.y).toLocaleString():'');
                  }
                  return Chart.defaults.plugins.tooltip.callbacks.label(ctx2);
                }
              }
              },
              animation:{ duration: 380, easing:'easeOutCubic' }
          },
            onClick:(evt, activeEls)=>{ handleCursorClick(evt); },
            onHover:(evt, activeEls)=>{ if(evt.native){ hoverX = evt.chart.scales.x.getValueForPixel(evt.native.clientX - evt.chart.canvas.getBoundingClientRect().left); updateCompareBox(); } }
        }
      }); }

    function update(){ const res = computeSeries(); renderKpis(res); if(window.Chart){ if(fallback) fallback.style.display='none'; buildChart(res); } else { if(fallback) { fallback.style.display='block'; fallback.textContent = 'Chart.js 未加载，Adjusted Inflow: '+Math.round(res.adjustedInflow).toLocaleString(); } } }

    // Publish result to localStorage and notify other pages (dashboard / wall)
    function publishPolicyResult(res){
      try{
        const key = 'ocean_platform_policy_sim_v1';
        const payload = {
          timestamp: Date.now(),
          params: {
            baseInflow: Number(baseInflow?.value)||0,
            reduction: Number(reduction?.value)||0,
            calming: Number(calming?.value)||0,
            years: Number(years?.value)||0,
            autoRefresh: Number(autoRefresh?.value)||0
          },
          result: res
        };
        localStorage.setItem(key, JSON.stringify(payload));
        try{ window.dispatchEvent(new CustomEvent('policy-sim:updated',{detail:{key,key,payload:payload}})); }catch(e){ console.warn('[PolicySim] dispatch failed',e); }
      }catch(e){ console.warn('[PolicySim] publish failed', e); }
    }

    // expose for debug
    window.policySimPublish = publishPolicyResult;

    // wrap update to also publish
    const _origUpdate = update;
    update = function(forceFull=false){
      const res = computeSeries();
      // call original behavior (render + chart)
      renderKpis(res);
      lastComputed = res;
      if(playbackActive && !forceFull){ buildChart(res); }
      else if(window.Chart){ if(fallback) fallback.style.display='none'; buildChart(res); } else { if(fallback) { fallback.style.display='block'; fallback.textContent = 'Chart.js 未加载，Adjusted Inflow: '+Math.round(res.adjustedInflow).toLocaleString(); } }
      // publish for external listeners
      publishPolicyResult(res);
    };

    // UI bindings (guard for file modes where elements may be missing)
  // 输入实时联动（带轻量防抖）
  let debounceTimer=null; const trigger=()=>{ clearTimeout(debounceTimer); debounceTimer=setTimeout(()=>update(),140); };
  function stopPlaybackIfActive(){ if(playbackActive){ playbackActive=false; clearTimeout(playbackTimer); if(playToggle) playToggle.textContent='▶ 播放'; playbackIndex=0; updateYearInfo(); } }
  function reactiveTrigger(){ // 参数变化：清空缓存并重新锁定
    axisDirty=true; cachedYMax=null; cachedY2Max=null; if(chkContinuePlay && chkContinuePlay.checked){ trigger(); return; } stopPlaybackIfActive(); trigger(); }
  if(reduction){ reduction.oninput = ()=>{ if(reductionVal) reductionVal.textContent = reduction.value+'%'; reactiveTrigger(); }; reduction.onchange = reactiveTrigger; }
  if(calming){ calming.oninput = ()=>{ if(calmingVal) calmingVal.textContent = Number(calming.value).toFixed(2); reactiveTrigger(); }; calming.onchange = reactiveTrigger; }
  if(baseInflow){ baseInflow.oninput = reactiveTrigger; baseInflow.onchange = reactiveTrigger; }
  if(years){ years.oninput = reactiveTrigger; years.onchange = reactiveTrigger; }
  if(autoRefresh){ autoRefresh.onchange = reactiveTrigger; }
  if(advRemoval){ advRemoval.oninput = ()=>{ if(advRemovalVal) advRemovalVal.textContent=advRemoval.value+'%'; reactiveTrigger(); }; advRemoval.onchange = reactiveTrigger; }
  if(advBoost){ advBoost.oninput = ()=>{ if(advBoostVal) advBoostVal.textContent=advBoost.value+'%'; reactiveTrigger(); }; advBoost.onchange = reactiveTrigger; }
  if(applyBtn) applyBtn.onclick = ()=>update();
    if(resetBtn) resetBtn.onclick = ()=>{ if(baseInflow) baseInflow.value=8200000; if(reduction) reduction.value=10; if(reductionVal) reductionVal.textContent='10%'; if(calming) calming.value=0.8; if(calmingVal) calmingVal.textContent='0.80'; if(autoRefresh) autoRefresh.value=1; if(years) years.value=25; update(); };
  if(exportBtn) exportBtn.onclick = ()=>{ const res = lastComputed||computeSeries(); const rows=[['year','inflow','stock']]; for(let i=0;i<res.years.length;i++){ rows.push([res.years[i], res.inflows[i-1]||'', res.stockSeries[i]]); } const meta=[`baseInflow=${baseInflow?.value}`,`reduction=${reduction?.value}`,`calming=${calming?.value}`,`autoRefresh=${autoRefresh?.value}`,`years=${years?.value}`,`removal=${advRemoval?.value||'2'}`,`boost=${advBoost?.value||'0'}`].join(';'); rows.unshift(['# meta', meta, '', '']); const csv = rows.map(r=>r.join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='policy_sim.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); };
  if(exportPNG) exportPNG.onclick = ()=>{ try{ const canvas=document.getElementById('policyChart'); const url=canvas.toDataURL('image/png'); const a=document.createElement('a'); a.href=url; a.download='policy_chart.png'; a.click(); }catch(e){ alert('导出失败:'+e); } };

  function updateYearInfo(){ if(!playYearInfo){ return; } const res=lastComputed; if(!res){ playYearInfo.textContent='Year: 0 / 0'; return; } const total=res.years.length-1; const cur = Math.min(playbackIndex, total); playYearInfo.textContent='Year: '+cur+' / '+total; }
  function togglePlayback(){ if(!lastComputed) lastComputed=computeSeries(); playbackActive=!playbackActive; if(playbackActive){ inflowBuffer=null; stockBuffer=null; initPlaybackBuffers(lastComputed); playbackIndex=0; updateYearInfo(); if(playToggle) playToggle.textContent='⏸ 暂停'; buildChart(lastComputed); stepPlayback(); } else { if(playToggle) playToggle.textContent='▶ 播放'; clearTimeout(playbackTimer); inflowBuffer=null; stockBuffer=null; update(true); updateYearInfo(); } }
  function stepPlayback(){ if(!playbackActive) return; const res=lastComputed||computeSeries(); if(!inflowBuffer||!stockBuffer) initPlaybackBuffers(res); playbackIndex++; if(playbackIndex>=res.years.length){ playbackActive=false; if(playToggle) playToggle.textContent='▶ 播放'; inflowBuffer=null; stockBuffer=null; update(true); updateYearInfo(); return; }
    // 写入当前帧值（inflows 对应年份 index-1）
    if(playbackIndex-1>=0 && playbackIndex-1<inflowBuffer.length){ inflowBuffer[playbackIndex-1]=res.inflows[playbackIndex-1]; }
    if(playbackIndex<stockBuffer.length){ stockBuffer[playbackIndex]=res.displayStock[playbackIndex]; }
    buildChart(res); updateYearInfo(); const speed = playSpeed?.value||'normal';
    const progress = playbackIndex / res.years.length; let baseDelay = speed==='slow'?820 : speed==='normal'?420 : speed==='fast'?210 : 70; if(progress<0.25) baseDelay*=0.55; else if(progress>0.85) baseDelay*=1.5; playbackTimer=setTimeout(stepPlayback, baseDelay); }
  if(playToggle) playToggle.onclick=togglePlayback;

  if(toggleAdvanced) toggleAdvanced.onclick = ()=>{ if(!advancedPanel) return; const open = advancedPanel.style.display!=='none'; advancedPanel.style.display=open?'none':'block'; toggleAdvanced.textContent=open?'高级参数 ▼':'高级参数 ▲'; };

  function saveSnapshot(){ const res=lastComputed||computeSeries(); const name = 'S'+(snapshots.length+1)+'('+ (reduction?.value||'0') +'%)'; snapshots.push({ name, params:{ base:baseInflow?.value, red:reduction?.value, calm:calming?.value, auto:autoRefresh?.value, yrs:years?.value, rem:advRemoval?.value, boost:advBoost?.value, smooth:stockSmoothingSel?.value }, playback:{ idx: playbackIndex }, result: res }); persistSnaps(); renderSnapshots(); }
  function loadSnapshot(i){ const s=snapshots[i]; if(!s) return; if(baseInflow) baseInflow.value=s.params.base; if(reduction){ reduction.value=s.params.red; reductionVal.textContent=s.params.red+'%'; } if(calming){ calming.value=s.params.calm; calmingVal.textContent=Number(s.params.calm).toFixed(2);} if(autoRefresh) autoRefresh.value=s.params.auto; if(years) years.value=s.params.yrs; if(advRemoval){ advRemoval.value=s.params.rem; advRemovalVal.textContent=s.params.rem+'%'; } if(advBoost){ advBoost.value=s.params.boost; advBoostVal.textContent=s.params.boost+'%'; } if(stockSmoothingSel && s.params.smooth){ stockSmoothingSel.value=s.params.smooth; } axisDirty=true; update(true); if(chkResumeOnLoad && chkResumeOnLoad.checked){ playbackIndex = s.playback?.idx? Math.min(s.playback.idx, (lastComputed?.years.length||1)-1):0; playbackActive=true; if(playToggle) playToggle.textContent='⏸ 暂停'; stepPlayback(); } }
  if(saveSnapshotBtn) saveSnapshotBtn.onclick=()=>saveSnapshot();
  if(clearSnapshotsBtn) clearSnapshotsBtn.onclick=()=>{ snapshots=[]; persistSnaps(); renderSnapshots(); };

    // init when Chart.js ready or immediately show fallback
  document.addEventListener('chart-ready', ()=>{ setTimeout(()=>{ update(true); updateYearInfo(); },120); });
  window.addEventListener('load', ()=>{ setTimeout(()=>{ update(true); updateYearInfo(); },200); });
  window.addEventListener('resize', ()=>{ if(chart){ chart.resize(); } });

  // 主题切换（亮/暗）
  (function themeToggleInit(){
    const btn = document.getElementById('themeToggle');
    if(!btn) return;
    const KEY='policy_sim_theme';
    function syncButton(){ const isLight = document.body.classList.contains('theme-light'); btn.textContent = isLight ? '🌘 暗色' : '🌗 亮色'; }
    try{ const saved = localStorage.getItem(KEY); if(saved==='light'){ document.body.classList.add('theme-light'); } }catch(e){}
    syncButton();
    btn.addEventListener('click', ()=>{ const light = document.body.classList.toggle('theme-light'); try{ localStorage.setItem(KEY, light?'light':'dark'); }catch(e){} syncButton(); });
  })();

  // 平滑方式修改立即生效并持久化 smoothing persistence
  (function smoothingPersist(){ if(!stockSmoothingSel) return; const KEY='policy_sim_smoothing'; try{ const saved=localStorage.getItem(KEY); if(saved){ stockSmoothingSel.value=saved; } }catch(e){} stockSmoothingSel.addEventListener('change', ()=>{ try{ localStorage.setItem(KEY, stockSmoothingSel.value); }catch(e){} update(true); }); })();

  // 双光标对比逻辑 Dual cursor compare
  let cursorA=null, cursorB=null; let hoverX=null; const compareBox=document.getElementById('compareBox'); const compareContent=document.getElementById('compareContent');
  function handleCursorClick(evt){ if(!lastComputed) return; const chartInstance = chart; if(!chartInstance) return; const rect = chartInstance.canvas.getBoundingClientRect(); const xPixel = evt.native ? (evt.native.clientX - rect.left) : evt.x; const scale = chartInstance.scales.x; const idx = Math.round(scale.getValueForPixel(xPixel)); if(idx<0||idx>= (lastComputed.years.length)) return; // 双击清除
    if(evt.native && evt.native.detail===2){ cursorA=null; cursorB=null; updateCompareBox(); return; }
    if(cursorA==null){ cursorA=idx; }
    else if(cursorB==null){ cursorB=idx; }
    else { cursorA=idx; cursorB=null; }
    updateCompareBox(); }
  function valueAt(ds, i){ return i>=0 && i<ds.length ? ds[i]: null; }
  function updateCompareBox(){ if(!compareBox || !compareContent || !lastComputed) return; const main = lastComputed.displayStock || lastComputed.stockSeries; const len = main.length; let aTxt='—', bTxt='—', delta='—'; if(cursorA!=null && cursorA<len){ aTxt=cursorA+':'+Math.round(valueAt(main,cursorA)).toLocaleString(); } if(cursorB!=null && cursorB<len){ bTxt=cursorB+':'+Math.round(valueAt(main,cursorB)).toLocaleString(); } if(cursorA!=null && cursorB!=null){ const vA=valueAt(main,cursorA); const vB=valueAt(main,cursorB); if(vA!=null&&vB!=null){ const diff=vB-vA; const pct = vA!==0? (diff/vA*100):0; delta = (diff>0?'+':'')+Math.round(diff).toLocaleString()+' ('+(pct>0?'+':'')+pct.toFixed(1)+'%)'; } }
    compareContent.textContent = 'A:'+aTxt+'  B:'+bTxt+'  Δ:'+delta; }
  // 在 chart update 之后保持对比框刷新
  const _oldBuild = buildChart; buildChart = function(res){ _oldBuild.call(this,res); updateCompareBox(); computeDeltaRanking(); };
  function lerp(a,b,t){ if(a==null) return b; return a + (b-a)*t; }

  // 轴模式按钮
  (function axisModeInit(){ const btn=document.getElementById('axisModeBtn'); if(!btn) return; function sync(){ btn.textContent = '轴:'+(axisMode==='lock'?'锁定':'自适'); }
    btn.addEventListener('click',()=>{ axisMode = axisMode==='lock'?'adaptive':'lock'; try{ localStorage.setItem(AXIS_MODE_KEY, axisMode); }catch(e){} axisDirty=true; cachedYMax=null; cachedY2Max=null; sync(); update(true); }); sync(); })();
  // 快照差异排名 (Final / Peak) 只针对勾选的 overlay 快照
  function computeDeltaRanking(){ const listEl=document.getElementById('deltaRankingList'); if(!listEl){ return; } listEl.innerHTML=''; if(!lastComputed){ listEl.innerHTML='<div style="opacity:.5;">(暂无)</div>'; return; } if(!overlaySelect){ listEl.innerHTML='<div style="opacity:.5;">(无选择)</div>'; return; } const checks=overlaySelect.querySelectorAll('input[type=checkbox]:checked'); if(!checks.length){ listEl.innerHTML='<div style="opacity:.45;">(未勾选)</div>'; return; } const main= lastComputed; const mainFinal = main.finalStock; const mainPeakVal = main.stockSeries[main.peakYear]; const rows=[]; checks.forEach(ch=>{ const idx=Number(ch.dataset.index); const snap=snapshots[idx]; if(!snap) return; const r=snap.result; if(!r) return; const finalDiff=r.finalStock - mainFinal; const peakVal=r.stockSeries[r.peakYear]; const peakDiff = peakVal - mainPeakVal; rows.push({ name:snapshotLabel(snap), finalDiff, peakDiff }); }); rows.sort((a,b)=> Math.abs(b.finalDiff)-Math.abs(a.finalDiff)); rows.forEach(r=>{ const div=document.createElement('div'); const f = (r.finalDiff>0?'+':'')+Math.round(r.finalDiff).toLocaleString(); const p=(r.peakDiff>0?'+':'')+Math.round(r.peakDiff).toLocaleString(); div.style.cssText='display:flex;gap:4px;justify-content:space-between;'; div.innerHTML=`<span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${r.name}</span><span style="color:${r.finalDiff>0?'#ffb347':'#7dd774'};">F ${f}</span><span style="color:${r.peakDiff>0?'#ffb347':'#7dd774'};">P ${p}</span>`; listEl.appendChild(div); }); }
  // 监听键盘 ESC 清除
  window.addEventListener('keydown', e=>{ if(e.key==='Escape'){ cursorA=null; cursorB=null; updateCompareBox(); }});

  })();

})();
