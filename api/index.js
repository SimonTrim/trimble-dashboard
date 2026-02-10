// Point d'entrée Vercel Serverless Function
// Structure standard: /api/*.js = fonction serverless

console.log('🔵 [Vercel] /api/index.js is loading...');
console.log('🔵 [Vercel] __dirname:', __dirname);
console.log('🔵 [Vercel] process.cwd():', process.cwd());

let app;
try {
  console.log('🔵 [Vercel] Attempting to require ../backend/server.js...');
  app = require('../backend/server.js');
  console.log('✅ [Vercel] server.js loaded successfully');
  console.log('✅ [Vercel] App type:', typeof app);
} catch (error) {
  console.error('❌ [Vercel] CRITICAL ERROR loading server.js:', error);
  console.error('❌ [Vercel] Error stack:', error.stack);
  throw error;
}

module.exports = app;
