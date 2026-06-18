// Native-only (iOS/Android) — uses expo-sqlite
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Product, StockMovement, Customer, Invoice, InvoiceItem, Settings } from '../types';

// Lazily opened — avoids crashing at module load time before init() is called
let _db: SQLiteDatabase | null = null;
const getDb = (): SQLiteDatabase => {
    if (!_db) {
        _db = openDatabaseSync('factory_erp.db');
    }
    return _db;
};

const DEFAULT_SETTINGS: Settings = {
    factoryName: 'Factory ERP System',
    currency: 'PKR',
    taxPercent: 0,
    receiptFooter: 'Thank you for your business!',
    darkMode: false,
};

export const db = {
    init: async (): Promise<void> => {
        try {
            const d = getDb();
            d.execSync(`
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
            d.execSync(`
        CREATE TABLE IF NOT EXISTS stock_movements (
          id TEXT PRIMARY KEY,
          productCode TEXT NOT NULL,
          type TEXT NOT NULL,
          quantity REAL NOT NULL,
          date TEXT NOT NULL,
          note TEXT
        );
      `);
            d.execSync(`
        CREATE TABLE IF NOT EXISTS customers (
          phone TEXT PRIMARY KEY,
          name TEXT,
          totalPurchases REAL DEFAULT 0,
          totalDiscount REAL DEFAULT 0,
          lastVisit TEXT,
          isRegular INTEGER DEFAULT 0
        );
      `);
            d.execSync(`
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
            d.execSync(`
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
            d.execSync(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
            // Migration: add isRegular column if missing
            try {
                d.execSync(`ALTER TABLE customers ADD COLUMN isRegular INTEGER DEFAULT 0;`);
            } catch (_) { /* already exists */ }

            const row = d.getFirstSync(`SELECT value FROM settings WHERE key = 'app_settings'`);
            if (!row) {
                d.runSync(
                    `INSERT INTO settings (key, value) VALUES (?, ?)`,
                    ['app_settings', JSON.stringify(DEFAULT_SETTINGS)]
                );
            }
        } catch (err) {
            console.error('Error initializing SQLite database:', err);
        }
    },

    getProducts: async (): Promise<Product[]> => {
        // Return ALL products (active + archived) — store/UI filters by isActive
        const rows = getDb().getAllSync(`SELECT * FROM products`);
        return (rows as any[]).map((row) => ({ ...row, isActive: !!row.isActive }));
    },

    saveProduct: async (product: Product): Promise<void> => {
        getDb().runSync(`
      INSERT OR REPLACE INTO products (
        code, name, category, unitType, piecesPerBox, buyingPrice,
        sellingPrice, currentStock, minStockAlert, createdDate, updatedAt, isActive, barcode, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            product.code, product.name, product.category, product.unitType,
            product.piecesPerBox, product.buyingPrice, product.sellingPrice,
            product.currentStock, product.minStockAlert, product.createdDate,
            product.updatedAt, product.isActive ? 1 : 0, product.barcode ?? null, product.description ?? null,
        ]);
    },

    deleteProduct: async (code: string): Promise<void> => {
        getDb().runSync(
            `UPDATE products SET isActive = 0, updatedAt = ? WHERE code = ?`,
            [new Date().toISOString(), code]
        );
    },

    getStockMovements: async (productCode?: string): Promise<StockMovement[]> => {
        if (productCode) {
            return getDb().getAllSync(
                `SELECT * FROM stock_movements WHERE productCode = ? ORDER BY date DESC`,
                [productCode]
            ) as StockMovement[];
        }
        return getDb().getAllSync(`SELECT * FROM stock_movements ORDER BY date DESC`) as StockMovement[];
    },

    addStockMovement: async (movement: StockMovement): Promise<void> => {
        const d = getDb();
        d.runSync(
            `INSERT INTO stock_movements (id, productCode, type, quantity, date, note) VALUES (?, ?, ?, ?, ?, ?)`,
            [movement.id, movement.productCode, movement.type, movement.quantity, movement.date, movement.note || '']
        );
        d.runSync(
            `UPDATE products SET currentStock = currentStock + ?, updatedAt = ? WHERE code = ?`,
            [movement.quantity, movement.date, movement.productCode]
        );
    },

    getCustomers: async (): Promise<Customer[]> => {
        const rows = getDb().getAllSync(`SELECT * FROM customers ORDER BY lastVisit DESC`);
        return (rows as any[]).map((c) => ({ ...c, isRegular: !!c.isRegular }));
    },

    saveCustomer: async (customer: Customer): Promise<void> => {
        getDb().runSync(`
      INSERT OR REPLACE INTO customers (phone, name, totalPurchases, totalDiscount, lastVisit, isRegular)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
            customer.phone, customer.name || '', customer.totalPurchases,
            customer.totalDiscount, customer.lastVisit, customer.isRegular ? 1 : 0,
        ]);
    },

    getInvoices: async (): Promise<Invoice[]> => {
        return getDb().getAllSync(`SELECT * FROM invoices ORDER BY date DESC`) as Invoice[];
    },

    getInvoiceItems: async (invoiceId: string): Promise<InvoiceItem[]> => {
        return getDb().getAllSync(
            `SELECT * FROM invoice_items WHERE invoiceId = ?`,
            [invoiceId]
        ) as InvoiceItem[];
    },

    addInvoice: async (invoice: Invoice, items: InvoiceItem[]): Promise<void> => {
        const d = getDb();
        d.runSync(`
      INSERT INTO invoices (id, invoiceNumber, date, customerPhone, subtotal, discountAmount, finalTotal, paymentType, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            invoice.id, invoice.invoiceNumber, invoice.date, invoice.customerPhone ?? null,
            invoice.subtotal, invoice.discountAmount, invoice.finalTotal, invoice.paymentType, invoice.status,
        ]);
        for (const item of items) {
            d.runSync(`
        INSERT INTO invoice_items (id, invoiceId, productCode, productName, quantity, unitSelected, quantityInBaseUnit, sellingPrice, buyingPrice, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                item.id, item.invoiceId, item.productCode, item.productName,
                item.quantity, item.unitSelected, item.quantityInBaseUnit,
                item.sellingPrice, item.buyingPrice, item.subtotal,
            ]);
        }
    },

    updateInvoiceStatus: async (invoiceId: string, status: Invoice['status']): Promise<void> => {
        getDb().runSync(`UPDATE invoices SET status = ? WHERE id = ?`, [status, invoiceId]);
    },

    getSettings: async (): Promise<Settings> => {
        const row = getDb().getFirstSync(`SELECT value FROM settings WHERE key = 'app_settings'`) as any;
        return row ? JSON.parse(row.value) : DEFAULT_SETTINGS;
    },

    saveSettings: async (settings: Settings): Promise<void> => {
        getDb().runSync(
            `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
            ['app_settings', JSON.stringify(settings)]
        );
    },

    backupData: async (): Promise<string> => {
        const d = getDb();
        const products = d.getAllSync(`SELECT * FROM products`) as any[];
        const stock_movements = d.getAllSync(`SELECT * FROM stock_movements`) as StockMovement[];
        const customers = d.getAllSync(`SELECT * FROM customers`) as any[];
        const invoices = d.getAllSync(`SELECT * FROM invoices`) as Invoice[];
        const invoice_items = d.getAllSync(`SELECT * FROM invoice_items`) as InvoiceItem[];
        const settingsRow = d.getFirstSync(`SELECT value FROM settings WHERE key = 'app_settings'`) as any;
        const settings = settingsRow ? JSON.parse(settingsRow.value) : DEFAULT_SETTINGS;

        const productsMap: Record<string, Product> = {};
        products.forEach((p) => { productsMap[p.code] = { ...p, isActive: !!p.isActive }; });
        const customersMap: Record<string, Customer> = {};
        customers.forEach((c) => { customersMap[c.phone] = { ...c, isRegular: !!c.isRegular }; });
        const invoicesMap: Record<string, Invoice> = {};
        invoices.forEach((i) => { invoicesMap[i.id] = i; });

        return JSON.stringify({ products: productsMap, stock_movements, customers: customersMap, invoices: invoicesMap, invoice_items, settings });
    },

    restoreData: async (jsonString: string): Promise<boolean> => {
        try {
            const restored = JSON.parse(jsonString);
            if (!restored.products || !restored.invoices || !restored.settings) return false;

            const d = getDb();
            d.execSync(`DELETE FROM products`);
            d.execSync(`DELETE FROM stock_movements`);
            d.execSync(`DELETE FROM customers`);
            d.execSync(`DELETE FROM invoices`);
            d.execSync(`DELETE FROM invoice_items`);
            d.execSync(`DELETE FROM settings`);

            d.runSync(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['app_settings', JSON.stringify(restored.settings)]);

            for (const p of Object.values(restored.products) as any[]) {
                d.runSync(`
          INSERT INTO products (code, name, category, unitType, piecesPerBox, buyingPrice, sellingPrice, currentStock, minStockAlert, createdDate, updatedAt, isActive, barcode, description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [p.code, p.name, p.category, p.unitType, p.piecesPerBox, p.buyingPrice, p.sellingPrice, p.currentStock, p.minStockAlert, p.createdDate, p.updatedAt, p.isActive ? 1 : 0, p.barcode ?? null, p.description ?? null]);
            }
            for (const m of restored.stock_movements as any[]) {
                d.runSync(`INSERT INTO stock_movements (id, productCode, type, quantity, date, note) VALUES (?, ?, ?, ?, ?, ?)`,
                    [m.id, m.productCode, m.type, m.quantity, m.date, m.note || '']);
            }
            for (const c of Object.values(restored.customers) as any[]) {
                d.runSync(`INSERT INTO customers (phone, name, totalPurchases, totalDiscount, lastVisit, isRegular) VALUES (?, ?, ?, ?, ?, ?)`,
                    [c.phone, c.name || '', c.totalPurchases, c.totalDiscount, c.lastVisit, c.isRegular ? 1 : 0]);
            }
            for (const i of Object.values(restored.invoices) as any[]) {
                d.runSync(`INSERT INTO invoices (id, invoiceNumber, date, customerPhone, subtotal, discountAmount, finalTotal, paymentType, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [i.id, i.invoiceNumber, i.date, i.customerPhone ?? null, i.subtotal, i.discountAmount, i.finalTotal, i.paymentType, i.status]);
            }
            for (const item of restored.invoice_items as any[]) {
                d.runSync(`INSERT INTO invoice_items (id, invoiceId, productCode, productName, quantity, unitSelected, quantityInBaseUnit, sellingPrice, buyingPrice, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [item.id, item.invoiceId, item.productCode, item.productName, item.quantity, item.unitSelected, item.quantityInBaseUnit, item.sellingPrice, item.buyingPrice, item.subtotal]);
            }
            return true;
        } catch (e) {
            console.error('Failed to restore database', e);
            return false;
        }
    },
};

export default db;
