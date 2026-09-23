#!/usr/bin/env node
/**
 * مشغل بوابة واتساب المباشر لبوت التاكسي
 * يضبط متغيرات البيئة الافتراضية ويشغل البوابة بأمان دون مشاكل تشفير الـ CMD
 */

process.env.ADMIN_KEY = process.env.ADMIN_KEY || 'taxi-admin-2025';
process.env.WORKER_URL = process.env.WORKER_URL || 'http://127.0.0.1:3000';
process.env.GATEWAY_PORT = process.env.GATEWAY_PORT || '3010';

console.log('============================================================');
console.log('🚕 تشغيل بوابة واتساب (WhatsApp Gateway) لبوت التاكسي');
console.log('============================================================');
console.log('  - السيرفر السحابي:', process.env.WORKER_URL);
console.log('  - المنفذ الداخلي:', process.env.GATEWAY_PORT);
console.log('  - مفتاح الإدارة:', process.env.ADMIN_KEY ? '✅ مضبوط ومؤكد' : '❌ غير موجود');
console.log('============================================================\n');

await import('./gateway.mjs');
