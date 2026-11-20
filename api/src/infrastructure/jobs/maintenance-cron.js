const db = require('../../config/database');
const logger = require('../../utils/logger');

let timerHandle = null;

async function runMaintenanceSweep() {
  try {
    const overdueRes = await db.query(`
      UPDATE payment_installments
      SET payment_status = 'OVERDUE', updated_at = NOW()
      WHERE deleted_at IS NULL
        AND payment_status IN ('PENDING', 'INVOICED')
        AND due_date IS NOT NULL
        AND due_date < CURRENT_DATE
    `);

    const cleanedTokensRes = await db.query(`
      DELETE FROM refresh_tokens
      WHERE expires_at < NOW() - INTERVAL '7 days'
         OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')
    `);

    if ((overdueRes.rowCount || 0) > 0 || (cleanedTokensRes.rowCount || 0) > 0) {
      logger.info('Maintenance sweep completed', {
        markedOverdueInstallments: overdueRes.rowCount || 0,
        cleanedRefreshTokens: cleanedTokensRes.rowCount || 0,
      });
    }
  } catch (err) {
    logger.warn('Maintenance sweep skipped/failed:', err.message);
  }
}

function startMaintenanceCron(intervalMs = 60 * 60 * 1000) {
  if (timerHandle || process.env.NODE_ENV === 'test') return;
  runMaintenanceSweep();
  timerHandle = setInterval(runMaintenanceSweep, intervalMs);
  if (timerHandle.unref) timerHandle.unref();
}

function stopMaintenanceCron() {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}

module.exports = {
  runMaintenanceSweep,
  startMaintenanceCron,
  stopMaintenanceCron,
};
