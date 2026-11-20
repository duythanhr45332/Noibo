const express = require('express');
const router = express.Router();
const sprint3Controller = require('../controllers/sprint3.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Tổng hợp KPI Dự án, Công nợ & Cảnh báo nhắc Log Mandays
 */

/**
 * @swagger
 * /api/v1/dashboard/summary:
 *   get:
 *     summary: Tổng hợp KPI Dashboard theo quyền (ẩn VNĐ đối với PM)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dữ liệu tổng hợp Dashboard
 */
router.get('/summary', authMiddleware, sprint3Controller.dashboardSummary);

module.exports = router;
