@echo off
echo ========================================
echo  ∆Ω RESONATOR WASM BUILDER
echo ========================================
echo.

cd /d "C:\Users\rares\Desktop\resonator"

echo [1/3] Checking Emscripten...

if exist "C:\Users\rares\Desktop\resonator\emsdk\upstream\emscripten\emcc.exe" (
    echo Found: Local emsdk
    set "EMCC=C:\Users\rares\Desktop\resonator\emsdk\upstream\emscripten\emcc.exe"
    goto :compile
)

if exist "C:\Users\rares\emsdk\upstream\emscripten\emcc.exe" (
    echo Found: User emsdk
    set "EMCC=C:\Users\rares\emsdk\upstream\emscripten\emcc.exe"
    goto :compile
)

echo ERROR: emcc not found!
echo Please install Emscripten:
echo   git clone https://github.com/emscripten-core/emsdk.git
echo   cd emsdk
echo   emsdk.bat install latest
echo   emsdk.bat activate latest
pause
exit /b 1

:compile
echo [2/3] Compiling resonator.cpp...
echo.

"%EMCC%" resonator.cpp -O3 ^
  -s WASM=1 ^
  -s EXPORTED_FUNCTIONS="['_malloc','_free','_wasm_malloc','_wasm_free','_engine_create','_engine_render','_engine_free','_result_get_sample_rate','_result_get_num_samples','_result_get_left_buffer','_result_get_right_buffer','_result_get_peak','_result_get_duration','_result_free']" ^
  -s EXPORTED_RUNTIME_METHODS="['getValue','setValue','UTF8ToString','stringToUTF8']" ^
  -s ALLOW_MEMORY_GROWTH=1 ^
  -s INITIAL_MEMORY=64MB ^
  -s MAXIMUM_MEMORY=256MB ^
  -s MODULARIZE=1 ^
  -s EXPORT_NAME="ResonatorModule" ^
  -s ENVIRONMENT=web,worker ^
  -s SINGLE_FILE=0 ^
  -o resonator.js

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Compilation failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Build complete!
echo.
echo Output files:
dir /b resonator.js resonator.wasm 2>nul
echo.
pause