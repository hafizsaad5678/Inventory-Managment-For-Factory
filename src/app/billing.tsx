import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  View, 
  Pressable, 
  TextInput, 
  Text,
  Modal,
  Platform,
  Alert,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Colors, Spacing, MaxContentWidth, BottomTabInset } from '../constants/theme';
import { useTheme } from '../hooks/use-theme';
import { Product, InvoiceItem, Invoice, Customer } from '../types';
import { convertQuantity, getConversionMultiplier } from '../utils/conversions';
import { 
  SearchIcon, 
  CloseIcon, 
  TrashIcon, 
  PlusIcon, 
  MinusIcon, 
  CheckIcon,
  ExportIcon,
  POSIcon
} from '../components/Icons';

interface CartItem {
  product: Product;
  quantity: number;
  unitSelected: Product['unitType'];
  sellingPrice: number; // custom price override support, defaults to product.sellingPrice
}

export default function BillingScreen() {
  const store = useStore();
  const theme = useTheme();
  
  // Layout tracking for split screen on large displays
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription.remove();
  }, []);

  const isSplitScreen = screenWidth > 768;

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Customer Checkout Details
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [showRegisterCustomer, setShowRegisterCustomer] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);
  
  // Discount & Taxes
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [discountVal, setDiscountVal] = useState('0');
  const [paymentType, setPaymentType] = useState<Invoice['paymentType']>('Cash');
  
  // Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null);
  const [generatedItems, setGeneratedItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    store.refreshData();
  }, []);

  // Search Customer on Phone input change
  useEffect(() => {
    const cleanPhone = customerPhone.trim();
    if (cleanPhone.length >= 7) {
      const match = store.customers.find(c => c.phone === cleanPhone);
      if (match) {
        setMatchedCustomer(match);
        setCustomerName(match.name || '');
        setShowRegisterCustomer(false);
      } else {
        setMatchedCustomer(null);
        setShowRegisterCustomer(true);
      }
    } else {
      setMatchedCustomer(null);
      setShowRegisterCustomer(false);
    }
  }, [customerPhone, store.customers]);

  // Add Product to POS Cart
  const handleAddToCart = (product: Product) => {
    if (product.currentStock <= 0) {
      alert('Product is out of stock!');
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.code === product.code);
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      const newQty = updatedCart[existingIndex].quantity + 1;
      
      // Check stock limit conversion
      const baseQty = convertQuantity(newQty, updatedCart[existingIndex].unitSelected, product.unitType, product.piecesPerBox);
      if (baseQty > product.currentStock) {
        alert('Cannot exceed available stock!');
        return;
      }
      
      updatedCart[existingIndex].quantity = newQty;
      setCart(updatedCart);
    } else {
      setCart([...cart, {
        product,
        quantity: 1,
        unitSelected: product.unitType, // default to base unit
        sellingPrice: product.sellingPrice
      }]);
    }
  };

  // Adjust Cart Quantities
  const handleUpdateCartQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(index);
      return;
    }

    const item = cart[index];
    const baseQty = convertQuantity(newQty, item.unitSelected, item.product.unitType, item.product.piecesPerBox);
    if (baseQty > item.product.currentStock) {
      alert('Cannot exceed available stock!');
      return;
    }

    const updatedCart = [...cart];
    updatedCart[index].quantity = newQty;
    setCart(updatedCart);
  };

  // Change sale unit
  const handleUpdateUnit = (index: number, unit: Product['unitType']) => {
    const updatedCart = [...cart];
    const item = updatedCart[index];
    
    // We adjust unit and convert quantities so billing is smooth
    // e.g. if converting from kg to g, quantity 1 -> 1000
    const convertedQty = convertQuantity(item.quantity, item.unitSelected, unit, item.product.piecesPerBox);
    
    updatedCart[index].unitSelected = unit;
    updatedCart[index].quantity = convertedQty;
    setCart(updatedCart);
  };

  const handleRemoveFromCart = (index: number) => {
    const updated = cart.filter((_, i) => i !== index);
    setCart(updated);
  };

  // Pricing calculations
  const calculateCartSubtotal = () => {
    return cart.reduce((sum, item) => {
      // Calculate price based on unit conversion
      // if base is kg, and selected is g, price per gram is sellingPrice / 1000
      const mult = getConversionMultiplier(item.unitSelected, item.product.unitType, item.product.piecesPerBox);
      const itemSub = item.quantity * (item.sellingPrice * mult);
      return sum + itemSub;
    }, 0);
  };

  const subtotal = calculateCartSubtotal();
  
  // Tax
  const taxPct = store.settings.taxPercent || 0;
  const taxAmount = (subtotal * taxPct) / 100;
  const subtotalWithTax = subtotal + taxAmount;

  // Discount
  const discountAmount = (() => {
    const val = parseFloat(discountVal) || 0;
    if (discountType === 'percentage') {
      return (subtotalWithTax * val) / 100;
    }
    return val;
  })();

  const grandTotal = Math.max(0, subtotalWithTax - discountAmount);

  // POST CHECKOUT
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Cart is empty!');
      return;
    }

    try {
      const checkoutItems = cart.map(item => {
        const baseQty = convertQuantity(item.quantity, item.unitSelected, item.product.unitType, item.product.piecesPerBox);
        return {
          productCode: item.product.code,
          productName: item.product.name,
          quantity: item.quantity,
          unitSelected: item.unitSelected,
          sellingPrice: item.sellingPrice,
        };
      });

      const invoiceData = {
        customerPhone: customerPhone.trim() || null,
        customerName: customerName.trim() || (matchedCustomer ? matchedCustomer.name : undefined),
        subtotal: subtotal + taxAmount,
        discountAmount,
        finalTotal: grandTotal,
        paymentType,
      };

      const inv = await store.createInvoice(invoiceData, checkoutItems);
      
      // Load saved invoice items for receipt
      const SQLite = require('../database/db');
      const savedItems = await SQLite.db.getInvoiceItems(inv.id);

      setGeneratedInvoice(inv);
      setGeneratedItems(savedItems);
      setShowReceiptModal(true);

      // Clear State
      setCart([]);
      setCustomerPhone('');
      setCustomerName('');
      setDiscountVal('0');
      setPaymentType('Cash');
    } catch (e) {
      console.error(e);
      alert('Checkout failed! Check stock quantities.');
    }
  };

  // Filter products for POS Left pane
  const categories = ['All', ...new Set(store.products.map(p => p.category))];
  const filteredProducts = store.products.filter(p => {
    if (!p.isActive) return false;
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Render product search and grid (Left pane)
  const renderProductCatalog = () => (
    <View style={styles.catalogContainer}>
      <View style={styles.posSearchRow}>
        <View style={styles.searchWrapper}>
          <SearchIcon size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search products..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posCategoryScroll}>
        {categories.map(cat => (
          <Pressable
            key={cat}
            style={[
              styles.categoryBadge,
              { backgroundColor: theme.backgroundElement },
              selectedCategory === cat && styles.categoryBadgeActive
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <ThemedText 
              type="smallBold"
              themeColor={selectedCategory === cat ? 'background' : 'textSecondary'}
              style={selectedCategory === cat && { color: '#fff' }}
            >
              {cat}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.catalogGrid} showsVerticalScrollIndicator={false}>
        {filteredProducts.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
            No products found
          </ThemedText>
        ) : (
          filteredProducts.map(p => {
            const isLow = p.currentStock <= p.minStockAlert;
            return (
              <Pressable
                key={p.code}
                style={({ pressed }) => [
                  styles.catalogCard,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed
                ]}
                onPress={() => handleAddToCart(p)}
              >
                <ThemedText type="smallBold" numberOfLines={1}>{p.name}</ThemedText>
                <ThemedText type="code" themeColor="textSecondary" style={{ fontSize: 10 }}>{p.code}</ThemedText>
                
                <View style={styles.catalogCardMeta}>
                  <Text style={[styles.catalogStockText, { color: isLow ? '#c62828' : '#2e7d32' }]}>
                    {p.currentStock} {p.unitType}
                  </Text>
                  <ThemedText type="smallBold" style={{ color: '#208AEF' }}>
                    {store.settings.currency} {p.sellingPrice}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  // Render Checkout Cart pane (Right pane)
  const renderPOSCart = () => (
    <View style={[styles.cartContainer, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" style={styles.cartHeaderTitle}>Checkout Cart ({cart.length} items)</ThemedText>
      
      {/* Cart list */}
      <ScrollView style={styles.cartItemsScroll} showsVerticalScrollIndicator={false}>
        {cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <POSIcon size={36} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 12 }}>
              Cart is empty. Tap products on the left to add.
            </ThemedText>
          </View>
        ) : (
          cart.map((item, index) => {
            // Units conversion options based on base unit
            const conversionOptions: Product['unitType'][] = [item.product.unitType];
            if (item.product.unitType === 'kg') conversionOptions.push('g');
            if (item.product.unitType === 'liter') conversionOptions.push('ml');
            if (item.product.unitType === 'dozen') conversionOptions.push('piece');
            if (item.product.unitType === 'box') conversionOptions.push('piece');

            const mult = getConversionMultiplier(item.unitSelected, item.product.unitType, item.product.piecesPerBox);
            const itemCost = item.quantity * (item.sellingPrice * mult);

            return (
              <View key={item.product.code} style={styles.cartItemRow}>
                <View style={{ flex: 1.5 }}>
                  <ThemedText type="smallBold" numberOfLines={1}>{item.product.name}</ThemedText>
                  <ThemedText type="code" themeColor="textSecondary" style={{ fontSize: 10 }}>{item.product.code}</ThemedText>
                  
                  {/* Unit conversion triggers */}
                  {conversionOptions.length > 1 && (
                    <View style={styles.cartUnitGroup}>
                      {conversionOptions.map(u => (
                        <Pressable 
                          key={u} 
                          style={[
                            styles.cartUnitBadge,
                            item.unitSelected === u && { backgroundColor: '#208AEF' }
                          ]}
                          onPress={() => handleUpdateUnit(index, u)}
                        >
                          <Text style={[styles.cartUnitBadgeText, item.unitSelected === u && { color: '#fff' }]}>
                            {u}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {/* Adjust quantities */}
                <View style={styles.qtyControls}>
                  <Pressable 
                    style={styles.qtyBtn} 
                    onPress={() => handleUpdateCartQty(index, item.quantity - (item.unitSelected === 'g' || item.unitSelected === 'ml' ? 100 : 1))}
                  >
                    <MinusIcon size={14} color={theme.text} />
                  </Pressable>
                  <TextInput
                    style={[styles.qtyInput, { color: theme.text }]}
                    keyboardType="numeric"
                    value={String(item.quantity)}
                    onChangeText={(val) => handleUpdateCartQty(index, parseFloat(val) || 0)}
                  />
                  <Pressable 
                    style={styles.qtyBtn} 
                    onPress={() => handleUpdateCartQty(index, item.quantity + (item.unitSelected === 'g' || item.unitSelected === 'ml' ? 100 : 1))}
                  >
                    <PlusIcon size={14} color={theme.text} />
                  </Pressable>
                </View>

                <View style={styles.cartItemPriceBox}>
                  <ThemedText type="smallBold">{store.settings.currency} {Math.round(itemCost)}</ThemedText>
                  <Pressable onPress={() => handleRemoveFromCart(index)} style={{ padding: 4 }}>
                    <TrashIcon size={16} color="#e53935" />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Customer Panel */}
      <View style={styles.cartSectionBorder}>
        <ThemedText type="smallBold">Customer Identifier</ThemedText>
        <TextInput
          style={[styles.posInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
          placeholder="Enter phone number..."
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          value={customerPhone}
          onChangeText={setCustomerPhone}
        />
        
        {/* Customer State display */}
        {matchedCustomer && (
          <View style={[styles.customerAlertCard, { backgroundColor: '#e8f5e9' }]}>
            <ThemedText type="smallBold" style={{ color: '#2e7d32' }}>✓ Existing Customer Detected</ThemedText>
            <Text style={{ fontSize: 11, color: '#2e7d32' }}>
              Name: {matchedCustomer.name || 'Regular Customer'} | Total Purchases: {store.settings.currency} {matchedCustomer.totalPurchases}
            </Text>
          </View>
        )}

        {showRegisterCustomer && (
          <View style={[styles.customerAlertCard, { backgroundColor: '#e3f2fd' }]}>
            <ThemedText type="smallBold" style={{ color: '#1565c0' }}>+ New Customer Details</ThemedText>
            <TextInput
              style={[styles.posInputCompact, { color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="Enter customer name (optional)..."
              placeholderTextColor={theme.textSecondary}
              value={customerName}
              onChangeText={setCustomerName}
            />
          </View>
        )}
      </View>

      {/* Discount & Checkout Calculation */}
      <View style={styles.cartSectionBorder}>
        <View style={styles.discountSelector}>
          <ThemedText type="smallBold">Discount Applied</ThemedText>
          <View style={styles.discountToggle}>
            <Pressable 
              style={[styles.discountToggleBtn, discountType === 'percentage' && styles.discountToggleActive]}
              onPress={() => setDiscountType('percentage')}
            >
              <Text style={[styles.discountToggleText, discountType === 'percentage' && { color: '#fff' }]}>%</Text>
            </Pressable>
            <Pressable 
              style={[styles.discountToggleBtn, discountType === 'flat' && styles.discountToggleActive]}
              onPress={() => setDiscountType('flat')}
            >
              <Text style={[styles.discountToggleText, discountType === 'flat' && { color: '#fff' }]}>Flat</Text>
            </Pressable>
          </View>
        </View>

        <TextInput
          style={[styles.posInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
          keyboardType="numeric"
          value={discountVal}
          onChangeText={setDiscountVal}
        />

        {/* Payment Type Selection */}
        <ThemedText type="smallBold" style={{ marginTop: 8 }}>Payment Type</ThemedText>
        <View style={styles.paymentMethodGroup}>
          {(['Cash', 'Card', 'Credit'] as const).map(mode => (
            <Pressable
              key={mode}
              style={[
                styles.paymentMethodBtn,
                { borderColor: theme.backgroundSelected },
                paymentType === mode && styles.paymentMethodActive
              ]}
              onPress={() => setPaymentType(mode)}
            >
              <Text style={[styles.paymentMethodText, paymentType === mode && { color: '#fff' }]}>
                {mode}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Cart Summary Totals */}
      <View style={styles.checkoutTotals}>
        <View style={styles.totalRow}>
          <ThemedText type="small">Gross Items Price:</ThemedText>
          <ThemedText type="smallBold">{store.settings.currency} {subtotal.toLocaleString()}</ThemedText>
        </View>
        {taxPct > 0 && (
          <View style={styles.totalRow}>
            <ThemedText type="small">Tax ({taxPct}%):</ThemedText>
            <ThemedText type="smallBold">{store.settings.currency} {taxAmount.toLocaleString()}</ThemedText>
          </View>
        )}
        <View style={styles.totalRow}>
          <ThemedText type="small" style={{ color: '#e53935' }}>Discount Deducted:</ThemedText>
          <ThemedText type="smallBold" style={{ color: '#e53935' }}>
            - {store.settings.currency} {discountAmount.toLocaleString()}
          </ThemedText>
        </View>
        <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: theme.backgroundSelected, paddingTop: Spacing.two }]}>
          <ThemedText type="subtitle" style={{ fontSize: 20 }}>Grand Total:</ThemedText>
          <ThemedText type="subtitle" style={{ fontSize: 22, color: '#208AEF', fontWeight: '800' }}>
            {store.settings.currency} {grandTotal.toLocaleString()}
          </ThemedText>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.checkoutBtn, 
            pressed && styles.pressed,
            cart.length === 0 && { backgroundColor: '#B0B4BA' }
          ]}
          disabled={cart.length === 0}
          onPress={handleCheckout}
        >
          <CheckIcon size={22} color="#fff" />
          <Text style={styles.checkoutBtnText}>Complete POS Checkout</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.main}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {isSplitScreen ? (
          <View style={styles.splitLayout}>
            <View style={{ flex: 1.3 }}>
              {renderProductCatalog()}
            </View>
            <View style={{ flex: 1 }}>
              {renderPOSCart()}
            </View>
          </View>
        ) : (
          // On mobile, show a toggled view (Catalog / Cart)
          <View style={styles.mobileLayout}>
            {cart.length > 0 ? (
              <View style={styles.mobileCartHeader}>
                <Pressable onPress={() => setCart([])} style={styles.mobileClearBtn}>
                  <ThemedText type="smallBold" style={{ color: '#e53935' }}>Clear Cart</ThemedText>
                </Pressable>
              </View>
            ) : null}
            <ScrollView showsVerticalScrollIndicator={false}>
              {renderProductCatalog()}
              <View style={{ height: 30 }} />
              {renderPOSCart()}
            </ScrollView>
          </View>
        )}
      </SafeAreaView>

      {/* Invoice Receipt Modal */}
      <Modal
        visible={showReceiptModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReceiptModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="background" style={[styles.modalContent, { maxHeight: '90%' }]}>
            {generatedInvoice && (
              <>
                <View style={styles.modalHeader}>
                  <ThemedText type="subtitle">POS Checkout Successful</ThemedText>
                  <Pressable onPress={() => setShowReceiptModal(false)}>
                    <CloseIcon size={24} color={theme.text} />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.receiptScroll}>
                  {/* Bill Layout Sheet */}
                  <View style={styles.receiptSheet}>
                    <Text style={styles.receiptTitle}>{store.settings.factoryName}</Text>
                    <Text style={styles.receiptSubtitle}>OFFICIAL SALES INVOICE</Text>
                    
                    <View style={styles.receiptDivider} />
                    
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMetaText}>Invoice No: {generatedInvoice.invoiceNumber}</Text>
                      <Text style={styles.receiptMetaText}>Date: {new Date(generatedInvoice.date).toLocaleString()}</Text>
                    </View>

                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMetaText}>Payment Mode: {generatedInvoice.paymentType}</Text>
                      <Text style={styles.receiptMetaText}>
                        Customer: {generatedInvoice.customerPhone ? generatedInvoice.customerPhone : 'Walk-in'}
                      </Text>
                    </View>

                    <View style={styles.receiptDivider} />

                    {/* Table */}
                    <View style={styles.receiptTable}>
                      <View style={styles.receiptTableHeader}>
                        <Text style={[styles.receiptHeadCell, { flex: 2 }]}>Product</Text>
                        <Text style={styles.receiptHeadCell}>Qty</Text>
                        <Text style={styles.receiptHeadCell}>Price</Text>
                        <Text style={[styles.receiptHeadCell, { textAlign: 'right' }]}>Total</Text>
                      </View>

                      {generatedItems.map(item => (
                        <View key={item.id} style={styles.receiptTableRow}>
                          <Text style={[styles.receiptCell, { flex: 2 }]}>{item.productName}</Text>
                          <Text style={styles.receiptCell}>{item.quantity} {item.unitSelected}</Text>
                          <Text style={styles.receiptCell}>{store.settings.currency} {item.sellingPrice}</Text>
                          <Text style={[styles.receiptCell, { textAlign: 'right' }]}>
                            {store.settings.currency} {Math.round(item.subtotal)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.receiptDivider} />

                    {/* Totals */}
                    <View style={styles.receiptTotalBlock}>
                      <View style={styles.receiptTotalRow}>
                        <Text style={styles.receiptTotalLabel}>Gross Amount:</Text>
                        <Text style={styles.receiptTotalValue}>
                          {store.settings.currency} {Math.round(generatedInvoice.subtotal + generatedInvoice.discountAmount)}
                        </Text>
                      </View>
                      {generatedInvoice.discountAmount > 0 && (
                        <View style={styles.receiptTotalRow}>
                          <Text style={styles.receiptTotalLabel}>Discount Deducted:</Text>
                          <Text style={styles.receiptTotalValue}>
                            - {store.settings.currency} {Math.round(generatedInvoice.discountAmount)}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.receiptTotalRow, { borderTopWidth: 1, borderTopColor: '#000', paddingTop: 4, marginTop: 4 }]}>
                        <Text style={[styles.receiptTotalLabel, { fontWeight: '800' }]}>GRAND TOTAL:</Text>
                        <Text style={[styles.receiptTotalValue, { fontWeight: '800', fontSize: 16 }]}>
                          {store.settings.currency} {generatedInvoice.finalTotal.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.receiptDivider} />

                    <Text style={styles.receiptFooter}>{store.settings.receiptFooter}</Text>
                  </View>

                  <View style={styles.receiptActions}>
                    <Pressable
                      style={({ pressed }) => [styles.receiptPrintBtn, pressed && styles.pressed]}
                      onPress={() => alert('PDF receipt exported to device storage!')}
                    >
                      <ExportIcon size={18} color="#fff" />
                      <Text style={styles.receiptPrintBtnText}>Export PDF Receipt</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [styles.receiptCloseBtn, pressed && styles.pressed]}
                      onPress={() => setShowReceiptModal(false)}
                    >
                      <Text style={styles.receiptCloseBtnText}>Start New Billing</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </>
            )}
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  splitLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  mobileLayout: {
    flex: 1,
    paddingHorizontal: Spacing.three,
  },
  mobileCartHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: Spacing.two,
  },
  mobileClearBtn: {
    padding: Spacing.one,
  },
  catalogContainer: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  posSearchRow: {
    marginVertical: Spacing.two,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F3',
    height: 40,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: Spacing.two,
    fontSize: 14,
  },
  posCategoryScroll: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
    height: 32,
  },
  categoryBadge: {
    paddingVertical: Spacing.one / 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    justifyContent: 'center',
  },
  categoryBadgeActive: {
    backgroundColor: '#208AEF',
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  catalogCard: {
    width: '48%',
    flexGrow: 1,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.01,
    shadowRadius: 2,
    elevation: 1,
  },
  catalogCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  catalogStockText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    width: '100%',
    paddingVertical: Spacing.six,
  },
  cartContainer: {
    flex: 1,
    padding: Spacing.four,
    borderTopLeftRadius: Spacing.four,
    borderBottomLeftRadius: Spacing.four,
  },
  cartHeaderTitle: {
    fontSize: 16,
    marginBottom: Spacing.three,
  },
  cartItemsScroll: {
    flex: 1,
    marginVertical: Spacing.two,
  },
  emptyCart: {
    flex: 1,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  cartUnitGroup: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  cartUnitBadge: {
    backgroundColor: '#F0F0F3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cartUnitBadgeText: {
    fontSize: 9,
    color: '#666',
    fontWeight: '700',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B0B4BA',
    borderRadius: 4,
    height: 28,
  },
  qtyBtn: {
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyInput: {
    width: 32,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    padding: 0,
  },
  cartItemPriceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 80,
    gap: 8,
  },
  cartSectionBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: Spacing.three,
    marginTop: Spacing.three,
  },
  posInput: {
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    marginTop: Spacing.one,
    fontSize: 12,
  },
  posInputCompact: {
    height: 28,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: Spacing.two,
    marginTop: Spacing.one,
    fontSize: 11,
  },
  customerAlertCard: {
    padding: Spacing.two,
    borderRadius: 6,
    marginTop: Spacing.two,
    gap: 2,
  },
  discountSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F3',
    borderRadius: 4,
    padding: 2,
  },
  discountToggleBtn: {
    width: 32,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 3,
  },
  discountToggleActive: {
    backgroundColor: '#208AEF',
  },
  discountToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
  },
  paymentMethodGroup: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  paymentMethodBtn: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
  },
  paymentMethodActive: {
    backgroundColor: '#208AEF',
    borderColor: '#208AEF',
  },
  paymentMethodText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  checkoutTotals: {
    marginTop: Spacing.four,
    gap: Spacing.one,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkoutBtn: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  checkoutBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalContent: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    width: '100%',
    maxWidth: 550,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
  receiptScroll: {
    gap: Spacing.four,
  },
  receiptSheet: {
    backgroundColor: '#fff',
    borderColor: '#000',
    borderWidth: 1,
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
  },
  receiptSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    letterSpacing: 2,
    marginTop: 2,
  },
  receiptDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderStyle: 'dashed',
    marginVertical: Spacing.three,
  },
  receiptMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  receiptMetaText: {
    fontSize: 11,
    color: '#000',
  },
  receiptTable: {
    gap: 4,
  },
  receiptTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 4,
  },
  receiptHeadCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
  },
  receiptTableRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  receiptCell: {
    flex: 1,
    fontSize: 11,
    color: '#000',
  },
  receiptTotalBlock: {
    alignSelf: 'flex-end',
    width: 200,
    gap: 2,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptTotalLabel: {
    fontSize: 11,
    color: '#000',
  },
  receiptTotalValue: {
    fontSize: 11,
    color: '#000',
  },
  receiptFooter: {
    fontSize: 10,
    textAlign: 'center',
    color: '#000',
    marginTop: Spacing.two,
  },
  receiptActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  receiptPrintBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#208AEF',
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  receiptPrintBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  receiptCloseBtn: {
    flex: 1,
    backgroundColor: '#F0F0F3',
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptCloseBtnText: {
    color: '#333',
    fontWeight: '700',
  },
});
