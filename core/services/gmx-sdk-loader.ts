// This file forces Vercel to include @gmx-io/sdk in the bundle
// by doing a static require at module level

let _sdkResolved: string | null = null;

export function ensureSDKIncluded(): void {
  if (_sdkResolved) return;
  
  try {
    // Force static resolution to ensure Vercel includes the module
    const { createRequire } = require('module');
    const path = require('path');
    const requireSDK = createRequire(path.resolve(process.cwd(), 'package.json'));
    _sdkResolved = requireSDK.resolve('@gmx-io/sdk');
  } catch (error) {
    // Will be resolved at runtime in the actual service
    _sdkResolved = null;
  }
}

// Call immediately to force inclusion
ensureSDKIncluded();

