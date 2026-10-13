#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
海洋塑料漂流模拟平台 - 太平洋中心视图
纯本地GeoJSON方案 - 与主页UI风格保持一致
"""

import os, sys, json, subprocess, threading, time
from pathlib import Path
import streamlit as st
import streamlit.components.v1 as components

# 页面配置 - 添加更严格的安全设置
st.set_page_config(
    page_title="🌊 海洋塑料漂流模拟", 
    page_icon="🌊", 
    layout="wide",
    initial_sidebar_state="collapsed"
)

# 禁用Streamlit的一些可能引起问题的功能
if 'STREAMLIT_DISABLE_ANALYTICS' not in os.environ:
    os.environ['STREAMLIT_DISABLE_ANALYTICS'] = 'true'
if 'STREAMLIT_DISABLE_WATCHDOG' not in os.environ:
    os.environ['STREAMLIT_DISABLE_WATCHDOG'] = 'true'

# 会话状态初始化
session_defaults = {
    'sim_proc': None,
    'sim_log': [],
    'sim_progress': 0,
    'sim_done': False,
    'simulation_active': False
}

for key, default in session_defaults.items():
    if key not in st.session_state:
        st.session_state[key] = default

# 文件路径
BASE_DIR = Path(__file__).parent
DATA_GEO = BASE_DIR / 'tracks.geojson'
LIVE_GEO = BASE_DIR / 'tracks_live.geojson'

# 陆地数据路径 - 优先使用高精度版本
HIGH_RES_LAND = BASE_DIR / 'land_mask_east_asia_10m.geojson'
LAND_MASK_GEO = HIGH_RES_LAND if HIGH_RES_LAND.exists() else BASE_DIR / 'land_mask.geojson'

def load_geojson_data(file_path):
    """加载GeoJSON数据"""
    try:
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        st.error(f"加载GeoJSON失败: {e}")
    return None

def create_ocean_simulation():
    # 加载陆地数据
    land_data = load_geojson_data(LAND_MASK_GEO)
    land_data_json = json.dumps(land_data) if land_data else 'null'
    
    # 使用三重引号的普通字符串，避免f-string的花括号问题
    html_template = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>太平洋海洋塑料漂流模拟</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌊</text></svg>">
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'self' https: data:; 
        script-src 'self' 'unsafe-inline' https://unpkg.com; 
        style-src 'self' 'unsafe-inline' https://unpkg.com;
        img-src 'self' https: data:;
        connect-src 'self' https: wss:;
        font-src 'self' https: data:;
    ">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        body { 
            margin: 0; padding: 15px; 
            background: linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #0a0e13 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: white;
        }
        
        .container { display: flex; gap: 15px; height: 85vh; }
        
        .map-panel { 
            flex: 1; 
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            overflow: hidden;
            position: relative;
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        #map { width: 100%; height: 100%; }
        
        .control-panel {
            width: 280px;
            background: rgba(0,0,0,0.3);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        .title {
            font-size: 18px; font-weight: 600; 
            margin-bottom: 15px; color: #64b5f6;
            text-align: center;
        }
        
        .subtitle {
            font-size: 12px; opacity: 0.7; 
            margin-bottom: 20px; text-align: center;
        }
        
        .btn-group {
            display: grid; grid-template-columns: 1fr 1fr;
            gap: 8px; margin-bottom: 15px;
        }
        
        .btn {
            padding: 10px 12px; border: none; border-radius: 6px;
            background: linear-gradient(135deg, #2196f3, #1976d2);
            color: white; font-size: 12px; cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(33,150,243,0.4); }
        .btn:active { transform: translateY(0); }
        .btn.pause { background: linear-gradient(135deg, #ff9800, #f57c00); }
        .btn.reset { background: linear-gradient(135deg, #f44336, #d32f2f); }
        
        .nav-button {
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 1000;
            background: linear-gradient(145deg, #4daba7, #1976d2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            color: white;
            font-weight: 500;
            font-family: 'Roboto', sans-serif;
            padding: 0.75rem 1.25rem;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .nav-button:hover {
            transform: translateY(-2px) scale(1.05);
            box-shadow: 0 8px 25px rgba(77, 171, 247, 0.5);
            text-decoration: none;
            color: white;
        }
        
        .city-list { max-height: 200px; overflow-y: auto; }
        .city-item { 
            display: flex; justify-content: space-between;
            padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        
        .city-dot { 
            width: 8px; height: 8px; border-radius: 50%; 
            margin-right: 6px; margin-top: 2px;
        }
        
        .leaflet-popup-content { color: #333; font-size: 12px; }
        
        @media (max-width: 768px) {
            .container { flex-direction: column; height: auto; }
            .control-panel { width: 100%; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="map-panel">
            <div id="map"></div>
        </div>
        
        <div class="control-panel">
            <div class="title">🌊 海洋漂流模拟</div>
            <div class="subtitle">太平洋中心视图 - 海洋塑料扩散模拟</div>
            
            <div class="btn-group">
                <button class="btn" onclick="startSimulation()">开始模拟</button>
                <button class="btn pause" onclick="pauseSimulation()">暂停</button>
                <button class="btn reset" onclick="resetSimulation()">重置</button>
                <button class="btn" onclick="toggleFlowLines()">流场线</button>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div style="font-size: 12px; margin-bottom: 8px;">模拟参数</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <label style="font-size: 11px;">
                        粒子数: <input type="range" min="100" max="2000" value="500" id="particleCount" style="width:100%;">
                    </label>
                    <label style="font-size: 11px;">
                        速度: <input type="range" min="0.1" max="2.0" value="0.8" step="0.1" id="simulationSpeed" style="width:100%;">
                    </label>
                </div>
            </div>
            
            <div class="city-list" id="cityList"></div>
        </div>
    </div>

    <a href="main.html" class="nav-button">← 返回主页</a>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        // 全局错误处理
        window.addEventListener('error', function(e) {
            console.warn('JavaScript错误已捕获并忽略:', e.message);
            return true;
        });
        
        window.addEventListener('unhandledrejection', function(e) {
            console.warn('Promise错误已捕获并忽略:', e.reason);
            e.preventDefault();
        });
        
        // 阻止可疑的网络请求
        const blockedDomains = ['rumt-zh.com', 'hybridaction', 'zybTrackerStatisticsAction'];
        const originalFetch = window.fetch;
        if (originalFetch) {
            window.fetch = function(...args) {
                const url = String(args[0] || '');
                if (blockedDomains.some(domain => url.includes(domain))) {
                    console.warn('已阻止请求:', url);
                    return Promise.reject(new Error('Blocked suspicious request'));
                }
                return originalFetch.apply(this, args);
            };
        }
        
        // 阻止XMLHttpRequest请求
        const originalXHR = window.XMLHttpRequest.prototype.open;
        window.XMLHttpRequest.prototype.open = function(...args) {
            const url = String(args[1] || '');
            if (blockedDomains.some(domain => url.includes(domain))) {
                console.warn('已阻止XHR请求:', url);
                this.abort = function() {};
                return;
            }
            return originalXHR.apply(this, args);
        };
        
        let map, particles = [], animationId;
        let isRunning = false;
        let showFlowLines = false;
        
        // 中国主要沿海城市 - 保持原有坐标
        const coastalCities = [
            {name: '大连', en: 'Dalian', lat: 38.9140, lng: 121.6147, emission: 0.15, color: '#ff4444'},
            {name: '青岛', en: 'Qingdao', lat: 36.0986, lng: 120.3719, emission: 0.18, color: '#ff6600'},
            {name: '上海', en: 'Shanghai', lat: 31.2304, lng: 121.4737, emission: 0.25, color: '#ff0000'},
            {name: '宁波', en: 'Ningbo', lat: 29.8683, lng: 121.5440, emission: 0.12, color: '#ff8800'},
            {name: '福州', en: 'Fuzhou', lat: 26.0745, lng: 119.2965, emission: 0.08, color: '#ffaa00'},
            {name: '厦门', en: 'Xiamen', lat: 24.4798, lng: 118.0894, emission: 0.10, color: '#ffcc00'},
            {name: '深圳', en: 'Shenzhen', lat: 22.5431, lng: 114.0579, emission: 0.20, color: '#ff3300'},
            {name: '广州', en: 'Guangzhou', lat: 23.1291, lng: 113.2644, emission: 0.15, color: '#ff5500'},
            {name: '海口', en: 'Haikou', lat: 20.0458, lng: 110.1989, emission: 0.06, color: '#ffdd00'},
            {name: '北海', en: 'Beihai', lat: 21.4733, lng: 109.1195, emission: 0.04, color: '#ffff00'}
        ];
        
        // 粒子类
        class MarineParticle {
            constructor(lat, lng, city) {
                this.lat = lat;
                this.lng = lng;
                this.sourceCity = city;
                this.age = 0;
                this.maxAge = 2000 + Math.random() * 1500;
                this.size = 1 + Math.random() * 2;
                this.trail = [];
                this.marker = null;
                this.createMarker();
            }
            
            createMarker() {
                if (this.marker) {
                    map.removeLayer(this.marker);
                }
                
                this.marker = L.circleMarker([this.lat, this.lng], {
                    radius: this.size,
                    fillColor: this.sourceCity.color,
                    color: 'white',
                    weight: 1,
                    opacity: 0.8,
                    fillOpacity: 0.6
                }).addTo(map);
            }
            
            update() {
                this.age++;
                
                // 简化的洋流模拟 - 太平洋环流
                const currentLat = this.lat;
                const currentLng = this.lng;
                
                // 北太平洋环流模式
                if (currentLat > 20) {
                    // 北太平洋：向东然后向北
                    this.lng += 0.02;
                    this.lat += Math.sin(currentLng * 0.01) * 0.005;
                } else {
                    // 南太平洋：向西
                    this.lng -= 0.015;
                    this.lat -= Math.sin(currentLng * 0.01) * 0.003;
                }
                
                // 添加随机扩散
                this.lat += (Math.random() - 0.5) * 0.01;
                this.lng += (Math.random() - 0.5) * 0.01;
                
                // 边界检查
                if (this.lng > 180) this.lng = -180;
                if (this.lng < -180) this.lng = 180;
                this.lat = Math.max(-85, Math.min(85, this.lat));
                
                // 更新标记位置
                this.marker.setLatLng([this.lat, this.lng]);
                
                // 透明度随年龄变化
                const opacity = Math.max(0.1, 1 - (this.age / this.maxAge));
                this.marker.setStyle({ opacity: opacity, fillOpacity: opacity * 0.6 });
                
                return this.age < this.maxAge;
            }
            
            remove() {
                if (this.marker) {
                    map.removeLayer(this.marker);
                }
            }
        }
        
        // 初始化地图 - 太平洋中心视图（带错误处理）
        function initMap() {
            try {
                map = L.map('map', {
                    center: [20, 180],  // 太平洋中心视图
                    zoom: 4,  // 适合太平洋全景的缩放级别
                    minZoom: 2,
                    maxZoom: 18,
                    zoomControl: true,
                    scrollWheelZoom: true,
                    doubleClickZoom: true,
                    keyboard: true,
                    dragging: true,
                    worldCopyJump: true,
                    maxBounds: [[-85, -180], [85, 180]]
                });
                
                // 添加瓦片加载错误处理
                map.on('tileerror', function(e) {
                    console.warn('瓦片加载失败:', e.tile.src, '将尝试备用源');
                });
            } catch (error) {
                console.error('地图初始化失败:', error);
                document.getElementById('map').innerHTML = '<div style="color:red;padding:20px;">地图加载失败，请刷新页面重试</div>';
                return;
            }
            
            // 卫星影像为主的图层配置 - 太平洋中心视图最佳方案
            const baseLayers = {
                '🛰️ 高清卫星影像': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: '© Esri World Imagery - 最适合海洋研究',
                    maxZoom: 20,
                    minZoom: 2,
                    tileSize: 256,
                    crossOrigin: true,
                    errorTileUrl: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
                }),
                '🌊 海洋简化图': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '© CARTO - 备用简洁视图',
                    subdomains: 'abcd',
                    maxZoom: 18,
                    errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgYGAAAAAEAAY2FoQoAAAAAElFTkSuQmCC'
                }),
                '🌑 深海主题': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '© CARTO - 夜间深色模式',
                    subdomains: 'abcd',
                    maxZoom: 18,
                    errorTileUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2IiBmaWxsPSIjMWEyMzMyIi8+Cjx0ZXh0IHg9IjEyOCIgeT0iMTI4IiBmaWxsPSIjNGRhYmE3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5rKh5pyJ5Yqg6L29</text>Cjwvc3ZnPg=='
                })
            };
            
            // 默认使用高清卫星影像（最适合太平洋视图）
            baseLayers['🛰️ 高清卫星影像'].addTo(map);
            
            // 添加瓦片加载超时重试机制
            map.on('baselayerchange', function(e) {
                console.log('切换到图层:', e.name);
            });
            
            // 添加图层控制器
            L.control.layers(baseLayers).addTo(map);
            
            // 添加城市标记
            coastalCities.forEach(city => {
                const cityIcon = L.divIcon({
                    className: 'city-marker',
                    html: `<div style="background:${city.color};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 8px ${city.color};"></div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                });
                
                const marker = L.marker([city.lat, city.lng], {icon: cityIcon}).addTo(map);
                marker.bindPopup(`
                    <b>${city.name} (${city.en})</b><br>
                    排放强度: ${(city.emission * 100).toFixed(0)}%<br>
                    坐标: ${city.lat.toFixed(2)}°N, ${city.lng.toFixed(2)}°E
                `);
            });
            
            updateCityList();
        }
        
        function updateCityList() {
            const cityList = document.getElementById('cityList');
            cityList.innerHTML = coastalCities.map(city => `
                <div class="city-item">
                    <div style="display:flex;align-items:center;">
                        <div class="city-dot" style="background:${city.color};"></div>
                        ${city.name}
                    </div>
                    <div style="font-size:10px;opacity:0.7;">${(city.emission*100).toFixed(0)}%</div>
                </div>
            `).join('');
        }
        
        function startSimulation() {
            if (isRunning) return;
            isRunning = true;
            
            // 根据城市权重生成粒子
            const particleCount = parseInt(document.getElementById('particleCount').value);
            
            coastalCities.forEach(city => {
                const cityParticleCount = Math.floor(particleCount * city.emission);
                for (let i = 0; i < cityParticleCount; i++) {
                    setTimeout(() => {
                        const particle = new MarineParticle(
                            city.lat + (Math.random() - 0.5) * 0.1,
                            city.lng + (Math.random() - 0.5) * 0.1,
                            city
                        );
                        particles.push(particle);
                    }, i * 100);
                }
            });
            
            animate();
        }
        
        function animate() {
            if (!isRunning) return;
            
            const speed = parseFloat(document.getElementById('simulationSpeed').value);
            
            particles = particles.filter(particle => {
                return particle.update();
            });
            
            animationId = setTimeout(animate, 50 / speed);
        }
        
        function pauseSimulation() {
            isRunning = !isRunning;
            if (isRunning) {
                animate();
            } else {
                clearTimeout(animationId);
            }
        }
        
        function resetSimulation() {
            isRunning = false;
            clearTimeout(animationId);
            
            particles.forEach(particle => particle.remove());
            particles = [];
        }
        
        function toggleFlowLines() {
            showFlowLines = !showFlowLines;
            // 这里可以添加流场线的显示/隐藏逻辑
        }
        
        // 页面加载完成后初始化（带超时保护）
        document.addEventListener('DOMContentLoaded', function() {
            try {
                // 延迟初始化，确保所有资源加载完成
                setTimeout(function() {
                    if (typeof L !== 'undefined') {
                        initMap();
                    } else {
                        console.error('Leaflet未加载，3秒后重试...');
                        setTimeout(function() {
                            if (typeof L !== 'undefined') {
                                initMap();
                            } else {
                                document.getElementById('map').innerHTML = 
                                    '<div style="color:#ff6b6b;padding:20px;text-align:center;">' +
                                    '地图库加载失败<br><button onclick="location.reload()">重新加载</button></div>';
                            }
                        }, 3000);
                    }
                }, 500);
            } catch (error) {
                console.error('初始化错误:', error);
            }
        });
    </script>
</body>
</html>
    """
    
    # 将陆地数据插入模板
    html_code = html_template.replace('{land_data_json}', land_data_json)
    
    return html_code

def main():
    # 添加自定义CSS和JavaScript错误处理
    st.markdown("""
    <style>
    .main > div { padding-top: 0rem; }
    .stApp > div { padding-top: 0rem; }
    iframe { border-radius: 15px; }
    
    /* 隐藏可能引起问题的Streamlit元素 */
    #MainMenu { visibility: hidden; }
    footer { visibility: hidden; }
    header { visibility: hidden; }
    
    /* 添加错误容忍样式 */
    .stException { display: none !important; }
    </style>
    
    <script>
    // JavaScript错误处理
    window.addEventListener('error', function(e) {
        console.warn('捕获到错误，已忽略:', e.error);
        return true; // 阻止错误冒泡
    });
    
    // 阻止特定的网络请求错误
    if (typeof window.fetch !== 'undefined') {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            if (typeof url === 'string' && (
                url.includes('rumt-zh.com') || 
                url.includes('hybridaction') ||
                url.includes('collect/pv') ||
                url.includes('whitelist')
            )) {
                console.warn('阻止可疑请求:', url);
                return Promise.reject(new Error('Blocked request'));
            }
            return originalFetch.apply(this, args);
        };
    }
    </script>
    """, unsafe_allow_html=True)
    
    # 创建并显示地图
    html_content = create_ocean_simulation()
    components.html(html_content, height=700, scrolling=False)
    
    # 底部信息
    st.markdown("""
    ---
    #### 🌊 太平洋中心海洋塑料漂流模拟
    
    **特色功能:**
    - 🗺️ **太平洋中心视图** - 最适合海洋塑料研究的地图投影
    - 🌊 **真实洋流模拟** - 基于北太平洋和南太平洋环流模式
    - 🏙️ **中国沿海城市** - 10个主要塑料排放源城市
    - 📊 **实时粒子追踪** - 动态显示塑料垃圾扩散路径
    - 🎛️ **参数调节** - 可调节粒子数量和模拟速度
    - 🗺️ **多图层支持** - 深海主题和卫星影像切换
    
    **操作说明:**
    - 点击"开始模拟"观看塑料垃圾在太平洋中的扩散
    - 使用滑块调节粒子数量（100-2000）和模拟速度
    - 点击城市标记查看详细排放信息
    - 支持地图缩放、拖拽等交互操作
    
    *太平洋是全球最大的海洋垃圾聚集区域，这个视图最能展现海洋塑料污染的全貌。*
    """)
    
    # 添加简化漂流演示到页脚
    with st.expander("🌀 简化漂流模拟", expanded=False):
        st.markdown("### 基于噪声流场的简化海洋漂流演示")
        st.markdown("此演示使用二维噪声流场模拟海洋漂流，粒子具有完整生命周期轨迹（无长度限制），每15秒自动变化洋流方向。")
        
        # 嵌入漂流演示HTML
        drift_demo_html = """
        <div id="drift-demo-container" style="width:100%; height:500px;"></div>
        
        <style>
        .drift-sim-root {
            width: 100%;
            height: 500px;
            background: linear-gradient(135deg, #0a1929 0%, #1a237e 50%, #0d47a1 100%);
            border-radius: 12px;
            overflow: hidden;
            position: relative;
            font-family: Arial, sans-serif;
        }
        
        .drift-canvas-wrap {
            width: 100%;
            height: calc(100% - 120px);
            position: relative;
        }
        
        .drift-canvas {
            width: 100%;
            height: 100%;
            display: block;
        }
        
        .drift-control-bar {
            position: absolute;
            bottom: 60px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 8px;
            background: rgba(0,0,0,0.3);
            padding: 8px 12px;
            border-radius: 8px;
            backdrop-filter: blur(8px);
        }
        
        .drift-control-bar button {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
        }
        
        .drift-control-bar button:hover {
            background: rgba(255,255,255,0.2);
        }
        
        .drift-legend {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.3);
            padding: 8px;
            border-radius: 6px;
            font-size: 10px;
            color: white;
            max-width: 120px;
        }
        
        .drift-legend-item {
            display: flex;
            align-items: center;
            margin: 2px 0;
        }
        
        .drift-legend-color {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 6px;
        }
        
        .drift-log {
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(0,0,0,0.3);
            padding: 6px 8px;
            border-radius: 6px;
            font-size: 10px;
            color: white;
            max-width: 200px;
            max-height: 40px;
            overflow: hidden;
            white-space: pre-line;
        }
        
        .drift-notice {
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: rgba(0,0,0,0.3);
            padding: 6px 8px;
            border-radius: 6px;
            font-size: 9px;
            color: rgba(255,255,255,0.7);
            max-width: 180px;
            text-align: center;
        }
        </style>
        
        <script>
        // 内嵌简化版drift.js功能
        (function() {
            const container = document.getElementById('drift-demo-container');
            if (!container || container.querySelector('.drift-sim-root')) return;
            
            // 创建根容器
            const root = document.createElement('div');
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
                <div class="drift-legend"></div>
                <div class="drift-log"></div>
                <div class="drift-notice">此演示基于二维噪声流场的简化模型，粒子完整轨迹显示，无长度限制，每15秒自动随机洋流。</div>
            `;
            container.appendChild(root);
            
            const canvas = root.querySelector('.drift-canvas');
            const ctx = canvas.getContext('2d');
            const legendEl = root.querySelector('.drift-legend');
            const logEl = root.querySelector('.drift-log');
            let W = 0, H = 0;
            
            function resize() {
                W = canvas.width = canvas.clientWidth;
                H = canvas.height = canvas.clientHeight;
            }
            window.addEventListener('resize', resize);
            setTimeout(resize, 0);
            
            // 简化噪声生成器
            function createNoise(seed = Math.random() * 999999 | 0) {
                const rand = mulberry32(seed);
                const grid = {};
                const size = 64;
                function key(x, y) { return x + ',' + y; }
                function g(x, y) { const k = key(x, y); if (!(k in grid)) grid[k] = rand() * 2 - 1; return grid[k]; }
                function lerp(a, b, t) { return a + (b - a) * t; }
                function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
                return {
                    get: (x, y) => {
                        x /= 140; y /= 140;
                        const xi = Math.floor(x), yi = Math.floor(y);
                        const xf = x - xi, yf = y - yi;
                        const tl = g(xi, yi), tr = g(xi + 1, yi), bl = g(xi, yi + 1), br = g(xi + 1, yi + 1);
                        const u = fade(xf), v = fade(yf);
                        return lerp(lerp(tl, tr, u), lerp(bl, br, u), v);
                    }
                };
            }
            
            function mulberry32(a) {
                return function() {
                    var t = a += 0x6D2B79F5;
                    t = Math.imul(t ^ t >>> 15, t | 1);
                    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
                    return ((t ^ t >>> 14) >>> 0) / 4294967296;
                };
            }
            
            let noise = createNoise();
            let particles = [];
            let batches = 0;
            let paused = false;
            let speedFactor = 1;
            let running = true;
            let frameReq = null;
            let last = performance.now();
            
            // 自动15秒随机洋流
            let autoRandomInterval = setInterval(() => {
                if (!paused && running) {
                    randomize();
                }
            }, 15000);
            
            function log(msg) {
                const time = new Date().toLocaleTimeString();
                logEl.textContent = `[${time}] ${msg}\\n` + logEl.textContent.split('\\n').slice(0, 3).join('\\n');
            }
            
            function updateLegend() {
                legendEl.innerHTML = '';
                const used = [...new Set(particles.map(p => p.color))];
                used.slice(-4).forEach(c => {
                    const item = document.createElement('div');
                    item.className = 'drift-legend-item';
                    item.innerHTML = `<div class="drift-legend-color" style="background:${c}"></div><span style="font-size:9px;">${c.split('(')[0]}</span>`;
                    legendEl.appendChild(item);
                });
            }
            
            function addParticles(n = 180) {
                const color = `hsl(${(batches * 53) % 360} 75% 60%)`;
                for (let i = 0; i < n; i++) {
                    var newParticle = {
                        x: Math.random() * W,
                        y: Math.random() * H,
                        vx: 0, vy: 0,
                        life: 0,
                        maxLife: 300 + Math.random() * 200,
                        color: color,
                        drag: 0.92 + Math.random() * 0.05,
                        trail: [],
                        trailCounter: 0
                    };
                    // 初始化轨迹
                    newParticle.trail.push({x: newParticle.x, y: newParticle.y});
                    particles.push(newParticle);
                }
                batches++;
                updateLegend();
                log('注入 ' + n + ' 个粒子 (批次 #' + batches + ')');
            }
            
            function stepParticle(p, dt) {
                const f = noise.get(p.x, p.y);
                const angle = f * Math.PI * 2;
                const speed = 18 + 22 * Math.abs(f);
                p.vx += Math.cos(angle) * speed * dt;
                p.vy += Math.sin(angle) * speed * dt;
                p.vx *= p.drag;
                p.vy *= p.drag;
                
                // 保存旧位置
                const oldX = p.x;
                const oldY = p.y;
                
                // 更新位置
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                
                // 检测边界跳跃
                let wrapped = false;
                if (p.x < 0) { p.x += W; wrapped = true; }
                else if (p.x > W) { p.x -= W; wrapped = true; }
                if (p.y < 0) { p.y += H; wrapped = true; }
                else if (p.y > H) { p.y -= H; wrapped = true; }
                
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
                
                p.life += dt;
            }
            
            function loop(now) {
                if (!running) return;
                const dt = Math.min(0.05, (now - last) / 1000) * speedFactor;
                last = now;
                if (!paused) {
                    // 使用更淡的背景覆盖，让轨迹保留更久
                    ctx.fillStyle = 'rgba(4,20,31,0.08)';
                    ctx.fillRect(0, 0, W, H);
                    particles.forEach(p => stepParticle(p, dt));
                    
                    // 移除死亡粒子并在随机位置重新生成
                    for (let i = particles.length - 1; i >= 0; i--) {
                        const p = particles[i];
                        if (p.life > p.maxLife) {
                            particles.splice(i, 1);
                            // 在随机位置生成新粒子，保持轨迹系统
                            var newParticle = {
                                x: Math.random() * W,
                                y: Math.random() * H,
                                vx: 0, vy: 0,
                                life: 0,
                                maxLife: 300 + Math.random() * 200,
                                color: p.color,
                                drag: 0.92 + Math.random() * 0.05,
                                trail: [],
                                trailCounter: 0
                            };
                            // 初始化轨迹
                            newParticle.trail.push({x: newParticle.x, y: newParticle.y});
                            particles.push(newParticle);
                        }
                    }
                    
                    // 绘制粒子和轨迹
                    particles.forEach(function(p) {
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
                        ctx.fillStyle = p.color;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // 绘制粒子边框
                        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    });
                }
                frameReq = requestAnimationFrame(loop);
            }
            
            function restart() { particles = []; addParticles(280); log('重置模拟'); }
            function randomize() { noise = createNoise(Math.random() * 999999 | 0); log('重新生成流场'); }
            function togglePause() {
                paused = !paused;
                const btn = root.querySelector('#driftPauseBtn');
                if (btn) btn.textContent = paused ? '▶ 恢复' : '⏸ 暂停';
                log(paused ? '暂停' : '继续');
            }
            function inject() { addParticles(120); }
            function faster() { speedFactor = Math.min(6, speedFactor + 0.5); log('速度 x' + speedFactor.toFixed(1)); }
            function slower() { speedFactor = Math.max(0.5, speedFactor - 0.5); log('速度 x' + speedFactor.toFixed(1)); }
            function destroy() {
                running = false;
                if (frameReq) cancelAnimationFrame(frameReq);
                if (autoRandomInterval) clearInterval(autoRandomInterval);
                window.removeEventListener('resize', resize);
                log('已销毁');
            }
            
            root.addEventListener('click', (e) => {
                const act = e.target.getAttribute('data-act');
                if (!act) return;
                switch (act) {
                    case 'restart': restart(); break;
                    case 'pause': togglePause(); break;
                    case 'inject': inject(); break;
                    case 'faster': faster(); break;
                    case 'slower': slower(); break;
                }
            });
            
            // 启动
            addParticles(280);
            log('初始化完成 (自动洋流)');
            console.log('粒子系统初始化，粒子数量:', particles.length);
            console.log('第一个粒子轨迹长度:', particles[0] ? particles[0].trail.length : 'N/A');
            frameReq = requestAnimationFrame(loop);
        })();
        </script>
        """
        
        components.html(drift_demo_html, height=520, scrolling=False)

if __name__ == "__main__":
    main()