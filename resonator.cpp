#include <emscripten/emscripten.h>
#include <cmath>
#include <cstring>
#include <cstdlib>
#include <cstdint>

extern "C" {
    EMSCRIPTEN_KEEPALIVE void* wasm_malloc(size_t size) { return malloc(size); }
    EMSCRIPTEN_KEEPALIVE void wasm_free(void* ptr) { free(ptr); }
}

const double PHI = 1.618033988749895;
const double PI = 3.14159265358979323846;

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
    // Parse minimal preset: mode=duration_sec=value|...
    return (void*)strdup(preset_text);
}

EMSCRIPTEN_KEEPALIVE
void* engine_render(void* engine_ptr) {
    if(!engine_ptr) return nullptr;
    
    char* preset = (char*)engine_ptr;
    
    // Default params
    int sampleRate = 48000;
    double duration = 480;
    double cHz = 20.51;
    double gamma = 90.12;
    double delta = 1.25;
    double theta = 5.08;
    double lower = 10.55;
    double upper = 33.18;
    double infralow = 0.125;
    double mix = 0.7;
    double hm = 0.3;
    double stereoW = 0.5;
    double stereoE = 1.0;
    double head = 0.3;
    double md = 0.25;
    double gInt = 0.6;
    double mMult = 1.0;
    double hDecay = 1.6;
    double exitC = 0.5;
    int harmonics = 4;
    double attackPct = 5;
    double releasePct = 5;
    char mode[16] = "drift";
    
    // Parse preset
    char* copy = strdup(preset);
    char* line = strtok(copy, "\n");
    while(line) {
        char* eq = strchr(line, '=');
        if(eq) {
            *eq = 0;
            char* key = line;
            char* val = eq + 1;
            
            if(strcmp(key, "duration_sec") == 0) duration = atof(val);
            else if(strcmp(key, "carrier_hz") == 0) cHz = atof(val);
            else if(strcmp(key, "gamma_hz") == 0) gamma = atof(val);
            else if(strcmp(key, "delta_hz") == 0) delta = atof(val);
            else if(strcmp(key, "theta_hz") == 0) theta = atof(val);
            else if(strcmp(key, "lower_hz") == 0) lower = atof(val);
            else if(strcmp(key, "upper_hz") == 0) upper = atof(val);
            else if(strcmp(key, "infralow_hz") == 0) infralow = atof(val);
            else if(strcmp(key, "carrier_mix") == 0) mix = atof(val);
            else if(strcmp(key, "harmonic_mix") == 0) hm = atof(val);
            else if(strcmp(key, "stereo_width") == 0) stereoW = atof(val);
            else if(strcmp(key, "stereo_expansion") == 0) stereoE = atof(val);
            else if(strcmp(key, "headroom") == 0) head = atof(val);
            else if(strcmp(key, "mod_depth") == 0) md = atof(val);
            else if(strcmp(key, "gamma_intensity") == 0) gInt = atof(val);
            else if(strcmp(key, "modulation_mult") == 0) mMult = atof(val);
            else if(strcmp(key, "harmonic_decay") == 0) hDecay = atof(val);
            else if(strcmp(key, "exit_curve") == 0) exitC = atof(val);
            else if(strcmp(key, "harmonics") == 0) harmonics = atoi(val);
            else if(strcmp(key, "attack_percent") == 0) attackPct = atof(val);
            else if(strcmp(key, "release_percent") == 0) releasePct = atof(val);
            else if(strcmp(key, "mode") == 0) strncpy(mode, val, 15);
        }
        line = strtok(nullptr, "\n");
    }
    free(copy);
    
    // Derived params
    double sExp = stereoW * stereoE;
    if(sExp > 1.0) sExp = 1.0;
    if(sExp < 0.0) sExp = 0.0;
    
    double bias = (strcmp(mode, "action") == 0) ? 0.2 : (strcmp(mode, "survival") == 0) ? 0.0 : 0.1;
    double base = cHz + bias;
    
    double sweepR = 0.6 + sExp * 0.25;
    if(sweepR > 1.0) sweepR = 1.0;
    double sweepStart = base - (base - lower) * sweepR;
    double sweepEnd = base + (upper - base) * sweepR;
    double exitTarget = infralow * exitC + theta * (1.0 - exitC);
    
    if(hDecay < 1.01) hDecay = 1.01;
    
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
    
    // Phases
    struct Phase { double dur, sf, ef, a0, a1, mf; };
    Phase phases[4] = {
        {duration * 0.15, theta, base, 0.0, 0.8, delta},
        {duration * 0.25, base, base, 0.8, 0.9, gamma * 0.3 * mMult},
        {duration * 0.45, sweepStart, sweepEnd, 0.9, 1.0, gamma * mMult},
        {duration * 0.15, sweepEnd, exitTarget, 1.0, 0.0, delta}
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
            
            double freq = phases[ph].sf * pow(phases[ph].ef / phases[ph].sf, pr);
            double amp = phases[ph].a0 + (phases[ph].a1 - phases[ph].a0) * pr;
            
            if(attackSamples > 0 && i < attackSamples) amp *= (double)i / attackSamples;
            if(releaseSamples > 0 && i >= samples - releaseSamples) 
                amp *= (double)(samples - i) / releaseSamples;
            
            double modPh = 2 * PI * phases[ph].mf * t;
            double am = 1.0 + md * gInt * sin(modPh);
            double fm = sin(2 * PI * delta * t) * 0.5;
            double sp = sExp * 0.35;
            
            double lh = 0.0, rh = 0.0;
            for(int h = 1; h <= harmonics; h++) {
                double hf = freq * pow(PHI, h);
                double ha = pow(1.0 / hDecay, h);
                double pan = (h % 2 == 0) ? -sExp : sExp;
                double arg = 2 * PI * hf * t + fm;
                lh += ha * (1.0 + pan * 0.3) * sin(arg - 2 * PI * hf * sp);
                rh += ha * (1.0 - pan * 0.3) * sin(arg + 2 * PI * hf * sp);
            }
            
            double lc = mix * sin(2 * PI * freq * (t - sp) + fm);
            double rc = mix * sin(2 * PI * freq * (t + sp) + fm);
            
            double ls = head * amp * am * (lc + hm * lh);
            double rs = head * amp * am * (rc + hm * rh);
            
            // tanh
            ls = ls > 3 ? 1 : ls < -3 ? -1 : ls * (27 + ls*ls) / (27 + 9*ls*ls);
            rs = rs > 3 ? 1 : rs < -3 ? -1 : rs * (27 + rs*rs) / (27 + 9*rs*rs);
            
            result->leftBuffer[idx] = (float)ls;
            result->rightBuffer[idx] = (float)rs;
            if(fabs(ls) > peak) peak = fabs(ls);
            if(fabs(rs) > peak) peak = fabs(rs);
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
    if(e) free(e);
}

} // extern "C"