// src/repositories/workflowRepository.js
const pool = require('../config/db');

class WorkflowRepository {
  // =============================================================
  // WORKFLOW MASTER
  // =============================================================

  async getAll({ limit = 50, offset = 0, search, is_active } = {}) {
    let conditions = [];
    let params = [];

    if (search) {
      conditions.push('(workflow_name LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(is_active);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(
      `SELECT * FROM workflow_master ${whereClause} ORDER BY workflow_name ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM workflow_master ${whereClause}`,
      params
    );

    return { rows, total: countResult[0].total };
  }

  async getById(id) {
    const [rows] = await pool.query('SELECT * FROM workflow_master WHERE id = ?', [id]);
    return rows[0];
  }

  async create({ workflow_name, description }) {
    const [result] = await pool.query(
      'INSERT INTO workflow_master (workflow_name, description) VALUES (?, ?)',
      [workflow_name, description || null]
    );
    return result.insertId;
  }

  async update(id, { workflow_name, description, is_active }) {
    const updates = [];
    const params = [];

    if (workflow_name !== undefined) { updates.push('workflow_name = ?'); params.push(workflow_name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

    if (updates.length === 0) return;

    params.push(id);
    await pool.query(
      `UPDATE workflow_master SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  // =============================================================
  // WORKFLOW STEPS
  // =============================================================

  async getSteps(workflowId) {
    const [rows] = await pool.query(
      `SELECT ws.*, r.role_name AS required_role_name
       FROM workflow_steps ws
       LEFT JOIN roles r ON ws.required_role_id = r.id
       WHERE ws.workflow_id = ? AND ws.is_active = 1
       ORDER BY ws.step_order ASC`,
      [workflowId]
    );
    return rows;
  }

  async getStepById(id) {
    const [rows] = await pool.query(
      `SELECT ws.*, wm.workflow_name, r.role_name AS required_role_name
       FROM workflow_steps ws
       JOIN workflow_master wm ON ws.workflow_id = wm.id
       LEFT JOIN roles r ON ws.required_role_id = r.id
       WHERE ws.id = ?`,
      [id]
    );
    return rows[0];
  }

  async getNextStep(workflowId, currentStepOrder) {
    const [rows] = await pool.query(
      `SELECT ws.*, r.role_name AS required_role_name
       FROM workflow_steps ws
       LEFT JOIN roles r ON ws.required_role_id = r.id
       WHERE ws.workflow_id = ? AND ws.step_order > ? AND ws.is_active = 1
       ORDER BY ws.step_order ASC
       LIMIT 1`,
      [workflowId, currentStepOrder]
    );
    return rows[0] || null;
  }

  async getFirstStep(workflowId) {
    const [rows] = await pool.query(
      `SELECT ws.*, r.role_name AS required_role_name
       FROM workflow_steps ws
       LEFT JOIN roles r ON ws.required_role_id = r.id
       WHERE ws.workflow_id = ? AND ws.is_active = 1
       ORDER BY ws.step_order ASC
       LIMIT 1`,
      [workflowId]
    );
    return rows[0] || null;
  }

  async createStep({ workflow_id, step_order, step_name, step_code, is_optional, required_role_id }) {
    const [result] = await pool.query(
      `INSERT INTO workflow_steps (workflow_id, step_order, step_name, step_code, is_optional, required_role_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [workflow_id, step_order, step_name, step_code, is_optional ? 1 : 0, required_role_id || null]
    );
    return result.insertId;
  }

  async updateStep(id, { step_order, step_name, step_code, is_optional, is_active, required_role_id }) {
    const updates = [];
    const params = [];

    if (step_order !== undefined) { updates.push('step_order = ?'); params.push(step_order); }
    if (step_name !== undefined) { updates.push('step_name = ?'); params.push(step_name); }
    if (step_code !== undefined) { updates.push('step_code = ?'); params.push(step_code); }
    if (is_optional !== undefined) { updates.push('is_optional = ?'); params.push(is_optional ? 1 : 0); }
    if (required_role_id !== undefined) { updates.push('required_role_id = ?'); params.push(required_role_id || null); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

    if (updates.length === 0) return;

    params.push(id);
    await pool.query(
      `UPDATE workflow_steps SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  async deleteStep(id) {
    await pool.query('UPDATE workflow_steps SET is_active = 0 WHERE id = ?', [id]);
  }

  // =============================================================
  // WORKFLOW STEP TRANSITIONS
  // =============================================================

  async getTransitions(workflowId) {
    const [rows] = await pool.query(
      `SELECT wst.*,
              fs.step_name AS from_step_name,
              ts.step_name AS to_step_name,
              r.role_name AS allowed_role_name
       FROM workflow_step_transitions wst
       LEFT JOIN workflow_steps fs ON wst.from_step_id = fs.id
       LEFT JOIN workflow_steps ts ON wst.to_step_id = ts.id
       LEFT JOIN roles r ON wst.allowed_role_id = r.id
       WHERE wst.workflow_id = ? AND wst.is_active = 1
       ORDER BY wst.transition_type, wst.id ASC`,
      [workflowId]
    );
    return rows;
  }

  async getTransitionById(id) {
    const [rows] = await pool.query(
      `SELECT wst.*,
              fs.step_name AS from_step_name,
              ts.step_name AS to_step_name,
              r.role_name AS allowed_role_name
       FROM workflow_step_transitions wst
       LEFT JOIN workflow_steps fs ON wst.from_step_id = fs.id
       LEFT JOIN workflow_steps ts ON wst.to_step_id = ts.id
       LEFT JOIN roles r ON wst.allowed_role_id = r.id
       WHERE wst.id = ?`,
      [id]
    );
    return rows[0];
  }

  async findForwardTransition(workflowId, fromStepId, roleId) {
    const [rows] = await pool.query(
      `SELECT * FROM workflow_step_transitions
       WHERE workflow_id = ? AND from_step_id = ? AND allowed_role_id = ?
       AND transition_type = 'FORWARD' AND is_active = 1
       LIMIT 1`,
      [workflowId, fromStepId, roleId]
    );
    return rows[0] || null;
  }

  async findSendbackTransition(workflowId, fromStepId, roleId) {
    const [rows] = await pool.query(
      `SELECT * FROM workflow_step_transitions
       WHERE workflow_id = ? AND from_step_id = ? AND allowed_role_id = ?
       AND transition_type = 'SENDBACK' AND is_active = 1
       LIMIT 1`,
      [workflowId, fromStepId, roleId]
    );
    return rows[0] || null;
  }

  async findTransitionFromStart(workflowId, roleId) {
    // Used when package is created — find the first step transition for the creator role
    const [rows] = await pool.query(
      `SELECT wst.* FROM workflow_step_transitions wst
       WHERE wst.workflow_id = ? AND wst.from_step_id IS NULL
       AND wst.allowed_role_id = ? AND wst.transition_type = 'FORWARD'
       AND wst.is_active = 1
       LIMIT 1`,
      [workflowId, roleId]
    );
    return rows[0] || null;
  }

  async createTransition({ workflow_id, from_step_id, to_step_id, transition_type, allowed_role_id }) {
    const [result] = await pool.query(
      `INSERT INTO workflow_step_transitions (workflow_id, from_step_id, to_step_id, transition_type, allowed_role_id)
       VALUES (?, ?, ?, ?, ?)`,
      [workflow_id, from_step_id || null, to_step_id, transition_type, allowed_role_id]
    );
    return result.insertId;
  }

  async updateTransition(id, { from_step_id, to_step_id, transition_type, allowed_role_id, is_active }) {
    const updates = [];
    const params = [];

    if (from_step_id !== undefined) { updates.push('from_step_id = ?'); params.push(from_step_id || null); }
    if (to_step_id !== undefined) { updates.push('to_step_id = ?'); params.push(to_step_id || null); }
    if (transition_type !== undefined) { updates.push('transition_type = ?'); params.push(transition_type); }
    if (allowed_role_id !== undefined) { updates.push('allowed_role_id = ?'); params.push(allowed_role_id); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

    if (updates.length === 0) return;

    params.push(id);
    await pool.query(
      `UPDATE workflow_step_transitions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  async deleteTransition(id) {
    await pool.query('UPDATE workflow_step_transitions SET is_active = 0 WHERE id = ?', [id]);
  }
}

module.exports = new WorkflowRepository();
