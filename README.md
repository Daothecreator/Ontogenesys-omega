# ∆Ω-RESONATOR

Готовое приложение на Next.js 14 с App Router, Prisma, NextAuth, UI генератора, CRUD пресетов и клиентским аудио-движком.

## Что внутри

- landing / login / register / dashboard
- credentials auth + optional Google OAuth
- Prisma schema for users, presets and render jobs
- API routes for register, health, presets, render
- рабочий клиентский synth-движок с preview / play / WAV export
- Tailwind UI с quantum-стилем

## Быстрый старт

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

## Что важно

Скрипт `npm run wasm:build` оставлен как заглушка. Приложение уже работает без готового WASM-бинаря: рендер и playback выполняются в браузере через TypeScript engine.
