@echo off
echo ============================================
echo 云南白药 BI 数据门户 - 本地测试启动
echo ============================================
echo.

echo [1/3] 检查 Node.js 版本...
node --version
if %errorlevel% neq 0 (
    echo 错误: 未找到 Node.js，请先安装 Node.js >= 18.0.0
    pause
    exit /b 1
)
echo.

echo [2/3] 安装依赖...
call npm install
if %errorlevel% neq 0 (
    echo 错误: 依赖安装失败
    pause
    exit /b 1
)
echo.

echo [3/3] 启动开发服务器...
echo.
echo ============================================
echo 服务器将在 http://localhost:3000 启动
echo 按 Ctrl+C 停止服务器
echo ============================================
echo.

call npm run dev
