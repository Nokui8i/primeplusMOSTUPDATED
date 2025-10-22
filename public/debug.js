// Debug script for PrimePlus+ layout debugging
console.log('🔍 DEBUG: Layout script executing...');
console.log('🔍 DEBUG: Document ready state:', document.readyState);
console.log('🔍 DEBUG: Window location:', window.location.href);
console.log('🔍 DEBUG: User agent:', navigator.userAgent);
console.log('🔍 DEBUG: Timestamp:', new Date().toISOString());

// Check for any existing errors
window.addEventListener('error', function(e) {
  console.error('🔍 DEBUG: Global error caught:', e.error);
  console.error('🔍 DEBUG: Error message:', e.message);
  console.error('🔍 DEBUG: Error filename:', e.filename);
  console.error('🔍 DEBUG: Error line:', e.lineno);
  console.error('🔍 DEBUG: Error column:', e.colno);
});

// Check for unhandled promise rejections
window.addEventListener('unhandledrejection', function(e) {
  console.error('🔍 DEBUG: Unhandled promise rejection:', e.reason);
});

console.log('🔍 DEBUG: Body script executing...');
console.log('🔍 DEBUG: React components should load now...');
console.log('🔍 DEBUG: Body element:', document.body);
console.log('🔍 DEBUG: End of body script executing...');
console.log('🔍 DEBUG: All components should be loaded now...');
