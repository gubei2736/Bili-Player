@echo off
setlocal
title BBPlayer Dev Environment

set "RUSTUP_HOME=D:\Public_Environment\Rust\rustup"
set "CARGO_HOME=D:\Public_Environment\Rust\cargo"
set "PATH=D:\Public_Environment\Rust\cargo\bin;D:\Public_Environment\Node\nvm\v22.17.1;%PATH%"

call "D:\VS\VC\Auxiliary\Build\vcvars64.bat"

cd /d "G:\Project\Gemini\BBPlayer"
call pnpm --filter desktop tauri dev

if %errorlevel% neq 0 (
    echo.
    echo [BBPlayer Error] Process exited with code %errorlevel%
    pause
)