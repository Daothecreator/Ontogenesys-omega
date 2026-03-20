/*
 * ∆Ω-RESONATOR WASM v1.2w
 * Emscripten build: 
 * emcc resonator_wasm.cpp -O3 -s WASM=1 -s EXPORTED_FUNCTIONS="['_malloc','_free']" -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap','getValue','setValue']" -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_NAME="ResonatorModule" -o resonator.js
 */

#include <emscripten/emscripten.h>
#include <cmath>
#include <vector>
#include <string>
#include <cstring>
#include <algorithm>
#include <sstream>
#include <cstdint>
#include <map>

extern "C" {
    EMSCRIPTEN_KEEPALIVE void* wasm_malloc(size_t size) { return malloc(size); }
    EMSCRIPTEN_KEEPALIVE void wasm_free(void* ptr) { free(ptr); }
}

const double PHI = 1.618033988749895;
const double PI = 3.14159265358979323846;

struct FlatPreset {
    std::map<std::string, double> numbers;
    std::map<std::string, std::string> strings;
    
    void parse(const char* text) {
        std::istringstream stream(text);
        std::string line;
        while(std::getline(stream, line)) {
            auto comment = line.find('#');
            if(comment != std::string::npos) line = line.substr(0, comment);
            auto eqPos = line.find('=');
            if(eqPos == std::string::npos) continue;
            
            std::string key = line.substr(0, eqPos);
            std::string val = line.substr(eqPos + 1);
            
            key.erase(0, key.find_first_not_of(" \t\r\n"));
            key.erase(key.find_last_not_of(" \t\r\n") + 1);
            val.erase(0, val.find_first_not_of(" \t\r\n"));
            val.erase(val.find_last_not_of(" \t\r\n") + 1);
            
            if(key.empty()) continue;
            
            try {
                size_t pos;
                double num = std::stod(val, &pos);
                if(pos == val.length()) numbers[key] = num;
                else strings[key] = val;
            } catch(...) {
                strings[key] = val;
            }
        }
    }
    
    double getDouble(const char* key, double def) const {
        auto it = numbers.find(key);
        return (it != numbers.end()) ? it->second : def;
    }
    
    const char* getString(const char* key, const char* def) const {
        auto it = strings.find(key);
        return (it != strings.end()) ? it->second.c_str() : def;
    }
};

struct RenderResult {
    float* leftBuffer;
    float* rightBuffer;
    int numSamples;
    int sampleRate;
    double peakAmplitude;
    double durationActual;
};

extern "C" {

EMSCRIPTEN_KEEPALIVE
void* engine_create(const char* preset_text) {
    FlatPreset* preset = new FlatPreset();
    preset->parse(preset_text);
    return preset;
}

EMSCRIPTEN_KEEPALIVE
void* engine_render(void* engine_ptr) {
    if(!engine_ptr) return nullptr;
    
    FlatPreset& p = *(FlatPreset*)engine_ptr;
    
    int sampleRate = (int)p.getDouble("sample_rate", 48000);
    double duration = p.getDouble("duration_sec", 480);
    int totalSamples = (int)(duration * sampleRate);
    
    RenderResult* result = (RenderResult*)malloc(sizeof(RenderResult));
    result->leftBuffer = (float*)malloc(totalSamples * sizeof(float));
    result->rightBuffer = (float*)malloc(totalSamples * sizeof(float));
    result->sampleRate = sampleRate;
    result->numSamples = totalSamples;
    
    if(!result->leftBuffer || !result->rightBuffer) {
        free(result->leftBuffer);
        free(result->rightBuffer);
        free(result);
        return nullptr;
    }
    
    // Parameters
    double cHz = p.getDouble("carrier_hz", 20.51);
    double mix = p.getDouble("carrier_mix", 0.7);
    double hDecay = std::max(1.01, p.getDouble("harmonic_decay", 1.6));
    double stereoW = p.getDouble("stereo_width", 0.5);
    double stereoE = p.getDouble("stereo_expansion", 1.0);
    double sExp = std::min(1.0, std::max(0.0, stereoW * stereoE));
    double head = p.getDouble("headroom", 0.3);
    double md = p.getDouble("mod_depth", 0.25);
    double gInt = p.getDouble("gamma_intensity", 0.6);
    double mMult = p.getDouble("modulation_mult", 1.0);
    
    const char* mode = p.getString("mode", "action");
    double bias = (strcmp(mode, "action") == 0) ? 0.2 : (strcmp(mode, "survival") == 0) ? 0.0 : 0.1;
    double base = cHz + bias;
    
    double sweepR = std::min(1.0, std::max(0.0, 0.6 + sExp * 0.25));
    double lower = p.getDouble("lower_hz", 10.55);
    double upper = p.getDouble("upper_hz", 33.18);
    double sweepStart = base - (base - lower) * sweepR;
    double sweepEnd = base + (upper - base) * sweepR;
    
    double infralow = p.getDouble("infralow_hz", 0.125);
    double theta = p.getDouble("theta_hz", 5.08);
    double exitC = p.getDouble("exit_curve", 0.5);
    double exitTarget = infralow * exitC + theta * (1.0 - exitC);
    
    double gamma = p.getDouble("gamma_hz", 90.12);
    double delta = p.getDouble("delta_hz", 1.25);
    
    int harmonics = (int)p.getDouble("harmonics", 4);
    double attackPct = p.getDouble("attack_percent", 5);
    double releasePct = p.getDouble("release_percent", 5);
    
    struct Phase { double dur, sf, ef, a0, a1, mf; };
    Phase phases[4] = {
        {duration * 0.15, theta, base, 
         p.getDouble("entry_amp_start", 0.0), p.getDouble("entry_amp_end", 0.8), delta},
        {duration * 0.25, base, base, 
         p.getDouble("lock_amp_start", 0.8), p.getDouble("lock_amp_end", 0.9), gamma * 0.3 * mMult},
        {duration * 0.45, sweepStart, sweepEnd, 
         p.getDouble("sweep_amp_start", 0.9), p.getDouble("sweep_amp_end", 1.0), gamma * mMult},
        {duration * 0.15, sweepEnd, exitTarget, 
         p.getDouble("exit_amp_start", 1.0), p.getDouble("exit_amp_end", 0.0), delta}
    };
    
    int idx = 0;
    double peak = 0.0;
    
    for(int ph = 0; ph < 4; ph++) {
        int samples = (int)(phases[ph].dur * sampleRate);
        int attackSamples = (int)(phases[ph].dur * sampleRate * attackPct / 100.0);
        int releaseSamples = (int)(phases[ph].dur * sampleRate * releasePct / 100.0);
        
        for(int i = 0; i < samples && idx < totalSamples; i++, idx++) {
            double t = (double)idx / sampleRate;
            double pr = (double)i / samples;
            
            double freq = phases[ph].sf * std::pow(phases[ph].ef / phases[ph].sf, pr);
            double amp = phases[ph].a0 + (phases[ph].a1 - phases[ph].a0) * pr;
            
            if(attackSamples > 0 && i < attackSamples) amp *= (double)i / attackSamples;
            if(releaseSamples > 0 && i >= samples - releaseSamples) 
                amp *= (double)(samples - i) / releaseSamples;
            
            double modPh = 2 * PI * phases[ph].mf * t;
            double am = 1.0 + md * gInt * std::sin(modPh);
            double fm = std::sin(2 * PI * delta * t) * 0.5;
            double sp = sExp * 0.35;
            
            double lh = 0.0, rh = 0.0;
            for(int h = 1; h <= harmonics; h++) {
                double hf = freq * std::pow(PHI, h);
                double ha = std::pow(1.0 / hDecay, h);
                double pan = (h % 2 == 0) ? -sExp : sExp;
                double arg = 2 * PI * hf * t + fm;
                lh += ha * (1.0 + pan * 0.3) * std::sin(arg - 2 * PI * hf * sp);
                rh += ha * (1.0 - pan * 0.3) * std::sin(arg + 2 * PI * hf * sp);
            }
            
            double lc = mix * std::sin(2 * PI * freq * (t - sp) + fm);
            double rc = mix * std::sin(2 * PI * freq * (t + sp) + fm);
            double hm = p.getDouble("harmonic_mix", 0.3);
            
            double ls = head * amp * am * (lc + hm * lh);
            double rs = head * amp * am * (rc + hm * rh);
            
            // tanh soft clip
            ls = ls > 3 ? 1 : ls < -3 ? -1 : ls * (27 + ls*ls) / (27 + 9*ls*ls);
            rs = rs > 3 ? 1 : rs < -3 ? -1 : rs * (27 + rs*rs) / (27 + 9*rs*rs);
            
            result->leftBuffer[idx] = (float)ls;
            result->rightBuffer[idx] = (float)rs;
            peak = std::max({peak, std::abs(ls), std::abs(rs)});
        }
    }
    
    result->numSamples = idx;
    result->peakAmplitude = peak;
    result->durationActual = (double)idx / sampleRate;
    
    return result;
}

EMSCRIPTEN_KEEPALIVE int result_get_sample_rate(void* r) { 
    return r ? ((RenderResult*)r)->sampleRate : 0; 
}

EMSCRIPTEN_KEEPALIVE int result_get_num_samples(void* r) { 
    return r ? ((RenderResult*)r)->numSamples : 0; 
}

EMSCRIPTEN_KEEPALIVE float* result_get_left_buffer(void* r) { 
    return r ? ((RenderResult*)r)->leftBuffer : nullptr; 
}

EMSCRIPTEN_KEEPALIVE float* result_get_right_buffer(void* r) { 
    return r ? ((RenderResult*)r)->rightBuffer : nullptr; 
}

EMSCRIPTEN_KEEPALIVE double result_get_peak(void* r) { 
    return r ? ((RenderResult*)r)->peakAmplitude : 0.0; 
}

EMSCRIPTEN_KEEPALIVE double result_get_duration(void* r) { 
    return r ? ((RenderResult*)r)->durationActual : 0.0; 
}

EMSCRIPTEN_KEEPALIVE void result_free(void* r) {
    if(!r) return;
    RenderResult* res = (RenderResult*)r;
    free(res->leftBuffer);
    free(res->rightBuffer);
    free(res);
}

EMSCRIPTEN_KEEPALIVE void engine_free(void* e) {
    if(e) delete (FlatPreset*)e;
}

} // extern "C"
