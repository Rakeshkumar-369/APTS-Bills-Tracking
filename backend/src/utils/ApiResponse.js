// src/utils/ApiResponse.js
class ApiResponse {
    constructor(success, message = "Success", data = []) {
        this.success = success;
        this.message = message;
        this.data = Array.isArray(data) ? data : [data];
    }

    static success(message, data, meta = {}) {
        const response = new ApiResponse(true, message, data);
        response.meta = meta;
        return response;
    }

    static error(message, data = []) {
        return new ApiResponse(false, message, data);
    }
}

module.exports = ApiResponse;