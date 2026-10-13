// 主要交互功能

// 面板动画效果
function animatePanel(panel, evt) {
    if (!panel) return;
    panel.classList.add('panel-animate');
    const e = evt || window.event; // 兼容性
    // 添加点击涟漪效果
    const ripple = document.createElement('div');
    ripple.classList.add('ripple');
    try {
        const rect = panel.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = (e?.clientX || rect.width/2) - rect.left - size / 2;
        const y = (e?.clientY || rect.height/2) - rect.top - size / 2;
        ripple.style.cssText = `position:absolute;width:${size}px;height:${size}px;left:${x}px;top:${y}px;background:rgba(255,255,255,0.12);border-radius:50%;transform:scale(0);animation:ripple 0.6s linear;pointer-events:none;z-index:10;`;
    } catch(err) {
        ripple.style.cssText = 'position:absolute;inset:0;background:rgba(255,255,255,0.08);opacity:0;';
    }
    panel.style.position = 'relative';
    panel.appendChild(ripple);
    setTimeout(() => {
        panel.classList.remove('panel-animate');
        ripple.remove?.();
    }, 650);
    // 触发相关图表动画
    const chartId = panel.querySelector('canvas')?.id;
    if (chartId && window.chartManager?.animateChart) {
        const chartName = chartId.replace('-chart', '');
        try { window.chartManager.animateChart(chartName); } catch(_) {}
    }
}

// 导航到演示页面
function navigateToDemo() {
    console.log('🔗 打开海洋塑料漂流模拟...');
    
    // 直接打开漂流模拟页面，无需检查文件是否存在
    try {
        console.log('✅ 打开本地漂流模拟页面: drift_simulation.html');
        // 使用相对路径打开文件
        window.open('./drift_simulation.html', '_blank');
    } catch(error) {
        console.error('❌ 打开漂流模拟页面失败:', error);
        alert('无法打开漂流模拟页面，请确保 drift_simulation.html 文件存在于项目根目录');
    }
}

// 导航到Streamlit应用
async function navigateToStreamlit() {
    console.log('🔗 打开Streamlit海洋数据分析平台...');
    
    // 常见的Streamlit端口（包括备用端口）
    const streamlitPorts = [8526, 8527, 8501, 8502, 8503, 8504, 8505];
    
    // 尝试连接所有可能的Streamlit端口
    await tryStreamlitPorts(streamlitPorts);
}

// 尝试连接到可用的Streamlit端口
async function tryStreamlitPorts(ports) {
    console.log(`🔍 开始检测 ${ports.length} 个端口...`);
    let successfulPort = null;
    
    for (const port of ports) {
        const url = `http://localhost:${port}`;
        console.log(`🔗 尝试连接端口 ${port}...`);
        
        try {
            // 创建一个测试图片来检查端口
            const testUrl = `${url}/favicon.ico`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            
            const response = await fetch(testUrl, { 
                method: 'GET',
                signal: controller.signal,
                mode: 'no-cors'
            });
            
            clearTimeout(timeoutId);
            console.log(`✅ 端口 ${port} 响应成功`);
            
            // 如果成功，直接打开页面
            successfulPort = port;
            window.open(url, '_blank');
            console.log(`🚀 成功跳转到 ${url}`);
            return;
            
        } catch (error) {
            console.log(`❌ 端口 ${port} 连接失败:`, error.message);
            // 继续尝试下一个端口
            continue;
        }
    }
    
    if (!successfulPort) {
        console.log('⚠️ 所有端口都不可用，显示手动选择对话框');
        // 所有端口都不可用，提供手动选择
        showPortSelectionDialog(ports);
    }
}

// 显示端口选择对话框
function showPortSelectionDialog(ports) {
    const modal = document.createElement('div');
    modal.className = 'port-selection-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>选择Streamlit应用端口</h3>
            <p>请选择您的海洋漂流模拟应用运行的端口：</p>
            <div class="port-buttons">
                ${ports.map(port => `
                    <button class="port-btn" onclick="openStreamlitPort(${port})">
                        http://localhost:${port}
                    </button>
                `).join('')}
            </div>
            <button class="close-btn" onclick="closePortModal()">取消</button>
        </div>
        <div class="modal-overlay" onclick="closePortModal()"></div>
    `;
    
    // 添加模态框样式
    const style = document.createElement('style');
    style.textContent = `
        .port-selection-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .modal-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(5px);
        }
        
        .modal-content {
            position: relative;
            background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
            border: 1px solid rgba(168, 218, 220, 0.3);
            border-radius: 15px;
            padding: 30px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }
        
        .modal-content h3 {
            color: #a8dadc;
            margin-bottom: 15px;
            font-size: 1.4rem;
        }
        
        .modal-content p {
            color: #ffffff;
            margin-bottom: 20px;
            opacity: 0.9;
        }
        
        .port-buttons {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .port-btn {
            background: linear-gradient(135deg, #457b9d 0%, #1d3557 100%);
            border: 1px solid rgba(168, 218, 220, 0.3);
            color: #ffffff;
            padding: 12px 20px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-family: 'Roboto', sans-serif;
        }
        
        .port-btn:hover {
            background: linear-gradient(135deg, #5a91b5 0%, #2d4a6b 100%);
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }
        
        .close-btn {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #ffffff;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .close-btn:hover {
            background: rgba(255, 255, 255, 0.2);
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    // 添加全局函数供按钮调用
    window.openStreamlitPort = function(port) {
        window.open(`http://localhost:${port}`, '_blank');
        closePortModal();
    };
    
    window.closePortModal = function() {
        document.body.removeChild(modal);
        document.head.removeChild(style);
        delete window.openStreamlitPort;
        delete window.closePortModal;
    };
}

// 添加涟漪动画CSS
const style = document.createElement('style');
style.textContent = `
@keyframes ripple { to { transform: scale(4); opacity:0; } }
.concept-link{ position:relative; overflow:hidden; }
.concept-link::before{ content:''; position:absolute; top:0; left:-100%; width:100%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent); transition:left .5s; }
.concept-link:hover::before{ left:100%; }
`;
document.head.appendChild(style);

// 全局变量（若其它脚本已定义则不重复覆盖）
// Globe feature removed (UI & 3D rendering). Keep placeholder to avoid reference errors.
if (!window.globe3D) { window.globe3D = null; }
// Provide safe no-op stubs early (will be reaffirmed later)
window.toggleRotation = () => false;
window.resetGlobe = () => {};
window.setGlobeSize = () => {};

// 全局弹窗清理函数
window.clearAllPopups = function() {
    const unwantedSelectors = [
        '.simulation-result-card', '.result-modal', '.result-popup', '.modal', '.data-modal', '.chart-modal', '.results-container',
        '[class*="result"]', '[class*="popup"]', '[class*="modal"]', '[id*="immersive"]', '[class*="immersive"]', 
        '[id*="translate"]', '[class*="translate"]', '.tippy-box', '.tooltip', '.popover',
        '[style*="position: fixed"]', '[style*="z-index: 999"]', '[style*="z-index: 9999"]'
    ];
    
    unwantedSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (el && el.parentNode && !el.closest('.app-container, .main-content, .huarong-puzzle-container, .globe-section')) {
                    console.log('�️ 移除不需要的弹窗元素:', el.className || el.id || selector);
                    el.remove();
                }
            });
        } catch (e) {
            console.warn('清理弹窗时出错:', e);
        }
    });
    
    // 特殊处理翻译相关弹窗
    const translatePopups = document.querySelectorAll('div[style*="position: fixed"]');
    translatePopups.forEach(el => {
        if (el.textContent && (el.textContent.includes('翻译') || el.textContent.includes('translate'))) {
            console.log('🗑️ 移除翻译相关弹窗');
            el.remove();
        }
    });
};

// 页面加载完成后的初始化
window.addEventListener('load', () => {
    // 添加页面加载动画
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.8s ease';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
    
    // 清理任何已存在的弹窗
    setTimeout(() => {
        window.clearAllPopups();
    }, 500);
    
    console.log('🌍 Globe 功能已移除，跳过 3D 地球初始化');
    
    // 初始化工具提示
    initTooltips();
    
    // 自动开始地球动画
    setTimeout(() => {
        if (globe3D) {
            globe3D.toggleAnimation();
        }
    }, 2000);
    
    console.log('海洋塑料污染数据可视化平台已加载完成');
});

// (删除重复旧版自动刷新逻辑，统一使用下方带倒计时实现)
// 兼容：旧接口留空
window.runUnifiedSimulation = function(){ console.log('[runUnifiedSimulation] 已废弃，使用自动刷新'); };

// 自动刷新逻辑（15s，带倒计时）
(function(){
    const REFRESH_INTERVAL=15000; // ms
    let refreshing=false;
    let nextTs=Date.now()+REFRESH_INTERVAL;
    const statusEl=document.getElementById('auto-refresh-status');

    async function doRefresh(){
        if(refreshing) return; refreshing=true;
        try{
            if(statusEl) statusEl.textContent='自动刷新中...';
            if(window.chartManager){
                await Promise.all([
                    window.chartManager.createRubbishChart(true),
                    window.chartManager.createOceanCurrentChart(true),
                    window.chartManager.createTrendChart(),
                    window.chartManager.createSpeciesImpactChart(),
                    window.chartManager.createWaterQualityChart(),
                    window.chartManager.createMarineBioLossChart()
                ]);
            }
        }catch(e){ console.warn('[AutoRefresh] 失败',e); }
        finally{ nextTs=Date.now()+REFRESH_INTERVAL; refreshing=false; }
    }

    // 倒计时显示（每秒）
    setInterval(()=>{
        const remain=nextTs-Date.now();
        if(!statusEl) return;
        if(refreshing){ statusEl.textContent='自动刷新中...'; return; }
        if(remain<=0){ statusEl.textContent='即将刷新...'; doRefresh(); return; }
        const sec=Math.ceil(remain/1000);
        statusEl.textContent=`下次刷新: ${sec}s`;    
    },1000);

    // 首次立即触发一次刷新，随后循环
    doRefresh();
})();
// 工具提示初始化
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
    });
}

function showTooltip(event) {
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    tooltip.textContent = event.target.getAttribute('data-tooltip');
    
    tooltip.style.cssText = `
        position: absolute;
        background: rgba(22, 33, 62, 0.95);
        color: #ffffff;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 400;
        white-space: nowrap;
        z-index: 1000;
        pointer-events: none;
        border: 1px solid rgba(168, 218, 220, 0.3);
        backdrop-filter: blur(10px);
    `;
    
    document.body.appendChild(tooltip);
    
    const updatePosition = (e) => {
        tooltip.style.left = (e.clientX + 10) + 'px';
        tooltip.style.top = (e.clientY - tooltip.offsetHeight - 10) + 'px';
    };
    
    updatePosition(event);
    event.target.addEventListener('mousemove', updatePosition);
    event.target.tooltip = tooltip;
}

function hideTooltip(event) {
    if (event.target.tooltip) {
        document.body.removeChild(event.target.tooltip);
        delete event.target.tooltip;
    }
}

// 性能监控
function trackPerformance() {
    if ('performance' in window) {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        console.log(`页面加载时间: ${loadTime}ms`);
        
        // 如果有分析工具，可以在这里发送性能数据
    }
}

// 错误处理
window.addEventListener('error', (event) => {
    console.error('页面错误:', event.error);
    // 这里可以添加错误报告逻辑
});

// 移动设备适配
if ('ontouchstart' in window) {
    // 为触摸设备添加特殊处理
    document.body.classList.add('touch-device');
    
    // 防止双击缩放
    document.addEventListener('touchstart', (event) => {
        if (event.touches.length > 1) {
            event.preventDefault();
        }
    });
    
    // 触摸设备上的面板交互优化
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => {
        panel.addEventListener('touchstart', () => {
            panel.style.transform = 'scale(0.98)';
        });
        
        panel.addEventListener('touchend', () => {
            panel.style.transform = 'scale(1)';
        });
    });
}

// ===== 保留功能完整的地球控制（避免被后面回退代码覆盖） =====
// ---- 地球就绪队列 ----
window.__globeReadyCallbacks = window.__globeReadyCallbacks || [];
function onGlobeReady(cb){
    if(window.globe3D){ cb(window.globe3D); } else { window.__globeReadyCallbacks.push(cb); }
}
// globe.js 创建后在 window.globe3D 赋值后追加: window.__globeReadyCallbacks?.forEach(fn=>{try{fn(window.globe3D)}catch(e){console.warn(e)}}); window.__globeReadyCallbacks=[];

// Legacy globe functions replaced with no-ops
function toggleAnimation() { return false; }
function resetView() { return false; }



// 页面卸载时的清理
window.addEventListener('beforeunload', () => { trackPerformance(); });

// 数据模拟功能
async function runRubbishSimulation() {
    console.log('🚀 开始运行海洋垃圾产量模拟...');
    
    // 添加视觉反馈
    const button = document.querySelector('button[onclick="runRubbishSimulation()"]');
    if (button) {
        button.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
        button.innerHTML = '⏳ 运行中...';
        button.disabled = true;
    }
    
    const statusElement = document.getElementById('simulation-status');
    const statusText = statusElement?.querySelector('.status-text');
    
    try {
        // 更新状态为运行中
        if (statusText) {
            statusText.textContent = '正在运行海洋垃圾产量模拟...';
            statusText.className = 'status-text status-running';
        }
        
        // 模拟执行时间
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 生成模拟的海洋垃圾数据
        const rubbishData = generateRubbishSimulationData();
        console.log('📊 海洋垃圾数据已生成:', rubbishData);
        
        if (statusText) {
            statusText.textContent = '海洋垃圾产量模拟完成！';
            statusText.className = 'status-text status-success';
        }
        
        // 更新图表数据（不显示额外结果卡片）
        console.log('🔄 开始更新图表数据...');
        await updateChartWithSimulationData('rubbish', rubbishData);
        
        // 使用全局清理函数清除所有弹窗
        window.clearAllPopups();
        
        // 延迟清理多次，确保彻底清除
        setTimeout(() => window.clearAllPopups(), 100);
        setTimeout(() => window.clearAllPopups(), 500);
        setTimeout(() => window.clearAllPopups(), 1500);
        setTimeout(() => window.clearAllPopups(), 3000);
        
        // 5秒后恢复原状态
        setTimeout(() => {
            if (statusText) {
                statusText.textContent = '准备就绪';
                statusText.className = 'status-text';
            }
            
            // 恢复按钮状态
            if (button) {
                button.style.background = '';
                button.innerHTML = '🏭 海洋垃圾产量模拟';
                button.disabled = false;
            }
        }, 5000);
        
    } catch (error) {
        console.error('❌ 海洋垃圾模拟失败:', error);
        statusText.textContent = '模拟执行失败，请检查控制台';
        statusText.className = 'status-text status-error';
        
        // 3秒后恢复原状态
        setTimeout(() => {
            statusText.textContent = '准备就绪';
            statusText.className = 'status-text';
        }, 3000);
    }
}

async function runOceanCurrentSimulation() {
    console.log('🌊 开始运行海洋环流数据模拟...');
    
    // 添加视觉反馈
    const button = document.querySelector('button[onclick="runOceanCurrentSimulation()"]');
    if (button) {
        button.style.background = 'linear-gradient(135deg, #06b6d4, #0891b2)';
        button.innerHTML = '⏳ 运行中...';
        button.disabled = true;
    }
    
    const statusElement = document.getElementById('simulation-status');
    const statusText = statusElement?.querySelector('.status-text');
    
    try {
        // 更新状态为运行中
        if (statusText) {
            statusText.textContent = '正在运行海洋环流数据模拟...';
            statusText.className = 'status-text status-running';
        }
        
        // 模拟执行时间
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        // 生成模拟的海洋环流数据
        const oceanData = generateOceanCurrentSimulationData();
        console.log('🌊 海洋环流数据已生成:', oceanData);
        
        if (statusText) {
            statusText.textContent = '海洋环流数据模拟完成！';
            statusText.className = 'status-text status-success';
        }
        
        // 更新图表数据（不显示额外结果卡片）
        console.log('🔄 开始更新图表数据...');
        await updateChartWithSimulationData('ocean_current', oceanData);
        
        // 使用全局清理函数
        window.clearAllPopups();
        
        // 延迟清理多次，确保彻底清除
        setTimeout(() => window.clearAllPopups(), 100);
        setTimeout(() => window.clearAllPopups(), 500);
        setTimeout(() => window.clearAllPopups(), 1500);
        setTimeout(() => window.clearAllPopups(), 3000);
        
        // 5秒后恢复原状态
        setTimeout(() => {
            if (statusText) {
                statusText.textContent = '准备就绪';
                statusText.className = 'status-text';
            }
            
            // 恢复按钮状态
            if (button) {
                button.style.background = '';
                button.innerHTML = '🌊 海洋环流数据模拟';
                button.disabled = false;
            }
        }, 5000);
        
    } catch (error) {
        console.error('❌ 海洋环流模拟失败:', error);
        if (statusText) {
            statusText.textContent = '模拟执行失败，请检查控制台';
        }
        statusText.className = 'status-text status-error';
        
        // 3秒后恢复原状态
        setTimeout(() => {
            statusText.textContent = '准备就绪';
            statusText.className = 'status-text';
        }, 3000);
    }
}

// (已移除的模拟数据生成函数位置占位)

// 更新图表数据的辅助函数
async function updateChartWithSimulationData(simulationType, data) {
    console.log(`📈 准备更新 ${simulationType} 图表...`);
    console.log('🔍 window.chartManager 状态:', window.chartManager);
    console.log('🔍 数据内容:', data);
    
    // 强制初始化图表管理器（如果尚未初始化）
    if (!window.chartManager) {
        console.log('🔧 强制初始化图表管理器...');
        try {
            if (typeof ChartManager !== 'undefined') {
                window.chartManager = new ChartManager();
                // 等待初始化完成
                await window.chartManager.createCharts();
                console.log('✅ 图表管理器强制初始化完成');
            } else {
                console.error('❌ ChartManager类未找到');
                return; // 如果没有ChartManager，直接返回
            }
        } catch (error) {
            console.error('❌ 强制初始化图表管理器失败:', error);
            return; // 如果初始化失败，直接返回
        }
    }
    
    if (window.chartManager) {
        try {
            console.log('🎯 开始更新图表数据...');
            
            if (simulationType === 'rubbish') {
                console.log('📊 创建海洋垃圾数据图表...');
                console.log('🔍 调用 chartManager.createRubbishChart');
                await window.chartManager.createRubbishChart(data);
                console.log('✅ 海洋垃圾图表创建完成');
            } else if (simulationType === 'ocean_current') {
                console.log('🌊 创建海洋环流数据图表...');
                console.log('🔍 调用 chartManager.createOceanCurrentChart');
                await window.chartManager.createOceanCurrentChart(data);
                console.log('✅ 海洋环流图表创建完成');
            }
            
            console.log(`✅ ${simulationType} 图表数据已成功更新`);
            
            // 强制重新渲染图表
            setTimeout(() => {
                console.log('🔄 强制重新渲染所有图表...');
                if (window.Chart) {
                    Object.values(Chart.instances).forEach(chart => {
                        if (chart && chart.update) {
                            chart.update();
                        }
                    });
                }
            }, 100);
            
        } catch (error) {
            console.error(`❌ 更新 ${simulationType} 图表失败:`, error);
            console.error('错误详情:', error.stack);
            console.error('chartManager方法列表:', Object.getOwnPropertyNames(window.chartManager));
        }
    } else {
        console.error('❌ chartManager 仍未初始化');
        console.log('🔍 可用的全局对象:', Object.keys(window).filter(key => key.toLowerCase().includes('chart')));
        
        // 等待一段时间后重试
        setTimeout(async () => {
            if (window.chartManager) {
                console.log('🔄 延迟重试创建图表...');
                await updateChartWithSimulationData(simulationType, data);
            } else {
                console.error('❌ 图表管理器延迟重试仍失败');
            }
        }, 1000);
    }
}

// 测试函数 - 用于验证模拟图表功能
function testSimulationCharts() {
    console.log('🧪 开始测试模拟图表功能...');
    
    // 检查按钮是否存在
    const button1 = document.querySelector('button[onclick="runRubbishSimulation()"]');
    const button2 = document.querySelector('button[onclick="runOceanCurrentSimulation()"]');
    console.log('🔘 垃圾模拟按钮:', button1);
    console.log('🔘 环流模拟按钮:', button2);
    
    // 检查状态显示区域
    const statusElement = document.getElementById('simulation-status');
    console.log('📊 状态显示区域:', statusElement);
    
    // 检查图表管理器
    console.log('🎨 图表管理器:', window.chartManager);
    
    // 直接运行一次垃圾模拟测试
    if (window.chartManager) {
        console.log('🚀 直接测试垃圾图表创建...');
        const testData = generateRubbishSimulationData();
        window.chartManager.createRubbishChart(testData);
    }
}

// (Globe removed) 保留对 setGlobeSize 的引用为稳定的 no-op
window.setGlobeSize = window.setGlobeSize || (()=>{});
// 统一运行所有模拟
async function runAllSimulations() {
    console.log('🚀 开始运行全部数据模拟...');
    const statusElement = document.getElementById('simulation-status');
    const statusText = statusElement.querySelector('.status-text');
    
    try {
        // 更新状态为运行中
        statusText.textContent = '正在运行全部数据模拟...';
        statusText.className = 'status-text status-running';
        
        // 先运行垃圾模拟
        console.log('📊 步骤1: 运行垃圾产量模拟...');
        const rubbishData = generateRubbishSimulationData();
        await updateChartWithSimulationData('rubbish', rubbishData);
        
        // 等待一下再运行洋流模拟
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 运行洋流模拟
        console.log('🌊 步骤2: 运行海洋环流模拟...');
        const oceanData = generateOceanCurrentSimulationData();
        await updateChartWithSimulationData('ocean_current', oceanData);
        
        statusText.textContent = '全部数据模拟完成！';
        statusText.className = 'status-text status-success';
        
        // 5秒后恢复原状态
        setTimeout(() => {
            statusText.textContent = '准备就绪';
            statusText.className = 'status-text';
        }, 5000);
        
    } catch (error) {
        console.error('❌ 数据模拟失败:', error);
        statusText.textContent = '模拟执行失败，请检查控制台';
        statusText.className = 'status-text status-error';
        
        // 3秒后恢复原状态
        setTimeout(() => {
            statusText.textContent = '准备就绪';
            statusText.className = 'status-text';
        }, 3000);
    }
}

// 统一的旋转控制函数（去重保留）
function toggleRotation() { return false; }
function resetGlobe() { /* no-op (globe removed) */ }
function setGlobeSize(size) { /* no-op */ }

// ---- 统一按钮绑定：防止 inline onclick 失效时仍可响应 ----
function bindGlobeButtons() { /* removed with globe */ }
document.addEventListener('DOMContentLoaded', bindGlobeButtons);

// ---- ChartManager 回退 ----
if(!window.ChartManager){
    console.warn('未找到 ChartManager，创建回退管理器');
    window.ChartManager = class {
        constructor(){ this.instances={}; this.initBaseCharts(); }
        initBaseCharts(){
            const baseConfigs = {
                'source': {el:'source-chart', type:'doughnut', data:{labels:['A','B','C'], datasets:[{data:[30,40,30], backgroundColor:['#4dabf7','#1dd3b0','#ffaf40']}]}},
                'trend': {el:'trend-chart', type:'line', data:{labels:['2021','2022','2023','2024','2025'], datasets:[{label:'塑料量', data:[10,20,28,36,40], borderColor:'#4dabf7', tension:.3}]}}
            };
            Object.values(baseConfigs).forEach(cfg=>{ const c=document.getElementById(cfg.el); if(c && window.Chart){this.instances[cfg.el]=new Chart(c,{type:cfg.type,data:cfg.data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});} });
        }
        createRubbishChart(simData){
            const yearly = document.getElementById('rubbish-yearly-chart');
            if(yearly && window.Chart){
                this.instances['rubbish-yearly-chart']?.destroy();
                this.instances['rubbish-yearly-chart']= new Chart(yearly,{type:'bar',data:{labels:simData.yearly_totals.labels, datasets:[{label:'年度垃圾量(吨)', data:simData.yearly_totals.values, backgroundColor:'#4dabf7'}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{ticks:{color:'#fff'},beginAtZero:true},x:{ticks:{color:'#fff'}}}}});
            }
            const city = document.getElementById('rubbish-city-chart');
            if(city && window.Chart){
                this.instances['rubbish-city-chart']?.destroy();
                this.instances['rubbish-city-chart']= new Chart(city,{type:'radar',data:{labels:simData.city_totals.labels,datasets:[{label:'城市垃圾量', data:simData.city_totals.values, backgroundColor:'rgba(77,171,247,0.3)', borderColor:'#4dabf7'}]},options:{plugins:{legend:{display:false}},scales:{r:{grid:{color:'rgba(255,255,255,0.15)'},angleLines:{color:'rgba(255,255,255,0.15)'},pointLabels:{color:'#fff'},ticks:{display:false}}}}});
            }
        }
        createOceanCurrentChart(oData){
            const river = document.getElementById('ocean-river-chart');
            if(river && window.Chart){
                const list = oData.rivers.top_rivers;
                this.instances['ocean-river-chart']?.destroy();
                this.instances['ocean-river-chart']= new Chart(river,{type:'bar',data:{labels:list.map(r=>r.river),datasets:[{label:'排放(吨/年)', data:list.map(r=>r.plastic_tons_per_year), backgroundColor:'#1dd3b0'}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{ticks:{color:'#fff'},beginAtZero:true},x:{ticks:{color:'#fff'}}}}});
            }
            const overview = document.getElementById('ocean-overview-chart');
            if(overview && window.Chart){
                this.instances['ocean-overview-chart']?.destroy();
                this.instances['ocean-overview-chart']= new Chart(overview,{type:'line',data:{labels:['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'],datasets:[{label:'环流强度指数', data:[10,14,18,16,13], borderColor:'#1dd3b0', fill:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{color:'#fff'}},x:{ticks:{color:'#fff'}}}}});
            }
        }
        animateChart(){/* 可扩展动画 */}
        handleResize(){Object.values(this.instances).forEach(ch=>ch.resize());}
        renderChart(){/* 密度图等留空 */}
    }
}
// 若仍未实例化，主动实例化
if(!window.chartManager){ try{ window.chartManager = new ChartManager(); }catch(e){ console.warn('图表回退初始化失败', e);} }

window.toggleAnimation = toggleAnimation; // now no-op
window.resetView = resetView; // now no-op
window.runRubbishSimulation = runRubbishSimulation;
window.runOceanCurrentSimulation = runOceanCurrentSimulation;
window.runAllSimulations = runAllSimulations;
window.testSimulationCharts = testSimulationCharts;
// 生态影响统计图表切换
function toggleEcoChart(element) {
    if (element.classList.contains('clicked')) {
        element.classList.remove('clicked');
        console.log('生态影响统计图表已隐藏');
    } else {
        element.classList.add('clicked');
        console.log('生态影响统计图表已显示');
        
        // 如果图表管理器存在，触发图表渲染
        if (window.chartManager && window.chartManager.renderChart) {
            setTimeout(() => {
                window.chartManager.renderChart('density');
            }, 300);
        }
    }
}

window.toggleRotation = toggleRotation;
window.resetGlobe = resetGlobe; // no-op

// 响应式布局处理
function handleResponsiveLayout() {
    const container = document.querySelector('.huarong-puzzle-container');
    const pieces = document.querySelectorAll('.huarong-piece');
    if (!container) return;
    
    // 获取容器尺寸
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    
    console.log(`🔧 响应式布局调整: ${containerWidth}x${containerHeight}`);
    
    // 更新所有组件的自适应
    pieces.forEach(piece => {
        // 强制重新计算布局
        piece.style.transform = piece.style.transform;
        
        // 确保canvas图表重新适应
        const canvas = piece.querySelector('canvas');
        if (canvas && window.Chart) {
            const chartInstance = window.Chart.getChart(canvas);
            if (chartInstance) {
                setTimeout(() => {
                    chartInstance.resize();
                }, 100);
            }
        }
    });
    
    // (globe removed) skip globe sizing
    
    // 触发图表管理器重新布局
    if (window.chartManager && window.chartManager.handleResize) {
        window.chartManager.handleResize();
    }
}

// 节流函数
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// 监听窗口大小变化
window.addEventListener('resize', throttle(handleResponsiveLayout, 250));

// 页面加载完成后初始化响应式布局（保留原复杂模拟函数，移除重复简化版）

// 删除重复简化版 toggleRotation/resetGlobe（已合并到上方）

window.addEventListener('load', () => {
    setTimeout(handleResponsiveLayout, 500);
});

// 导出响应式布局函数供外部调用
window.handleResponsiveLayout = handleResponsiveLayout;
window.toggleEcoChart = toggleEcoChart;
window.runRubbishSimulation = runRubbishSimulation;
window.runOceanCurrentSimulation = runOceanCurrentSimulation;

// === 贴图切换桥接函数 ===

// 保留一次注册，避免多次覆盖
// (Globe removed) registerGlobeControlsOnce block stripped

    // ===== 地球控件强化绑定（二次保障） =====
    // (Globe removed) reinforceGlobeControls block stripped

    // === 追加：确保暂停后可以恢复旋转 ===
    // (Globe removed) override callback block stripped

// ===== 统一按钮事件委托，确保所有按钮可点击响应 =====
document.addEventListener('click', (e) => {
    const target = e.target.closest('button, .panel');
    if (!target) return;
    if (target.classList.contains('panel')) {
        animatePanel(target, e);
    }
});

// 防止链接按钮被覆盖层阻挡（如果存在意外层）
// 关键概念按钮工作正常，若未来出现层问题可取消注释：
// document.querySelectorAll('.concept-link').forEach(a=>a.style.pointerEvents='auto');

// 结束：主交互脚本已加载
// <-- 文件结束 (移除多余的包裹大括号) -->

// ================= Streamlit 自动探测与跳转增强 =================
// 目的: 统一端口探测 (8501-8510)、按钮状态动态更新、提供失败提示与再次检测入口
// ================= 漂流演示按钮初始化 =================
// 确保按钮显示正确的文本，不依赖Streamlit
;(function initDriftDemoButton(){
    function resetDemoBtn(){
        const btn = document.querySelector('.demo-btn[onclick*="navigateToDemo"]');
        if(!btn) return;
        
        // 重置按钮为原始状态
        btn.innerHTML = '🌊 详细漂流演示<span class="btn-arrow">→</span>';
        btn.removeAttribute('data-state');
        btn.classList.remove('streamlit-loading');
        btn.style.background = '';
        btn.disabled = false;
        
        console.log('✅ 漂流演示按钮已重置为正确文本');
    }

    // 页面就绪后立即重置按钮文本
    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', resetDemoBtn);
    } else {
        resetDemoBtn();
    }
    
    // 延迟再次确保按钮文本正确（防止其他脚本覆盖）
    setTimeout(resetDemoBtn, 100);
    setTimeout(resetDemoBtn, 500);

    // 清理：已移除不再需要的Streamlit相关样式
})();

// ===== 初始尺寸同步保障 =====
// 若初始地球默认逻辑已是 medium，但按钮可能被其它早期脚本标记在 small；
// 这里添加一次性的安全同步：在 DOMContentLoaded 与 globe ready 后都尝试一次。
// (Globe removed) ensureInitialMediumSize block stripped

// ================== Portrait Mode Detection (纵向模式检测) ==================
// 目的：在宽高比 < 1 时统一卡片尺寸（配合 styles.css 中的 portrait-mode 覆盖）
// 可通过给 <body> 添加 class="no-portrait-auto" 禁用该自动切换。
;(function setupPortraitMode(){
    let last=null; let ticking=false;
    let attempts=0; const MAX_ATTEMPTS=8;
    function evaluate(){
        ticking=false;
        if(!document.body){
            if(attempts++ < MAX_ATTEMPTS) return setTimeout(evaluate,80);
            return;
        }
        if(document.body.classList.contains('no-portrait-auto')) return;
        const isPortrait = window.innerHeight > window.innerWidth; // 简单判断
        if(isPortrait!==last){
            document.body.classList.toggle('portrait-mode', isPortrait);
            last=isPortrait;
            if(isPortrait){
                if(!document.body.classList.contains('unify-cards')){
                    document.body.classList.add('unify-cards');
                    console.log('[Portrait] 进入纵向 -> 强制 unify-cards (flex 模式)');
                }
                // 清除旧的区域定位或绝对定位尺寸，防止挤压
                document.querySelectorAll('.panel-grid-8 .huarong-piece').forEach(el=>{
                    el.style.gridArea='';
                    el.style.left='';
                    el.style.top='';
                    el.style.width='';
                    el.style.height='';
                    if(el.style.position==='absolute') el.style.position='';
                });
                // 检测列是否过窄，必要时启用 flex 回退
                setTimeout(()=>{
                    try{
                        const container=document.querySelector('.panel-grid-8');
                        if(!container) return;
                        const pieces=[...container.querySelectorAll('.huarong-piece')];
                        const tooNarrow = pieces.some(p=>p.getBoundingClientRect().width < 140);
                        // 额外判定：如果第一块宽度 < 容器宽度 * 0.25 说明仍被旧 grid-area 影响
                        const first=pieces[0];
                        let ratioOk=true;
                        if(first){
                           const cw=container.getBoundingClientRect().width;
                           const fw=first.getBoundingClientRect().width;
                           ratioOk = fw >= cw*0.25;
                        }
                        if(tooNarrow){
                           document.body.classList.add('portrait-flex-fallback');
                           console.log('[Portrait] 启用 flex 回退模式 (列过窄)');
                        } else if(!ratioOk){
                            document.body.classList.add('portrait-flex-fallback');
                            console.log('[Portrait] 启用 flex 回退模式 (首块比例异常)');
                        } else {
                           document.body.classList.remove('portrait-flex-fallback');
                        }
                    }catch(e){console.warn('Portrait fallback detect failed',e);}
                },90);
            } else {
                document.body.classList.remove('portrait-flex-fallback');
            }
            // 触发一次 resize 让 Chart.js / Globe 重算
            setTimeout(()=>window.dispatchEvent(new Event('resize')),60);
        }
        // 即使未触发状态变化也进行比例自检（防止最初判断失误）
        if(isPortrait){
            setTimeout(()=>{
               try{
                 const container=document.querySelector('.panel-grid-8');
                 if(!container) return;
                 const first=container.querySelector('.huarong-piece');
                 if(first){
                    const cw=container.getBoundingClientRect().width;
                    const fw=first.getBoundingClientRect().width;
                    if(fw < cw*0.25){
                       document.body.classList.add('portrait-flex-fallback');
                       console.log('[Portrait] 后置检查触发 flex 回退');
                    }
                 }
               }catch(e){}
            },220);
        }
    }
    function onResize(){
        if(!ticking){
            ticking=true;
            requestAnimationFrame(evaluate);
        }
    }
    window.addEventListener('resize', onResize, {passive:true});
    window.addEventListener('orientationchange', ()=>{ setTimeout(evaluate,50); }, {passive:true});
    // 多次延迟尝试，防止早期执行未正确判断
    const kickoffTimes=[0,120,400,900];
    kickoffTimes.forEach(t=>setTimeout(()=>evaluate(),t));
    // 提供手动触发工具
    window.__forcePortraitMode = function(force){
        if(typeof force==='boolean'){
            last=!force; // 让 evaluate 感知变化
            if(force){ window.innerWidth = 500; } // 仅用于模拟时；真实环境下无效（浏览器不允许直接改）
        }
        evaluate();
    };
    window.forceUnifiedCards = () => { document.body.classList.add('portrait-mode','portrait-flex-fallback'); console.log('[Portrait] 手动强制统一卡片布局'); };
})();

    // =============== 全局列挤压监视 ===============
    ;(function setupGlobalCardCompressionWatch(){
        const MIN_ACCEPTABLE = 150; // px
        function scan(){
             const container=document.querySelector('.panel-grid-8');
             if(!container) return;
             try {
                 const cw = container.getBoundingClientRect().width;
                 // 新增：小屏（容器宽度 < 760px）直接启用统一 flex 布局，绕过复杂 grid-area，防止“小块挤进大块”现象
                 if(cw && cw < 760){
                     if(!document.body.classList.contains('unify-cards')){
                         document.body.classList.add('unify-cards');
                         console.log('[Unify] 小屏宽度触发统一布局 width='+cw.toFixed(1));
                         setTimeout(()=>window.dispatchEvent(new Event('resize')),40);
                     }
                     return; // 已强制统一，后续宽度差判定无需执行
                 } else if(cw && cw > 820 && document.body.classList.contains('unify-cards')) {
                     // 宽度恢复，允许回退（仅当不是由列压缩逻辑继续需要时）
                     // 先暂时移除，稍后依靠宽度差逻辑决定是否再加
                     document.body.classList.remove('unify-cards');
                     console.log('[Unify] 小屏恢复宽度，尝试回退统一布局 width='+cw.toFixed(1));
                 }
             } catch(e){}
             const pieces=[...container.querySelectorAll('.huarong-piece')];
             if(!pieces.length) return;
             const widths=pieces.map(p=>p.getBoundingClientRect().width).filter(w=>w>0);
             if(!widths.length) return;
             const min=Math.min(...widths);
             const avg=widths.reduce((a,b)=>a+b,0)/widths.length;
             if(min < MIN_ACCEPTABLE && avg > min*2){
                 if(!document.body.classList.contains('unify-cards')){
                     document.body.classList.add('unify-cards');
                     console.log(`[Unify] 触发统一卡片布局 min=${min.toFixed(1)} avg=${avg.toFixed(1)}`);
                     setTimeout(()=>window.dispatchEvent(new Event('resize')),40);
                 }
             } else if(min >= MIN_ACCEPTABLE*1.1 && document.body.classList.contains('unify-cards')){
                 document.body.classList.remove('unify-cards');
                 console.log('[Unify] 取消统一卡片布局');
             }
        }
        let resizeTimer=null; function schedule(){ clearTimeout(resizeTimer); resizeTimer=setTimeout(scan,140); }
        window.addEventListener('resize', schedule, {passive:true});
        document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(scan,120); setTimeout(scan,500); });
        window.scanCardCompression = scan; // 手动触发
        window.forceSmallScreenLayout = ()=>{ document.body.classList.add('unify-cards'); console.log('[Unify] 手动强制小屏统一布局'); setTimeout(()=>window.dispatchEvent(new Event('resize')),30); };
    })();