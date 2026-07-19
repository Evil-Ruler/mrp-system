
const repository = require("../repositories/mrp.repository");

class MRPService {
  async getAllSalesOrders() {
    return await repository.getAllSalesOrders();
  }
}

module.exports = new MRPService();
