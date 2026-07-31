const claimService = require('../services/claimService');
const ApiResponse = require('../utils/ApiResponse');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const getAllClaims = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query.limit, req.query.offset);
    const { status, project_id, workflow_id, po_id, search, vendor_id: queryVendorId } = req.query;

    const params = {
      limit, offset,
      status,
      project_id: project_id ? Number(project_id) : undefined,
      workflow_id: workflow_id ? Number(workflow_id) : undefined,
      po_id: po_id ? Number(po_id) : undefined,
      search
    };

    // Apply access scoping based on user role
    if (req.user.role_name !== 'Super Admin') {
      if (req.user.role_name === 'Vendor') {
        // Vendors only see their own claims (ignore query param)
        params.vendor_id = req.user.vendor_id;
      } else {
        // Other roles (PM, TPA, etc.) see claims they're involved with
        params.involved_role_id = req.user.role_id;
        params.involved_user_id = req.user.user_id;
      }
    } else if (queryVendorId) {
      // Admin can still filter by vendor_id via query param
      params.vendor_id = Number(queryVendorId);
    }

    const result = await claimService.getAll(params);

    const meta = buildPaginationMeta(result.total, limit, offset, result.rows.length);
    res.json(ApiResponse.success('Claims fetched successfully', result.rows, meta));
  } catch (error) {
    next(error);
  }
};

const getClaimById = async (req, res, next) => {
  try {
    const includeDetails = req.query.include_details !== 'false';
    const claim = includeDetails
      ? await claimService.getWithDetails(req.params.id)
      : await claimService.getById(req.params.id);
    res.json(ApiResponse.success('Claim fetched successfully', [claim]));
  } catch (error) {
    next(error);
  }
};

const createClaim = async (req, res, next) => {
  try {
    const claim = await claimService.create(req.body, req.files, req.user, req.ip);
    res.status(201).json(ApiResponse.success('Claim created successfully', [claim]));
  } catch (error) {
    next(error);
  }
};

const forwardClaim = async (req, res, next) => {
  try {
    const { remarks } = req.body;
    const claim = await claimService.forward(req.params.id, remarks, req.user, req.ip);
    res.json(ApiResponse.success('Claim forwarded successfully', [claim]));
  } catch (error) {
    next(error);
  }
};

const assignClaim = async (req, res, next) => {
  try {
    const { target_user_id, remarks } = req.body;
    const claim = await claimService.assign(req.params.id, target_user_id, remarks, req.user, req.ip);
    res.json(ApiResponse.success('Claim assigned successfully', [claim]));
  } catch (error) {
    next(error);
  }
};

const pullBackClaim = async (req, res, next) => {
  try {
    const { remarks } = req.body;
    const claim = await claimService.pullBack(req.params.id, remarks, req.user, req.ip);
    res.json(ApiResponse.success('Claim pulled back successfully', [claim]));
  } catch (error) {
    next(error);
  }
};

const sendbackClaim = async (req, res, next) => {
  try {
    const { remarks } = req.body;
    const claim = await claimService.sendback(req.params.id, remarks, req.user, req.ip);
    res.json(ApiResponse.success('Claim returned successfully', [claim]));
  } catch (error) {
    next(error);
  }
};

const approveClaim = async (req, res, next) => {
  try {
    const { remarks } = req.body;
    const claim = await claimService.approve(req.params.id, remarks, req.user, req.ip);
    res.json(ApiResponse.success('Claim approved and completed successfully', [claim]));
  } catch (error) {
    next(error);
  }
};

const resubmitClaim = async (req, res, next) => {
  try {
    const { remarks } = req.body;
    const claim = await claimService.resubmit(req.params.id, remarks, req.user, req.ip);
    res.json(ApiResponse.success('Claim re-submitted successfully', [claim]));
  } catch (error) {
    next(error);
  }
};

const getClaimHistory = async (req, res, next) => {
  try {
    const history = await claimService.getHistory(req.params.id);
    res.json(ApiResponse.success('Claim history fetched successfully', history));
  } catch (error) {
    next(error);
  }
};

const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(ApiResponse.error('No file provided', []));
    }
    const fileId = await claimService.uploadFile(req.params.id, req.file, req.user);
    res.status(201).json(ApiResponse.success('File uploaded successfully', [{ id: fileId }]));
  } catch (error) {
    next(error);
  }
};

const deleteFile = async (req, res, next) => {
  try {
    await claimService.deleteFile(req.params.id, req.params.fileId, req.user);
    res.json(ApiResponse.success('File deleted successfully', []));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllClaims, getClaimById, createClaim,
  forwardClaim, assignClaim, pullBackClaim,
  sendbackClaim, approveClaim, resubmitClaim,
  getClaimHistory, uploadFile, deleteFile
};
