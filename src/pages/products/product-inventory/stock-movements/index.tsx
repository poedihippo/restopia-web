import { GlobalLayout } from "@/components/global-layout";
import StockMovement from "@/views/StockMovement";

const StockMovementPage = () => {
  return (
    <GlobalLayout
      name="Stock Movements"
      breadcrumb={["Products", "Product Inventory", "Stock Movements"]}
    >
      <StockMovement />
    </GlobalLayout>
  );
};

export default StockMovementPage;
