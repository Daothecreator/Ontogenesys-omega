# Build & Deploy Guide — Ontogenesys-omega (∆Ω-RESONATOR)

## Quick Reference

| Target | Status | Command | Time |
|--------|--------|---------|------|
| Web (Dev) | ✅ | `npm run dev` | <1 min |
| Web (Prod) | ✅ | `npm run build` | 2–3 min |
| APK (Debug) | ✅ | `npm run build:apk` | 15–20 min |
| APK (Release) | ✅ | `./build-release.sh --sign` | 15–20 min |
| APK (Cloud) | ✅ | Push to `main` → GitHub Actions | ~20 min |

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| npm | 10+ | Bundled with Node.js |
| Java (JDK) | 17 | `sudo apt install openjdk-17-jdk` |
| Android SDK | API 33+ | Android Studio or `sdkmanager` |

---

## Web Deployment

### Development
```bash
npm install
npm run dev
# Opens http://localhost:3000
```

### Production build
```bash
npm run build
# Generates optimized output in dist/
```

### Deploy options
```bash
# Vercel
vercel deploy --prod

# Netlify
netlify deploy --prod --dir=dist

# GitHub Pages (via gh-pages)
npx gh-pages -d dist
```

---

## Mobile APK Build

### First-time setup
```bash
# 1. Install dependencies
npm install

# 2. Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 3. Add Android platform
npm run cap:add:android
```

### Debug build
```bash
npm run build:apk
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### Release (signed) build
```bash
# Set signing credentials
export KEYSTORE_PATH=/path/to/release.jks
export KEYSTORE_PASSWORD=your-keystore-password
export KEY_ALIAS=your-key-alias
export KEY_PASSWORD=your-key-password

./build-release.sh --sign
# Output: android/app/build/outputs/apk/release/app-release.apk
```

### Install on device
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## GitHub Actions (Cloud APK Build)

The workflow file `.github/workflows/build-apk.yml` automatically:

1. Triggers on every push to `main`
2. Builds web assets with Vite
3. Adds the Android Capacitor platform
4. Builds the debug APK via Gradle
5. Uploads the APK as a downloadable artifact (retained 30 days)
6. Creates a GitHub Release with the APK attached

### Download APK from GitHub Actions
1. Go to the repository on GitHub
2. Click **Actions** tab
3. Select the latest **Build APK** workflow run
4. Under **Artifacts**, click `app-debug` to download

### Signed release builds via GitHub Actions

Add these secrets in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `KEYSTORE_BASE64` | Base64-encoded `.jks` keystore file |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias |
| `KEY_PASSWORD` | Key password |

---

## Capacitor Configuration

Key settings in `capacitor.config.ts`:

```ts
{
  appId: 'com.resonator.quantum',
  appName: '∆Ω-RESONATOR',
  webDir: 'dist',          // Vite output directory
}
```

> **Important:** `webDir` must match the Vite build output (`dist`).

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `java: command not found` | Install JDK 17: `sudo apt install openjdk-17-jdk` |
| `ANDROID_HOME not set` | `export ANDROID_HOME=$HOME/Android/Sdk` |
| `gradlew: Permission denied` | `chmod +x android/gradlew` |
| `SDK location not found` | Create `android/local.properties` with `sdk.dir=/path/to/sdk` |
| TypeScript errors | Run `npm run lint` to check before building |
| Capacitor sync fails | Delete `android/` folder and re-run `npx cap add android` |

---

## Project Structure

```
Ontogenesys-omega/
├── .github/
│   └── workflows/
│       └── build-apk.yml       # Cloud APK CI/CD
├── ResonatorEngine.ts           # Audio synthesis engine
├── PresetEngine.ts              # Preset management
├── QuantumFieldGenerator.tsx    # Main React UI component
├── capacitor.config.ts          # Capacitor/Android config
├── vite.config.ts               # Vite build config
├── package.json                 # Scripts and dependencies
├── build-release.sh             # Production build script
├── BUILD_AND_DEPLOY.md          # This file
└── MODULE_VERIFICATION.md       # Module audit report
```
