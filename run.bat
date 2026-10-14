@echo off
set "RUSTUP_HOME=D:\Public_Environment\Rust\rustup"
set "CARGO_HOME=D:\Public_Environment\Rust\cargo"
set "PATH=D:\Public_Environment\Rust\cargo\bin;D:\Public_Environment\Node\nvm\v22.17.1;%PATH%"

cd /d "G:\Project\Gemini\BBPlayer"
pnpm --filter desktop tauri dev
