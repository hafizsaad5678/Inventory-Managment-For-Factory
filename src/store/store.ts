import { create } from 'zustand';
import { Product, StockMovement, Customer, Invoice, InvoiceItem, Settings } from '../types';
import db from '../database/db';
import { convertQuantity } from '../utils/conversions';

interface AppState {
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  stockMovements: StockMovement[];
  settings: Settings;
  isLoading: boolean;

  initApp: () => Promise<void>;
  refreshData: () => Promise<void>;
  
  // Products
  addProduct: (product: Omit<Product, 'createdDate' | 'updatedAt' | 'isActive' | 'currentStock'> & { initialStock?: number }) => Promise<string>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (code: string) => Promise<void>;
  
  // Purchases & Movements
  addPurchase: (productCode: string, qty: number, buyingPrice: number, supplierName: string, date: string, note?: string) => Promise<void>;
  addAdjustment: (productCode: string, qty: number, type: 'adjustment' | 'damage', note: string, date: string) => Promise<void>;
  
  // Invoices & POS
  createInvoice: (
    invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'date' | 'status'> & { customerName?: string },
    items: Omit<InvoiceItem, 'id' | 'invoiceId' | 'quantityInBaseUnit' | 'subtotal' | 'buyingPrice'>[]
  ) => Promise<Invoice>;
  cancelInvoice: (invoiceId: string) => Promise<void>;
  
  // Settings
  saveSettings: (settings: Settings) => Promise<void>;
  restoreBackup: (jsonString: string) => Promise<boolean>;
}

// Generate code using CATEGORY-SERIAL logic (e.g. CHEM-001)
const generateProductCode = (category: string, products: Product[]): string => {
  let cleanCategory = category.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleanCategory.length === 0) cleanCategory = 'GEN';
  const prefix = cleanCategory.substring(0, 4);
  
  // Count existing codes starting with prefix
  const matchingProducts = products.filter(p => p.code.startsWith(prefix));
  let maxNum = 0;
  matchingProducts.forEach(p => {
    const parts = p.code.split('-');
    if (parts.length > 1) {
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });
  
  const nextNum = maxNum + 1;
  const serial = String(nextNum).padStart(3, '0');
  return `${prefix}-${serial}`;
};

// Generate Invoice Serial number: INV-YYYYMMDD-XXXX
const generateInvoiceNumber = (invoices: Invoice[], dateStr: string): string => {
  const cleanDate = dateStr.substring(0, 10).replace(/-/g, '');
  const prefix = `INV-${cleanDate}`;
  const dayInvoices = invoices.filter(inv => inv.invoiceNumber.startsWith(prefix));
  const nextNum = dayInvoices.length + 1;
  const serial = String(nextNum).padStart(4, '0');
  return `${prefix}-${serial}`;
};

export const useStore = create<AppState>((set, get) => ({
  products: [],
  customers: [],
  invoices: [],
  stockMovements: [],
  settings: {
    factoryName: 'Factory ERP System',
    currency: 'PKR',
    taxPercent: 0,
    receiptFooter: 'Thank you for your business!',
    darkMode: false,
  },
  isLoading: true,

  initApp: async () => {
    set({ isLoading: true });
    try {
      await db.init();
      await get().refreshData();
    } catch (e) {
      console.error('Error initializing app state', e);
    } finally {
      set({ isLoading: false });
    }
  },

  refreshData: async () => {
    try {
      const products = await db.getProducts();
      const customers = await db.getCustomers();
      const invoices = await db.getInvoices();
      const stockMovements = await db.getStockMovements();
      const settings = await db.getSettings();
      set({ products, customers, invoices, stockMovements, settings });
    } catch (e) {
      console.error('Error refreshing store data', e);
    }
  },

  addProduct: async (pData) => {
    const { products } = get();
    const code = pData.code ? pData.code.trim().toUpperCase() : generateProductCode(pData.category, products);
    const now = new Date().toISOString();

    const newProduct: Product = {
      code,
      name: pData.name.trim(),
      category: pData.category.trim(),
      unitType: pData.unitType,
      piecesPerBox: pData.piecesPerBox,
      buyingPrice: pData.buyingPrice,
      sellingPrice: pData.sellingPrice,
      currentStock: 0, // Starts at 0, updated by stock movement if initialStock is set
      minStockAlert: pData.minStockAlert,
      createdDate: now,
      updatedAt: now,
      isActive: true,
      barcode: pData.barcode.trim(),
      description: pData.description.trim(),
    };

    await db.saveProduct(newProduct);

    // If there is initial stock, create a stock movement
    if (pData.initialStock && pData.initialStock > 0) {
      const mvId = `mv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const movement: StockMovement = {
        id: mvId,
        productCode: code,
        type: 'purchase',
        quantity: pData.initialStock,
        date: now,
        note: 'Initial stock entry',
      };
      await db.addStockMovement(movement);
    }

    await get().refreshData();
    return code;
  },

  updateProduct: async (product) => {
    product.updatedAt = new Date().toISOString();
    await db.saveProduct(product);
    await get().refreshData();
  },

  deleteProduct: async (code) => {
    await db.deleteProduct(code);
    await get().refreshData();
  },

  addPurchase: async (productCode, qty, purchasePrice, supplierName, date, note) => {
    const { products } = get();
    const product = products.find(p => p.code === productCode);
    if (!product) throw new Error('Product not found');

    const currentStock = product.currentStock;
    const currentCost = product.buyingPrice;
    
    // Weighted Average Cost Logic:
    let newBuyingCost = purchasePrice;
    if (currentStock > 0) {
      newBuyingCost = ((currentStock * currentCost) + (qty * purchasePrice)) / (currentStock + qty);
      // round to 2 decimals
      newBuyingCost = Math.round(newBuyingCost * 100) / 100;
    }

    // Update product cost and update date
    const updatedProduct = {
      ...product,
      buyingPrice: newBuyingCost,
      updatedAt: date,
    };
    await db.saveProduct(updatedProduct);

    // Add stock movement
    const mvId = `mv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const movement: StockMovement = {
      id: mvId,
      productCode,
      type: 'purchase',
      quantity: qty,
      date,
      note: note || `Purchased from ${supplierName} at ${purchasePrice} / unit`,
    };
    await db.addStockMovement(movement);

    await get().refreshData();
  },

  addAdjustment: async (productCode, qty, type, note, date) => {
    // qty should be positive for addition, negative for deduction (e.g. damage is negative)
    const mvId = `mv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const movement: StockMovement = {
      id: mvId,
      productCode,
      type,
      quantity: qty,
      date,
      note,
    };
    await db.addStockMovement(movement);
    await get().refreshData();
  },

  createInvoice: async (invoiceData, itemsData) => {
    const { products, invoices, customers } = get();
    const now = new Date().toISOString();
    
    const invoiceId = `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const invoiceNumber = generateInvoiceNumber(invoices, now);

    const items: InvoiceItem[] = [];
    
    // Process items & deduct stock
    for (const rawItem of itemsData) {
      const product = products.find(p => p.code === rawItem.productCode);
      if (!product) throw new Error(`Product ${rawItem.productCode} not found`);

      // Convert quantity to base unit
      const qtyInBaseUnit = convertQuantity(
        rawItem.quantity,
        rawItem.unitSelected,
        product.unitType,
        product.piecesPerBox
      );

      const subtotal = qtyInBaseUnit * rawItem.sellingPrice;

      const item: InvoiceItem = {
        id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        invoiceId,
        productCode: rawItem.productCode,
        productName: rawItem.productName,
        quantity: rawItem.quantity,
        unitSelected: rawItem.unitSelected,
        quantityInBaseUnit: qtyInBaseUnit,
        sellingPrice: rawItem.sellingPrice,
        buyingPrice: product.buyingPrice, // save historic buying cost
        subtotal: subtotal,
      };
      
      items.push(item);

      // Create Sale stock movement (deducts stock)
      const mvId = `mv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const movement: StockMovement = {
        id: mvId,
        productCode: rawItem.productCode,
        type: 'sale',
        quantity: -qtyInBaseUnit, // Negative for sale
        date: now,
        note: `Sold on ${invoiceNumber}`,
      };
      await db.addStockMovement(movement);
    }

    // Save invoice
    const newInvoice: Invoice = {
      id: invoiceId,
      invoiceNumber,
      date: now,
      customerPhone: invoiceData.customerPhone || null,
      subtotal: invoiceData.subtotal,
      discountAmount: invoiceData.discountAmount,
      finalTotal: invoiceData.finalTotal,
      paymentType: invoiceData.paymentType,
      status: 'paid', // default status
    };

    await db.addInvoice(newInvoice, items);

    // Update customer history if phone was supplied
    if (invoiceData.customerPhone) {
      const phone = invoiceData.customerPhone.trim();
      const existingCustomer = customers.find(c => c.phone === phone);

      const updatedCustomer: Customer = {
        phone,
        name: invoiceData.customerName || (existingCustomer ? existingCustomer.name : 'Regular Customer'),
        totalPurchases: (existingCustomer ? existingCustomer.totalPurchases : 0) + invoiceData.finalTotal,
        totalDiscount: (existingCustomer ? existingCustomer.totalDiscount : 0) + invoiceData.discountAmount,
        lastVisit: now,
      };
      await db.saveCustomer(updatedCustomer);
    }

    await get().refreshData();
    return newInvoice;
  },

  cancelInvoice: async (invoiceId) => {
    const { invoices, customers, products } = get();
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'cancelled') return; // already cancelled

    const now = new Date().toISOString();

    // 1. Fetch invoice items
    const items = await db.getInvoiceItems(invoiceId);

    // 2. Return items to stock (create opposite movement)
    for (const item of items) {
      const mvId = `mv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const movement: StockMovement = {
        id: mvId,
        productCode: item.productCode,
        type: 'return',
        quantity: item.quantityInBaseUnit, // Positive to return stock
        date: now,
        note: `Returned from cancelled invoice ${invoice.invoiceNumber}`,
      };
      await db.addStockMovement(movement);
    }

    // 3. Reverse customer purchases
    if (invoice.customerPhone) {
      const phone = invoice.customerPhone;
      const customer = customers.find(c => c.phone === phone);
      if (customer) {
        const updatedCustomer: Customer = {
          ...customer,
          totalPurchases: Math.max(0, customer.totalPurchases - invoice.finalTotal),
          totalDiscount: Math.max(0, customer.totalDiscount - invoice.discountAmount),
          lastVisit: now,
        };
        await db.saveCustomer(updatedCustomer);
      }
    }

    // 4. Update status in Database
    await db.updateInvoiceStatus(invoiceId, 'cancelled');

    await get().refreshData();
  },

  saveSettings: async (settings) => {
    await db.saveSettings(settings);
    await get().refreshData();
  },

  restoreBackup: async (jsonString) => {
    const success = await db.restoreData(jsonString);
    if (success) {
      await get().refreshData();
    }
    return success;
  },
}));
export default useStore;
