const mrpService = require("../services/mrp.service");
const { validatePlanningQuery } = require("../validation/mrp.validation");
const { ValidationError, DataAccessError } = require("../errors/mrp.errors");

/**
 * Controller for handling MRP HTTP request endpoints.
 * Operates strictly as an HTTP adapter layer: reads query parameters, validates requests,
 * invokes service layer workflows, and formats standardized JSON responses.
 */
class MRPController {
  /**
   * Private error handler mapping domain errors to standard HTTP JSON error responses.
   *
   * @param {Object} res Express response object
   * @param {Error} error Error thrown by validation or service layer
   * @private
   */
  _handleError(res, error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    if (error instanceof DataAccessError) {
      return res.status(500).json({
        success: false,
        error: {
          code: "DATA_ACCESS_ERROR",
          message: error.message,
        },
      });
    }

    // Log unhandled/unexpected system errors before sanitizing API output
    console.error(error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected internal server error occurred.",
      },
    });
  }

  /**
   * GET /api/mrp/run
   * Executes the full 6-stage MRP planning engine pipeline.
   *
   * @param {Object} req Express request object
   * @param {Object} res Express response object
   */
  async runPlanning(req, res) {
    try {
      const filters = validatePlanningQuery(req.query);
      const result = await mrpService.runPlanning(filters);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return this._handleError(res, error);
    }
  }

  /**
   * GET /api/mrp/planning-data
   * Loads and validates raw planning dataset (demand, BOM structures, items) without executing planning algorithms.
   *
   * @param {Object} req Express request object
   * @param {Object} res Express response object
   */
  async getPlanningData(req, res) {
    try {
      const filters = validatePlanningQuery(req.query);
      const data = await mrpService.getPlanningData(filters);

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return this._handleError(res, error);
    }
  }

  /**
   * GET /api/mrp/sales-orders
   * Returns open demand sales order lines.
   *
   * @param {Object} req Express request object
   * @param {Object} res Express response object
   */
  async getAllSalesOrders(req, res) {
    try {
      const filters = validatePlanningQuery(req.query);
      const salesOrders = await mrpService.getAllSalesOrders(filters);

      return res.status(200).json({
        success: true,
        data: salesOrders,
      });
    } catch (error) {
      return this._handleError(res, error);
    }
  }
}

module.exports = new MRPController();
