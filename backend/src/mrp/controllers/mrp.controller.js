const service = require("../services/mrp.service");

class MRPController {
  async getAllSalesOrders(req, res) {
    try {
      const salesOrders = await service.getAllSalesOrders();
      return res.status(200).json(salesOrders);
    } catch (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

module.exports = new MRPController();
