// Codes emitted by modules that are not optional and own no other wire
// surface: authorization refusals from the CASL guard. Anything belonging to a
// REMOVABLE module must not live here — this file has no fence markers, so a
// code left behind would outlive the module that emits it and break the
// contract check on a subtracted tree.
export const COMMON_ERROR_CODES = ['CASL_FORBIDDEN', 'ADMIN_IMPERSONATION_FORBIDDEN'] as const;
