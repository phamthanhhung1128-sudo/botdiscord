/**
 * src/routes/health.js
 * ---------------------------------------------------------------------------
 * Endpoint kiểm tra sức khoẻ hệ thống.
 *   GET /health       → JSON (dùng cho uptime monitor, Docker healthcheck)
 *   GET /health/page  → trang HTML thân thiện cho người xem
 */
'use strict';

const express = require('express');
const db = require('../db');
const env = require('../config/env');

const router = express.Router();
const startedAt = Date.now();

function buildReport() {
  const isDbOk = (() => {
    try {
      db.get('SELECT 1 AS ok');
      return true;
    } catch {
      return false;
    }
  })();

  const stats = isDbOk ? db.stats() : null;

  return {
    ok: isDbOk,
    status: isDbOk ? 'healthy' : 'degraded',
    app: {
      name: env.APP_NAME,
      env: env.NODE_ENV,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      node: process.version,
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    database: stats
      ? {
          engine: stats.engine,
          journalMode: stats.journalMode,
          tables: stats.tableCount,
          sizeKB: Math.round(stats.fileSizeBytes / 1024),
        }
      : { engine: 'unknown', error: 'Không kết nối được database' },
    timestamp: new Date().toISOString(),
  };
}

router.get('/', (req, res) => {
  const report = buildReport();
  res.status(report.ok ? 200 : 503).json(report);
});

router.get('/page', (req, res) => {
  const report = buildReport();
  res.status(report.ok ? 200 : 503).render('pages/health', {
    title: 'Trạng thái hệ thống',
    report,
  });
});

module.exports = router;
