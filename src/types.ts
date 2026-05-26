export type Warehouse = {
  id: string;
  name: string;
  location: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  reorderLevel: number;
};

export type MovementKind = "entrada" | "saida" | "ajuste" | "transferencia";

export type Movement = {
  id: string;
  at: string;
  kind: MovementKind;
  productId: string;
  quantity: number;
  warehouseId?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  note?: string;
};

export type AppState = {
  warehouses: Warehouse[];
  products: Product[];
  stock: Record<string, number>;
  movements: Movement[];
};

export function stockKey(warehouseId: string, productId: string): string {
  return `${warehouseId}:${productId}`;
}
