@echo off
call "D:\VS\VC\Auxiliary\Build\vcvars64.bat"
if %errorlevel% neq 0 exit /b %errorlevel%

set PATH=D:\Public_Environment\Rust\cargo\bin;D:\Public_Environment\Node\nvm\v22.17.1;%PATH%

cd /d "G:\Project\Gemini\BBPlayer\apps\desktop\src-tauri"
cargo build --release
if %errorlevel% neq 0 exit /b %errorlevel%

echo BUILD_SUCCESS
