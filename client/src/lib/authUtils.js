"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUnauthorizedError = isUnauthorizedError;
function isUnauthorizedError(error) {
    return /^401: .*Unauthorized/.test(error.message);
}
