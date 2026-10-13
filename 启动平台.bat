@echo off
setlocal ENABLEDELAYEDEXPANSION
chcp 65001 >nul
cd /d "%~dp0"
title 海洋塑料污染数据分析展示平台 启动器

REM =====================================================
REM 新版启动脚本: 提供交互选择  (2025-09 重写)
REM 选项：
REM   1) 直接本地 file:// 打开 (零依赖, 使用前端回退/模拟数据)
REM   2) 启动本地 HTTP 静态服务器 (避免部分浏览器 file:// 安全限制)
REM   3) 启动 HTTP + Streamlit 漂流/参数后端 (若已安装依赖)
REM   4) 仅启动 Streamlit 后端 (不再另开静态服务器)
REM   5) 退出
REM   命令行快捷参数:  /f  -> 直开   /http  -> 静态服   /all  -> HTTP+Streamlit
REM =====================================================

if not exist "explore.html" (
    echo ❌ 无法找到 explore.html，请确认脚本放在项目根目录。
    pause & exit /b 1
)

set PORT=8000
set STREAMLIT_PORT=8526
set LOG_DIR=logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
REM ---- 构造安全日志文件名（去掉 / : 空格）----
set SAFE_DATE=%DATE:/=-%
set SAFE_TIME=%TIME::=-%
set SAFE_TIME=%SAFE_TIME:.=_%
set SAFE_TIME=%SAFE_TIME: =0%
set LAUNCH_LOG=%LOG_DIR%\launch_%SAFE_DATE%_%SAFE_TIME%.log

call :detect_python || goto :after_python_fail

REM =========== 命令行快速模式处理 ===========
if /I "%~1"=="/f"   goto MODE_FILE
if /I "%~1"=="file" goto MODE_FILE
if /I "%~1"=="/http" goto MODE_HTTP
if /I "%~1"=="http"  goto MODE_HTTP
if /I "%~1"=="/all"  goto MODE_ALL
if /I "%~1"=="all"   goto MODE_ALL

REM 预检测端口可用性函数定义在后面, 菜单模式先不调用

:menu
cls
echo ==============================================
echo   海洋塑料污染数据分析展示平台 启动器
echo ==============================================
echo   1. 直接本地打開 (file://)
echo   2. 本地 HTTP 静态服务器  (端口 %PORT%)
echo   3. HTTP + Streamlit 后端 (端口 %PORT% + %STREAMLIT_PORT%)
echo   4. 仅启动 Streamlit 后端 (端口 %STREAMLIT_PORT%)
echo   5. 退出
echo ----------------------------------------------
echo   提示: 可用參數 /f /http /all 直接跳过此菜单
echo          日志输出 -> %LAUNCH_LOG%
echo ==============================================
set /p CHOICE=请选择启动模式 [1-5]: 
if "%CHOICE%"=="1" goto MODE_FILE
if "%CHOICE%"=="2" goto MODE_HTTP
if "%CHOICE%"=="3" goto MODE_ALL
if "%CHOICE%"=="4" goto MODE_STREAMLIT_ONLY
if "%CHOICE%"=="5" goto END
echo 无效输入...
pause
goto menu

:: ================== 模式 1: 直接本地 ==================
:MODE_FILE
echo [INFO] 本地 file:// 模式 - 使用浏览器直接打开 explore.html
call :open_url "explore.html"
call :post_info
goto END

:: ================== 模式 2: HTTP 静态服务器 ==================
:MODE_HTTP
echo [INFO] 启动简易 HTTP 服务器 (Python http.server) 端口 %PORT%
call :ensure_free_port PORT
call :start_http_only
goto END

:: ================== 模式 3: HTTP + Streamlit ==================
:MODE_ALL
echo [INFO] 启动静态服务器 + Streamlit 后端
call :ensure_free_port PORT
call :ensure_free_port STREAMLIT_PORT
call :start_http_in_bg
call :start_streamlit
echo.
echo 打开起始页...
call :open_url "http://localhost:%PORT%/explore.html"
echo 打开 Streamlit 漂流界面...
call :open_url "http://localhost:%STREAMLIT_PORT%" 
call :post_info
goto WAIT_BLOCK

:: ================== 模式 4: 仅 Streamlit ==================
:MODE_STREAMLIT_ONLY
echo [INFO] 仅启动 Streamlit 后端 (不提供静态http)
call :ensure_free_port STREAMLIT_PORT
call :start_streamlit
call :open_url "http://localhost:%STREAMLIT_PORT%"
call :post_info
goto WAIT_BLOCK

:: (函数) 检测 Python
:detect_python
    for %%P in (python.exe py.exe) do (
        where %%P >nul 2>&1 && (set PYTHON_CMD=%%P & goto :found_py)
    )
    echo [WARN] 未检测到 python / py。
    set PYTHON_CMD=
    exit /b 1
:found_py
    echo [INFO] 使用 Python 命令: %PYTHON_CMD%
    exit /b 0

:: (函数) 启动 http.server 阻塞版本
:start_http_only
    if not defined PYTHON_CMD (echo ❌ 无 Python 无法使用该模式 & goto MODE_FILE)
    echo [DEBUG] 尝试启动 http.server 端口 %PORT% >>"%LAUNCH_LOG%"
    start "HTTP_SERVER %PORT%" %PYTHON_CMD% -m http.server %PORT% 1>>"%LAUNCH_LOG%" 2>&1
    REM 等待服务器初始化 (部分环境需要>1s)
    call :sleep 2
    call :open_url "http://localhost:%PORT%/explore.html"
    call :post_info
    goto WAIT_BLOCK

:: (函数) 后台启动 http.server (窗口独立)
:start_http_in_bg
    if not defined PYTHON_CMD (echo ❌ 无 Python 跳过 HTTP 服务器 & exit /b 0)
    echo [DEBUG] 后台启动 http.server 端口 %PORT% >>"%LAUNCH_LOG%"
    start "HTTP_SERVER %PORT%" %PYTHON_CMD% -m http.server %PORT% 1>>"%LAUNCH_LOG%" 2>&1
    call :sleep 2
    exit /b 0

:: (函数) 启动 Streamlit
:start_streamlit
    if not defined PYTHON_CMD (echo [WARN] 无 Python，无法启动 Streamlit 后端 & exit /b 0)
    if not exist "app_streamlit.py" (echo [WARN] 缺少 app_streamlit.py，跳过 Streamlit & exit /b 0)
    echo [INFO] 启动 Streamlit (端口 %STREAMLIT_PORT%) ...
    echo [DEBUG] 启动命令: %PYTHON_CMD% -m streamlit run app_streamlit.py --server.port %STREAMLIT_PORT% --server.headless true >>"%LAUNCH_LOG%" 2>&1
    start "STREAMLIT %STREAMLIT_PORT%" %PYTHON_CMD% -m streamlit run app_streamlit.py --server.port %STREAMLIT_PORT% --server.headless true 1>>"%LAUNCH_LOG%" 2>&1
    call :sleep 3
    exit /b 0

:: (函数) 打开 URL 或文件
:open_url
    set TARGET=%~1
    REM 使用 start 会按系统默认浏览器打开，文件直接 file:// 访问
    start "" %TARGET%
    exit /b 0

:: (函数) 启动后说明
:post_info
    echo --------------------------------------------------
    echo  使用说明:
    echo    • file:// 模式下控制台可关闭, 页面继续显示。
    echo    • 如果图表空白或跨域失败, 请选择 HTTP 模式重新启动。
    echo    • Streamlit 后端包含更详细漂流参数 UI (端口 %STREAMLIT_PORT%).
    echo    • 日志文件: %LAUNCH_LOG%
    echo    • 若浏览器未打开可手动访问: http://localhost:%PORT%/
    echo    • 若端口占用已自动向上递增: 当前 HTTP=%PORT%  Streamlit=%STREAMLIT_PORT%
    echo --------------------------------------------------
    exit /b 0

:: 阻塞等待 (HTTP / Streamlit 组合情境)
:WAIT_BLOCK
echo.
echo [按 Ctrl+C 结束后台服务窗口(若有), 或任意键退出本启动器]
pause >nul
goto END

:after_python_fail
echo.
echo ⚠ 未发现 Python, 已自动降级为本地 file:// 打开。
call :open_url "explore.html"
goto END

:END
echo 完成。
endlocal
exit /b 0

:: ===== 工具函数: 端口可用性检查 (简单版，检测被 LISTEN / ESTABLISHED 占用) =====
:ensure_free_port
    set VAR_NAME=%1
    for /f "tokens=2 delims==" %%V in ('set %VAR_NAME%') do set CUR_PORT=%%V
    set /a TRY_COUNT=0
    :_port_loop
        call :_is_port_busy !CUR_PORT! && (
                set /a CUR_PORT=CUR_PORT+1
                set /a TRY_COUNT=TRY_COUNT+1
                if !TRY_COUNT! GEQ 15 (echo [WARN] 端口连续占用, 使用最后尝试端口 !CUR_PORT! & goto _port_done)
                goto _port_loop
        )
    :_port_done
    set %VAR_NAME%=!CUR_PORT!
    if "%1"=="PORT" echo [INFO] 使用HTTP端口: !CUR_PORT!
    if "%1"=="STREAMLIT_PORT" echo [INFO] 使用Streamlit端口: !CUR_PORT!
    exit /b 0

:_is_port_busy
    REM 利用 netstat 查找端口是否已被占用
    for /f "delims=" %%L in ('netstat -ano ^| findstr /R ":[ ]*%1"') do (
         exit /b 0
    )
    REM 没找到返回1 (不忙)
    exit /b 1

:: ===== 简易 sleep (兼容早期 Win10) =====
:sleep
    set SECS=%1
    if not defined SECS set SECS=1
    timeout /t %SECS% >nul
    exit /b 0