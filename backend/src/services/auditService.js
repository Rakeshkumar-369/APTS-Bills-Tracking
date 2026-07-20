// src/services/auditService.js
const auditRepository = require('../repositories/auditRepository');
const logger = require('../utils/logger');

class AuditService {
  async log(data) {
    try {
      const { table_name, record_id, action, old_value, new_value, performed_by, ip_address, user_agent } = data;
      await auditRepository.createAuditLog({
        table_name,
        record_id: record_id || null,
        action,
        old_value: old_value || null,
        new_value: new_value || null,
        performed_by: performed_by || null,
        ip_address: ip_address || null,
        user_agent: user_agent || null
      });
    } catch (err) {
      // Never break main flow because of audit failure
      logger.error('Failed to create audit log', { error: err, data });
    }
  }

  async getAuditLogs(table_name, record_id, pagination) {
    return auditRepository.getAuditLogs(table_name, record_id, pagination);
  }
}

module.exports = new AuditService();