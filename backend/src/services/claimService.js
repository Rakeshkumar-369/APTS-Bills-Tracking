const claimRepository = require('../repositories/claimRepository');
const projectRepository = require('../repositories/projectRepository');
const userRepository = require('../repositories/userRepository');
const poRepository = require('../repositories/poRepository');
const workflowService = require('./workflowService');
const auditService = require('./auditService');
const ApiError = require('../utils/ApiError');

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/claims');

class ClaimService {
  async getAll(params) {
    return claimRepository.getAll(params);
  }

  async getById(id) {
    const claim = await claimRepository.getById(id);
    if (!claim) throw new ApiError(404, 'Claim not found');
    return claim;
  }

  async getWithDetails(id) {
    const claim = await this.getById(id);
    claim.files = await claimRepository.getFiles(id);
    claim.history = await claimRepository.getHistory(id);
    return claim;
  }

  // ── Create Claim ──

  async create(data, files, currentUser, ipAddress) {
    const { vendor_id, vendor_contact_user_id, project_id, po_id, remarks } = data;

    // Only vendor users can create claims
    if (currentUser.role_name !== 'Vendor' || !currentUser.vendor_id) {
      throw new ApiError(403, 'Only vendor users can create claims');
    }

    // The creating user must belong to the vendor they're creating for
    if (currentUser.vendor_id !== Number(vendor_id)) {
      throw new ApiError(403, 'You can only create claims for your own vendor');
    }

    const vendorIdNum = Number(vendor_id);
    const projectIdNum = Number(project_id);
    const poIdNum = po_id ? Number(po_id) : null;

    // Validate vendor contact belongs to the selected vendor
    if (vendor_contact_user_id) {
      const contactUserIdNum = Number(vendor_contact_user_id);
      const contactUser = await userRepository.findById(contactUserIdNum);
      if (!contactUser) {
        throw new ApiError(400, 'Vendor contact user not found');
      }
      if (contactUser.vendor_id !== vendorIdNum) {
        throw new ApiError(400, 'Selected contact user does not belong to the chosen vendor');
      }
    }

    // Look up the project
    const project = await projectRepository.getById(projectIdNum);
    if (!project) {
      throw new ApiError(400, 'Project not found');
    }

    // Validate PO
    if (!poIdNum) {
      throw new ApiError(400, 'A Purchase Order must be selected for this claim');
    }
    const po = await poRepository.getById(poIdNum);
    if (!po || !po.is_active) {
      throw new ApiError(400, 'Purchase Order not found or is inactive');
    }
    if (po.vendor_id !== vendorIdNum) {
      throw new ApiError(403, 'This Purchase Order is not assigned to your vendor');
    }
    if (po.project_id !== projectIdNum) {
      throw new ApiError(400, 'Purchase Order does not belong to the selected project');
    }

    // Verify the vendor has access to this project
    const vendorProjectIds = await projectRepository.getVendorProjectIds(vendorIdNum);
    if (!vendorProjectIds.includes(projectIdNum)) {
      throw new ApiError(403, 'Your vendor does not have access to the selected project');
    }

    let workflow_id = project.workflow_id;
    let current_step_id = null;
    let current_step_order = 0;
    let current_assigned_user_id = null;
    let actionLabel = '';

    if (workflow_id) {
      // Workflow mode: find first step
      const firstStep = await workflowService.getFirstStep(workflow_id);
      if (!firstStep) {
        throw new ApiError(400, 'Workflow has no active steps. Add steps before creating claims.');
      }

      const createTransition = await workflowService.findTransitionFromStart(workflow_id, currentUser.role_id);
      if (!createTransition) {
        throw new ApiError(403, 'Your role is not authorised to create claims in this workflow');
      }

      current_step_id = firstStep.id;
      current_step_order = firstStep.step_order;
      actionLabel = `Claim created and dispatched to ${firstStep.step_name}`;
    } else {
      // Non-workflow mode: claim stays with the vendor until they manually assign
      current_assigned_user_id = currentUser.user_id;
      actionLabel = 'Claim created';
    }

    const claimCode = await this.generateClaimCode();

    const claimId = await claimRepository.create({
      claim_code: claimCode,
      vendor_id: vendorIdNum,
      vendor_contact_user_id: vendor_contact_user_id ? Number(vendor_contact_user_id) : null,
      project_id: projectIdNum,
      po_id: poIdNum,
      workflow_id: workflow_id || null,
      current_step_id,
      current_step_order,
      current_assigned_user_id,
      remarks: remarks || null,
      created_by: currentUser.user_id
    });

    // Record creation history
    await claimRepository.createHistory({
      claim_id: claimId,
      from_step_id: null,
      to_step_id: current_step_id,
      forwarded_to_user_id: null,
      action: 'CREATE',
      action_label: actionLabel,
      performed_by: currentUser.user_id,
      performed_by_role_id: currentUser.role_id,
      remarks: remarks || 'Claim created'
    });

    await auditService.log({
      table_name: 'claims',
      record_id: claimId,
      action: 'CREATE',
      new_value: { claim_code: claimCode, vendor_id: vendorIdNum, project_id: projectIdNum, po_id: poIdNum, workflow_id },
      performed_by: currentUser.user_id,
      ip_address: ipAddress
    });

    // Save uploaded files if any
    if (files && files.length > 0) {
      const uploadDir = path.join(UPLOADS_DIR, String(claimId));
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      for (const file of files) {
        const ext = path.extname(file.originalname);
        const storedName = `${crypto.randomUUID()}${ext}`;
        const filePath = path.join(uploadDir, storedName);

        fs.writeFileSync(filePath, file.buffer);

        await claimRepository.createFile({
          claim_id: claimId,
          original_name: file.originalname,
          stored_name: storedName,
          file_path: path.join('uploads/claims', String(claimId), storedName),
          file_size: file.size,
          mime_type: file.mimetype || 'application/octet-stream',
          uploaded_by: currentUser.user_id
        });
      }
    }

    return this.getWithDetails(claimId);
  }

  // ── Forward Package (workflow mode) ──

  async forward(claimId, remarks, currentUser, ipAddress) {
    const claim = await this.getById(claimId);

    if (claim.is_completed) {
      throw new ApiError(400, 'Claim is already completed');
    }

    if (!claim.workflow_id) {
      throw new ApiError(400, 'This claim does not use a workflow. Use the assign endpoint instead.');
    }

    if (!remarks || !remarks.trim()) {
      throw new ApiError(400, 'Remarks are mandatory when forwarding a claim');
    }

    if (!claim.current_step_id) {
      throw new ApiError(400, 'Claim has no current step assigned');
    }

    // Find valid forward transition
    const transition = await workflowService.findForwardTransition(
      claim.workflow_id, claim.current_step_id, currentUser.role_id
    );

    if (!transition) {
      throw new ApiError(403, 'You are not authorised to forward this claim from its current stage');
    }

    const nextStep = transition.to_step_id
      ? await workflowService.getStepById(transition.to_step_id)
      : null;

    // Determine new status and step
    let newStatus = 'IN_PROGRESS';
    let isCompleted = false;
    let completedAt = null;
    let actionLabel = '';

    if (!nextStep) {
      newStatus = 'COMPLETED';
      isCompleted = true;
      completedAt = new Date();
      actionLabel = 'Claim completed and approved';
    } else {
      actionLabel = `Approved & forwarded to ${nextStep.step_name}`;
    }

    // Update claim
    await claimRepository.updateCurrentStep(claim.id, {
      current_step_id: transition.to_step_id || null,
      current_step_order: nextStep ? nextStep.step_order : 999,
      status: newStatus,
      is_completed: isCompleted,
      completed_at: completedAt
    });

    // Record history
    await claimRepository.createHistory({
      claim_id: claim.id,
      from_step_id: claim.current_step_id,
      to_step_id: transition.to_step_id,
      forwarded_to_user_id: null,
      action: isCompleted ? 'COMPLETE' : 'FORWARD',
      action_label: actionLabel,
      performed_by: currentUser.user_id,
      performed_by_role_id: currentUser.role_id,
      remarks: remarks
    });

    await auditService.log({
      table_name: 'claims',
      record_id: claim.id,
      action: 'FORWARD',
      new_value: { from_step: claim.current_step_id, to_step: transition.to_step_id, status: newStatus },
      performed_by: currentUser.user_id,
      ip_address: ipAddress
    });

    return this.getWithDetails(claim.id);
  }

  // ── Send Back Claim ──

  async sendback(claimId, remarks, currentUser, ipAddress) {
    const claim = await this.getById(claimId);

    if (claim.is_completed) {
      throw new ApiError(400, 'Claim is already completed');
    }

    if (!remarks || !remarks.trim()) {
      throw new ApiError(400, 'Remarks are mandatory when sending a claim back');
    }

    // Non-workflow sendback: send back to the vendor (the created_by user)
    if (!claim.workflow_id) {
      if (claim.current_assigned_user_id !== currentUser.user_id) {
        throw new ApiError(403, 'You can only send back a claim that is currently assigned to you');
      }

      // Send back to vendor: set current_assigned_user_id to the creator
      await claimRepository.updateCurrentAssignee(claim.id, claim.created_by);
      await claimRepository.updateCurrentStep(claim.id, { status: 'SENT_BACK' });

      await claimRepository.createHistory({
        claim_id: claim.id,
        from_step_id: null,
        to_step_id: null,
        forwarded_to_user_id: null,
        action: 'SENDBACK',
        action_label: 'Returned to vendor for revision',
        performed_by: currentUser.user_id,
        performed_by_role_id: currentUser.role_id,
        remarks: remarks
      });

      await auditService.log({
        table_name: 'claims',
        record_id: claim.id,
        action: 'SENDBACK',
        new_value: { status: 'SENT_BACK' },
        performed_by: currentUser.user_id,
        ip_address: ipAddress
      });

      return this.getWithDetails(claim.id);
    }

    // Workflow sendback: follow existing workflow transitions
    if (!claim.current_step_id) {
      throw new ApiError(400, 'Claim has no current step assigned');
    }

    const transition = await workflowService.findSendbackTransition(
      claim.workflow_id, claim.current_step_id, currentUser.role_id
    );

    if (!transition) {
      throw new ApiError(403, 'You are not authorised to send back this claim from its current stage');
    }

    let newStatus = 'IN_PROGRESS';
    let actionLabel = '';

    if (!transition.to_step_id) {
      newStatus = 'SENT_BACK';
      actionLabel = 'Returned to vendor for revision';
    } else {
      const backStep = transition.to_step_id ? await workflowService.getStepById(transition.to_step_id).catch(() => null) : null;
      actionLabel = backStep ? `Returned to ${backStep.step_name} for revision` : 'Returned with remarks';
    }

    await claimRepository.updateCurrentStep(claim.id, {
      current_step_id: transition.to_step_id || claim.current_step_id,
      current_step_order: transition.to_step_id ? undefined : claim.current_step_order,
      status: newStatus
    });

    await claimRepository.createHistory({
      claim_id: claim.id,
      from_step_id: claim.current_step_id,
      to_step_id: transition.to_step_id,
      forwarded_to_user_id: null,
      action: 'SENDBACK',
      action_label: actionLabel,
      performed_by: currentUser.user_id,
      performed_by_role_id: currentUser.role_id,
      remarks: remarks
    });

    await auditService.log({
      table_name: 'claims',
      record_id: claim.id,
      action: 'SENDBACK',
      new_value: { from_step: claim.current_step_id, to_step: transition.to_step_id, status: newStatus },
      performed_by: currentUser.user_id,
      ip_address: ipAddress
    });

    return this.getWithDetails(claim.id);
  }

  // ── Assign (non-workflow: assign to a specific officer) ──

  async assign(claimId, targetUserId, remarks, currentUser, ipAddress) {
    const claim = await this.getById(claimId);

    if (claim.is_completed) {
      throw new ApiError(400, 'Claim is already completed');
    }

    if (claim.workflow_id) {
      throw new ApiError(400, 'This claim uses a workflow. Use the forward endpoint instead.');
    }

    if (!remarks || !remarks.trim()) {
      throw new ApiError(400, 'Remarks are mandatory when assigning a claim');
    }

    // Must be the current assigned user to forward
    if (claim.current_assigned_user_id !== currentUser.user_id) {
      throw new ApiError(403, 'You can only assign a claim that is currently assigned to you');
    }

    // Target user must exist and be active
    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new ApiError(400, 'Target user not found or is inactive');
    }

    // Cannot assign to Super Admin or Admin roles
    if (targetUser.role_name === 'Super Admin' || targetUser.role_name === 'Admin') {
      throw new ApiError(400, 'Cannot assign a claim to Super Admin or Admin');
    }

    // Cannot assign back to self
    if (Number(targetUserId) === currentUser.user_id) {
      throw new ApiError(400, 'Cannot assign a claim to yourself');
    }

    // Update claim: set current_assigned_user_id to target
    await claimRepository.updateCurrentAssignee(claim.id, targetUserId);

    // Record history
    await claimRepository.createHistory({
      claim_id: claim.id,
      from_step_id: null,
      to_step_id: null,
      forwarded_to_user_id: targetUserId,
      action: 'FORWARD',
      action_label: `Forwarded to ${targetUser.name}`,
      performed_by: currentUser.user_id,
      performed_by_role_id: currentUser.role_id,
      remarks: remarks
    });

    await auditService.log({
      table_name: 'claims',
      record_id: claim.id,
      action: 'FORWARD',
      new_value: { assigned_to_user_id: targetUserId },
      performed_by: currentUser.user_id,
      ip_address: ipAddress
    });

    return this.getWithDetails(claim.id);
  }

  // ── Pull Back (non-workflow: undo assign) ──

  async pullBack(claimId, remarks, currentUser, ipAddress) {
    const claim = await this.getById(claimId);

    if (claim.is_completed) {
      throw new ApiError(400, 'Claim is already completed');
    }

    if (claim.workflow_id) {
      throw new ApiError(400, 'This claim uses a workflow. Pull-back is not available.');
    }

    if (!remarks || !remarks.trim()) {
      throw new ApiError(400, 'Remarks are mandatory when pulling back a claim');
    }

    // Find the latest forward entry where currentUser forwarded to the current assignee
    const latestForward = await claimRepository.findLatestForward(
      claim.id,
      currentUser.user_id,
      claim.current_assigned_user_id
    );

    if (!latestForward) {
      throw new ApiError(400,
        'You cannot pull back this claim. Only the person who forwarded it can pull it back.'
      );
    }

    // Update claim: assign back to currentUser
    await claimRepository.updateCurrentAssignee(claim.id, currentUser.user_id);

    // Record history
    await claimRepository.createHistory({
      claim_id: claim.id,
      from_step_id: null,
      to_step_id: null,
      forwarded_to_user_id: null,
      action: 'PULL_BACK',
      action_label: `Pulled back from ${latestForward.target_user_name || 'previous assignee'}`,
      performed_by: currentUser.user_id,
      performed_by_role_id: currentUser.role_id,
      remarks: remarks
    });

    await auditService.log({
      table_name: 'claims',
      record_id: claim.id,
      action: 'PULL_BACK',
      new_value: { pulled_from_user_id: claim.current_assigned_user_id },
      performed_by: currentUser.user_id,
      ip_address: ipAddress
    });

    return this.getWithDetails(claim.id);
  }

  // ── Re-submit (vendor sends back to the workflow after revision) ──

  async resubmit(claimId, remarks, currentUser, ipAddress) {
    const claim = await this.getById(claimId);

    if (claim.status !== 'SENT_BACK') {
      throw new ApiError(400, 'Only claims in SENT_BACK status can be re-submitted');
    }

    if (claim.vendor_contact_user_id && claim.vendor_contact_user_id !== currentUser.user_id) {
      throw new ApiError(403, 'Only the designated vendor contact can re-submit this claim');
    }

    if (!remarks || !remarks.trim()) {
      throw new ApiError(400, 'Remarks are mandatory when re-submitting');
    }

    // Non-workflow: resubmit sends back to the person who sent it back
    if (!claim.workflow_id) {
      const history = await claimRepository.getHistory(claimId);
      const lastEntry = history[history.length - 1];

      if (!lastEntry || lastEntry.action !== 'SENDBACK') {
        throw new ApiError(400, 'Cannot find previous sendback reference');
      }

      // Send back to the person who sent it back
      const returnToUserId = lastEntry.performed_by;

      await claimRepository.updateCurrentAssignee(claim.id, returnToUserId);
      await claimRepository.updateCurrentStep(claim.id, { status: 'IN_PROGRESS' });

      await claimRepository.createHistory({
        claim_id: claim.id,
        from_step_id: null,
        to_step_id: null,
        forwarded_to_user_id: null,
        action: 'RESUBMIT',
        action_label: 'Re-submitted after revision',
        performed_by: currentUser.user_id,
        performed_by_role_id: currentUser.role_id,
        remarks: remarks
      });

      await auditService.log({
        table_name: 'claims',
        record_id: claim.id,
        action: 'RESUBMIT',
        new_value: { status: 'IN_PROGRESS' },
        performed_by: currentUser.user_id,
        ip_address: ipAddress
      });

      return this.getWithDetails(claim.id);
    }

    // Workflow resubmit: find the sendback origin step
    const history = await claimRepository.getHistory(claimId);
    const lastEntry = history[history.length - 1];

    if (!lastEntry || lastEntry.action !== 'SENDBACK') {
      throw new ApiError(400, 'Cannot find previous sendback reference');
    }

    const sendbackOriginStepId = lastEntry.from_step_id;
    if (!sendbackOriginStepId) {
      throw new ApiError(400, 'Cannot determine where to send the claim');
    }

    await claimRepository.updateCurrentStep(claim.id, {
      current_step_id: sendbackOriginStepId,
      status: 'IN_PROGRESS'
    });

    await claimRepository.createHistory({
      claim_id: claim.id,
      from_step_id: null,
      to_step_id: sendbackOriginStepId,
      forwarded_to_user_id: null,
      action: 'RESUBMIT',
      action_label: 'Re-submitted after revision',
      performed_by: currentUser.user_id,
      performed_by_role_id: currentUser.role_id,
      remarks: remarks
    });

    await auditService.log({
      table_name: 'claims',
      record_id: claim.id,
      action: 'RESUBMIT',
      new_value: { to_step: sendbackOriginStepId, status: 'IN_PROGRESS' },
      performed_by: currentUser.user_id,
      ip_address: ipAddress
    });

    return this.getWithDetails(claim.id);
  }

  // ── Files ──

  async uploadFile(claimId, file, currentUser) {
    const claim = await this.getById(claimId);

    const uploadDir = path.join(UPLOADS_DIR, String(claimId));
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = path.extname(file.originalname);
    const storedName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, storedName);

    fs.writeFileSync(filePath, file.buffer);

    const fileId = await claimRepository.createFile({
      claim_id: claimId,
      original_name: file.originalname,
      stored_name: storedName,
      file_path: path.join('uploads/claims', String(claimId), storedName),
      file_size: file.size,
      mime_type: file.mimetype || 'application/octet-stream',
      uploaded_by: currentUser.user_id
    });

    return fileId;
  }

  async deleteFile(claimId, fileId, currentUser) {
    const claim = await this.getById(claimId);
    const file = await claimRepository.deleteFile(fileId);

    if (file) {
      const fullPath = path.join(__dirname, '../..', file.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    return file;
  }

  async getHistory(claimId) {
    await this.getById(claimId);
    return claimRepository.getHistory(claimId);
  }

  // ── Inbox ──

  async getInbox(currentUser, { limit = 50, offset = 0 } = {}) {
    return claimRepository.getInbox(currentUser.role_id, currentUser.user_id, { limit, offset });
  }

  async getOutbox(currentUser, { limit = 50, offset = 0 } = {}) {
    return claimRepository.getOutbox(currentUser.user_id, { limit, offset });
  }

  async getInboxStats(currentUser) {
    return claimRepository.getInboxStats(currentUser.role_id, currentUser.user_id);
  }

  // ── Helpers ──

  async generateClaimCode() {
    const lastCode = await claimRepository.getLastClaimCode();
    const year = new Date().getFullYear();
    let nextNum = 1;

    if (lastCode) {
      const parts = lastCode.split('-');
      if (parts.length >= 2) {
        nextNum = parseInt(parts[parts.length - 1], 10) + 1;
      }
    }

    return `APTS-${year}-${String(nextNum).padStart(4, '0')}`;
  }
}

module.exports = new ClaimService();
