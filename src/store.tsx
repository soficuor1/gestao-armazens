import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type {
  AppState,
  Movement,
  MovementKind,
  Product,
  Warehouse,
} from "./types";
import { stockKey } from "./types";

const STORAGE_KEY = "gestao-armazens-v1";

const emptyState = (): AppState => ({
  warehouses: [],
  products: [],
  stock: {},
  movements: [],
});

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || typeof parsed !== "object") return emptyState();
    return {
      warehouses: Array.isArray(parsed.warehouses) ? parsed.warehouses : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      stock: parsed.stock && typeof parsed.stock === "object" ? parsed.stock : {},
      movements: Array.isArray(parsed.movements) ? parsed.movements : [],
    };
  } catch {
    return emptyState();
  }
}

type Action =
  | { type: "HYDRATE"; payload: AppState }
  | { type: "ADD_WAREHOUSE"; payload: Omit<Warehouse, "id"> }
  | { type: "UPDATE_WAREHOUSE"; payload: Warehouse }
  | { type: "DELETE_WAREHOUSE"; payload: string }
  | { type: "ADD_PRODUCT"; payload: Omit<Product, "id"> }
  | { type: "UPDATE_PRODUCT"; payload: Product }
  | { type: "DELETE_PRODUCT"; payload: string }
  | {
      type: "REGISTER_MOVEMENT";
      payload: {
        kind: MovementKind;
        productId: string;
        quantity: number;
        warehouseId?: string;
        fromWarehouseId?: string;
        toWarehouseId?: string;
        note?: string;
      };
    };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "HYDRATE":
      return action.payload;
    case "ADD_WAREHOUSE": {
      const w: Warehouse = {
        id: crypto.randomUUID(),
        ...action.payload,
      };
      return { ...state, warehouses: [...state.warehouses, w] };
    }
    case "UPDATE_WAREHOUSE":
      return {
        ...state,
        warehouses: state.warehouses.map((w) =>
          w.id === action.payload.id ? action.payload : w,
        ),
      };
    case "DELETE_WAREHOUSE": {
      const id = action.payload;
      const hasStock = Object.entries(state.stock).some(([key, qty]) => {
        if (qty <= 0) return false;
        return key.startsWith(`${id}:`);
      });
      if (hasStock) return state;
      const stock = { ...state.stock };
      for (const k of Object.keys(stock)) {
        if (k.startsWith(`${id}:`)) delete stock[k];
      }
      return {
        ...state,
        warehouses: state.warehouses.filter((w) => w.id !== id),
        stock,
      };
    }
    case "ADD_PRODUCT": {
      const p: Product = {
        id: crypto.randomUUID(),
        ...action.payload,
      };
      return { ...state, products: [...state.products, p] };
    }
    case "UPDATE_PRODUCT":
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.payload.id ? action.payload : p,
        ),
      };
    case "DELETE_PRODUCT": {
      const id = action.payload;
      const hasStock = Object.entries(state.stock).some(([key, qty]) => {
        if (qty <= 0) return false;
        return key.endsWith(`:${id}`);
      });
      if (hasStock) return state;
      const stock = { ...state.stock };
      for (const k of Object.keys(stock)) {
        if (k.endsWith(`:${id}`)) delete stock[k];
      }
      return {
        ...state,
        products: state.products.filter((p) => p.id !== id),
        stock,
      };
    }
    case "REGISTER_MOVEMENT": {
      const {
        kind,
        productId,
        quantity,
        warehouseId,
        fromWarehouseId,
        toWarehouseId,
        note,
      } = action.payload;
      if (quantity <= 0 || !Number.isFinite(quantity)) return state;

      const movement: Movement = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        kind,
        productId,
        quantity,
        warehouseId,
        fromWarehouseId,
        toWarehouseId,
        note,
      };

      const stock = { ...state.stock };

      const add = (wid: string, delta: number) => {
        const k = stockKey(wid, productId);
        const next = (stock[k] ?? 0) + delta;
        if (next <= 0) delete stock[k];
        else stock[k] = next;
      };

      if (kind === "entrada" && warehouseId) {
        add(warehouseId, quantity);
      } else if (kind === "saida" && warehouseId) {
        const k = stockKey(warehouseId, productId);
        const cur = stock[k] ?? 0;
        if (cur < quantity) return state;
        add(warehouseId, -quantity);
      } else if (kind === "ajuste" && warehouseId) {
        stock[stockKey(warehouseId, productId)] = quantity;
        if (quantity <= 0) delete stock[stockKey(warehouseId, productId)];
      } else if (
        kind === "transferencia" &&
        fromWarehouseId &&
        toWarehouseId &&
        fromWarehouseId !== toWarehouseId
      ) {
        const k = stockKey(fromWarehouseId, productId);
        const cur = stock[k] ?? 0;
        if (cur < quantity) return state;
        add(fromWarehouseId, -quantity);
        add(toWarehouseId, quantity);
      } else {
        return state;
      }

      return {
        ...state,
        stock,
        movements: [movement, ...state.movements],
      };
    }
    default:
      return state;
  }
}

type StoreValue = {
  state: AppState;
  addWarehouse: (w: Omit<Warehouse, "id">) => void;
  updateWarehouse: (w: Warehouse) => void;
  deleteWarehouse: (id: string) => boolean;
  addProduct: (p: Omit<Product, "id">) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => boolean;
  registerMovement: (m: {
    kind: MovementKind;
    productId: string;
    quantity: number;
    warehouseId?: string;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    note?: string;
  }) => boolean;
  getQty: (warehouseId: string, productId: string) => number;
  seedDemo: () => void;
  resetAll: () => void;
};

const StoreContext = createContext<StoreValue | null>(null);

function demoIso(daysAgo: number, hourUtc = 9, minute = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hourUtc, minute, 0, 0);
  return d.toISOString();
}

function demoState(): AppState {
  const w1: Warehouse = {
    id: crypto.randomUUID(),
    name: "Armazém Norte",
    location: "Porto",
  };
  const w2: Warehouse = {
    id: crypto.randomUUID(),
    name: "Armazém Sul",
    location: "Lisboa",
  };
  const w3: Warehouse = {
    id: crypto.randomUUID(),
    name: "Armazém Centro",
    location: "Coimbra",
  };
  const p1: Product = {
    id: crypto.randomUUID(),
    sku: "SKU-001",
    name: "Caixas cartonagem",
    unit: "un",
    reorderLevel: 50,
  };
  const p2: Product = {
    id: crypto.randomUUID(),
    sku: "SKU-002",
    name: "Paletes madeira",
    unit: "un",
    reorderLevel: 10,
  };
  const p3: Product = {
    id: crypto.randomUUID(),
    sku: "SKU-003",
    name: "Fita adesiva",
    unit: "rolo",
    reorderLevel: 40,
  };
  const stock: Record<string, number> = {
    [stockKey(w1.id, p1.id)]: 120,
    [stockKey(w1.id, p2.id)]: 8,
    [stockKey(w1.id, p3.id)]: 25,
    [stockKey(w2.id, p1.id)]: 40,
    [stockKey(w2.id, p2.id)]: 25,
  };

  const movementsNewestFirst: Movement[] = [
    {
      id: crypto.randomUUID(),
      at: demoIso(0, 15, 20),
      kind: "saida",
      productId: p1.id,
      quantity: 5,
      warehouseId: w1.id,
      note: "Encomenda B2B expedida",
    },
    {
      id: crypto.randomUUID(),
      at: demoIso(4, 14, 30),
      kind: "ajuste",
      productId: p3.id,
      quantity: 25,
      warehouseId: w1.id,
      note: "Contagem física — correção ERP",
    },
    {
      id: crypto.randomUUID(),
      at: demoIso(4, 8),
      kind: "saida",
      productId: p3.id,
      quantity: 50,
      warehouseId: w1.id,
      note: "Consumo obra temporária",
    },
    {
      id: crypto.randomUUID(),
      at: demoIso(6, 9, 30),
      kind: "entrada",
      productId: p3.id,
      quantity: 200,
      warehouseId: w1.id,
    },
    {
      id: crypto.randomUUID(),
      at: demoIso(9, 11),
      kind: "entrada",
      productId: p2.id,
      quantity: 25,
      warehouseId: w2.id,
      note: "Fornecedor Estibordo Lda.",
    },
    {
      id: crypto.randomUUID(),
      at: demoIso(11, 16),
      kind: "saida",
      productId: p2.id,
      quantity: 52,
      warehouseId: w1.id,
    },
    {
      id: crypto.randomUUID(),
      at: demoIso(13, 13),
      kind: "entrada",
      productId: p2.id,
      quantity: 60,
      warehouseId: w1.id,
      note: "Receção pallets usados homologados",
    },
    {
      id: crypto.randomUUID(),
      at: demoIso(16, 8, 30),
      kind: "transferencia",
      productId: p1.id,
      quantity: 30,
      fromWarehouseId: w1.id,
      toWarehouseId: w2.id,
      note: "Reequilíbrio Sul",
    },
    {
      id: crypto.randomUUID(),
      at: demoIso(18, 7),
      kind: "entrada",
      productId: p1.id,
      quantity: 10,
      warehouseId: w2.id,
    },
    {
      id: crypto.randomUUID(),
      at: demoIso(20, 7, 45),
      kind: "entrada",
      productId: p1.id,
      quantity: 155,
      warehouseId: w1.id,
      note: "Receção PO-2026-088",
    },
  ];

  return {
    warehouses: [w1, w2, w3],
    products: [p1, p2, p3],
    stock,
    movements: movementsNewestFirst,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, emptyState(), () => loadState());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const getQty = useCallback(
    (warehouseId: string, productId: string) =>
      state.stock[stockKey(warehouseId, productId)] ?? 0,
    [state.stock],
  );

  const deleteWarehouse = useCallback(
    (id: string) => {
      const hasStock = Object.entries(state.stock).some(([key, qty]) => {
        if (qty <= 0) return false;
        return key.startsWith(`${id}:`);
      });
      if (hasStock) return false;
      dispatch({ type: "DELETE_WAREHOUSE", payload: id });
      return true;
    },
    [state.stock],
  );

  const deleteProduct = useCallback(
    (id: string) => {
      const hasStock = Object.entries(state.stock).some(([key, qty]) => {
        if (qty <= 0) return false;
        return key.endsWith(`:${id}`);
      });
      if (hasStock) return false;
      dispatch({ type: "DELETE_PRODUCT", payload: id });
      return true;
    },
    [state.stock],
  );

  const registerMovement = useCallback(
    (payload: {
      kind: MovementKind;
      productId: string;
      quantity: number;
      warehouseId?: string;
      fromWarehouseId?: string;
      toWarehouseId?: string;
      note?: string;
    }) => {
      const next = reducer(state, { type: "REGISTER_MOVEMENT", payload });
      if (next === state) return false;
      dispatch({ type: "HYDRATE", payload: next });
      return true;
    },
    [state],
  );

  const seedDemo = useCallback(() => {
    dispatch({ type: "HYDRATE", payload: demoState() });
  }, []);

  const resetAll = useCallback(() => {
    dispatch({ type: "HYDRATE", payload: emptyState() });
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      addWarehouse: (w) => dispatch({ type: "ADD_WAREHOUSE", payload: w }),
      updateWarehouse: (w) => dispatch({ type: "UPDATE_WAREHOUSE", payload: w }),
      deleteWarehouse,
      addProduct: (p) => dispatch({ type: "ADD_PRODUCT", payload: p }),
      updateProduct: (p) => dispatch({ type: "UPDATE_PRODUCT", payload: p }),
      deleteProduct,
      registerMovement,
      getQty,
      seedDemo,
      resetAll,
    }),
    [
      state,
      deleteWarehouse,
      deleteProduct,
      registerMovement,
      getQty,
      seedDemo,
      resetAll,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore deve ser usado dentro de StoreProvider");
  return ctx;
}
