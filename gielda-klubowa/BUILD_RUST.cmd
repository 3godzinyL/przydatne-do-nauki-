@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Kompiluję Rust do WebAssembly (public\pkg)...
call npm.cmd run build:wasm
if exist "public\pkg\.gitignore" del "public\pkg\.gitignore"
pause
