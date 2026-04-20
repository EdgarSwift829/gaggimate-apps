@echo off
chcp 65001 > nul
title GaggiMate 起動スクリプト

echo ========================================
echo  GaggiMate Integration App - 起動
echo ========================================
echo.

REM ルートディレクトリを基準にパス設定
set ROOT=%~dp0
set ROOT=%ROOT:~0,-1%
set PIDFILE=%ROOT%\gaggimate.pids

REM 既存プロセスがあれば先に停止
if exist "%PIDFILE%" (
    echo [!] 前回のプロセスが残っています。停止します...
    call "%ROOT%\stop.bat" silent
    timeout /t 2 /nobreak > nul
)

REM PIDファイル初期化
echo. > "%PIDFILE%"

echo [1/3] シミュレーターを起動中...
start /b "" cmd /c "cd /d "%ROOT%\simulator" && python gaggimate_sim.py --ws-port 8766 --webhook-url http://localhost:8001/webhook > "%ROOT%\logs\simulator.log" 2>&1"
timeout /t 1 /nobreak > nul
for /f "tokens=2" %%i in ('tasklist /fi "windowtitle eq GaggiMate*" /fo list ^| findstr "PID"') do echo %%i >> "%PIDFILE%"

REM simulator PID取得（python gaggimate_sim.py を探す）
for /f "tokens=1" %%i in ('wmic process where "commandline like '%%gaggimate_sim%%'" get processid /value ^| findstr ProcessId') do (
    set SIM_LINE=%%i
)
echo %SIM_LINE% >> "%PIDFILE%"

timeout /t 2 /nobreak > nul

echo [2/3] バックエンドを起動中...
start /b "" cmd /c "cd /d "%ROOT%\backend" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 > "%ROOT%\logs\backend.log" 2>&1"
timeout /t 4 /nobreak > nul

REM バックエンド疎通確認
curl -s http://localhost:8001/api/health > nul 2>&1
if errorlevel 1 (
    echo [!] バックエンド起動に失敗しました。logs\backend.log を確認してください。
    pause
    exit /b 1
)
echo     バックエンド: OK

REM backend PID取得
for /f "tokens=1" %%i in ('wmic process where "commandline like '%%uvicorn%%app.main%%'" get processid /value ^| findstr ProcessId') do (
    set BACK_LINE=%%i
)
echo %BACK_LINE% >> "%PIDFILE%"

echo [3/3] フロントエンドを起動中...
start /b "" cmd /c "cd /d "%ROOT%\frontend" && npm run dev > "%ROOT%\logs\frontend.log" 2>&1"
timeout /t 3 /nobreak > nul

REM frontend PID取得
for /f "tokens=1" %%i in ('wmic process where "commandline like '%%vite%%'" get processid /value ^| findstr ProcessId') do (
    set FRONT_LINE=%%i
)
echo %FRONT_LINE% >> "%PIDFILE%"

echo.
echo ========================================
echo  起動完了！
echo.
echo  [PC]
echo  フロントエンド: http://localhost:5174
echo  API:           http://localhost:8001
echo  API Docs:      http://localhost:8001/docs
echo.
echo  ログ: logs\backend.log / simulator.log / frontend.log
echo ========================================
echo.

REM スマホ用QRコード表示
python "%ROOT%\show_qr.py" 5174

echo.
echo 停止するには stop.bat を実行してください。
echo このウィンドウを閉じると stop.bat が自動実行されます。
echo.
pause
call "%ROOT%\stop.bat"
