# GroovinLog

GroovinLog is a lightweight dance class review and practice tracking app.

It helps you record class reviews, keep video references, manually create practice tasks, log practice sessions, and review the week. The current version is designed as a local-first MVP.

## Local development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open the app in your browser:

```text
http://localhost:3000
```

Run checks before deploying:

```bash
npm run lint
npm run build
```

## PWA: add to home screen

GroovinLog includes a basic PWA manifest and app icons, so it can be added to a phone home screen from the browser.

On iPhone Safari:

1. Open the deployed GroovinLog URL in Safari.
2. Tap the Share button.
3. Choose “Add to Home Screen”.
4. Confirm the name and tap Add.

This does not require App Store release, Capacitor, React Native, or native iOS code.

## Data storage

The current MVP stores data in the browser with `localStorage`.

This means:

- Records stay on the same browser and device.
- Clearing browser data may delete records.
- Switching devices or browsers will not automatically bring records over.
- There is currently no cloud sync or account system.

## Current scope

The current version does not include:

- Database
- AI features
- Login or user accounts
- Video upload
- Cloud video storage
- Video transcoding
- Native iOS photo library access

## Video reference limitation

The PWA version does not upload videos and cannot permanently bind to videos inside iOS Photos.

Video references only save a filename, location note, or link so you can find the video later in your album, files, cloud drive, or another app.

## Deployment

This project is a standard Next.js app and can be deployed to Vercel.

Recommended Vercel settings:

- Framework Preset: Next.js
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: leave as the Vercel default for Next.js

No environment variables are required for the current localStorage-only MVP.
