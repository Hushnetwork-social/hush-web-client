/**
 * Version utility for displaying app version in the UI.
 *
 * The version is determined by:
 * 1. Development mode (npm run dev) -> "Development"
 * 2. Production with NEXT_PUBLIC_APP_VERSION set (CI/CD) -> The version (e.g., "v1.1.0")
 * 3. Production without version (local build) -> "Production"
 */

export function getVersionDisplay(): string {
  // In development mode, show "Development"
  if (process.env.NODE_ENV === 'development') {
    return 'Development';
  }

  // In production, check if a version was set at build time
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  if (version) {
    // Ensure consistent casing: "v1.1.0" -> "V1.1.0"
    return version.charAt(0).toUpperCase() + version.slice(1);
  }

  // Production build without version (local build)
  return 'Production';
}
