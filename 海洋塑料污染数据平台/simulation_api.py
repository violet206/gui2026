#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API服务器 - 处理模拟请求并返回结果
为主页提供运行Python模拟脚本的后端支持
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import json
import os
import sys
from pathlib import Path
import pandas as pd

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 项目根目录
PROJECT_ROOT = Path(__file__).parent

@app.route('/api/run-simulation', methods=['POST'])
def run_simulation():
    """运行模拟脚本并返回结果"""
    try:
        data = request.get_json()
        script_name = data.get('script')
        simulation_type = data.get('type')
        
        if not script_name or not simulation_type:
            return jsonify({
                'success': False,
                'error': '缺少必要参数: script 和 type'
            }), 400
        
        # 构建脚本路径
        script_path = PROJECT_ROOT / script_name
        if not script_path.exists():
            return jsonify({
                'success': False,
                'error': f'脚本文件不存在: {script_path}'
            }), 404
        
        print(f"🚀 开始运行模拟脚本: {script_path}")
        
        # 运行Python脚本
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=300  # 5分钟超时
        )
        
        if result.returncode != 0:
            print(f"❌ 脚本执行失败: {result.stderr}")
            return jsonify({
                'success': False,
                'error': f'脚本执行失败: {result.stderr}',
                'stdout': result.stdout
            }), 500
        
        print(f"✅ 脚本执行成功")
        
        # 根据模拟类型读取结果数据
        chart_data = None
        if simulation_type == 'rubbish':
            chart_data = read_rubbish_simulation_data()
        elif simulation_type == 'ocean_current':
            chart_data = read_ocean_current_simulation_data()
        
        return jsonify({
            'success': True,
            'message': '模拟执行成功',
            'stdout': result.stdout,
            'data': chart_data
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({
            'success': False,
            'error': '脚本执行超时（超过5分钟）'
        }), 408
    except Exception as e:
        print(f"❌ API错误: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'服务器错误: {str(e)}'
        }), 500

def read_rubbish_simulation_data():
    """读取海洋垃圾模拟数据"""
    try:
        # 读取CSV文件
        csv_file = PROJECT_ROOT / 'china_coastal_marine_waste.csv'
        summary_file = PROJECT_ROOT / 'china_coastal_marine_waste_summary.csv'
        
        if not csv_file.exists():
            return None
        
        # 读取详细数据
        df = pd.read_csv(csv_file)
        
        # 按年份统计总量
        yearly_data = df.groupby('年份')['海洋垃圾量(吨)'].sum().reset_index()
        
        # 按城市统计总量（取前10个）
        city_data = df.groupby('城市')['海洋垃圾量(吨)'].sum().sort_values(ascending=False).head(10)
        
        return {
            'yearly_totals': {
                'labels': yearly_data['年份'].tolist(),
                'values': yearly_data['海洋垃圾量(吨)'].tolist()
            },
            'city_totals': {
                'labels': city_data.index.tolist(),
                'values': city_data.values.tolist()
            },
            'total_waste': int(df['海洋垃圾量(吨)'].sum()),
            'avg_yearly': int(df.groupby('年份')['海洋垃圾量(吨)'].sum().mean())
        }
        
    except Exception as e:
        print(f"❌ 读取垃圾模拟数据失败: {e}")
        return None

def read_ocean_current_simulation_data():
    """读取海洋环流模拟数据"""
    try:
        # 检查生成的文件
        files_to_check = ['rivers.csv', 'cities.csv', 'shipping_routes.geojson', 'ocean_currents.nc']
        
        data = {}
        
        # 读取河流数据
        rivers_file = PROJECT_ROOT / 'rivers.csv'
        if rivers_file.exists():
            rivers_df = pd.read_csv(rivers_file)
            data['rivers'] = {
                'count': len(rivers_df),
                'total_plastic': int(rivers_df['plastic_tons_per_year'].sum()),
                'top_rivers': rivers_df.nlargest(5, 'plastic_tons_per_year')[['river', 'plastic_tons_per_year']].to_dict('records')
            }
        
        # 读取城市数据
        cities_file = PROJECT_ROOT / 'cities.csv'
        if cities_file.exists():
            cities_df = pd.read_csv(cities_file)
            data['cities'] = {
                'count': len(cities_df),
                'total_population': int(cities_df['population'].sum()),
                'avg_population': int(cities_df['population'].mean())
            }
        
        # 检查其他文件
        data['files_generated'] = []
        for file_name in files_to_check:
            file_path = PROJECT_ROOT / file_name
            if file_path.exists():
                data['files_generated'].append({
                    'name': file_name,
                    'size': file_path.stat().st_size
                })
        
        return data
        
    except Exception as e:
        print(f"❌ 读取海洋环流数据失败: {e}")
        return None

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取API状态"""
    return jsonify({
        'status': 'running',
        'message': '海洋塑料污染数据模拟API正在运行',
        'project_root': str(PROJECT_ROOT)
    })

if __name__ == '__main__':
    print("🌊 启动海洋塑料污染数据模拟API服务器...")
    print(f"📁 项目根目录: {PROJECT_ROOT}")
    print("🔗 API将运行在 http://localhost:5000")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
