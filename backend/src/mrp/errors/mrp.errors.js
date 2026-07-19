class DataAccessError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "DataAccessError";
    this.cause = cause;
  }
}

module.exports = {
  DataAccessError,
};
