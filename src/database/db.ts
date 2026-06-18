// Web-only — uses localStorage. No expo-sqlite import.
import {
  Customer,
  Invoice,
  InvoiceItem,
  Product,
  Settings,
  StockMovement,
} from '../types';

const DEFAULT_SETTINGS: Settings = {
  factoryName: 'Factory ERP System',
  currency: 'PKR',
  taxPercent: 0,
  receiptFooter: 'Thank you for your business!',
  darkMode: false,
};

const WEB_DB_KEY = 'factory_erp_json_db';

interface WebDB {
  products: Record<string, Product>;
  stock_movements: StockMovement[];
  customers: Record<string, Customer>;
  invoices: Record<string, Invoice>;
  invoice_items: InvoiceItem[];
  settings: Settings;
}

const getWebDB = (): WebDB => {
  const win = typeof globalThis !== 'undefined' ? (globalThis as any).window : null;
  if (!win || !win.localStorage) {
    return { products: {}, stock_movements: [], customers: {}, invoices: {}, invoice_items: [], settings: { ...DEFAULT_SETTINGS } };
  }
  const data = win.localStorage.getItem(WEB_DB_KEY);
  if (!data) {
    const fresh: WebDB = { products: {}, stock_movements: [], customers: {}, invoices: {}, invoice_items: [], settings: { ...DEFAULT_SETTINGS } };
    win.localStorage.setItem(WEB_DB_KEY, JSON.stringify(fresh));
    return fresh;
  }
  try {
    return JSON.parse(data) as WebDB;
  } catch {
    return { products: {}, stock_movements: [], customers: {}, invoices: {}, invoice_items: [], settings: { ...DEFAULT_SETTINGS } };
  }
};

const saveWebDB = (wdb: WebDB): void => {
  const win = typeof globalThis !== 'undefined' ? (globalThis as any).window : null;
  if (win && win.localStorage) {
    win.localStorage.setItem(WEB_DB_KEY, JSON.stringify(wdb));
  }
};

export const db = {
  init: async (): Promise<void> => {
    getWebDB(); // ensures fresh DB is seeded if missing
  },

  // PRODUCTS — returns ALL products (active + archived) so UI can filter
  getProducts: async (): Promise<Product[]> => {
    return Object.values(getWebDB().products);
  },

  saveProduct: async (product: Product): Promise<void> => {
    const wdb = getWebDB();
    wdb.products[product.code] = product;
    saveWebDB(wdb);
  },

  deleteProduct: async (code: string): Promise<void> => {
    const wdb = getWebDB();
    if (wdb.products[code]) {
      wdb.products[code].isActive = false;
      wdb.products[code].updatedAt = new Date().toISOString();
      saveWebDB(wdb);
    }
  },

  // STOCK MOVEMENTS
  getStockMovements: async (productCode?: string): Promise<StockMovement[]> => {
    const wdb = getWebDB();
    const all = [...wdb.stock_movements].reverse();
    return productCode ? all.filter(m => m.productCode === productCode) : all;
  },

  addStockMovement: async (movement: StockMovement): Promise<void> => {
    const wdb = getWebDB();
    wdb.stock_movements.push(movement);
    if (wdb.products[movement.productCode]) {
      wdb.products[movement.productCode].currentStock += movement.quantity;
      wdb.products[movement.productCode].updatedAt = movement.date;
    }
    saveWebDB(wdb);
  },

  // CUSTOMERS
  getCustomers: async (): Promise<Customer[]> => {
    return Object.values(getWebDB().customers)
      .sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''));
  },

  saveCustomer: async (customer: Customer): Promise<void> => {
    const wdb = getWebDB();
    wdb.customers[customer.phone] = customer;
    saveWebDB(wdb);
  },

  // INVOICES
  getInvoices: async (): Promise<Invoice[]> => {
    return Object.values(getWebDB().invoices)
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  getInvoiceItems: async (invoiceId: string): Promise<InvoiceItem[]> => {
    return getWebDB().invoice_items.filter(item => item.invoiceId === invoiceId);
  },

  addInvoice: async (invoice: Invoice, items: InvoiceItem[]): Promise<void> => {
    const wdb = getWebDB();
    wdb.invoices[invoice.id] = invoice;
    wdb.invoice_items.push(...items);
    saveWebDB(wdb);
  },

  updateInvoiceStatus: async (invoiceId: string, status: Invoice['status']): Promise<void> => {
    const wdb = getWebDB();
    if (wdb.invoices[invoiceId]) {
      wdb.invoices[invoiceId].status = status;
      saveWebDB(wdb);
    }
  },

  // SETTINGS
  getSettings: async (): Promise<Settings> => {
    return getWebDB().settings ?? { ...DEFAULT_SETTINGS };
  },

  saveSettings: async (settings: Settings): Promise<void> => {
    const wdb = getWebDB();
    wdb.settings = settings;
    saveWebDB(wdb);
  },

  // BACKUP & RESTORE
  backupData: async (): Promise<string> => {
    return JSON.stringify(getWebDB());
  },

  restoreData: async (jsonString: string): Promise<boolean> => {
    try {
      const restored = JSON.parse(jsonString) as WebDB;
      if (!restored.products || !restored.invoices || !restored.settings) return false;
      saveWebDB(restored);
      return true;
    } catch {
      return false;
    }
  },
};

export default db;
