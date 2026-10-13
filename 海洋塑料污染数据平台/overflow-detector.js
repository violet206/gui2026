// 8组件溢出检测器 - 专门检测piece-7和piece-8的溢出问题
class ComponentOverflowDetector {
    constructor() {
        this.overflowThreshold = 10; // 10px容忍度
        this.checkInterval = 2000; // 2秒检测间隔
        this.isMonitoring = false;
    }
    
    startMonitoring() {
        if (this.isMonitoring) return;
        
        console.log('🔍 开始监控组件溢出...');
        this.isMonitoring = true;
        
        this.checkAllComponents();
        this.monitoringInterval = setInterval(() => {
            this.checkAllComponents();
        }, this.checkInterval);
    }
    
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.isMonitoring = false;
            console.log('⏹️ 停止监控组件溢出');
        }
    }
    
    checkAllComponents() {
        const container = document.querySelector('.container') || document.body;
        const containerRect = container.getBoundingClientRect();
        
        const components = [
            { selector: '.piece-1', name: '海洋污染' },
            { selector: '.piece-2', name: '塑料污染来源统计' },
            { selector: '.piece-3', name: '生态影响统计' },
            { selector: '.piece-4', name: '历史趋势' },
            { selector: '.piece-5', name: '模拟数据分析' },
            { selector: '.piece-6', name: '城市垃圾分布' },
            { selector: '.piece-7', name: '河流排放' },
            { selector: '.piece-8', name: '环流数据概览' }
        ];
        
        let overflowResults = [];
        
        components.forEach(comp => {
            const element = document.querySelector(comp.selector);
            if (element) {
                const result = this.checkComponentOverflow(element, containerRect, comp.name);
                if (result.hasOverflow) {
                    overflowResults.push(result);
                }
            }
        });
        
        // 特别检查piece-7和piece-8
        this.checkCriticalComponents();
        
        if (overflowResults.length > 0) {
            this.reportOverflow(overflowResults);
        }
        
        return overflowResults;
    }
    
    checkComponentOverflow(element, containerRect, componentName) {
        const rect = element.getBoundingClientRect();
        
        const overflows = {
            right: rect.right > (containerRect.right + this.overflowThreshold),
            bottom: rect.bottom > (containerRect.bottom + this.overflowThreshold),
            left: rect.left < (containerRect.left - this.overflowThreshold),
            top: rect.top < (containerRect.top - this.overflowThreshold)
        };
        
        const hasOverflow = Object.values(overflows).some(overflow => overflow);
        
        return {
            componentName: componentName,
            element: element,
            hasOverflow: hasOverflow,
            overflows: overflows,
            rect: {
                width: rect.width,
                height: rect.height,
                left: rect.left - containerRect.left,
                top: rect.top - containerRect.top,
                right: rect.right - containerRect.left,
                bottom: rect.bottom - containerRect.top
            },
            containerSize: {
                width: containerRect.width,
                height: containerRect.height
            }
        };
    }
    
    checkCriticalComponents() {
        const piece7 = document.querySelector('.piece-7');
        const piece8 = document.querySelector('.piece-8');
        
        if (piece7) {
            const status7 = this.analyzeCriticalComponent(piece7, 'piece-7 (河流排放)');
            if (status7.hasIssue) {
                console.warn('🚨 piece-7 问题:', status7);
            }
        }
        
        if (piece8) {
            const status8 = this.analyzeCriticalComponent(piece8, 'piece-8 (环流数据概览)');
            if (status8.hasIssue) {
                console.warn('🚨 piece-8 问题:', status8);
            }
        }
    }
    
    analyzeCriticalComponent(element, name) {
        const rect = element.getBoundingClientRect();
        const container = document.querySelector('.container') || document.body;
        const containerRect = container.getBoundingClientRect();
        
        const issues = [];
        
        // 检查溢出
        if (rect.right > containerRect.right) {
            issues.push(`右侧溢出 ${Math.round(rect.right - containerRect.right)}px`);
        }
        if (rect.bottom > containerRect.bottom) {
            issues.push(`底部溢出 ${Math.round(rect.bottom - containerRect.bottom)}px`);
        }
        if (rect.left < containerRect.left) {
            issues.push(`左侧溢出 ${Math.round(containerRect.left - rect.left)}px`);
        }
        if (rect.top < containerRect.top) {
            issues.push(`顶部溢出 ${Math.round(containerRect.top - rect.top)}px`);
        }
        
        // 检查尺寸
        if (rect.width < 100) {
            issues.push(`宽度过小 ${Math.round(rect.width)}px`);
        }
        if (rect.height < 50) {
            issues.push(`高度过小 ${Math.round(rect.height)}px`);
        }
        
        return {
            name: name,
            hasIssue: issues.length > 0,
            issues: issues,
            dimensions: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                left: Math.round(rect.left - containerRect.left),
                top: Math.round(rect.top - containerRect.top)
            }
        };
    }
    
    reportOverflow(overflowResults) {
        console.group('🚨 检测到组件溢出');
        
        overflowResults.forEach(result => {
            console.warn(`${result.componentName}:`, {
                '溢出方向': Object.keys(result.overflows).filter(dir => result.overflows[dir]),
                '组件尺寸': `${Math.round(result.rect.width)}×${Math.round(result.rect.height)}px`,
                '组件位置': `(${Math.round(result.rect.left)}, ${Math.round(result.rect.top)})`,
                '容器尺寸': `${Math.round(result.containerSize.width)}×${Math.round(result.containerSize.height)}px`
            });
        });
        
        console.groupEnd();
        
        // 显示视觉警告
        this.showOverflowWarning(overflowResults);
    }
    
    showOverflowWarning(overflowResults) {
        // 移除之前的警告
        const existingWarning = document.querySelector('.overflow-warning');
        if (existingWarning) {
            existingWarning.remove();
        }
        
        // 创建新的警告提示
        const warning = document.createElement('div');
        warning.className = 'overflow-warning';
        warning.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(244, 67, 54, 0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            max-width: 300px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        
        const overflowList = overflowResults.map(result => 
            `• ${result.componentName}: ${Object.keys(result.overflows).filter(dir => result.overflows[dir]).join(', ')}`
        ).join('\n');
        
        warning.innerHTML = `
            <strong>⚠️ 组件溢出警告</strong><br>
            检测到 ${overflowResults.length} 个组件溢出:<br>
            <pre>${overflowList}</pre>
        `;
        
        document.body.appendChild(warning);
        
        // 5秒后自动移除
        setTimeout(() => {
            if (warning && warning.parentNode) {
                warning.parentNode.removeChild(warning);
            }
        }, 5000);
    }
    
    // 手动触发单次检测
    checkNow() {
        console.log('🔍 执行手动检测...');
        return this.checkAllComponents();
    }
    
    // 获取详细报告
    getDetailedReport() {
        const results = this.checkAllComponents();
        
        return {
            timestamp: new Date().toISOString(),
            overflowCount: results.length,
            overflows: results,
            screenInfo: {
                width: window.innerWidth,
                height: window.innerHeight,
                ratio: window.innerWidth / window.innerHeight,
                isLandscape: window.innerWidth > window.innerHeight
            }
        };
    }
}

// 全局实例
window.overflowDetector = new ComponentOverflowDetector();

// 自动启动检测
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 组件溢出检测器已加载');
    
    // 等待布局初始化完成
    setTimeout(() => {
        window.overflowDetector.startMonitoring();
    }, 2000);
});

// 窗口大小变化时重新检测
window.addEventListener('resize', () => {
    setTimeout(() => {
        window.overflowDetector.checkNow();
    }, 300);
});

// 导出检测函数供外部调用
window.checkComponentOverflow = () => window.overflowDetector.checkNow();
window.getOverflowReport = () => window.overflowDetector.getDetailedReport();

console.log('✅ 组件溢出检测器脚本已加载完成');