const packageRepository = require('../repositories/packageRepository');
const projectRepository = require('../repositories/projectRepository');
const userRepository = require('../repositories/userRepository');
const workflowService = require('./workflowService');
const auditService = require('./auditService');
const ApiError = require('../utils/ApiError');

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/packages');

class PackageService {
  async getAll(params) {
    return packageRepository.getAll(params);
  }

  async getById(id) {
    const pkg = await packageRepository.getById(id);
    if (!pkg) throw new ApiError(404, 'Package not found');
    return pkg;
  }

  async getWithDetails(id) {
    const pkg = await this.getById(id);
    pkg.files = await packageRepository.getFiles(id);
    pkg.history = await packageRepository.getHistory(id);
    return pkg;
  }

  // ── Create Package ──

  async create(data, currentUser, ipAddress) {
    const { vendor_id, vendor_contact_user_id, project_id, remarks } = data;

    // Only vendor users can create packages
    if (currentUser.role_name !== 'Vendor' || !currentUser.vendor_id) {
      throw new ApiError(403, 'Only vendor users can create packages');
    }

    // The creating user must belong to the vendor they're creating for
    if (currentUser.vendor_id !== vendor_id) {
      throw new ApiError(403, 'You can only create packages for your own vendor');
    }

    // Validate vendor contact belongs to the selected vendor
    if (vendor_contact_user_id) {
      const contactUser = await userRepository.findById(vendor_contact_user_id);
      if (!contactUser) {
        throw new ApiError(400, 'Vendor contact user not found');
      }
      if (contactUser.vendor_id !== vendor_id) {
        throw new ApiError(400, 'Selected contact user does not belong to the chosen vendor');
      }
    }

    // Look up the project to get its assigned workflow
    const project = await projectRepository.getById(project_id);
    if (!project) {
      throw new ApiError(400, 'Project not found');
    }

    const workflow_id = project.workflow_id;
    if (!workflow_id) {
      throw new ApiError(400, 'Selected project has no workflow assigned. Contact admin to configure it.');
    }

    // Verify the vendor has access to this project
    const vendorProjectIds = await projectRepository.getVendorProjectIds(vendor_id);
    if (!vendorProjectIds.includes(project_id)) {
      throw new ApiError(403, 'Your vendor does not have access to the selected project');
    }

    const firstStep = await workflowService.getFirstStep(workflow_id);
    if (!firstStep) {
      throw new ApiError(400, 'Workflow has no active steps. Add steps before creating packages.');
    }

    const createTransition = await workflowService.findTransitionFromStart(workflow_id, currentUser.role_id);
    if (!createTransition) {
      throw new ApiError(403, 'Your role is not authorised to create packages in this workflow');
    }

    const packageCode = await this.generatePackageCode();

    const packageId = await packageRepository.create({
      package_code: packageCode,
      vendor_id,
      vendor_contact_user_id,
      project_id,
      workflow_id,
      current_step_id: firstStep.id,
      current_step_order: firstStep.step_order,
      remarks,
      created_by: currentUser.user_id
    });

    // Record creation history
    await packageRepository.createHistory({
      package_id: packageId,
      from_step_id: null,
      to_step_id: firstStep.id,
      action: 'CREATE',
      action_label: `Package created and dispatched to ${firstStep.step_name}`,
      performed_by: currentUser.user_id,
      performed_by_role_id: currentUser.role_id,
      remarks: remarks || 'Package created'
    });

    await auditService.log({
      table_name: 'packages',
      record_id: packageId,
      action: 'CREATE',
      new_value: { package_code: packageCode, vendor_id, project_id, workflow_id },
      performed_by: currentUser.user_id,
      ip_address: ipAddress
    });

    return this.getWithDetails(packageId);
  }

  // ── Forward Package ──

  async forward(packageId, remarks, currentUser, ipAddress) {
    const pkg = await this.getById(packageId);

    if (pkg.is_completed) {
      throw new ApiError(400, 'Package is already completed');
    }

    if (!remarks || !remarks.trim()) {
      throw new ApiError(400, 'Remarks are mandatory when forwarding a package');
    }

    if (!pkg.current_step_id) {
      throw new ApiError(400, 'Package has no current step assigned');
    }

    // Find valid forward transition
    const transition = await workflowService.findForwardTransition(
      pkg.workflow_id, pkg.current_step_id, currentUser.role_id
    );

    if (!transition) {
      throw new ApiError(403, 'You are not authorised to forward this package from its current stage');
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
      // No destination step means this is the final approval
      newStatus = 'COMPLETED';
      isCompleted = true;
      completedAt = new Date();
      actionLabel = 'Package completed and approved';
    } else {
      actionLabel = `Approved & forwarded to ${nextStep.step_name}`;
    }

    // Update package
    await packageRepository.updateCurrentStep(pkg.id, {
      current_step_id: transition.to_step_id || null,
      current_step_order: nextStep ? nextStep.step_order : 999,
      status: newStatus,
      is_completed: isCompleted,
      completed_at: completedAt
    });

    // Record history
    await packageRepository.createHistory({
      package_id: pkg.id,
      from_step_id: pkg.current_step_id,
      to_step_id: transition.to_step_id,
      action: isCompleted ? 'COMPLETE' : 'FORWARD',
      action_label: actionLabel,
      performed_by: currentUser.user_id,
      performed_by_role_id: currentUser.role_id,
      remarks: remarks
    });

    await auditService.log({
      table_name: 'packages',
      record_id: pkg.id,
      action: 'FORWARD',
      new_value: { from_step: pkg.current_step_id, to_step: transition.to_step_id, status: newStatus },
      performed_by: currentUser.user_id,
      ip_address: ipAddress
    });

    return this.getWithDetails(pkg.id);
  }

  // ── Send Back Package ──

  async sendback(packageId, remarks, currentUser, ipAddress) {
    const pkg = await this.getById(packageId);

    if (pkg.is_completed) {
      throw new ApiError(400, 'Package is already completed');
    }

    if (!remarks || !remarks.trim()) {
      throw new ApiError(400, 'Remarks are mandatory when sending a package back');
    }

    if (!pkg.current_step_id) {
      throw new ApiError(400, 'Package has no current step assigned');
    }

    // Find valid sendback transition
    const transition = await workflowService.findSendbackTransition(
      pkg.workflow_id, pkg.current_step_id, currentUser.role_id
    );

    if (!transition) {
      throw new ApiError(403, 'You are not authorised to send back this package from its current stage');
    }

    let newStatus = 'IN_PROGRESS';
    let actionLabel = '';

    if (!transition.to_step_id) {
      // Null to_step means send back to vendor
      newStatus = 'SENT_BACK';
      actionLabel = 'Returned to vendor for revision';
    } else {
      const backStep = transition.to_step_id ? await workflowService.getStepById(transition.to_step_id).catch(() => null) : null;
      actionLabel = backStep ? `Returned to ${backStep.step_name} for revision` : 'Returned with remarks';
    }

    // Update package
    await packageRepository.updateCurrentStep(pkg.id, {
      current_step_id: transition.to_step_id || pkg.current_step_id,
      current_step_order: transition.to_step_id ? undefined : pkg.current_step_order,
      status: newStatus
    });

    // Record history
    await packageRepository.createHistory({
      package_id: pkg.id,
      from_step_id: pkg.current_step_id,
      to_step_id: transition.to_step_id,
      action: 'SENDBACK',
      action_label: actionLabel,
      performed_by: currentUser.user_id,
      performed_by_role_id: currentUser.role_id,
      remarks: remarks
    });

    await auditService.log({
      table_name: 'packages',
      record_id: pkg.id,
      action: 'SENDBACK',
      new_value: { from_step: pkg.current_step_id, to_step: transition.to_step_id, status: newStatus },
      performed_by: currentUser.user_id,
      ip_address: ipAddress
    });

    return this.getWithDetails(pkg.id);
  }

  // ── Re-submit (vendor sends back to the workflow after revision) ──

  async resubmit(packageId, remarks, currentUser, ipAddress) {
    const pkg = await this.getById(packageId);

    if (pkg.status !== 'SENT_BACK') {
      throw new ApiError(400, 'Only packages in SENT_BACK status can be re-submitted');
    }

    if (pkg.vendor_contact_user_id && pkg.vendor_contact_user_id !== currentUser.user_id) {
      throw new ApiError(403, 'Only the designated vendor contact can re-submit this package');
    }

    if (!remarks || !remarks.trim()) {
      throw new ApiError(400, 'Remarks are mandatory when re-submitting');
    }

    // Find the forward transition from the current step (which was the returning step)
    // The package's current_step_id should be the step it was sent back FROM
    // Actually, sendback retains the current_step_id — we need to find the correct forward
    // transition from the step the vendor was sent back TO.
    // Better approach: find the sendback transition's from_step_id and go forward from there

    // Get the last history entry to find where it was sent from
    const history = await packageRepository.getHistory(packageId);
    const lastEntry = history[history.length - 1];

    if (!lastEntry || lastEntry.action !== 'SENDBACK') {
      throw new ApiError(400, 'Cannot find previous sendback reference');
    }

    // The to_step_id of the last sendback is from_step_id of the sendback origin
    // Actually, we need to find who sent it back and their role, then find the reverse transition
    // For simplicity: the vendor submits back, and it goes to whoever sent it back
    // which is the from_step_id of the sendback transition

    const sendbackOriginStepId = lastEntry.from_step_id;
    if (!sendbackOriginStepId) {
      throw new ApiError(400, 'Cannot determine where to send the package');
    }

    // Update package: move back to the step that sent it back
    await packageRepository.updateCurrentStep(pkg.id, {
      current_step_id: sendbackOriginStepId,
      status: 'IN_PROGRESS'
    });

    await packageRepository.createHistory({
      package_id: pkg.id,
      from_step_id: null,
      to_step_id: sendbackOriginStepId,
      action: 'RESUBMIT',
      action_label: 'Re-submitted after revision',
      performed_by: currentUser.user_id,
      performed_by_role_id: currentUser.role_id,
      remarks: remarks
    });

    await auditService.log({
      table_name: 'packages',
      record_id: pkg.id,
      action: 'RESUBMIT',
      new_value: { to_step: sendbackOriginStepId, status: 'IN_PROGRESS' },
      performed_by: currentUser.user_id,
      ip_address: ipAddress
    });

    return this.getWithDetails(pkg.id);
  }

  // ── Files ──

  async uploadFile(packageId, file, currentUser) {
    const pkg = await this.getById(packageId);

    const uploadDir = path.join(UPLOADS_DIR, String(packageId));
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = path.extname(file.originalname);
    const storedName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, storedName);

    fs.writeFileSync(filePath, file.buffer);

    const fileId = await packageRepository.createFile({
      package_id: packageId,
      original_name: file.originalname,
      stored_name: storedName,
      file_path: path.join('uploads/packages', String(packageId), storedName),
      file_size: file.size,
      mime_type: file.mimetype || 'application/octet-stream',
      uploaded_by: currentUser.user_id
    });

    return fileId;
  }

  async deleteFile(packageId, fileId, currentUser) {
    const pkg = await this.getById(packageId);
    const file = await packageRepository.deleteFile(fileId);

    if (file) {
      const fullPath = path.join(__dirname, '../..', file.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    return file;
  }

  async getHistory(packageId) {
    await this.getById(packageId);
    return packageRepository.getHistory(packageId);
  }

  // ── Inbox ──

  async getInbox(currentUser, { limit = 50, offset = 0 } = {}) {
    return packageRepository.getInbox(currentUser.role_id, { limit, offset });
  }

  async getOutbox(currentUser, { limit = 50, offset = 0 } = {}) {
    return packageRepository.getOutbox(currentUser.user_id, { limit, offset });
  }

  async getInboxStats(currentUser) {
    return packageRepository.getInboxStats(currentUser.role_id);
  }

  // ── Helpers ──

  async generatePackageCode() {
    const lastCode = await packageRepository.getLastPackageCode();
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

module.exports = new PackageService();
