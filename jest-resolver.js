module.exports = (request, options) => {
  // Handle googleapis and related packages that use ESM
  if (request === 'gaxios' || request.startsWith('gaxios/')) {
    // Try to resolve to CJS build if available
    try {
      const cjsPath = request.replace('gaxios', 'gaxios/build');
      return options.defaultResolver(cjsPath, options);
    } catch {
      // Fallback to original
      return options.defaultResolver(request, options);
    }
  }

  // Default resolver for all other modules
  return options.defaultResolver(request, options);
};
