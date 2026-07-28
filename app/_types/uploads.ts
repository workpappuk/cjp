export const UPLOAD_SCOPES = ["post", "community", "comment"] as const;

export type UploadScope = (typeof UPLOAD_SCOPES)[number];
