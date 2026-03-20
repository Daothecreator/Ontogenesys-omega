// ∆Ω-RESONATOR WASM Loader v1.2w
// Auto-generated Emscripten glue (simplified for sovereign deployment)

var ResonatorModule = (() => {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  if (typeof __filename !== 'undefined') _scriptDir = _scriptDir || __filename;
  
  return (
function(ResonatorModule) {
  ResonatorModule = ResonatorModule || {};

var Module = typeof ResonatorModule != "undefined" ? ResonatorModule : {};
var readyPromiseResolve, readyPromiseReject;
Module["ready"] = new Promise(function(resolve, reject) {
  readyPromiseResolve = resolve;
  readyPromiseReject = reject;
});

// Memory management
var wasmMemory;
var wasmTable;

function initMemory(imports) {
  wasmMemory = new WebAssembly.Memory({
    "initial": 256,
    "maximum": 16384,
    "shared": false
  });
  imports["env"]["memory"] = wasmMemory;
  wasmTable = new WebAssembly.Table({
    "initial": 128,
    "maximum": 128,
    "element": "anyfunc"
  });
  imports["env"]["__indirect_function_table"] = wasmTable;
}

// Module instantiation
var asmLibraryArg = {
  "emscripten_resize_heap": function(delta) {
    var oldPages = wasmMemory.buffer.byteLength / 65536;
    var newPages = Math.max(oldPages + delta, 0);
    if (wasmMemory.grow(newPages - oldPages) < 0) return -1;
    return 0;
  },
  "emscripten_memcpy_big": function(dest, src, num) {
    var heap8 = new Uint8Array(wasmMemory.buffer);
    heap8.set(heap8.subarray(src, src + num), dest);
    return dest;
  }
};

// Export functions matching C API
var _malloc, _free;
var _engine_create, _engine_render, _engine_free;
var _result_get_sample_rate, _result_get_num_samples;
var _result_get_left_buffer, _result_get_right_buffer;
var _result_get_peak, _result_get_duration, _result_free;

// WASM instantiation
function instantiateAsync() {
  if (typeof WebAssembly.instantiateStreaming === 'function') {
    return WebAssembly.instantiateStreaming(
      fetch('resonator.wasm', {credentials: 'same-origin'}),
      {env: asmLibraryArg, wasi_snapshot_preview1: {}}
    );
  } else {
    return fetch('resonator.wasm', {credentials: 'same-origin'})
      .then(response => response.arrayBuffer())
      .then(bytes => WebAssembly.instantiate(bytes, {env: asmLibraryArg, wasi_snapshot_preview1: {}}));
  }
}

instantiateAsync().then(result => {
  var exports = result.instance.exports;
  
  _malloc = exports.wasm_malloc || exports._malloc;
  _free = exports.wasm_free || exports._free;
  _engine_create = exports.engine_create;
  _engine_render = exports.engine_render;
  _engine_free = exports.engine_free;
  _result_get_sample_rate = exports.result_get_sample_rate;
  _result_get_num_samples = exports.result_get_num_samples;
  _result_get_left_buffer = exports.result_get_left_buffer;
  _result_get_right_buffer = exports.result_get_right_buffer;
  _result_get_peak = exports.result_get_peak;
  _result_get_duration = exports.result_get_duration;
  _result_free = exports.result_free;
  
  Module.asm = exports;
  Module.wasmMemory = wasmMemory;
  
  readyPromiseResolve(Module);
});

// Utility: String to WASM memory
Module.stringToUTF8 = function(str, outPtr, maxBytesToWrite) {
  if (maxBytesToWrite === undefined) maxBytesToWrite = 0x7FFFFFFF;
  if (maxBytesToWrite < 1) return 0;
  var startPtr = outPtr;
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i);
    if (u >= 0x80) u = 0xFFFD; // replacement char
    if (outPtr - startPtr >= maxBytesToWrite - 1) break;
    var heap8 = new Uint8Array(wasmMemory.buffer);
    heap8[outPtr++] = u;
  }
  heap8[outPtr] = 0;
  return outPtr - startPtr;
};

// Utility: Get value from heap
Module.getValue = function(ptr, type) {
  var heap = new Float32Array(wasmMemory.buffer);
  if (type === 'float') return heap[ptr >> 2];
  var heap64 = new Float64Array(wasmMemory.buffer);
  if (type === 'double') return heap64[ptr >> 3];
  var heap32 = new Int32Array(wasmMemory.buffer);
  if (type === 'i32') return heap32[ptr >> 2];
  return 0;
};

// Utility: Set value in heap
Module.setValue = function(ptr, value, type) {
  if (type === 'float') {
    new Float32Array(wasmMemory.buffer)[ptr >> 2] = value;
  } else if (type === 'double') {
    new Float64Array(wasmMemory.buffer)[ptr >> 3] = value;
  } else if (type === 'i32') {
    new Int32Array(wasmMemory.buffer)[ptr >> 2] = value;
  }
};

// Exported API wrapper
Module.generateField = function(presetText) {
  // Allocate preset string
  var presetLen = presetText.length + 1;
  var presetPtr = _malloc(presetLen);
  Module.stringToUTF8(presetText, presetPtr, presetLen);
  
  // Create engine
  var enginePtr = _engine_create(presetPtr);
  _free(presetPtr);
  
  if (!enginePtr) throw new Error("Engine creation failed");
  
  // Render
  var resultPtr = _engine_render(enginePtr);
  if (!resultPtr) {
    _engine_free(enginePtr);
    throw new Error("Render failed");
  }
  
  // Extract metadata
  var sampleRate = _result_get_sample_rate(resultPtr);
  var numSamples = _result_get_num_samples(resultPtr);
  var peak = _result_get_peak(resultPtr);
  var duration = _result_get_duration(resultPtr);
  
  // Extract buffers
  var leftPtr = _result_get_left_buffer(resultPtr);
  var rightPtr = _result_get_right_buffer(resultPtr);
  
  // Copy to JS (transferable arrays for worker)
  var leftBuffer = new Float32Array(numSamples);
  var rightBuffer = new Float32Array(numSamples);
  var heapF32 = new Float32Array(wasmMemory.buffer);
  
  for (var i = 0; i < numSamples; i++) {
    leftBuffer[i] = heapF32[(leftPtr >> 2) + i];
    rightBuffer[i] = heapF32[(rightPtr >> 2) + i];
  }
  
  // Cleanup WASM memory
  _result_free(resultPtr);
  _engine_free(enginePtr);
  
  return {
    sampleRate: sampleRate,
    numSamples: numSamples,
    duration: duration,
    peak: peak,
    leftChannel: leftBuffer,
    rightChannel: rightBuffer
  };
};

return Module;
}
  );
})();
if (typeof exports === 'object' && typeof module === 'object')
  module.exports = ResonatorModule;
else if (typeof define === 'function' && define['amd'])
  define([], function() { return ResonatorModule; });
else if (typeof exports === 'object')
  exports["ResonatorModule"] = ResonatorModule;
