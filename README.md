# Hush Web Client

Next.js web client for HushNetwork - a decentralized social network.

**Live URL:** https://chat.hushnetwork.social

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run tests once (CI mode)
npm run test:run

# Build for production
npm run build
```

## Code Quality

### Pre-Commit Check (REQUIRED)

**Before every git commit**, run the local CI script to catch issues early:

```powershell
# Windows (PowerShell)
cd hush-web-client
.\scripts\ci-local.ps1
```

```bash
# Linux/Mac
cd hush-web-client
./scripts/ci-local.sh
```

This script runs the same checks as GitHub CI:
1. `npm ci` - Install dependencies
2. `npm run lint` - ESLint check
3. `npm run test:run` - Unit tests
4. `npm run build` - Production build

**Only commit if all 4 steps pass!**

### Manual Commands

If you prefer running checks individually:

```bash
npm run lint      # ESLint check
npm run test:run  # Unit tests
npm run build     # Production build
```

### CI/CD

The GitHub Actions workflow (`.github/workflows/ci-hush-webclient.yml`) runs on every push/PR to `master` that changes files in `hush-web-client/`:

1. Install dependencies
2. **Lint** - ESLint check
3. **Test** - Vitest unit tests
4. **Build** - Next.js production build

All steps must pass for the PR to be mergeable.

## Tauri Desktop App

```bash
# Development mode
npm run tauri:dev

# Production build (connects to live server)
npm run tauri:prod

# Build distributable
npm run tauri:build
```

## Project Structure

```
hush-web-client/
├── src/
│   ├── app/           # Next.js App Router pages
│   ├── components/    # React components
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities (crypto, grpc, sync)
│   ├── modules/       # Feature modules (feeds, reactions, identity)
│   └── stores/        # Zustand state stores
├── public/            # Static assets
├── src-tauri/         # Tauri desktop configuration
└── eslint.config.mjs  # ESLint configuration
```

## Technologies

- **Framework:** Next.js 14+ with App Router
- **UI:** React 19, Tailwind CSS
- **State:** Zustand
- **Testing:** Vitest, Testing Library
- **Desktop:** Tauri 2.0
- **Communication:** gRPC-Web
