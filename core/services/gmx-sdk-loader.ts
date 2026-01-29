// Forces Vercel's Node File Trace to include these modules in the serverless bundle.
// Dynamic require/createRequire is not traced; a static require is.
try {
  require('@gmx-io/sdk');
} catch {
  // Resolved at runtime by gmx-service via findSDKPath
}
try {
  require('cross-fetch');
} catch {
  // Optional; SDK or runtime may load it
}

