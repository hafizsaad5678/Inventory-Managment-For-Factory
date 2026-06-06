import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  View, 
  Pressable, 
  Modal, 
  TextInput, 
  Text,
  Alert, 
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Colors, Spacing, MaxContentWidth, BottomTabInset } from '../constants/theme';
import { useTheme } from '../hooks/use-theme';
import { Product, StockMovement, StockMovementType } from '../types';
import { 
  PlusIcon, 
  SearchIcon, 
  CloseIcon, 
  WarningIcon, 
  EditIcon, 
  TrashIcon, 
  CheckIcon,
  DatabaseIcon
} from '../components/Icons';

export default function InventoryScreen() {
  const store = useStore();
  const theme = useTheme();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showActive, setShowActive] = useState(true); // Toggle active vs inactive products
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productMovements, setProductMovements] = useState<StockMovement[]>([]);

  // Add Product Form
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [code, setCode] = useState(''); // Category-Serial code (optional manual entry)
  const [unitType, setUnitType] = useState<'kg' | 'g' | 'liter' | 'ml' | 'dozen' | 'box' | 'piece'>('piece');
  const [piecesPerBox, setPiecesPerBox] = useState('12');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [minStockAlert, setMinStockAlert] = useState('10');
  const [initialStock, setInitialStock] = useState('0');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');

  // Purchase/Stock-in Form
  const [supplierName, setSupplierName] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseNote, setPurchaseNote] = useState('');

  // Adjustment Form
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'adjustment' | 'damage'>('adjustment');
  const [adjustmentNote, setAdjustmentNote] = useState('');

  useEffect(() => {
    store.refreshData();
  }, []);

  // Fetch product stock ledger when product changes/opens
  const loadProductLedger = async (productCode: string) => {
    try {
      const SQLite = require('../database/db');
      const mvs = await SQLite.db.getStockMovements(productCode);
      setProductMovements(mvs);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedProduct) {
      loadProductLedger(selectedProduct.code);
    }
  }, [selectedProduct, store.stockMovements]);

  // Handle Add Product
  const handleAddProduct = async () => {
    if (!name.trim() || !category.trim() || !buyingPrice || !sellingPrice || !minStockAlert) {
      alert('Please fill out all required fields');
      return;
    }

    try {
      const finalCode = await store.addProduct({
        code: code.trim(),
        name: name.trim(),
        category: category.trim(),
        unitType,
        piecesPerBox: parseInt(piecesPerBox, 10) || 1,
        buyingPrice: parseFloat(buyingPrice),
        sellingPrice: parseFloat(sellingPrice),
        minStockAlert: parseFloat(minStockAlert),
        initialStock: parseFloat(initialStock) || 0,
        barcode: barcode.trim(),
        description: description.trim(),
      });

      // Clear Form
      setName('');
      setCategory('');
      setCode('');
      setUnitType('piece');
      setPiecesPerBox('12');
      setBuyingPrice('');
      setSellingPrice('');
      setMinStockAlert('10');
      setInitialStock('0');
      setBarcode('');
      setDescription('');
      
      setShowAddModal(false);
      alert(`Product registered successfully! Code: ${finalCode}`);
    } catch (err) {
      console.error(err);
      alert('Failed to register product');
    }
  };

  // Handle Restock / Purchase In
  const handleRestock = async () => {
    if (!selectedProduct) return;
    const qtyVal = parseFloat(purchaseQty);
    const priceVal = parseFloat(purchasePrice);

    if (isNaN(qtyVal) || qtyVal <= 0 || isNaN(priceVal) || priceVal <= 0 || !supplierName.trim()) {
      alert('Please fill supplier name, positive qty and valid purchase price.');
      return;
    }

    try {
      const date = new Date().toISOString();
      await store.addPurchase(
        selectedProduct.code,
        qtyVal,
        priceVal,
        supplierName.trim(),
        date,
        purchaseNote.trim() || `Restocked from supplier ${supplierName.trim()}`
      );

      // Refresh Detail Panel
      const updated = store.products.find(p => p.code === selectedProduct.code);
      if (updated) setSelectedProduct(updated);

      // Reset Form
      setPurchaseQty('');
      setPurchasePrice('');
      setSupplierName('');
      setPurchaseNote('');

      alert('Restocked successfully (WAC updated)!');
    } catch (e) {
      console.error(e);
      alert('Restock failed');
    }
  };

  // Handle Adjustment / Damage
  const handleAdjustment = async () => {
    if (!selectedProduct) return;
    const qtyVal = parseFloat(adjustmentQty);

    if (isNaN(qtyVal) || qtyVal <= 0 || !adjustmentNote.trim()) {
      alert('Please input positive quantity and audit note.');
      return;
    }

    try {
      const date = new Date().toISOString();
      // If damage, we deduct stock, so quantity should be negative
      const signedQty = adjustmentType === 'damage' ? -qtyVal : qtyVal;
      
      await store.addAdjustment(
        selectedProduct.code,
        signedQty,
        adjustmentType,
        adjustmentNote.trim(),
        date
      );

      // Refresh Detail Panel
      const updated = store.products.find(p => p.code === selectedProduct.code);
      if (updated) setSelectedProduct(updated);

      setAdjustmentQty('');
      setAdjustmentNote('');

      alert('Adjustment logged successfully!');
    } catch (e) {
      console.error(e);
      alert('Adjustment failed');
    }
  };

  // Toggle active/inactive product state
  const handleToggleProductActive = async (p: Product) => {
    try {
      const updated = {
        ...p,
        isActive: !p.isActive,
      };
      await store.updateProduct(updated);
      setSelectedProduct(updated);
      alert(updated.isActive ? 'Product activated!' : 'Product soft-deleted (inactive)');
    } catch (e) {
      console.error(e);
    }
  };

  // Get categories
  const categories = ['All', ...new Set(store.products.map(p => p.category))];

  // Filter products
  const getFilteredProducts = () => {
    return store.products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesActive = p.isActive === showActive;

      return matchesSearch && matchesCategory && matchesActive;
    });
  };

  const filteredProducts = getFilteredProducts();

  return (
    <ThemedView style={styles.main}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Top Control Bar */}
        <View style={styles.topControlBar}>
          <View style={styles.searchWrapper}>
            <SearchIcon size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by code, name, barcode..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <Pressable 
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            onPress={() => setShowAddModal(true)}
          >
            <PlusIcon size={18} color="#fff" />
            <Text style={styles.addBtnText}>New Product</Text>
          </Pressable>
        </View>

        {/* Categories Bar */}
        <View style={{ maxHeight: 40, marginVertical: Spacing.one }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
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
        </View>

        {/* Toggle Active/Inactive */}
        <View style={styles.statusToggleBar}>
          <Pressable 
            style={[styles.statusToggleBtn, showActive && styles.statusToggleActive]}
            onPress={() => setShowActive(true)}
          >
            <ThemedText type="smallBold" themeColor={showActive ? 'text' : 'textSecondary'}>
              Active Products ({store.products.filter(p => p.isActive).length})
            </ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.statusToggleBtn, !showActive && styles.statusToggleActive]}
            onPress={() => setShowActive(false)}
          >
            <ThemedText type="smallBold" themeColor={!showActive ? 'text' : 'textSecondary'}>
              Inactive / Archived ({store.products.filter(p => !p.isActive).length})
            </ThemedText>
          </Pressable>
        </View>

        {/* Products List */}
        <ScrollView 
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        >
          {filteredProducts.length === 0 ? (
            <View style={styles.emptyView}>
              <ThemedText type="small" themeColor="textSecondary">No products found matching filters.</ThemedText>
            </View>
          ) : (
            filteredProducts.map(p => {
              const isLowStock = p.currentStock <= p.minStockAlert;
              return (
                <Pressable
                  key={p.code}
                  style={({ pressed }) => [pressed && styles.pressed]}
                  onPress={() => {
                    setSelectedProduct(p);
                    setShowDetailModal(true);
                  }}
                >
                  <ThemedView type="backgroundElement" style={styles.productCard}>
                    <View style={styles.productCardHeader}>
                      <View>
                        <ThemedText type="smallBold">{p.name}</ThemedText>
                        <ThemedText type="code" themeColor="textSecondary">{p.code}</ThemedText>
                      </View>
                      
                      {/* Stock Level Tag */}
                      <View style={[
                        styles.stockTag,
                        { 
                          backgroundColor: !p.isActive ? '#60646C' : (isLowStock ? '#ffebee' : '#e8f5e9')
                        }
                      ]}>
                        <Text style={[
                          styles.stockTagText,
                          { color: !p.isActive ? '#fff' : (isLowStock ? '#c62828' : '#2e7d32') }
                        ]}>
                          {p.currentStock} {p.unitType}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.productCardFooter}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Category: <ThemedText type="smallBold">{p.category}</ThemedText>
                      </ThemedText>
                      <View style={styles.pricesRow}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Avg Buy: <ThemedText type="smallBold">{store.settings.currency} {p.buyingPrice}</ThemedText>
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={{ marginLeft: Spacing.two }}>
                          Sell: <ThemedText type="smallBold">{store.settings.currency} {p.sellingPrice}</ThemedText>
                        </ThemedText>
                      </View>
                    </View>
                  </ThemedView>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Add Product Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="background" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Add New Factory Product</ThemedText>
              <Pressable onPress={() => setShowAddModal(false)}>
                <CloseIcon size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <ThemedText type="small">Product Name *</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  placeholder="e.g. Bed Sheet fabric"
                  placeholderTextColor={theme.textSecondary}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <ThemedText type="small">Category *</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    placeholder="e.g. TEXTILE, RAW"
                    placeholderTextColor={theme.textSecondary}
                    value={category}
                    onChangeText={setCategory}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <ThemedText type="small">Custom Code (Optional)</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    placeholder="Auto-generated if empty"
                    placeholderTextColor={theme.textSecondary}
                    value={code}
                    onChangeText={setCode}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <ThemedText type="small">Base Unit *</ThemedText>
                  <View style={[styles.pickerMock, { borderColor: theme.backgroundSelected }]}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {(['piece', 'kg', 'g', 'liter', 'ml', 'dozen', 'box'] as const).map(unit => (
                        <Pressable
                          key={unit}
                          style={[
                            styles.pickerBtn,
                            unitType === unit && styles.pickerBtnActive
                          ]}
                          onPress={() => setUnitType(unit)}
                        >
                          <Text style={[styles.pickerBtnText, unitType === unit && { color: '#fff' }]}>
                            {unit}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                {unitType === 'box' && (
                  <View style={[styles.formGroup, { width: 100 }]}>
                    <ThemedText type="small">Pcs/Box</ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                      keyboardType="numeric"
                      value={piecesPerBox}
                      onChangeText={setPiecesPerBox}
                    />
                  </View>
                )}
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <ThemedText type="small">Buying Price *</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    keyboardType="numeric"
                    placeholder="Cost per base unit"
                    placeholderTextColor={theme.textSecondary}
                    value={buyingPrice}
                    onChangeText={setBuyingPrice}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <ThemedText type="small">Selling Price *</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    keyboardType="numeric"
                    placeholder="Price per base unit"
                    placeholderTextColor={theme.textSecondary}
                    value={sellingPrice}
                    onChangeText={setSellingPrice}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <ThemedText type="small">Min Stock Alert *</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    keyboardType="numeric"
                    value={minStockAlert}
                    onChangeText={setMinStockAlert}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <ThemedText type="small">Initial Stock In</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    keyboardType="numeric"
                    value={initialStock}
                    onChangeText={setInitialStock}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <ThemedText type="small">Barcode / RFID (Optional)</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  placeholder="Scan or enter code"
                  placeholderTextColor={theme.textSecondary}
                  value={barcode}
                  onChangeText={setBarcode}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText type="small">Product Description</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected, height: 60 }]}
                  multiline
                  placeholder="Additional notes"
                  placeholderTextColor={theme.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              <Pressable
                style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                onPress={handleAddProduct}
              >
                <CheckIcon size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Save Product Record</Text>
              </Pressable>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* Product Detail & Stock Ledger Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="background" style={[styles.modalContent, { maxHeight: '95%' }]}>
            {selectedProduct && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <ThemedText type="subtitle">{selectedProduct.name}</ThemedText>
                    <ThemedText type="code" themeColor="textSecondary">{selectedProduct.code}</ThemedText>
                  </View>
                  <Pressable onPress={() => {
                    setSelectedProduct(null);
                    setShowDetailModal(false);
                  }}>
                    <CloseIcon size={24} color={theme.text} />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Stats Summary */}
                  <View style={styles.detailStatsGrid}>
                    <ThemedView type="backgroundSelected" style={styles.detailStatBox}>
                      <Text style={styles.detailStatLabel}>Current Stock</Text>
                      <Text style={[
                        styles.detailStatValue,
                        { color: selectedProduct.currentStock <= selectedProduct.minStockAlert ? '#e53935' : '#4CAF50' }
                      ]}>
                        {selectedProduct.currentStock} {selectedProduct.unitType}
                      </Text>
                    </ThemedView>

                    <ThemedView type="backgroundSelected" style={styles.detailStatBox}>
                      <Text style={styles.detailStatLabel}>Avg Buying Price</Text>
                      <Text style={styles.detailStatValue}>
                        {store.settings.currency} {selectedProduct.buyingPrice}
                      </Text>
                    </ThemedView>

                    <ThemedView type="backgroundSelected" style={styles.detailStatBox}>
                      <Text style={styles.detailStatLabel}>Selling Price</Text>
                      <Text style={styles.detailStatValue}>
                        {store.settings.currency} {selectedProduct.sellingPrice}
                      </Text>
                    </ThemedView>
                  </View>

                  {/* Actions / Audits */}
                  <View style={styles.detailMetaGrid}>
                    <ThemedText type="small">Category: <ThemedText type="smallBold">{selectedProduct.category}</ThemedText></ThemedText>
                    {selectedProduct.barcode && (
                      <ThemedText type="small">Barcode: <ThemedText type="code">{selectedProduct.barcode}</ThemedText></ThemedText>
                    )}
                    <ThemedText type="small">Min Limit: <ThemedText type="smallBold">{selectedProduct.minStockAlert} {selectedProduct.unitType}</ThemedText></ThemedText>
                    {selectedProduct.description && (
                      <ThemedText type="small" style={{ marginTop: 4 }}>Note: {selectedProduct.description}</ThemedText>
                    )}
                  </View>

                  {/* RESTOCK / STOCK IN PANELS */}
                  <ThemedView type="backgroundElement" style={styles.actionSection}>
                    <View style={styles.actionHeader}>
                      <DatabaseIcon size={20} color="#208AEF" />
                      <ThemedText type="smallBold" style={styles.actionSectionTitle}>Restock Entry (Stock IN)</ThemedText>
                    </View>

                    <View style={styles.formGroup}>
                      <ThemedText type="small">Supplier Name *</ThemedText>
                      <TextInput
                        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                        placeholder="Supplier/Vendor"
                        placeholderTextColor={theme.textSecondary}
                        value={supplierName}
                        onChangeText={setSupplierName}
                      />
                    </View>

                    <View style={styles.formRow}>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <ThemedText type="small">Quantity to Add ({selectedProduct.unitType}) *</ThemedText>
                        <TextInput
                          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                          keyboardType="numeric"
                          placeholder="e.g. 50"
                          placeholderTextColor={theme.textSecondary}
                          value={purchaseQty}
                          onChangeText={setPurchaseQty}
                        />
                      </View>

                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <ThemedText type="small">Purchase Unit Cost *</ThemedText>
                        <TextInput
                          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                          keyboardType="numeric"
                          placeholder="Per base unit"
                          placeholderTextColor={theme.textSecondary}
                          value={purchasePrice}
                          onChangeText={setPurchasePrice}
                        />
                      </View>
                    </View>

                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected, marginBottom: 8 }]}
                      placeholder="Audit note (optional)"
                      placeholderTextColor={theme.textSecondary}
                      value={purchaseNote}
                      onChangeText={setPurchaseNote}
                    />

                    <Pressable
                      style={({ pressed }) => [styles.purchaseBtn, pressed && styles.pressed]}
                      onPress={handleRestock}
                    >
                      <PlusIcon size={18} color="#fff" />
                      <Text style={styles.purchaseBtnText}>Post restock and update Cost</Text>
                    </Pressable>
                  </ThemedView>

                  {/* STOCK ADJUSTMENT / DAMAGES */}
                  <ThemedView type="backgroundElement" style={styles.actionSection}>
                    <View style={styles.actionHeader}>
                      <WarningIcon size={20} color="#FF9800" />
                      <ThemedText type="smallBold" style={styles.actionSectionTitle}>Stock Auditing (Adjustment & Damage)</ThemedText>
                    </View>

                    <View style={styles.formRow}>
                      <View style={[styles.formGroup, { flex: 1.5 }]}>
                        <ThemedText type="small">Adjustment Type</ThemedText>
                        <View style={styles.toggleRow}>
                          <Pressable 
                            style={[
                              styles.toggleOption, 
                              adjustmentType === 'adjustment' && { backgroundColor: '#208AEF' }
                            ]}
                            onPress={() => setAdjustmentType('adjustment')}
                          >
                            <Text style={[styles.toggleText, adjustmentType === 'adjustment' && { color: '#fff' }]}>
                              Adjust (+)
                            </Text>
                          </Pressable>
                          <Pressable 
                            style={[
                              styles.toggleOption, 
                              adjustmentType === 'damage' && { backgroundColor: '#e53935' }
                            ]}
                            onPress={() => setAdjustmentType('damage')}
                          >
                            <Text style={[styles.toggleText, adjustmentType === 'damage' && { color: '#fff' }]}>
                              Damage (-)
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <ThemedText type="small">Quantity *</ThemedText>
                        <TextInput
                          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                          keyboardType="numeric"
                          placeholder="e.g. 5"
                          placeholderTextColor={theme.textSecondary}
                          value={adjustmentQty}
                          onChangeText={setAdjustmentQty}
                        />
                      </View>
                    </View>

                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected, marginBottom: 8 }]}
                      placeholder="Note required (e.g. Annual audit discrepancies)"
                      placeholderTextColor={theme.textSecondary}
                      value={adjustmentNote}
                      onChangeText={setAdjustmentNote}
                    />

                    <Pressable
                      style={({ pressed }) => [
                        styles.auditBtn, 
                        pressed && styles.pressed,
                        { backgroundColor: adjustmentType === 'damage' ? '#e53935' : '#FF9800' }
                      ]}
                      onPress={handleAdjustment}
                    >
                      <WarningIcon size={18} color="#fff" />
                      <Text style={styles.purchaseBtnText}>Post adjustment ledger</Text>
                    </Pressable>
                  </ThemedView>

                  {/* Stock Ledger History */}
                  <View style={styles.ledgerSection}>
                    <ThemedText type="smallBold" style={styles.ledgerTitle}>Product Stock Ledger</ThemedText>
                    
                    {productMovements.length === 0 ? (
                      <ThemedText type="small" themeColor="textSecondary">No ledger movements recorded.</ThemedText>
                    ) : (
                      <View style={styles.ledgerTable}>
                        <View style={styles.tableHeader}>
                          <Text style={[styles.tableHeadCell, { flex: 1.2 }]}>Date</Text>
                          <Text style={styles.tableHeadCell}>Type</Text>
                          <Text style={styles.tableHeadCell}>Qty</Text>
                          <Text style={[styles.tableHeadCell, { flex: 1.5 }]}>Note</Text>
                        </View>

                        {productMovements.map(m => {
                          const formattedDate = new Date(m.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                          
                          let typeColor = '#2e7d32'; // purchase
                          if (m.type === 'sale') typeColor = '#1565c0';
                          else if (m.type === 'damage') typeColor = '#c62828';
                          else if (m.type === 'adjustment') typeColor = '#ef6c00';
                          else if (m.type === 'return') typeColor = '#6a1b9a';

                          return (
                            <View key={m.id} style={styles.tableRow}>
                              <Text style={[styles.tableCell, { flex: 1.2, fontSize: 11 }]}>{formattedDate}</Text>
                              <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
                                <Text style={styles.typeBadgeText}>{m.type.toUpperCase()}</Text>
                              </View>
                              <Text style={[
                                styles.tableCell, 
                                { 
                                  fontWeight: '700', 
                                  color: m.quantity < 0 ? '#c62828' : '#2e7d32',
                                  textAlign: 'right',
                                  paddingRight: 6
                                }
                              ]}>
                                {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                              </Text>
                              <Text style={[styles.tableCell, { flex: 1.5, fontSize: 11 }]} numberOfLines={2}>
                                {m.note || '-'}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Soft Delete Archive/Restore Buttons */}
                  <View style={styles.archiveActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.archiveBtn,
                        pressed && styles.pressed,
                        { backgroundColor: selectedProduct.isActive ? '#e53935' : '#4CAF50' }
                      ]}
                      onPress={() => handleToggleProductActive(selectedProduct)}
                    >
                      {selectedProduct.isActive ? (
                        <>
                          <TrashIcon size={18} color="#fff" />
                          <Text style={styles.archiveBtnText}>Deactivate & Archive Product</Text>
                        </>
                      ) : (
                        <>
                          <CheckIcon size={18} color="#fff" />
                          <Text style={styles.archiveBtnText}>Restore & Reactivate Product</Text>
                        </>
                      )}
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
  topControlBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    gap: Spacing.three,
    alignItems: 'center',
  },
  searchWrapper: {
    flex: 1,
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
  addBtn: {
    flexDirection: 'row',
    backgroundColor: '#208AEF',
    height: 40,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  categoryScroll: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  categoryBadge: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  categoryBadgeActive: {
    backgroundColor: '#208AEF',
  },
  statusToggleBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F3',
    marginHorizontal: Spacing.four,
    marginVertical: Spacing.two,
  },
  statusToggleBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  statusToggleActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#208AEF',
  },
  listContainer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
  },
  emptyView: {
    paddingVertical: Spacing.six,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  productCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  productCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.two,
  },
  stockTag: {
    paddingVertical: Spacing.one / 2,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  stockTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  productCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: Spacing.two,
  },
  pricesRow: {
    flexDirection: 'row',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  formGroup: {
    marginBottom: Spacing.three,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.one,
    fontSize: 14,
  },
  pickerMock: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    height: 40,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.two,
    justifyContent: 'center',
  },
  pickerBtn: {
    paddingHorizontal: Spacing.two,
    marginHorizontal: Spacing.one,
    borderRadius: Spacing.one,
    justifyContent: 'center',
    backgroundColor: '#F0F0F3',
    height: 28,
    alignSelf: 'center',
  },
  pickerBtnActive: {
    backgroundColor: '#208AEF',
  },
  pickerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    height: 48,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  detailStatsGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  detailStatBox: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  detailStatLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
    marginBottom: 4,
  },
  detailStatValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  detailMetaGrid: {
    marginBottom: Spacing.four,
    gap: Spacing.one,
  },
  actionSection: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.01,
    shadowRadius: 2,
    elevation: 1,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  actionSectionTitle: {
    fontSize: 14,
  },
  purchaseBtn: {
    flexDirection: 'row',
    backgroundColor: '#208AEF',
    height: 40,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  purchaseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    height: 40,
    marginTop: Spacing.one,
    backgroundColor: '#F0F0F3',
    borderRadius: Spacing.two,
    padding: 2,
  },
  toggleOption: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.two - 2,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  auditBtn: {
    flexDirection: 'row',
    backgroundColor: '#FF9800',
    height: 40,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  ledgerSection: {
    marginVertical: Spacing.three,
  },
  ledgerTitle: {
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  ledgerTable: {
    borderWidth: 1,
    borderColor: '#F0F0F3',
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F3',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  tableHeadCell: {
    flex: 1,
    fontWeight: '800',
    fontSize: 12,
    color: '#666',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F3',
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
  },
  typeBadge: {
    width: 66,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 6,
  },
  typeBadgeText: {
    fontSize: 8,
    color: '#fff',
    fontWeight: '800',
  },
  archiveActions: {
    marginTop: Spacing.four,
    marginBottom: Spacing.six,
  },
  archiveBtn: {
    flexDirection: 'row',
    height: 44,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  archiveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
