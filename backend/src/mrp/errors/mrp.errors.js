class DataAccessError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "DataAccessError";
    this.cause = cause;
  }
}

class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

module.exports = {
  DataAccessError,
  ValidationError,
};

