// This file forces Vercel to include @gmx-io/sdk and its dependencies in the bundle
// by doing static requires at module level

let _sdkResolved: string | null = null;

export function ensureSDKIncluded(): void {
  if (_sdkResolved) return;
  
  try {
    // Force static resolution to ensure Vercel includes the modules
    const { createRequire } = require('module');
    const path = require('path');
    const requireSDK = createRequire(path.resolve(process.cwd(), 'package.json'));
    
    // Force inclusion of @gmx-io/sdk
    _sdkResolved = requireSDK.resolve('@gmx-io/sdk');
    
    // Force inclusion of cross-fetch (required by @gmx-io/sdk)
    // This ensures Vercel includes it in the bundle
    try {
      requireSDK.resolve('cross-fetch');
      // Also require it to force bundling
      require('cross-fetch');
    } catch {
      // cross-fetch will be resolved at runtime
    }
  } catch (error) {
    // Will be resolved at runtime in the actual service
    _sdkResolved = null;
  }
}

// Call immediately to force inclusion
ensureSDKIncluded();

