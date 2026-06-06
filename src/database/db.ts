import { Platform } from 'react-native';
import { Product, StockMovement, Customer, Invoice, InvoiceItem, Settings } from '../types';
import storageService from '../services/storageService';

// Safely open expo-sqlite on Native platforms
let sqliteDb: any = null;
if (Platform.OS !== 'web') {
  try {
    const SQLite = require('expo-sqlite');
    sqliteDb = SQLite.openDatabaseSync('factory_erp.db');
  } catch (e) {
    console.error('Failed to open expo-sqlite', e);
  }
}

// Default settings
const DEFAULT_SETTINGS: Settings = {
  factoryName: 'Factory ERP System',
  currency: 'PKR',
  taxPercent: 0,
  receiptFooter: 'Thank you for your business!',
  darkMode: false,
};

// Web Fallback JSON database in localStorage
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
  if (typeof window === 'undefined' || !window.localStorage) {
    return { products: {}, stock_movements: [], customers: {}, invoices: {}, invoice_items: [], settings: DEFAULT_SETTINGS };
  }
  const data = localStorage.getItem(WEB_DB_KEY);
  if (!data) {
    const fresh = { products: {}, stock_movements: [], customers: {}, invoices: {}, invoice_items: [], settings: DEFAULT_SETTINGS };
    localStorage.setItem(WEB_DB_KEY, JSON.stringify(fresh));
    return fresh;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse web DB', e);
    return { products: {}, stock_movements: [], customers: {}, invoices: {}, invoice_items: [], settings: DEFAULT_SETTINGS };
  }
};

const saveWebDB = (db: WebDB) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(WEB_DB_KEY, JSON.stringify(db));
  }
};

// Database API
export const db = {
  init: async (): Promise<void> => {
    if (sqliteDb) {
      try {
        // Create tables in SQLite
        sqliteDb.execSync(`
          CREATE TABLE IF NOT EXISTS products (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            unitType TEXT NOT NULL,
            piecesPerBox INTEGER DEFAULT 1,
            buyingPrice REAL NOT NULL,
            sellingPrice REAL NOT NULL,
            currentStock REAL NOT NULL,
            minStockAlert REAL NOT NULL,
            createdDate TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            isActive INTEGER DEFAULT 1,
            barcode TEXT,
            description TEXT
          );
        `);

        sqliteDb.execSync(`
          CREATE TABLE IF NOT EXISTS stock_movements (
            id TEXT PRIMARY KEY,
            productCode TEXT NOT NULL,
            type TEXT NOT NULL,
            quantity REAL NOT NULL,
            date TEXT NOT NULL,
            note TEXT
          );
        `);

        sqliteDb.execSync(`
          CREATE TABLE IF NOT EXISTS customers (
            phone TEXT PRIMARY KEY,
            name TEXT,
            totalPurchases REAL DEFAULT 0,
            totalDiscount REAL DEFAULT 0,
            lastVisit TEXT
          );
        `);

        sqliteDb.execSync(`
          CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            invoiceNumber TEXT UNIQUE,
            date TEXT NOT NULL,
            customerPhone TEXT,
            subtotal REAL NOT NULL,
            discountAmount REAL NOT NULL,
            finalTotal REAL NOT NULL,
            paymentType TEXT NOT NULL,
            status TEXT NOT NULL
          );
        `);

        sqliteDb.execSync(`
          CREATE TABLE IF NOT EXISTS invoice_items (
            id TEXT PRIMARY KEY,
            invoiceId TEXT NOT NULL,
            productCode TEXT NOT NULL,
            productName TEXT NOT NULL,
            quantity REAL NOT NULL,
            unitSelected TEXT NOT NULL,
            quantityInBaseUnit REAL NOT NULL,
            sellingPrice REAL NOT NULL,
            buyingPrice REAL NOT NULL,
            subtotal REAL NOT NULL
          );
        `);

        sqliteDb.execSync(`
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );
        `);

        // Seed default settings if not exists
        const row = sqliteDb.getFirstSync(`SELECT value FROM settings WHERE key = 'app_settings'`);
        if (!row) {
          sqliteDb.runSync(
            `INSERT INTO settings (key, value) VALUES (?, ?)`,
            ['app_settings', JSON.stringify(DEFAULT_SETTINGS)]
          );
        }
      } catch (err) {
        console.error('Error initializing SQLite database:', err);
      }
    } else {
      // Web fallback init
      getWebDB();
    }
  },

  // PRODUCTS
  getProducts: async (): Promise<Product[]> => {
    if (sqliteDb) {
      const rows = sqliteDb.getAllSync(`SELECT * FROM products WHERE isActive = 1`);
      return rows.map((row: any) => ({
        ...row,
        isActive: !!row.isActive,
      }));
    } else {
      const wdb = getWebDB();
      return Object.values(wdb.products).filter(p => p.isActive);
    }
  },

  saveProduct: async (product: Product): Promise<void> => {
    if (sqliteDb) {
      sqliteDb.runSync(`
        INSERT OR REPLACE INTO products (
          code, name, category, unitType, piecesPerBox, buyingPrice, 
          sellingPrice, currentStock, minStockAlert, createdDate, updatedAt, isActive, barcode, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        product.code,
        product.name,
        product.category,
        product.unitType,
        product.piecesPerBox,
        product.buyingPrice,
        product.sellingPrice,
        product.currentStock,
        product.minStockAlert,
        product.createdDate,
        product.updatedAt,
        product.isActive ? 1 : 0,
        product.barcode,
        product.description,
      ]);
    } else {
      const wdb = getWebDB();
      wdb.products[product.code] = product;
      saveWebDB(wdb);
    }
  },

  deleteProduct: async (code: string): Promise<void> => {
    if (sqliteDb) {
      sqliteDb.runSync(`UPDATE products SET isActive = 0, updatedAt = ? WHERE code = ?`, [new Date().toISOString(), code]);
    } else {
      const wdb = getWebDB();
      if (wdb.products[code]) {
        wdb.products[code].isActive = false;
        wdb.products[code].updatedAt = new Date().toISOString();
        saveWebDB(wdb);
      }
    }
  },

  // STOCK MOVEMENTS
  getStockMovements: async (productCode?: string): Promise<StockMovement[]> => {
    if (sqliteDb) {
      if (productCode) {
        return sqliteDb.getAllSync(`SELECT * FROM stock_movements WHERE productCode = ? ORDER BY date DESC`, [productCode]);
      }
      return sqliteDb.getAllSync(`SELECT * FROM stock_movements ORDER BY date DESC`);
    } else {
      const wdb = getWebDB();
      if (productCode) {
        return wdb.stock_movements.filter(m => m.productCode === productCode).reverse();
      }
      return [...wdb.stock_movements].reverse();
    }
  },

  addStockMovement: async (movement: StockMovement): Promise<void> => {
    if (sqliteDb) {
      sqliteDb.runSync(`
        INSERT INTO stock_movements (id, productCode, type, quantity, date, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        movement.id,
        movement.productCode,
        movement.type,
        movement.quantity,
        movement.date,
        movement.note || '',
      ]);

      // Update actual product stock in products table
      sqliteDb.runSync(`
        UPDATE products 
        SET currentStock = currentStock + ?, updatedAt = ?
        WHERE code = ?
      `, [movement.quantity, movement.date, movement.productCode]);
    } else {
      const wdb = getWebDB();
      wdb.stock_movements.push(movement);
      if (wdb.products[movement.productCode]) {
        wdb.products[movement.productCode].currentStock += movement.quantity;
        wdb.products[movement.productCode].updatedAt = movement.date;
      }
      saveWebDB(wdb);
    }
  },

  // CUSTOMERS
  getCustomers: async (): Promise<Customer[]> => {
    if (sqliteDb) {
      return sqliteDb.getAllSync(`SELECT * FROM customers ORDER BY lastVisit DESC`);
    } else {
      const wdb = getWebDB();
      return Object.values(wdb.customers).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
    }
  },

  saveCustomer: async (customer: Customer): Promise<void> => {
    if (sqliteDb) {
      sqliteDb.runSync(`
        INSERT OR REPLACE INTO customers (phone, name, totalPurchases, totalDiscount, lastVisit)
        VALUES (?, ?, ?, ?, ?)
      `, [
        customer.phone,
        customer.name || '',
        customer.totalPurchases,
        customer.totalDiscount,
        customer.lastVisit,
      ]);
    } else {
      const wdb = getWebDB();
      wdb.customers[customer.phone] = customer;
      saveWebDB(wdb);
    }
  },

  // INVOICES & ITEMS
  getInvoices: async (): Promise<Invoice[]> => {
    if (sqliteDb) {
      return sqliteDb.getAllSync(`SELECT * FROM invoices ORDER BY date DESC`);
    } else {
      const wdb = getWebDB();
      return Object.values(wdb.invoices).sort((a, b) => b.date.localeCompare(a.date));
    }
  },

  getInvoiceItems: async (invoiceId: string): Promise<InvoiceItem[]> => {
    if (sqliteDb) {
      return sqliteDb.getAllSync(`SELECT * FROM invoice_items WHERE invoiceId = ?`, [invoiceId]);
    } else {
      const wdb = getWebDB();
      return wdb.invoice_items.filter(item => item.invoiceId === invoiceId);
    }
  },

  addInvoice: async (invoice: Invoice, items: InvoiceItem[]): Promise<void> => {
    if (sqliteDb) {
      // Start transaction or sequence
      sqliteDb.runSync(`
        INSERT INTO invoices (id, invoiceNumber, date, customerPhone, subtotal, discountAmount, finalTotal, paymentType, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoice.id,
        invoice.invoiceNumber,
        invoice.date,
        invoice.customerPhone,
        invoice.subtotal,
        invoice.discountAmount,
        invoice.finalTotal,
        invoice.paymentType,
        invoice.status,
      ]);

      for (const item of items) {
        sqliteDb.runSync(`
          INSERT INTO invoice_items (id, invoiceId, productCode, productName, quantity, unitSelected, quantityInBaseUnit, sellingPrice, buyingPrice, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          item.id,
          item.invoiceId,
          item.productCode,
          item.productName,
          item.quantity,
          item.unitSelected,
          item.quantityInBaseUnit,
          item.sellingPrice,
          item.buyingPrice,
          item.subtotal,
        ]);
      }
    } else {
      const wdb = getWebDB();
      wdb.invoices[invoice.id] = invoice;
      wdb.invoice_items.push(...items);
      saveWebDB(wdb);
    }
  },

  updateInvoiceStatus: async (invoiceId: string, status: Invoice['status']): Promise<void> => {
    if (sqliteDb) {
      sqliteDb.runSync(`UPDATE invoices SET status = ? WHERE id = ?`, [status, invoiceId]);
    } else {
      const wdb = getWebDB();
      if (wdb.invoices[invoiceId]) {
        wdb.invoices[invoiceId].status = status;
        saveWebDB(wdb);
      }
    }
  },

  // SETTINGS
  getSettings: async (): Promise<Settings> => {
    if (sqliteDb) {
      const row = sqliteDb.getFirstSync(`SELECT value FROM settings WHERE key = 'app_settings'`);
      return row ? JSON.parse(row.value) : DEFAULT_SETTINGS;
    } else {
      const wdb = getWebDB();
      return wdb.settings || DEFAULT_SETTINGS;
    }
  },

  saveSettings: async (settings: Settings): Promise<void> => {
    if (sqliteDb) {
      sqliteDb.runSync(`
        INSERT OR REPLACE INTO settings (key, value)
        VALUES (?, ?)
      `, ['app_settings', JSON.stringify(settings)]);
    } else {
      const wdb = getWebDB();
      wdb.settings = settings;
      saveWebDB(wdb);
    }
  },

  // BACKUP & RESTORE JSON
  backupData: async (): Promise<string> => {
    let allData: WebDB;
    if (sqliteDb) {
      const products = sqliteDb.getAllSync(`SELECT * FROM products`);
      const stock_movements = sqliteDb.getAllSync(`SELECT * FROM stock_movements`);
      const customers = sqliteDb.getAllSync(`SELECT * FROM customers`);
      const invoices = sqliteDb.getAllSync(`SELECT * FROM invoices`);
      const invoice_items = sqliteDb.getAllSync(`SELECT * FROM invoice_items`);
      const settingsRow = sqliteDb.getFirstSync(`SELECT value FROM settings WHERE key = 'app_settings'`);
      const settings = settingsRow ? JSON.parse(settingsRow.value) : DEFAULT_SETTINGS;

      // Format as WebDB object structure
      const productsMap: Record<string, Product> = {};
      products.forEach((p: any) => { productsMap[p.code] = { ...p, isActive: !!p.isActive }; });

      const customersMap: Record<string, Customer> = {};
      customers.forEach((c: any) => { customersMap[c.phone] = c; });

      const invoicesMap: Record<string, Invoice> = {};
      invoices.forEach((i: any) => { invoicesMap[i.id] = i; });

      allData = {
        products: productsMap,
        stock_movements,
        customers: customersMap,
        invoices: invoicesMap,
        invoice_items,
        settings,
      };
    } else {
      allData = getWebDB();
    }
    return JSON.stringify(allData);
  },

  restoreData: async (jsonString: string): Promise<boolean> => {
    try {
      const restored = JSON.parse(jsonString) as WebDB;
      if (!restored.products || !restored.invoices || !restored.settings) {
        return false;
      }

      if (sqliteDb) {
        // Clear all tables
        sqliteDb.execSync(`DELETE FROM products`);
        sqliteDb.execSync(`DELETE FROM stock_movements`);
        sqliteDb.execSync(`DELETE FROM customers`);
        sqliteDb.execSync(`DELETE FROM invoices`);
        sqliteDb.execSync(`DELETE FROM invoice_items`);
        sqliteDb.execSync(`DELETE FROM settings`);

        // Restore Settings
        sqliteDb.runSync(
          `INSERT INTO settings (key, value) VALUES (?, ?)`,
          ['app_settings', JSON.stringify(restored.settings)]
        );

        // Restore Products
        for (const p of Object.values(restored.products)) {
          sqliteDb.runSync(`
            INSERT INTO products (code, name, category, unitType, piecesPerBox, buyingPrice, sellingPrice, currentStock, minStockAlert, createdDate, updatedAt, isActive, barcode, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [p.code, p.name, p.category, p.unitType, p.piecesPerBox, p.buyingPrice, p.sellingPrice, p.currentStock, p.minStockAlert, p.createdDate, p.updatedAt, p.isActive ? 1 : 0, p.barcode || null, p.description || null]);
        }

        // Restore Stock Movements
        for (const m of restored.stock_movements) {
          sqliteDb.runSync(`
            INSERT INTO stock_movements (id, productCode, type, quantity, date, note)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [m.id, m.productCode, m.type, m.quantity, m.date, m.note || '']);
        }

        // Restore Customers
        for (const c of Object.values(restored.customers)) {
          sqliteDb.runSync(`
            INSERT INTO customers (phone, name, totalPurchases, totalDiscount, lastVisit)
            VALUES (?, ?, ?, ?, ?)
          `, [c.phone, c.name || '', c.totalPurchases, c.totalDiscount, c.lastVisit]);
        }

        // Restore Invoices
        for (const i of Object.values(restored.invoices)) {
          sqliteDb.runSync(`
            INSERT INTO invoices (id, invoiceNumber, date, customerPhone, subtotal, discountAmount, finalTotal, paymentType, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [i.id, i.invoiceNumber, i.date, i.customerPhone, i.subtotal, i.discountAmount, i.finalTotal, i.paymentType, i.status]);
        }

        // Restore Invoice Items
        for (const item of restored.invoice_items) {
          sqliteDb.runSync(`
            INSERT INTO invoice_items (id, invoiceId, productCode, productName, quantity, unitSelected, quantityInBaseUnit, sellingPrice, buyingPrice, subtotal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [item.id, item.invoiceId, item.productCode, item.productName, item.quantity, item.unitSelected, item.quantityInBaseUnit, item.sellingPrice, item.buyingPrice, item.subtotal]);
        }
      } else {
        saveWebDB(restored);
      }
      return true;
    } catch (e) {
      console.error('Failed to restore database', e);
      return false;
    }
  },
};
export default db;
