export interface Product {
  code: string; // e.g. CHEM-001 (Universal reusable code)
  name: string;
  category: string;
  unitType: "kg" | "g" | "liter" | "ml" | "dozen" | "box" | "piece";
  piecesPerBox: number; // For box ⇄ piece conversions (default = 1)
  buyingPrice: number; // Weighted average buying price
  sellingPrice: number;
  currentStock: number;
  minStockAlert: number;
  createdDate: string;
  updatedAt: string;
  isActive: boolean; // For soft deletes
  barcode: string; // Future barcode support
  description: string; // Optional notes
}

export type StockMovementType =
  | "purchase"
  | "sale"
  | "adjustment"
  | "damage"
  | "return";

export interface StockMovement {
  id: string;
  productCode: string;
  type: StockMovementType;
  quantity: number; // positive or negative, in base unit
  date: string;
  note?: string;
}

export interface Customer {
  phone: string; // Unique key
  name?: string;
  totalPurchases: number; // Sum of finalTotal of completed invoices
  totalDiscount: number; // Sum of discountAmount of completed invoices
  lastVisit: string; // ISO date string
  isRegular: boolean; // true if customer existed before (repeat customer)
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productCode: string;
  productName: string;
  quantity: number; // quantity input by user (e.g. 500)
  unitSelected: "kg" | "g" | "liter" | "ml" | "dozen" | "box" | "piece"; // unit selected by user (e.g. 'g')
  quantityInBaseUnit: number; // converted quantity (e.g. 0.5 for 500g of a 'kg' product)
  sellingPrice: number; // Price per base unit
  buyingPrice: number; // Historical buying price per base unit at time of sale
  subtotal: number; // (quantityInBaseUnit * sellingPrice)
}

export type InvoiceStatus = "paid" | "pending" | "cancelled" | "refunded";

export interface Invoice {
  id: string; // unique database ID
  invoiceNumber: string; // Human readable (e.g. INV-20260606-0001)
  date: string; // ISO string
  customerPhone: string | null; // NULL for anonymous/walk-in
  subtotal: number; // Sum of item.subtotal
  discountAmount: number; // applied discount value in currency
  finalTotal: number; // subtotal - discountAmount
  paymentType: "Cash" | "Card" | "Credit";
  status: InvoiceStatus;
}

export interface Settings {
  factoryName: string;
  logoUrl?: string;
  currency: string; // e.g. PKR, $, EUR
  taxPercent: number; // Tax rate applied at POS (default 0)
  receiptFooter: string;
  darkMode: boolean;
}
