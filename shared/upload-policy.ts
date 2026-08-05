export const MAX_UPLOAD_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_FILE_SIZE_LABEL = "25 MB";

export const EXTRACTABLE_UPLOAD_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const EXTRACTABLE_UPLOAD_ACCEPT =
  ".txt,.md,.csv,.json,.pdf,.docx,.zip";

export const IMAGE_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const IMAGE_UPLOAD_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif";

