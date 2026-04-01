/**
 * Thrown when export QC detects a mismatch (e.g. vulnerability drop between evaluation and render).
 */

export class ExportQCError extends Error {
  readonly code = 'EXPORT_QC_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'ExportQCError';
    Object.setPrototypeOf(this, ExportQCError.prototype);
  }
}
