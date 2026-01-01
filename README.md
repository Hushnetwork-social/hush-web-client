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

### Linting

ESLint is configured with Next.js recommended rules plus TypeScript strict mode.

```bash
# Run lint check
npm run lint
```

**Before committing**, ensure:
1. All tests pass: `npm run test:run`
2. No lint errors: `npm run lint`
3. Build succeeds: `npm run build`

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
