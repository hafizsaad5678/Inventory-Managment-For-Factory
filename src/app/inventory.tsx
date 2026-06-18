import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassCard } from "../components/glass-card";
import { GradientBg } from "../components/gradient-bg";
import {
  CheckIcon,
  CloseIcon,
  DatabaseIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  WarningIcon,
} from "../components/Icons";
import { ConfirmModal, ConfirmModalVariant } from "../components/confirm-modal";
import { ThemedText } from "../components/themed-text";
import { useStore } from "../store/store";

export default function InventoryScreen() {
  const store = useStore();

  // Confirm modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalVariant, setModalVariant] = useState<ConfirmModalVariant>('success');
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const showModal = (variant: ConfirmModalVariant, title: string, message: string) => {
    setModalVariant(variant);
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  // Local state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showActive, setShowActive] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productMovements, setProductMovements] = useState<any[]>([]);

  // Add Product Form
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [code, setCode] = useState("");
  const [unitType, setUnitType] = useState<
    "kg" | "g" | "liter" | "ml" | "dozen" | "box" | "piece"
  >("piece");
  const [piecesPerBox, setPiecesPerBox] = useState("12");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [minStockAlert, setMinStockAlert] = useState("10");
  const [initialStock, setInitialStock] = useState("0");
  const [barcode, setBarcode] = useState("");
  const [description, setDescription] = useState("");

  // Restock Form
  const [supplierName, setSupplierName] = useState("");
  const [purchaseQty, setPurchaseQty] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseNote, setPurchaseNote] = useState("");

  // Adjustment Form
  const [adjustmentQty, setAdjustmentQty] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"adjustment" | "damage">(
    "adjustment",
  );
  const [adjustmentNote, setAdjustmentNote] = useState("");

  // Fetch product stock ledger when product changes/opens
  const loadProductLedger = async (productCode: string) => {
    try {
      const SQLite = require("../database/db");
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
    if (
      !name.trim() ||
      !category.trim() ||
      !buyingPrice ||
      !sellingPrice ||
      !minStockAlert
    ) {
      showModal('warning', 'Missing Fields', 'Please fill out all required fields before saving.');
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
      setName("");
      setCategory("");
      setCode("");
      setUnitType("piece");
      setPiecesPerBox("12");
      setBuyingPrice("");
      setSellingPrice("");
      setMinStockAlert("10");
      setInitialStock("0");
      setBarcode("");
      setDescription("");

      setShowAddModal(false);
      showModal('success', 'Product Registered', `Product has been saved successfully with code: ${finalCode}`);
    } catch (err) {
      console.error(err);
      showModal('error', 'Registration Failed', 'Something went wrong while saving the product. Please try again.');
    }
  };

  // Handle Restock / Purchase In
  const handleRestock = async () => {
    if (!selectedProduct) return;
    const qtyVal = parseFloat(purchaseQty);
    const priceVal = parseFloat(purchasePrice);

    if (
      isNaN(qtyVal) ||
      qtyVal <= 0 ||
      isNaN(priceVal) ||
      priceVal <= 0 ||
      !supplierName.trim()
    ) {
      showModal('warning', 'Invalid Input', 'Please fill supplier name, positive quantity and a valid purchase price.');
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
        purchaseNote.trim() || `Restocked from supplier ${supplierName.trim()}`,
      );

      // Refresh Detail Panel
      const updated = store.products.find(
        (p) => p.code === selectedProduct.code,
      );
      if (updated) setSelectedProduct(updated);

      // Reset Form
      setPurchaseQty("");
      setPurchasePrice("");
      setSupplierName("");
      setPurchaseNote("");

      showModal('success', 'Restock Complete', 'Stock has been restocked and Weighted Average Cost has been updated.');
    } catch (e) {
      console.error(e);
      showModal('error', 'Restock Failed', 'Something went wrong during restocking. Please try again.');
    }
  };

  // Handle Adjustment / Damage
  const handleAdjustment = async () => {
    if (!selectedProduct) return;
    const qtyVal = parseFloat(adjustmentQty);

    if (isNaN(qtyVal) || qtyVal <= 0 || !adjustmentNote.trim()) {
      showModal('warning', 'Invalid Input', 'Please enter a positive quantity and an audit note.');
      return;
    }

    try {
      const date = new Date().toISOString();
      const signedQty = adjustmentType === "damage" ? -qtyVal : qtyVal;

      await store.addAdjustment(
        selectedProduct.code,
        signedQty,
        adjustmentType,
        adjustmentNote.trim(),
        date,
      );

      // Refresh Detail Panel — get fresh state after store update
      const freshProducts = useStore.getState().products;
      const updated = freshProducts.find((p) => p.code === selectedProduct.code);
      if (updated) setSelectedProduct(updated);

      // Refresh the ledger
      await loadProductLedger(selectedProduct.code);

      setAdjustmentQty("");
      setAdjustmentNote("");

      showModal('success', 'Adjustment Logged', 'Stock adjustment has been recorded in the ledger.');
    } catch (e) {
      console.error(e);
      showModal('error', 'Adjustment Failed', 'Something went wrong while logging the adjustment. Please try again.');
    }
  };

  // Toggle active/inactive product state
  const handleToggleProductActive = async (p: any) => {
    try {
      const updated = {
        ...p,
        isActive: !p.isActive,
      };
      await store.updateProduct(updated);
      setSelectedProduct(updated);
      showModal(
        updated.isActive ? 'success' : 'info',
        updated.isActive ? 'Product Activated' : 'Product Archived',
        updated.isActive
          ? 'This product is now active and visible in your inventory.'
          : 'This product has been archived and is no longer active.'
      );
    } catch (e) {
      console.error(e);
      showModal('error', 'Action Failed', 'Something went wrong. Please try again.');
    }
  };

  const categories = ["All", ...new Set(store.products.map((p) => p.category))];

  const getFilteredProducts = () => {
    return store.products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" || p.category === selectedCategory;
      const matchesActive = p.isActive === showActive;

      return matchesSearch && matchesCategory && matchesActive;
    });
  };

  const filteredProducts = getFilteredProducts();
  const activeProducts = store.products.filter((product) => product.isActive);
  const lowStockProducts = store.products.filter(
    (product) =>
      product.isActive && product.currentStock <= product.minStockAlert,
  );
  const inventoryValue = store.products.reduce(
    (sum, product) => sum + product.currentStock * product.buyingPrice,
    0,
  );

  return (
    <GradientBg>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <View className="flex-row justify-between items-center px-6 py-4">
          <View className="flex-row items-center gap-3">
            <View className="p-3 bg-brand-accent/10 rounded-2xl">
              <DatabaseIcon size={24} color="#412D15" />
            </View>
            <View>
              <ThemedText
                type="subtitle"
                className="text-xl font-extrabold tracking-tight text-brand-primary"
              >
                Inventory Control
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textMuted"
                className="font-semibold uppercase tracking-wider text-[10px] mt-0.5"
              >
                Stock Management
              </ThemedText>
            </View>
          </View>

          <Pressable
            className="flex-row bg-brand-accent h-11 rounded-xl px-4 items-center gap-1.5 shadow-sm active:opacity-80"
            onPress={() => setShowAddModal(true)}
          >
            <PlusIcon size={16} color="#FAF8F3" />
            <Text className="text-brand-cream font-bold text-[12px]">Add</Text>
          </Pressable>
        </View>

        {/* KPI Cards Grid */}
        <View className="flex-row flex-wrap gap-3 px-6 mb-6">
          <GlassCard
            variant="card"
            style={{
              borderLeftWidth: 4,
              borderLeftColor: "#412D15",
              overflow: "hidden",
            }}
            className="w-[47%] flex-grow min-h-[90px] justify-between"
          >
            <ThemedText
              type="small"
              themeColor="textSecondary"
              className="font-semibold text-[11px]"
            >
              Total Products
            </ThemedText>
            <ThemedText
              type="subtitle"
              className="text-brand-primary text-lg font-extrabold mt-2"
            >
              {store.products.length} items
            </ThemedText>
          </GlassCard>

          <GlassCard
            variant="card"
            style={{
              borderLeftWidth: 4,
              borderLeftColor: "#412D15",
              overflow: "hidden",
            }}
            className="w-[47%] flex-grow min-h-[90px] justify-between"
          >
            <ThemedText
              type="small"
              themeColor="textSecondary"
              className="font-semibold text-[11px]"
            >
              Active Items
            </ThemedText>
            <ThemedText
              type="subtitle"
              className="text-brand-primary text-lg font-extrabold mt-2"
            >
              {activeProducts.length} active
            </ThemedText>
          </GlassCard>

          <GlassCard
            variant="card"
            style={{
              borderLeftWidth: 4,
              borderLeftColor:
                lowStockProducts.length > 0 ? "#F4A300" : "#412D15",
              overflow: "hidden",
            }}
            className="w-[47%] flex-grow min-h-[90px] justify-between"
          >
            <ThemedText
              type="small"
              themeColor="textSecondary"
              className="font-semibold text-[11px]"
            >
              Low Stock Alerts
            </ThemedText>
            <ThemedText
              type="subtitle"
              className={`text-lg font-extrabold mt-2 ${lowStockProducts.length > 0 ? "text-brand-warning" : "text-brand-accent"}`}
            >
              {lowStockProducts.length} items
            </ThemedText>
          </GlassCard>

          <GlassCard
            variant="card"
            style={{
              borderLeftWidth: 4,
              borderLeftColor: "#412D15",
              overflow: "hidden",
            }}
            className="w-[47%] flex-grow min-h-[90px] justify-between"
          >
            <ThemedText
              type="small"
              themeColor="textSecondary"
              className="font-semibold text-[11px]"
            >
              Total Value
            </ThemedText>
            <ThemedText
              type="subtitle"
              className="text-brand-primary text-lg font-extrabold mt-2"
            >
              {store.settings.currency} {inventoryValue.toLocaleString()}
            </ThemedText>
          </GlassCard>
        </View>

        {/* Categories + Search + Toggle */}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginHorizontal: 24,
            marginBottom: 16,
            backgroundColor: "rgba(255,255,255,0.30)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.20)",
            borderRadius: 999,
            padding: 6,
          }}
        >
          <View className="flex-1 flex-row items-center bg-white/40 rounded-full px-3 gap-2">
            <SearchIcon size={16} color="#666666" />
            <TextInput
              className="flex-1 h-9 text-brand-primary text-xs font-inter"
              placeholder="Search..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View
            style={{
              paddingHorizontal: 8,
              justifyContent: "center",
            }}
          >
            <Pressable
              onPress={() => setShowActive(!showActive)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: showActive ? "#412D15" : "rgba(65,45,21,0.2)",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: showActive ? "#FAF8F3" : "#666",
                }}
              >
                {showActive
                  ? `Active (${activeProducts.length})`
                  : `Archive (${store.products.filter((p) => !p.isActive).length})`}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Products List */}
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: Platform.OS === "ios" ? 140 : 110,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Categories Scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginBottom: 16 }}
            style={{ marginHorizontal: -24, paddingHorizontal: 24 }}
          >
            {categories.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor:
                    selectedCategory === cat
                      ? "#412D15"
                      : "rgba(255,255,255,0.3)",
                  borderWidth: selectedCategory === cat ? 0 : 1,
                  borderColor: "rgba(255,255,255,0.4)",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: selectedCategory === cat ? "#FAF8F3" : "#8B5A2B",
                  }}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Product Cards */}
          {filteredProducts.length === 0 ? (
            <View className="py-12 justify-center items-center">
              <ThemedText type="small" themeColor="textMuted">
                No products found.
              </ThemedText>
            </View>
          ) : (
            filteredProducts.map((p) => {
              const isLowStock = p.currentStock <= p.minStockAlert;
              return (
                <Pressable
                  key={p.code}
                  className="active:opacity-85 mb-3"
                  onPress={() => {
                    setSelectedProduct(p);
                    setShowDetailModal(true);
                  }}
                >
                  <GlassCard
                    variant="card"
                    style={{ borderRadius: 20, overflow: "hidden", padding: 0 }}
                  >
                    <View
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 18,
                        margin: 6,
                        padding: 12,
                        shadowColor: "#412D15",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.04,
                        shadowRadius: 6,
                        elevation: 1,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 8,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "700",
                              color: "#1F150C",
                              marginBottom: 2,
                            }}
                          >
                            {p.name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "600",
                              color: "#A0693A",
                            }}
                          >
                            Code: {p.code}
                          </Text>
                        </View>

                        <View
                          style={{
                            borderRadius: 12,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            backgroundColor: !p.isActive
                              ? "rgba(160,105,58,0.1)"
                              : isLowStock
                                ? "rgba(244,163,0,0.1)"
                                : "rgba(46,125,50,0.1)",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color: !p.isActive
                                ? "#8B5A2B"
                                : isLowStock
                                  ? "#F4A300"
                                  : "#F4A300",
                            }}
                          >
                            {p.currentStock} {p.unitType}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderTopWidth: 1,
                          borderTopColor: "rgba(65,45,21,0.1)",
                          paddingTop: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "600",
                            color: "#8B5A2B",
                          }}
                        >
                          {p.category}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "700",
                              color: "#1F150C",
                            }}
                          >
                            Buy: {store.settings.currency}
                            {p.buyingPrice}
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "700",
                              color: "#1F150C",
                            }}
                          >
                            Sell: {store.settings.currency}
                            {p.sellingPrice}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </GlassCard>
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
        <View className="flex-1 justify-end bg-brand-primary/40">
          <View className="bg-brand-cream rounded-t-[32px] p-6 max-h-[85%] border-t border-brand-glass shadow-lg">
            <View className="flex-row justify-between items-center mb-5">
              <ThemedText
                type="subtitle"
                className="text-brand-primary text-xl font-bold"
              >
                Add New Factory Product
              </ThemedText>
              <Pressable
                className="w-10 h-10 rounded-full bg-brand-glass border border-brand-glass justify-center items-center active:opacity-75"
                onPress={() => setShowAddModal(false)}
              >
                <CloseIcon size={20} color="#000000" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="mb-4">
                <ThemedText
                  type="small"
                  className="text-brand-secondary font-semibold mb-1"
                >
                  Product Name *
                </ThemedText>
                <TextInput
                  className="h-12 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-sm font-inter"
                  placeholder="e.g. Bed Sheet fabric"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <ThemedText
                    type="small"
                    className="text-brand-secondary font-semibold mb-1"
                  >
                    Category *
                  </ThemedText>
                  <TextInput
                    className="h-12 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-sm font-inter"
                    placeholder="e.g. TEXTILE"
                    placeholderTextColor="#999"
                    value={category}
                    onChangeText={setCategory}
                  />
                </View>

                <View className="flex-1">
                  <ThemedText
                    type="small"
                    className="text-brand-secondary font-semibold mb-1"
                  >
                    Custom Code
                  </ThemedText>
                  <TextInput
                    className="h-12 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-sm font-inter"
                    placeholder="Auto-generated if empty"
                    placeholderTextColor="#999"
                    value={code}
                    onChangeText={setCode}
                  />
                </View>
              </View>

              <View className="flex-row gap-4 mb-4 items-center">
                <View className="flex-1">
                  <ThemedText
                    type="small"
                    className="text-brand-secondary font-semibold mb-1"
                  >
                    Base Unit *
                  </ThemedText>
                  <View className="border border-brand-glass rounded-2xl h-12 bg-white/70 justify-center px-2">
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6 }}
                    >
                      {(
                        [
                          "piece",
                          "kg",
                          "g",
                          "liter",
                          "ml",
                          "dozen",
                          "box",
                        ] as const
                      ).map((unit) => (
                        <Pressable
                          key={unit}
                          className={`px-3 py-1.5 rounded-xl justify-center h-8 align-center self-center ${unitType === unit
                            ? "bg-brand-accent"
                            : "bg-transparent"
                            }`}
                          onPress={() => setUnitType(unit)}
                        >
                          <Text
                            className={`text-xs font-bold ${unitType === unit ? "text-brand-cream" : "text-brand-secondary"}`}
                          >
                            {unit}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                {unitType === "box" && (
                  <View className="w-24">
                    <ThemedText
                      type="small"
                      className="text-brand-secondary font-semibold mb-1"
                    >
                      Pcs/Box
                    </ThemedText>
                    <TextInput
                      className="h-12 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-sm font-inter"
                      keyboardType="numeric"
                      value={piecesPerBox}
                      onChangeText={setPiecesPerBox}
                    />
                  </View>
                )}
              </View>

              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <ThemedText
                    type="small"
                    className="text-brand-secondary font-semibold mb-1"
                  >
                    Buying Price *
                  </ThemedText>
                  <TextInput
                    className="h-12 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-sm font-inter"
                    keyboardType="numeric"
                    placeholder="Cost per base unit"
                    placeholderTextColor="#999"
                    value={buyingPrice}
                    onChangeText={setBuyingPrice}
                  />
                </View>

                <View className="flex-1">
                  <ThemedText
                    type="small"
                    className="text-brand-secondary font-semibold mb-1"
                  >
                    Selling Price *
                  </ThemedText>
                  <TextInput
                    className="h-12 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-sm font-inter"
                    keyboardType="numeric"
                    placeholder="Price per base unit"
                    placeholderTextColor="#999"
                    value={sellingPrice}
                    onChangeText={setSellingPrice}
                  />
                </View>
              </View>

              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <ThemedText
                    type="small"
                    className="text-brand-secondary font-semibold mb-1"
                  >
                    Min Stock Alert *
                  </ThemedText>
                  <TextInput
                    className="h-12 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-sm font-inter"
                    keyboardType="numeric"
                    value={minStockAlert}
                    onChangeText={setMinStockAlert}
                  />
                </View>

                <View className="flex-1">
                  <ThemedText
                    type="small"
                    className="text-brand-secondary font-semibold mb-1"
                  >
                    Initial Stock In
                  </ThemedText>
                  <TextInput
                    className="h-12 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-sm font-inter"
                    keyboardType="numeric"
                    value={initialStock}
                    onChangeText={setInitialStock}
                  />
                </View>
              </View>

              <View className="mb-4">
                <ThemedText
                  type="small"
                  className="text-brand-secondary font-semibold mb-1"
                >
                  Barcode / RFID
                </ThemedText>
                <TextInput
                  className="h-12 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-sm font-inter"
                  placeholder="Scan or enter code"
                  placeholderTextColor="#999"
                  value={barcode}
                  onChangeText={setBarcode}
                />
              </View>

              <View className="mb-5">
                <ThemedText
                  type="small"
                  className="text-brand-secondary font-semibold mb-1"
                >
                  Product Description
                </ThemedText>
                <TextInput
                  className="h-16 bg-white/70 border border-brand-glass rounded-2xl px-4 py-2 text-brand-primary text-sm font-inter"
                  multiline
                  placeholder="Additional notes"
                  placeholderTextColor="#999"
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              <Pressable
                className="flex-row h-12 rounded-2xl justify-center items-center gap-2 shadow-sm active:opacity-85"
                style={{ backgroundColor: "#412D15" }}
                onPress={handleAddProduct}
              >
                <CheckIcon size={18} color="#FAF8F3" />
                <Text className="text-brand-cream font-bold text-sm">
                  Save Product Record
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Product Detail & Stock Ledger Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View className="flex-1 justify-end bg-brand-primary/40">
          <View className="bg-brand-cream rounded-t-[32px] p-6 max-h-[95%] border-t border-brand-glass shadow-lg">
            {selectedProduct && (
              <>
                <View className="flex-row justify-between items-center mb-5">
                  <View>
                    <ThemedText
                      type="subtitle"
                      className="text-brand-primary text-xl font-bold"
                    >
                      {selectedProduct.name}
                    </ThemedText>
                    <ThemedText
                      type="code"
                      themeColor="textMuted"
                      className="text-[11px] mt-0.5"
                    >
                      Code: {selectedProduct.code}
                    </ThemedText>
                  </View>
                  <Pressable
                    className="w-10 h-10 rounded-full bg-brand-glass border border-brand-glass justify-center items-center active:opacity-75"
                    onPress={() => {
                      setSelectedProduct(null);
                      setShowDetailModal(false);
                    }}
                  >
                    <CloseIcon size={20} color="#000000" />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Stats Summary with Enhanced KPI Cards */}
                  <View
                    className="bg-brand-primary/5 rounded-3xl p-4 mb-5"
                    style={{ backgroundColor: "rgba(31, 21, 12, 0.08)" }}
                  >
                    <View className="flex-row gap-3">
                      <GlassCard variant="card" className="flex-1">
                        <ThemedText
                          type="code"
                          themeColor="textMuted"
                          className="text-[10px] font-semibold tracking-wider"
                        >
                          CURRENT STOCK
                        </ThemedText>
                        <ThemedText
                          type="subtitle"
                          className={`text-2xl font-extrabold mt-1 ${selectedProduct.currentStock <=
                            selectedProduct.minStockAlert
                            ? "text-brand-warning"
                            : "text-brand-accent"
                            }`}
                        >
                          {selectedProduct.currentStock}
                        </ThemedText>
                        <ThemedText
                          type="code"
                          themeColor="textMuted"
                          className="text-[9px] mt-1"
                        >
                          {selectedProduct.unitType}
                        </ThemedText>
                      </GlassCard>

                      <GlassCard variant="card" className="flex-1">
                        <ThemedText
                          type="code"
                          themeColor="textMuted"
                          className="text-[10px] font-semibold tracking-wider"
                        >
                          COST PRICE
                        </ThemedText>
                        <ThemedText
                          type="subtitle"
                          className="text-xl font-bold text-brand-primary mt-1"
                        >
                          {store.settings.currency}{" "}
                          {selectedProduct.buyingPrice}
                        </ThemedText>
                      </GlassCard>

                      <GlassCard variant="card" className="flex-1">
                        <ThemedText
                          type="code"
                          themeColor="textMuted"
                          className="text-[10px] font-semibold tracking-wider"
                        >
                          SELL PRICE
                        </ThemedText>
                        <ThemedText
                          type="subtitle"
                          className="text-xl font-bold text-brand-primary mt-1"
                        >
                          {store.settings.currency}{" "}
                          {selectedProduct.sellingPrice}
                        </ThemedText>
                      </GlassCard>
                    </View>
                  </View>

                  {/* Profit Margin Card */}
                  <GlassCard
                    variant="card"
                    className="mb-5 bg-brand-accent/10"
                    style={{ borderLeftWidth: 4, borderLeftColor: "#412D15" }}
                  >
                    <ThemedText
                      type="code"
                      themeColor="textMuted"
                      className="text-[10px] font-semibold tracking-wider"
                    >
                      PROFIT MARGIN
                    </ThemedText>
                    <View className="flex-row items-end gap-2 mt-2">
                      <ThemedText
                        type="subtitle"
                        className="text-3xl font-extrabold text-brand-accent"
                      >
                        {Math.round(
                          ((selectedProduct.sellingPrice -
                            selectedProduct.buyingPrice) /
                            selectedProduct.sellingPrice) *
                          100 || 0,
                        )}
                        %
                      </ThemedText>
                      <ThemedText
                        type="small"
                        themeColor="textMuted"
                        className="mb-1"
                      >
                        Profit per unit: {store.settings.currency}{" "}
                        {Math.round(
                          selectedProduct.sellingPrice -
                          selectedProduct.buyingPrice,
                        )}
                      </ThemedText>
                    </View>
                  </GlassCard>

                  {/* Metadata info */}
                  <View
                    className="bg-brand-primary/5 rounded-3xl p-4 mb-5"
                    style={{ backgroundColor: "rgba(31, 21, 12, 0.08)" }}
                  >
                    <GlassCard
                      variant="card"
                      className="bg-transparent border-0 p-0"
                    >
                      <View className="gap-2.5">
                        <View>
                          <ThemedText
                            type="code"
                            themeColor="textMuted"
                            className="text-[10px] font-semibold tracking-wider"
                          >
                            CATEGORY
                          </ThemedText>
                          <ThemedText
                            type="subtitle"
                            className="text-base font-bold text-brand-primary mt-1"
                          >
                            {selectedProduct.category}
                          </ThemedText>
                        </View>
                        {selectedProduct.barcode && (
                          <View>
                            <ThemedText
                              type="code"
                              themeColor="textMuted"
                              className="text-[10px] font-semibold tracking-wider"
                            >
                              BARCODE
                            </ThemedText>
                            <Text className="text-sm font-bold text-brand-primary mt-1">
                              {selectedProduct.barcode}
                            </Text>
                          </View>
                        )}
                        <View>
                          <ThemedText
                            type="code"
                            themeColor="textMuted"
                            className="text-[10px] font-semibold tracking-wider"
                          >
                            ALERT LIMIT
                          </ThemedText>
                          <ThemedText
                            type="subtitle"
                            className="text-base font-bold text-brand-primary mt-1"
                          >
                            {selectedProduct.minStockAlert}{" "}
                            {selectedProduct.unitType}
                          </ThemedText>
                        </View>
                        {selectedProduct.description && (
                          <View>
                            <ThemedText
                              type="code"
                              themeColor="textMuted"
                              className="text-[10px] font-semibold tracking-wider"
                            >
                              DESCRIPTION
                            </ThemedText>
                            <ThemedText
                              type="small"
                              className="text-brand-primary mt-1"
                            >
                              {selectedProduct.description}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    </GlassCard>
                  </View>

                  {/* RESTOCK / STOCK IN PANELS */}
                  <GlassCard
                    variant="cardStrong"
                    style={{ borderRadius: 32, overflow: "hidden", padding: 0 }}
                    className="mb-5 border border-brand-glass"
                  >
                    <View
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 28,
                        margin: 8,
                        padding: 16,
                        shadowColor: "#412D15",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 2,
                      }}
                    >
                      <View className="flex-row items-center gap-2 mb-4">
                        <DatabaseIcon size={18} color="#412D15" />
                        <ThemedText
                          type="smallBold"
                          className="text-brand-primary font-bold text-sm"
                        >
                          Restock Entry (Stock IN)
                        </ThemedText>
                      </View>

                      <View className="mb-3">
                        <ThemedText
                          type="small"
                          className="text-brand-secondary font-semibold mb-1"
                        >
                          Supplier Name *
                        </ThemedText>
                        <TextInput
                          className="h-11 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-xs font-inter"
                          placeholder="Supplier/Vendor name"
                          placeholderTextColor="#999"
                          value={supplierName}
                          onChangeText={setSupplierName}
                        />
                      </View>

                      <View className="flex-row gap-3 mb-3">
                        <View className="flex-1">
                          <ThemedText
                            type="small"
                            className="text-brand-secondary font-semibold mb-1"
                          >
                            Quantity *
                          </ThemedText>
                          <TextInput
                            className="h-11 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-xs font-inter"
                            keyboardType="numeric"
                            placeholder={`Qty in ${selectedProduct.unitType}`}
                            placeholderTextColor="#999"
                            value={purchaseQty}
                            onChangeText={setPurchaseQty}
                          />
                        </View>

                        <View className="flex-1">
                          <ThemedText
                            type="small"
                            className="text-brand-secondary font-semibold mb-1"
                          >
                            Unit Buying Price *
                          </ThemedText>
                          <TextInput
                            className="h-11 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-xs font-inter"
                            keyboardType="numeric"
                            placeholder="Per base unit"
                            placeholderTextColor="#999"
                            value={purchasePrice}
                            onChangeText={setPurchasePrice}
                          />
                        </View>
                      </View>

                      <TextInput
                        className="h-11 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-xs font-inter mb-4"
                        placeholder="Auditing notes (optional)"
                        placeholderTextColor="#999"
                        value={purchaseNote}
                        onChangeText={setPurchaseNote}
                      />

                      <Pressable
                        className="flex-row h-11 rounded-2xl justify-center items-center gap-2 shadow-sm active:opacity-85"
                        style={{ backgroundColor: "#412D15" }}
                        onPress={handleRestock}
                      >
                        <PlusIcon size={16} color="#FAF8F3" />
                        <Text className="text-brand-cream font-bold text-xs">
                          Post Restock and Update Cost
                        </Text>
                      </Pressable>
                    </View>
                  </GlassCard>

                  {/* STOCK ADJUSTMENT / DAMAGES */}
                  <GlassCard
                    variant="cardStrong"
                    style={{ borderRadius: 32, overflow: "hidden", padding: 0 }}
                    className="mb-5 border border-brand-glass"
                  >
                    <View
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 28,
                        margin: 8,
                        padding: 16,
                        shadowColor: "#412D15",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 2,
                      }}
                    >
                      <View className="flex-row items-center gap-2 mb-4">
                        <WarningIcon size={18} color="#F4A300" />
                        <ThemedText
                          type="smallBold"
                          className="text-brand-primary font-bold text-sm"
                        >
                          Stock Auditing (Adjustment & Damage)
                        </ThemedText>
                      </View>

                      <View className="flex-row gap-3 mb-3 items-center">
                        <View className="flex-[1.5]">
                          <ThemedText
                            type="small"
                            className="text-brand-secondary font-semibold mb-1"
                          >
                            Adjustment Type
                          </ThemedText>
                          <View className="flex-row h-11 bg-brand-surface rounded-2xl p-1 border border-brand-glass">
                            <Pressable
                              className={`flex-1 justify-center items-center rounded-xl ${adjustmentType === "adjustment"
                                ? "bg-brand-accent"
                                : "bg-transparent"
                                }`}
                              onPress={() => setAdjustmentType("adjustment")}
                            >
                              <Text
                                className={`text-[11px] font-extrabold ${adjustmentType === "adjustment"
                                  ? "text-brand-cream"
                                  : "text-brand-secondary"
                                  }`}
                              >
                                Adjust (+)
                              </Text>
                            </Pressable>
                            <Pressable
                              className={`flex-1 justify-center items-center rounded-xl`}
                              style={
                                adjustmentType === "damage"
                                  ? {
                                    backgroundColor:
                                      "rgba(139, 90, 43, 0.25)",
                                  }
                                  : {}
                              }
                              onPress={() => setAdjustmentType("damage")}
                            >
                              <Text
                                className={`text-[11px] font-extrabold ${adjustmentType === "damage"
                                  ? "text-brand-cream"
                                  : "text-brand-secondary"
                                  }`}
                              >
                                Damage (-)
                              </Text>
                            </Pressable>
                          </View>
                        </View>

                        <View className="flex-1">
                          <ThemedText
                            type="small"
                            className="text-brand-secondary font-semibold mb-1"
                          >
                            Quantity *
                          </ThemedText>
                          <TextInput
                            className="h-11 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-xs font-inter"
                            keyboardType="numeric"
                            placeholder="e.g. 5"
                            placeholderTextColor="#999"
                            value={adjustmentQty}
                            onChangeText={setAdjustmentQty}
                          />
                        </View>
                      </View>

                      <TextInput
                        className="h-11 bg-white/70 border border-brand-glass rounded-2xl px-4 text-brand-primary text-xs font-inter mb-4"
                        placeholder="Audit note (required)"
                        placeholderTextColor="#999"
                        value={adjustmentNote}
                        onChangeText={setAdjustmentNote}
                      />

                      <Pressable
                        className="flex-row h-11 rounded-2xl justify-center items-center gap-2 shadow-sm active:opacity-85"
                        style={{
                          backgroundColor:
                            adjustmentType === "damage" ? "#8B5A2B" : "#412D15",
                        }}
                        onPress={handleAdjustment}
                      >
                        <WarningIcon size={16} color="#FAF8F3" />
                        <Text className="text-brand-cream font-bold text-xs">
                          Post Audit Adjustment
                        </Text>
                      </Pressable>
                    </View>
                  </GlassCard>

                  {/* Stock Ledger History */}
                  <View className="mb-6">
                    <ThemedText
                      type="smallBold"
                      className="text-brand-primary font-bold text-[15px] mb-3"
                    >
                      Product Stock Ledger
                    </ThemedText>

                    {productMovements.length === 0 ? (
                      <ThemedText type="small" themeColor="textMuted">
                        No ledger movements recorded.
                      </ThemedText>
                    ) : (
                      <View className="border border-brand-glass rounded-2xl overflow-hidden bg-brand-glass/30 shadow-xs">
                        <View className="flex-row bg-brand-accent/5 py-3 px-4 border-b border-brand-glass">
                          <Text className="flex-[1.2] font-bold text-[11px] text-brand-secondary">
                            Date
                          </Text>
                          <Text className="flex-1 font-bold text-[11px] text-brand-secondary text-center">
                            Type
                          </Text>
                          <Text className="flex-1 font-bold text-[11px] text-brand-secondary text-right">
                            Qty
                          </Text>
                          <Text className="flex-[1.5] font-bold text-[11px] text-brand-secondary pl-3">
                            Note
                          </Text>
                        </View>

                        {productMovements.map((m) => {
                          const formattedDate = new Date(
                            m.date,
                          ).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          let typeBadgeColor = "bg-brand-accent"; // purchase
                          if (m.type === "sale")
                            typeBadgeColor = "bg-brand-accent";
                          else if (m.type === "damage")
                            typeBadgeColor = "bg-brand-warning";
                          else if (m.type === "adjustment")
                            typeBadgeColor = "bg-brand-warning";
                          else if (m.type === "return")
                            typeBadgeColor = "bg-brand-accent";

                          return (
                            <View
                              key={m.id}
                              className="flex-row items-center py-3 px-4 border-b border-brand-glass/50 bg-white/20"
                            >
                              <Text className="flex-[1.2] text-[10px] text-brand-secondary font-medium">
                                {formattedDate}
                              </Text>
                              <View className="flex-1 items-center">
                                <View
                                  className={`rounded px-1.5 py-0.5 ${typeBadgeColor}`}
                                >
                                  <Text className="text-[8px] font-bold text-white uppercase">
                                    {m.type}
                                  </Text>
                                </View>
                              </View>
                              <Text
                                className={`flex-1 text-[11px] font-extrabold text-right pr-1 ${m.quantity < 0
                                  ? "text-brand-warning"
                                  : "text-brand-accent"
                                  }`}
                              >
                                {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                              </Text>
                              <Text
                                className="flex-[1.5] text-[10px] text-brand-muted pl-3 font-medium"
                                numberOfLines={2}
                              >
                                {m.note || "-"}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Soft Delete Archive/Restore Buttons */}
                  <View className="mt-4 mb-10">
                    <Pressable
                      className="flex-row h-12 rounded-2xl justify-center items-center gap-2 active:opacity-85 shadow-sm"
                      style={{
                        backgroundColor: selectedProduct.isActive
                          ? "#8B5A2B"
                          : "#412D15",
                      }}
                      onPress={() => handleToggleProductActive(selectedProduct)}
                    >
                      {selectedProduct.isActive ? (
                        <>
                          <TrashIcon size={16} color="#FAF8F3" />
                          <Text className="text-brand-cream font-bold text-sm">
                            Deactivate & Archive Product
                          </Text>
                        </>
                      ) : (
                        <>
                          <CheckIcon size={16} color="#FAF8F3" />
                          <Text className="text-brand-cream font-bold text-sm">
                            Restore & Reactivate Product
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </ScrollView>
              </>
            )}
          </View>

          {/* Confirm/Alert overlay — rendered inside this modal to avoid nested Modal issues on iOS */}
          {modalVisible && (
            <Pressable
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.45)',
                justifyContent: 'center', alignItems: 'center',
                paddingHorizontal: 32,
              }}
              onPress={() => setModalVisible(false)}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: '#FAF8F3',
                  borderRadius: 28,
                  paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24,
                  alignItems: 'center', width: '100%', maxWidth: 360,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: 0.15, shadowRadius: 24, elevation: 12,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
                }}
              >
                <View style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: modalVariant === 'success' ? 'rgba(46,125,50,0.12)'
                    : modalVariant === 'error' ? 'rgba(211,47,47,0.12)'
                      : modalVariant === 'warning' ? 'rgba(244,163,0,0.12)'
                        : 'rgba(65,45,21,0.10)',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {modalVariant === 'success' && <CheckIcon size={28} color="#2E7D32" />}
                  {modalVariant === 'error' && <CloseIcon size={28} color="#D32F2F" />}
                  {(modalVariant === 'warning' || modalVariant === 'info') && <WarningIcon size={28} color={modalVariant === 'warning' ? '#F4A300' : '#412D15'} />}
                </View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1F150C', marginTop: 16, textAlign: 'center' }}>
                  {modalTitle}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '500', color: '#666', marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                  {modalMessage}
                </Text>
                <View style={{ width: '100%', height: 1, backgroundColor: 'rgba(65,45,21,0.08)', marginTop: 20, marginBottom: 16 }} />
                <Pressable
                  onPress={() => setModalVisible(false)}
                  style={({ pressed }) => ({
                    width: '100%', height: 44, borderRadius: 14,
                    justifyContent: 'center', alignItems: 'center',
                    backgroundColor: modalVariant === 'error' ? '#D32F2F'
                      : modalVariant === 'warning' ? '#F4A300'
                        : '#412D15',
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>OK</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          )}
        </View>
      </Modal>

      {/* Confirm/Alert Modal — for screens outside the detail modal */}
      <ConfirmModal
        visible={modalVisible && !showDetailModal}
        onClose={() => setModalVisible(false)}
        variant={modalVariant}
        title={modalTitle}
        message={modalMessage}
      />
    </GradientBg>
  );
}
