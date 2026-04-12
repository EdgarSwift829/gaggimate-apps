@echo off
chcp 65001 > nul
if not "%1"=="silent" (
    echo ========================================
    echo  GaggiMate - 全サービス停止
    echo ========================================
)

set ROOT=%~dp0
set ROOT=%ROOT:~0,-1%

REM --- uvicorn（バックエンド）停止 ---
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq python.exe" /fo csv ^| findstr /i "uvicorn"') do (
    taskkill /F /PID %%~i > nul 2>&1
)
wmic process where "commandline like '%%uvicorn%%app.main%%'" delete > nul 2>&1

REM --- gaggimate_sim（シミュレーター）停止 ---
wmic process where "commandline like '%%gaggimate_sim%%'" delete > nul 2>&1

REM --- vite（フロントエンド）停止 ---
wmic process where "commandline like '%%vite%%'" delete > nul 2>&1

REM --- ポート8000・8765・5173 を使っているプロセスを念のため解放 ---
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 "') do (
    taskkill /F /PID %%a > nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8765 "') do (
    taskkill /F /PID %%a > nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "') do (
    taskkill /F /PID %%a > nul 2>&1
)

REM --- PIDファイル削除 ---
if exist "%ROOT%\gaggimate.pids" del /f /q "%ROOT%\gaggimate.pids"

if not "%1"=="silent" (
    echo.
    echo 全サービスを停止しました。
    echo.
    pause
)
