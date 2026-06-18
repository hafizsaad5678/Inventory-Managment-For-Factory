import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmModal, ConfirmModalVariant } from "../components/confirm-modal";
import { GradientBg } from "../components/gradient-bg";
import {
  CheckIcon,
  CloseIcon,
  ExportIcon,
  MinusIcon,
  PlusIcon,
  POSIcon,
  SearchIcon,
  TrashIcon,
} from "../components/Icons";
import { ThemedText } from "../components/themed-text";
import { ThemedView } from "../components/themed-view";
import { useStore } from "../store/store";
import { Customer, Invoice, InvoiceItem, Product } from "../types";
import { convertQuantity, getConversionMultiplier } from "../utils/conversions";

interface CartItem {
  product: Product;
  quantity: number;
  unitSelected: Product["unitType"];
  sellingPrice: number;
}

export default function BillingScreen() {
  const store = useStore();

  // Layout tracking for split screen on large displays
  const [screenWidth, setScreenWidth] = useState(
    Dimensions.get("window").width,
  );
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription.remove();
  }, []);

  const isSplitScreen = screenWidth > 768;

  // Local state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invoiceHistory, setInvoiceHistory] = useState<Invoice[]>([]);

  // Customer Checkout Details
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [showRegisterCustomer, setShowRegisterCustomer] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);

  // Discount & Taxes
  const [discountType, setDiscountType] = useState<"percentage" | "flat">(
    "percentage",
  );
  const [discountVal, setDiscountVal] = useState("0");
  const [paymentType, setPaymentType] =
    useState<Invoice["paymentType"]>("Cash");

  // Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(
    null,
  );
  const [generatedItems, setGeneratedItems] = useState<InvoiceItem[]>([]);

  // Product Detail Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDetail, setShowProductDetail] = useState(false);

  // Confirmation Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalVariant, setModalVariant] =
    useState<ConfirmModalVariant>("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const showModal = (
    variant: ConfirmModalVariant,
    title: string,
    message: string,
  ) => {
    setModalVariant(variant);
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  // Reset billing state when starting new billing session
  const resetBilling = () => {
    setShowReceiptModal(false);
    setGeneratedInvoice(null);
    setGeneratedItems([]);
    setModalVisible(false);
    setCart([]);
    setCustomerPhone("");
    setCustomerName("");
    setMatchedCustomer(null);
    setDiscountVal("0");
    setPaymentType("Cash");
  };

  // Load invoice history
  useEffect(() => {
    const loadInvoices = async () => {
      const SQLite = require("../database/db");
      const invoices = await SQLite.db.getInvoices();
      setInvoiceHistory(invoices.slice(-5)); // Last 5 invoices
    };
    loadInvoices();
  }, [generatedInvoice]);

  // Search Customer on Phone input change
  useEffect(() => {
    const cleanPhone = customerPhone.trim();
    if (cleanPhone.length >= 7) {
      const match = store.customers.find((c) => c.phone === cleanPhone);
      if (match) {
        setMatchedCustomer(match);
        setCustomerName(match.name || "");
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
      showModal(
        "error",
        "Out of Stock",
        "This product is currently out of stock.",
      );
      return;
    }

    const existingIndex = cart.findIndex(
      (item) => item.product.code === product.code,
    );
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      const newQty = updatedCart[existingIndex].quantity + 1;

      const baseQty = convertQuantity(
        newQty,
        updatedCart[existingIndex].unitSelected,
        product.unitType,
        product.piecesPerBox,
      );
      if (baseQty > product.currentStock) {
        showModal(
          "error",
          "Insufficient Stock",
          "Cannot exceed available stock for this product.",
        );
        return;
      }

      updatedCart[existingIndex].quantity = newQty;
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          unitSelected: product.unitType,
          sellingPrice: product.sellingPrice,
        },
      ]);
    }
  };

  // Adjust Cart Quantities
  const handleUpdateCartQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(index);
      return;
    }

    const item = cart[index];
    const baseQty = convertQuantity(
      newQty,
      item.unitSelected,
      item.product.unitType,
      item.product.piecesPerBox,
    );
    if (baseQty > item.product.currentStock) {
      showModal(
        "error",
        "Insufficient Stock",
        "Cannot exceed available stock for this product.",
      );
      return;
    }

    const updatedCart = [...cart];
    updatedCart[index].quantity = newQty;
    setCart(updatedCart);
  };

  // Change sale unit
  const handleUpdateUnit = (index: number, unit: Product["unitType"]) => {
    const updatedCart = [...cart];
    const item = updatedCart[index];

    const convertedQty = convertQuantity(
      item.quantity,
      item.unitSelected,
      unit,
      item.product.piecesPerBox,
    );

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
      const mult = getConversionMultiplier(
        item.unitSelected,
        item.product.unitType,
        item.product.piecesPerBox,
      );
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
    if (discountType === "percentage") {
      return (subtotalWithTax * val) / 100;
    }
    return val;
  })();

  const grandTotal = Math.max(0, subtotalWithTax - discountAmount);

  // POST CHECKOUT
  const handleCheckout = async () => {
    if (cart.length === 0) {
      showModal(
        "error",
        "Empty Cart",
        "Please add items to your cart before checking out.",
      );
      return;
    }

    try {
      const checkoutItems = cart.map((item) => {
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
        customerName:
          customerName.trim() ||
          (matchedCustomer ? matchedCustomer.name : undefined),
        subtotal: subtotal + taxAmount,
        discountAmount,
        finalTotal: grandTotal,
        paymentType,
      };

      const inv = await store.createInvoice(invoiceData, checkoutItems);

      const SQLite = require("../database/db");
      const savedItems = await SQLite.db.getInvoiceItems(inv.id);

      setGeneratedInvoice(inv);
      setGeneratedItems(savedItems);

      // Add to history
      setInvoiceHistory((prev) => [inv, ...prev].slice(0, 5));
      setShowReceiptModal(true);

      setCart([]);
      setCustomerPhone("");
      setCustomerName("");
      setDiscountVal("0");
      setPaymentType("Cash");
    } catch (e) {
      console.error(e);
      showModal(
        "error",
        "Checkout Failed",
        "An error occurred during checkout. Please verify stock quantities and try again.",
      );
    }
  };

  const categories = ["All", ...new Set(store.products.map((p) => p.category))];
  const filteredProducts = store.products.filter((p) => {
    if (!p.isActive) return false;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const renderProductCatalog = () => (
    <View className="flex-1 px-6">
      <View className="my-4">
        <View className="flex-row items-center bg-brand-glass border border-brand-glass h-12 rounded-2xl px-4 shadow-sm">
          <SearchIcon size={18} color="#666666" />
          <TextInput
            className="flex-1 h-full ml-2 text-brand-primary text-sm font-inter"
            placeholder="Search products..."
            placeholderTextColor="#666666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View className="max-h-12 py-1 mb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {categories.map((cat) => (
            <Pressable
              key={cat}
              className={`py-2 px-4 rounded-xl shadow-sm ${
                selectedCategory === cat
                  ? "bg-brand-accent"
                  : "bg-brand-glass border border-brand-glass"
              }`}
              onPress={() => setSelectedCategory(cat)}
            >
              <ThemedText
                type="smallBold"
                themeColor={
                  selectedCategory === cat ? "textInverse" : "textSecondary"
                }
                className="text-xs font-bold"
              >
                {cat}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row flex-wrap gap-4">
          {filteredProducts.length === 0 ? (
            <ThemedText
              type="small"
              themeColor="textMuted"
              className="py-8 text-center w-full"
            >
              No products found
            </ThemedText>
          ) : (
            filteredProducts.map((p) => {
              const isLow = p.currentStock <= p.minStockAlert;
              const isOutOfStock = p.currentStock <= 0;
              return (
                <View key={p.code} style={{ width: "47%", flexGrow: 1 }}>
                  {/* Card — tap to see details */}
                  <Pressable
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: 20,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: "rgba(65,45,21,0.10)",
                      shadowColor: "#412D15",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.06,
                      shadowRadius: 6,
                      elevation: 2,
                      opacity: isOutOfStock ? 0.5 : 1,
                    }}
                    onPress={() => {
                      setSelectedProduct(p);
                      setShowProductDetail(true);
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#1F150C",
                      }}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                    <Text
                      style={{ fontSize: 10, color: "#A0693A", marginTop: 2 }}
                    >
                      Code: {p.code}
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: isOutOfStock
                            ? "#F4A300"
                            : isLow
                              ? "#F4A300"
                              : "#412D15",
                        }}
                      >
                        {p.currentStock} {p.unitType}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#412D15",
                        }}
                      >
                        {store.settings.currency} {p.sellingPrice}
                      </Text>
                    </View>

                    {/* Add to cart button */}
                    <Pressable
                      disabled={isOutOfStock}
                      onPress={(e) => {
                        handleAddToCart(p);
                      }}
                      style={{
                        marginTop: 10,
                        height: 34,
                        borderRadius: 12,
                        backgroundColor: isOutOfStock
                          ? "rgba(65,45,21,0.08)"
                          : "#412D15",
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <PlusIcon
                        size={13}
                        color={isOutOfStock ? "#A0693A" : "#FAF8F3"}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: isOutOfStock ? "#A0693A" : "#FAF8F3",
                        }}
                      >
                        {isOutOfStock ? "Out of Stock" : "Add to Cart"}
                      </Text>
                    </Pressable>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );

  const renderPOSCart = () => (
    <View className="flex-1 bg-brand-cream p-5 border-l border-brand-glass">
      <ThemedText
        type="subtitle"
        className="text-lg font-bold mb-4 text-brand-primary"
      >
        Checkout Cart ({cart.length} items)
      </ThemedText>

      {/* Cart list */}
      <ScrollView className="flex-1 mb-4" showsVerticalScrollIndicator={false}>
        {cart.length === 0 ? (
          <View className="py-16 justify-center items-center">
            <POSIcon size={36} color="#999999" />
            <ThemedText
              type="small"
              themeColor="textMuted"
              className="mt-3 text-center"
            >
              Cart is empty. Tap products on the left to add.
            </ThemedText>
          </View>
        ) : (
          cart.map((item, index) => {
            const conversionOptions: Product["unitType"][] = [
              item.product.unitType,
            ];
            if (item.product.unitType === "kg") conversionOptions.push("g");
            if (item.product.unitType === "liter") conversionOptions.push("ml");
            if (item.product.unitType === "dozen")
              conversionOptions.push("piece");
            if (item.product.unitType === "box")
              conversionOptions.push("piece");

            const mult = getConversionMultiplier(
              item.unitSelected,
              item.product.unitType,
              item.product.piecesPerBox,
            );
            const itemCost = item.quantity * (item.sellingPrice * mult);

            return (
              <View
                key={item.product.code}
                className="flex-row justify-between items-center py-4 border-b border-brand-glass/50 bg-white/20 px-3 rounded-2xl mb-2"
              >
                <View className="flex-[1.5]">
                  <ThemedText
                    type="smallBold"
                    className="font-bold text-brand-primary"
                    numberOfLines={1}
                  >
                    {item.product.name}
                  </ThemedText>
                  <ThemedText
                    type="code"
                    themeColor="textMuted"
                    className="text-[10px] mt-0.5"
                  >
                    {item.product.code}
                  </ThemedText>

                  {conversionOptions.length > 1 && (
                    <View className="flex-row gap-1 mt-1.5">
                      {conversionOptions.map((u) => (
                        <Pressable
                          key={u}
                          className={`px-2 py-0.5 rounded-lg border border-brand-glass ${
                            item.unitSelected === u
                              ? "bg-brand-accent"
                              : "bg-transparent"
                          }`}
                          onPress={() => handleUpdateUnit(index, u)}
                        >
                          <Text
                            className={`text-[9px] font-bold ${item.unitSelected === u ? "text-white" : "text-brand-secondary"}`}
                          >
                            {u}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {/* Adjust quantities */}
                <View className="flex-row items-center bg-brand-surface rounded-xl border border-brand-glass p-0.5 mx-2">
                  <Pressable
                    className="w-7 h-7 justify-center items-center bg-brand-cream rounded-lg active:bg-brand-glass/50"
                    onPress={() =>
                      handleUpdateCartQty(
                        index,
                        item.quantity -
                          (item.unitSelected === "g" ||
                          item.unitSelected === "ml"
                            ? 100
                            : 1),
                      )
                    }
                  >
                    <MinusIcon size={12} color="#000" />
                  </Pressable>
                  <TextInput
                    className="w-10 text-center font-bold text-brand-primary text-xs font-inter h-7 p-0"
                    keyboardType="numeric"
                    value={String(item.quantity)}
                    onChangeText={(val) =>
                      handleUpdateCartQty(index, parseFloat(val) || 0)
                    }
                  />
                  <Pressable
                    className="w-7 h-7 justify-center items-center bg-brand-cream rounded-lg active:bg-brand-glass/50"
                    onPress={() =>
                      handleUpdateCartQty(
                        index,
                        item.quantity +
                          (item.unitSelected === "g" ||
                          item.unitSelected === "ml"
                            ? 100
                            : 1),
                      )
                    }
                  >
                    <PlusIcon size={12} color="#000" />
                  </Pressable>
                </View>

                <View className="items-end gap-1.5">
                  <ThemedText
                    type="smallBold"
                    className="font-extrabold text-brand-primary"
                  >
                    {store.settings.currency}{" "}
                    {Math.round(itemCost).toLocaleString()}
                  </ThemedText>
                  <Pressable
                    onPress={() => handleRemoveFromCart(index)}
                    className="p-1 active:opacity-75"
                  >
                    <TrashIcon size={15} color="#8B5A2B" />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Customer Panel */}
      <View className="border-t border-brand-glass pt-4 mb-4 gap-2">
        <ThemedText
          type="smallBold"
          className="text-brand-secondary font-bold text-[13px]"
        >
          Customer Phone (Identifier)
        </ThemedText>
        <TextInput
          className="h-11 bg-white/70 border border-brand-glass rounded-xl px-4 text-brand-primary text-sm font-inter"
          placeholder="Enter phone number..."
          placeholderTextColor="#999"
          keyboardType="phone-pad"
          value={customerPhone}
          onChangeText={setCustomerPhone}
        />

        {/* Matched existing customer */}
        {matchedCustomer && (
          <View
            style={{
              backgroundColor: "rgba(65,45,21,0.07)",
              borderWidth: 1,
              borderColor: "rgba(65,45,21,0.18)",
              borderRadius: 16,
              padding: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#2E7D32",
                }}
              />
              <Text
                style={{ fontSize: 11, fontWeight: "700", color: "#2E7D32" }}
              >
                Customer Found
              </Text>
              {matchedCustomer.isRegular && (
                <View
                  style={{
                    backgroundColor: "#412D15",
                    borderRadius: 6,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "800",
                      color: "#FAF8F3",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    ★ Regular
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#1F150C" }}>
              {matchedCustomer.name || "Walk-in Customer"}
            </Text>
            <Text style={{ fontSize: 11, color: "#A0693A", marginTop: 2 }}>
              Total Purchases: {store.settings.currency}{" "}
              {matchedCustomer.totalPurchases.toLocaleString()}
              {matchedCustomer.totalDiscount > 0
                ? `  ·  Discounts: ${store.settings.currency} ${matchedCustomer.totalDiscount.toLocaleString()}`
                : ""}
            </Text>
          </View>
        )}

        {/* New customer — show name input */}
        {showRegisterCustomer && (
          <View
            style={{
              backgroundColor: "rgba(65,45,21,0.04)",
              borderWidth: 1,
              borderColor: "rgba(65,45,21,0.12)",
              borderRadius: 16,
              padding: 12,
              gap: 8,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#F4A300",
                }}
              />
              <Text
                style={{ fontSize: 11, fontWeight: "700", color: "#8B5A2B" }}
              >
                New Customer — Enter Name (optional)
              </Text>
            </View>
            <TextInput
              className="h-10 bg-white/50 border border-brand-glass rounded-xl px-3 text-brand-primary text-xs font-inter"
              placeholder="Customer name..."
              placeholderTextColor="#999"
              value={customerName}
              onChangeText={setCustomerName}
            />
          </View>
        )}
      </View>

      {/* Discount & Checkout Calculation */}
      <View className="border-t border-brand-glass pt-4 mb-4 gap-2">
        <View className="flex-row justify-between items-center">
          <ThemedText
            type="smallBold"
            className="text-brand-secondary font-bold text-[13px]"
          >
            Discount Deductions
          </ThemedText>
          <View className="flex-row bg-brand-surface rounded-xl p-0.5 border border-brand-glass h-8 w-24">
            <Pressable
              className={`flex-1 justify-center items-center rounded-lg ${discountType === "percentage" ? "bg-brand-accent" : "bg-transparent"}`}
              onPress={() => setDiscountType("percentage")}
            >
              <Text
                className={`text-[10px] font-extrabold ${discountType === "percentage" ? "text-white" : "text-brand-secondary"}`}
              >
                %
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 justify-center items-center rounded-lg ${discountType === "flat" ? "bg-brand-accent" : "bg-transparent"}`}
              onPress={() => setDiscountType("flat")}
            >
              <Text
                className={`text-[10px] font-extrabold ${discountType === "flat" ? "text-white" : "text-brand-secondary"}`}
              >
                Flat
              </Text>
            </Pressable>
          </View>
        </View>

        <TextInput
          className="h-11 bg-white/70 border border-brand-glass rounded-xl px-4 text-brand-primary text-sm font-inter"
          keyboardType="numeric"
          value={discountVal}
          onChangeText={setDiscountVal}
        />

        <ThemedText
          type="smallBold"
          className="text-brand-secondary font-bold text-[13px] mt-1"
        >
          Payment Mode
        </ThemedText>
        <View className="flex-row gap-3">
          {(["Cash", "Card", "Credit"] as const).map((mode) => (
            <Pressable
              key={mode}
              className={`flex-1 py-2.5 rounded-xl border items-center ${
                paymentType === mode
                  ? "bg-brand-accent border-brand-accent"
                  : "bg-white/70 border-brand-glass active:bg-brand-glass/50"
              }`}
              onPress={() => setPaymentType(mode)}
            >
              <Text
                className={`text-xs font-bold ${paymentType === mode ? "text-brand-cream" : "text-brand-secondary"}`}
              >
                {mode}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Cart Summary Totals */}
      <View className="border-t border-brand-glass pt-4 mt-auto">
        <View className="flex-row justify-between items-center mb-1.5">
          <ThemedText type="small" themeColor="textSecondary">
            Subtotal Items Price:
          </ThemedText>
          <ThemedText type="smallBold" className="font-bold text-brand-primary">
            {store.settings.currency} {subtotal.toLocaleString()}
          </ThemedText>
        </View>
        {taxPct > 0 && (
          <View className="flex-row justify-between items-center mb-1.5">
            <ThemedText type="small" themeColor="textSecondary">
              Tax ({taxPct}%):
            </ThemedText>
            <ThemedText
              type="smallBold"
              className="font-bold text-brand-primary"
            >
              {store.settings.currency} {taxAmount.toLocaleString()}
            </ThemedText>
          </View>
        )}
        <View className="flex-row justify-between items-center mb-3">
          <ThemedText type="small" className="text-brand-warning">
            Discount Deducted:
          </ThemedText>
          <ThemedText type="smallBold" className="font-bold text-brand-warning">
            - {store.settings.currency} {discountAmount.toLocaleString()}
          </ThemedText>
        </View>

        <View className="flex-row justify-between items-center border-t border-brand-glass py-3 mt-1">
          <ThemedText
            type="subtitle"
            className="text-brand-primary font-extrabold text-lg"
          >
            Grand Total:
          </ThemedText>
          <ThemedText
            type="subtitle"
            className="text-brand-accent font-extrabold text-xl"
          >
            {store.settings.currency} {grandTotal.toLocaleString()}
          </ThemedText>
        </View>

        <Pressable
          className={`flex-row h-12 rounded-2xl justify-center items-center gap-2 shadow-sm active:opacity-85 ${
            cart.length === 0 ? "bg-brand-muted/30" : "bg-brand-accent"
          }`}
          style={cart.length > 0 ? { backgroundColor: "#412D15" } : {}}
          disabled={cart.length === 0}
          onPress={handleCheckout}
        >
          <CheckIcon size={18} color="#FAF8F3" />
          <Text className="text-brand-cream font-bold text-sm">
            Complete POS Checkout
          </Text>
        </Pressable>
      </View>
    </View>
  );

  // Calculate KPI metrics
  const totalSalesAmount = invoiceHistory.reduce(
    (sum, inv) => sum + inv.finalTotal,
    0,
  );
  const totalTransactions = invoiceHistory.length;
  const avgTransactionValue =
    totalTransactions > 0 ? totalSalesAmount / totalTransactions : 0;

  return (
    <GradientBg>
      <ThemedView type="background" style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          {/* Header */}
          {!isSplitScreen && (
            <View className="px-6 py-4">
              <View className="flex-row items-center gap-3 mb-4">
                <View
                  className="w-12 h-12 rounded-2xl bg-brand-accent/20 justify-center items-center"
                  style={{ backgroundColor: "rgba(65, 45, 21, 0.1)" }}
                >
                  <POSIcon size={24} color="#412D15" />
                </View>
                <View className="flex-1">
                  <ThemedText
                    type="subtitle"
                    className="text-lg font-bold text-brand-primary"
                  >
                    POS System
                  </ThemedText>
                  <ThemedText
                    type="small"
                    themeColor="textMuted"
                    className="text-xs"
                  >
                    {totalTransactions} today • {store.settings.currency}{" "}
                    {totalSalesAmount.toLocaleString()}
                  </ThemedText>
                </View>
              </View>

              {/* KPI Cards */}
              <View
                style={{
                  backgroundColor: "rgba(65,45,21,0.08)",
                  borderRadius: 24,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#FFFFFF",
                      borderRadius: 16,
                      padding: 12,
                      shadowColor: "#412D15",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                      elevation: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color: "#A0693A",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      TRANSACTIONS
                    </Text>
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: "800",
                        color: "#1F150C",
                        marginTop: 4,
                      }}
                    >
                      {totalTransactions}
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#FFFFFF",
                      borderRadius: 16,
                      padding: 12,
                      shadowColor: "#412D15",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                      elevation: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color: "#A0693A",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {"TODAY'S TOTAL"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "800",
                        color: "#412D15",
                        marginTop: 4,
                      }}
                    >
                      {store.settings.currency}{" "}
                      {Math.round(totalSalesAmount).toLocaleString()}
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#FFFFFF",
                      borderRadius: 16,
                      padding: 12,
                      shadowColor: "#412D15",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                      elevation: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color: "#A0693A",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      AVG SALE
                    </Text>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "800",
                        color: "#1F150C",
                        marginTop: 4,
                      }}
                    >
                      {store.settings.currency}{" "}
                      {Math.round(avgTransactionValue).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
          {isSplitScreen ? (
            <View className="flex-1 flex-row">
              <View className="flex-[1.3]">{renderProductCatalog()}</View>
              <View className="flex-1">{renderPOSCart()}</View>
            </View>
          ) : (
            <View className="flex-1 px-4">
              {cart.length > 0 ? (
                <View className="flex-row justify-end py-2">
                  <Pressable
                    onPress={() => setCart([])}
                    className="p-1 active:opacity-75"
                  >
                    <ThemedText type="smallBold" style={{ color: "#8B5A2B" }}>
                      Clear Cart
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
              >
                {renderProductCatalog()}
                <View className="h-4" />
                {renderPOSCart()}
              </ScrollView>
            </View>
          )}
        </SafeAreaView>

        {/* Product Detail Modal */}
        <Modal
          visible={showProductDetail}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowProductDetail(false)}
        >
          <View className="flex-1 justify-end bg-brand-primary/40">
            <View className="bg-brand-surface rounded-t-[32px] p-6 max-h-[90%] border-t border-brand-glass shadow-lg">
              {selectedProduct && (
                <>
                  {/* Header — product name + close */}
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
                      onPress={() => setShowProductDetail(false)}
                    >
                      <CloseIcon size={20} color="#000000" />
                    </Pressable>
                  </View>

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 30 }}
                  >
                    {/* 3-column KPI row */}
                    <View
                      style={{
                        backgroundColor: "rgba(65,45,21,0.08)",
                        borderRadius: 24,
                        padding: 12,
                        marginBottom: 16,
                      }}
                    >
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <View
                          style={{
                            flex: 1,
                            backgroundColor: "#FFFFFF",
                            borderRadius: 16,
                            padding: 12,
                            shadowColor: "#412D15",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 4,
                            elevation: 1,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: "700",
                              color: "#A0693A",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            STOCK
                          </Text>
                          <Text
                            style={{
                              fontSize: 22,
                              fontWeight: "800",
                              marginTop: 4,
                              color:
                                selectedProduct.currentStock <=
                                selectedProduct.minStockAlert
                                  ? "#F4A300"
                                  : "#412D15",
                            }}
                          >
                            {selectedProduct.currentStock}
                          </Text>
                          <Text
                            style={{
                              fontSize: 9,
                              color: "#A0693A",
                              marginTop: 2,
                            }}
                          >
                            {selectedProduct.unitType}
                          </Text>
                        </View>
                        <View
                          style={{
                            flex: 1,
                            backgroundColor: "#FFFFFF",
                            borderRadius: 16,
                            padding: 12,
                            shadowColor: "#412D15",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 4,
                            elevation: 1,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: "700",
                              color: "#A0693A",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            COST
                          </Text>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "700",
                              color: "#1F150C",
                              marginTop: 4,
                            }}
                          >
                            {store.settings.currency}{" "}
                            {selectedProduct.buyingPrice}
                          </Text>
                        </View>
                        <View
                          style={{
                            flex: 1,
                            backgroundColor: "#FFFFFF",
                            borderRadius: 16,
                            padding: 12,
                            shadowColor: "#412D15",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 4,
                            elevation: 1,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: "700",
                              color: "#A0693A",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            SELL
                          </Text>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "700",
                              color: "#1F150C",
                              marginTop: 4,
                            }}
                          >
                            {store.settings.currency}{" "}
                            {selectedProduct.sellingPrice}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Profit Margin — with left coffee border */}
                    <View
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 20,
                        padding: 16,
                        marginBottom: 16,
                        borderLeftWidth: 4,
                        borderLeftColor: "#412D15",
                        shadowColor: "#412D15",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 6,
                        elevation: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "700",
                          color: "#A0693A",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        PROFIT MARGIN
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-end",
                          gap: 8,
                          marginTop: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 28,
                            fontWeight: "800",
                            color: "#412D15",
                          }}
                        >
                          {Math.round(
                            ((selectedProduct.sellingPrice -
                              selectedProduct.buyingPrice) /
                              selectedProduct.sellingPrice) *
                              100 || 0,
                          )}
                          %
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#A0693A",
                            marginBottom: 4,
                          }}
                        >
                          {store.settings.currency}{" "}
                          {Math.round(
                            selectedProduct.sellingPrice -
                              selectedProduct.buyingPrice,
                          )}{" "}
                          per unit
                        </Text>
                      </View>
                    </View>

                    {/* Metadata */}
                    <View
                      style={{
                        backgroundColor: "rgba(65,45,21,0.08)",
                        borderRadius: 20,
                        padding: 16,
                        marginBottom: 16,
                        gap: 10,
                      }}
                    >
                      <View>
                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight: "700",
                            color: "#A0693A",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          CATEGORY
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: "#1F150C",
                            marginTop: 3,
                          }}
                        >
                          {selectedProduct.category}
                        </Text>
                      </View>
                      {selectedProduct.barcode ? (
                        <View>
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: "700",
                              color: "#A0693A",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            BARCODE
                          </Text>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "700",
                              color: "#1F150C",
                              marginTop: 3,
                            }}
                          >
                            {selectedProduct.barcode}
                          </Text>
                        </View>
                      ) : null}
                      <View>
                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight: "700",
                            color: "#A0693A",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          ALERT LIMIT
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            marginTop: 3,
                            color:
                              selectedProduct.currentStock <=
                              selectedProduct.minStockAlert
                                ? "#F4A300"
                                : "#1F150C",
                          }}
                        >
                          {selectedProduct.minStockAlert}{" "}
                          {selectedProduct.unitType}{" "}
                          {selectedProduct.currentStock <=
                          selectedProduct.minStockAlert
                            ? "⚠ LOW"
                            : "✓ OK"}
                        </Text>
                      </View>
                    </View>

                    {/* Add to Cart */}
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 12,
                        marginBottom: 16,
                      }}
                    >
                      <Pressable
                        style={{
                          flex: 1,
                          height: 48,
                          borderRadius: 16,
                          justifyContent: "center",
                          alignItems: "center",
                          backgroundColor: "#412D15",
                        }}
                        onPress={() => {
                          handleAddToCart(selectedProduct);
                          setShowProductDetail(false);
                        }}
                      >
                        <Text
                          style={{
                            color: "#FAF8F3",
                            fontWeight: "700",
                            fontSize: 14,
                          }}
                        >
                          Add 1 to Cart
                        </Text>
                      </Pressable>
                      <Pressable
                        style={{
                          flex: 1,
                          height: 48,
                          borderRadius: 16,
                          justifyContent: "center",
                          alignItems: "center",
                          borderWidth: 2,
                          borderColor: "#412D15",
                        }}
                        onPress={() => setShowProductDetail(false)}
                      >
                        <Text
                          style={{
                            color: "#412D15",
                            fontWeight: "700",
                            fontSize: 14,
                          }}
                        >
                          Close
                        </Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Invoice Receipt Modal */}
        <Modal
          visible={showReceiptModal}
          animationType="slide"
          transparent={true}
          onRequestClose={resetBilling}
        >
          <View className="flex-1 justify-end bg-brand-primary/40">
            <View className="bg-brand-cream rounded-t-[32px] p-6 max-h-[90%] border-t border-brand-glass shadow-lg">
              {generatedInvoice && (
                <>
                  <View className="flex-row justify-between items-center mb-4">
                    <ThemedText
                      type="subtitle"
                      className="text-brand-primary font-bold text-lg"
                    >
                      POS Checkout Successful
                    </ThemedText>
                    <Pressable
                      className="w-10 h-10 rounded-full bg-brand-glass border border-brand-glass justify-center items-center active:opacity-75"
                      onPress={resetBilling}
                    >
                      <CloseIcon size={20} color="#000000" />
                    </Pressable>
                  </View>

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 30 }}
                  >
                    {/* Bill Layout Sheet */}
                    <View className="bg-white rounded-3xl p-6 shadow-md border border-brand-glass max-w-sm self-center my-4 w-full">
                      <Text className="text-center font-extrabold text-[18px] tracking-tight text-brand-primary uppercase">
                        {store.settings.factoryName}
                      </Text>
                      <Text className="text-center font-bold text-[10px] text-brand-secondary mt-1 tracking-widest uppercase">
                        Official Sales Invoice
                      </Text>

                      <View className="border-b border-dashed border-gray-400 my-4" />

                      <View className="flex-row justify-between mb-2">
                        <Text className="text-[11px] text-brand-secondary font-medium">
                          Inv No: {generatedInvoice.invoiceNumber}
                        </Text>
                        <Text className="text-[11px] text-brand-secondary font-medium">
                          {new Date(generatedInvoice.date).toLocaleDateString()}
                        </Text>
                      </View>

                      <View className="flex-row justify-between mb-2">
                        <Text className="text-[11px] text-brand-secondary font-medium">
                          Mode: {generatedInvoice.paymentType}
                        </Text>
                        <Text className="text-[11px] text-brand-secondary font-medium">
                          Phone:{" "}
                          {generatedInvoice.customerPhone
                            ? generatedInvoice.customerPhone
                            : "Walk-in"}
                        </Text>
                      </View>

                      <View className="border-b border-dashed border-gray-400 my-4" />

                      {/* Table */}
                      <View className="mb-4">
                        <View className="flex-row pb-2 mb-2 border-b border-gray-150">
                          <Text className="flex-[2] font-bold text-[11px] text-brand-secondary">
                            Product
                          </Text>
                          <Text className="flex-1 font-bold text-[11px] text-brand-secondary text-center">
                            Qty
                          </Text>
                          <Text className="flex-1 font-bold text-[11px] text-brand-secondary text-right">
                            Price
                          </Text>
                          <Text className="flex-1 font-bold text-[11px] text-brand-secondary text-right">
                            Total
                          </Text>
                        </View>

                        {generatedItems.map((item) => (
                          <View key={item.id} className="flex-row py-1.5">
                            <Text className="flex-[2] text-[11px] text-brand-secondary font-medium">
                              {item.productName}
                            </Text>
                            <Text className="flex-1 text-[11px] text-brand-secondary text-center">
                              {item.quantity} {item.unitSelected}
                            </Text>
                            <Text className="flex-1 text-[11px] text-brand-secondary text-right">
                              {store.settings.currency} {item.sellingPrice}
                            </Text>
                            <Text className="flex-1 text-[11px] text-brand-primary font-bold text-right">
                              {store.settings.currency}{" "}
                              {Math.round(item.subtotal).toLocaleString()}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View className="border-b border-dashed border-gray-400 my-4" />

                      {/* Totals */}
                      <View className="gap-1.5 mb-2">
                        <View className="flex-row justify-between">
                          <Text className="text-[11px] text-brand-secondary font-medium">
                            Gross Total:
                          </Text>
                          <Text className="text-[11px] text-brand-secondary font-semibold">
                            {store.settings.currency}{" "}
                            {Math.round(
                              generatedInvoice.subtotal +
                                generatedInvoice.discountAmount,
                            ).toLocaleString()}
                          </Text>
                        </View>
                        {generatedInvoice.discountAmount > 0 && (
                          <View className="flex-row justify-between">
                            <Text className="text-[11px] text-brand-warning font-medium">
                              Discount:
                            </Text>
                            <Text className="text-[11px] text-brand-warning font-semibold">
                              - {store.settings.currency}{" "}
                              {Math.round(
                                generatedInvoice.discountAmount,
                              ).toLocaleString()}
                            </Text>
                          </View>
                        )}
                        <View className="flex-row justify-between border-t border-brand-primary pt-2 mt-1">
                          <Text className="text-xs font-extrabold text-brand-primary">
                            GRAND TOTAL:
                          </Text>
                          <Text className="text-sm font-extrabold text-brand-primary">
                            {store.settings.currency}{" "}
                            {generatedInvoice.finalTotal.toLocaleString()}
                          </Text>
                        </View>
                      </View>

                      <View className="border-b border-dashed border-gray-400 my-4" />

                      <Text className="text-center text-[11px] text-brand-muted italic mt-2">
                        {store.settings.receiptFooter}
                      </Text>
                    </View>

                    <View className="flex-row gap-4 px-4">
                      <Pressable
                        className="flex-1 flex-row h-12 rounded-2xl justify-center items-center gap-2 active:opacity-85 shadow-sm"
                        style={{ backgroundColor: "#412D15" }}
                        onPress={() => {
                          try {
                            // Generate invoice content
                            let invoiceContent = `${store.settings.factoryName}\n`;
                            invoiceContent += `\n======= SALES INVOICE =======\n\n`;
                            invoiceContent += `Invoice: ${generatedInvoice?.invoiceNumber}\n`;
                            invoiceContent += `Date: ${new Date(generatedInvoice?.date || "").toLocaleDateString()}\n`;
                            invoiceContent += `Payment: ${generatedInvoice?.paymentType}\n\n`;
                            invoiceContent += `ITEMS:\n`;
                            generatedItems.forEach((item) => {
                              invoiceContent += `${item.productName} x${item.quantity}${item.unitSelected} @ ${store.settings.currency}${item.sellingPrice}\n`;
                            });
                            invoiceContent += `\n=============================\n`;
                            invoiceContent += `Subtotal: ${store.settings.currency}${Math.round(generatedInvoice?.subtotal || 0).toLocaleString()}\n`;
                            if (
                              generatedInvoice &&
                              generatedInvoice.discountAmount > 0
                            ) {
                              invoiceContent += `Discount: -${store.settings.currency}${Math.round(generatedInvoice.discountAmount).toLocaleString()}\n`;
                            }
                            invoiceContent += `GRAND TOTAL: ${store.settings.currency}${generatedInvoice?.finalTotal.toLocaleString()}\n`;
                            invoiceContent += `\n${store.settings.receiptFooter}\n`;

                            if (Platform.OS === "web") {
                              // Web: Download as file
                              const blob = new Blob([invoiceContent], {
                                type: "text/plain",
                              });
                              const win = typeof globalThis !== "undefined" ? (globalThis as any).window : null;
                              const doc = typeof globalThis !== "undefined" ? (globalThis as any).document : null;
                              if (win && doc) {
                                const url = win.URL.createObjectURL(blob);
                                const link = doc.createElement("a");
                                link.href = url;
                                link.download = `Invoice-${generatedInvoice?.invoiceNumber}-${new Date().getTime()}.txt`;
                                doc.body.appendChild(link);
                                link.click();
                                doc.body.removeChild(link);
                                win.URL.revokeObjectURL(url);
                              }

                              showModal(
                                "success",
                                "Invoice Downloaded",
                                "Invoice has been downloaded successfully.",
                              );
                            } else {
                              // Mobile: Share
                              Share.share({
                                message: invoiceContent,
                                title: `Invoice ${generatedInvoice?.invoiceNumber}`,
                              })
                                .then((result) => {
                                  if (result.action === Share.dismissedAction) {
                                    // User dismissed without sharing
                                    return;
                                  }
                                  showModal(
                                    "success",
                                    "Invoice Shared",
                                    "Invoice has been shared successfully.",
                                  );
                                })
                                .catch((error) => {
                                  console.error("Share error:", error);
                                  showModal(
                                    "error",
                                    "Share Failed",
                                    "Could not share invoice. Please try again.",
                                  );
                                });
                            }
                          } catch (error) {
                            console.error("Export error:", error);
                            showModal(
                              "error",
                              "Export Failed",
                              "An error occurred while exporting the invoice.",
                            );
                          }
                        }}
                      >
                        <ExportIcon size={16} color="#FAF8F3" />
                        <Text className="text-brand-cream font-bold text-[13px]">
                          Export Invoice
                        </Text>
                      </Pressable>

                      <Pressable
                        className="flex-1 bg-brand-accent-sec h-12 rounded-2xl justify-center items-center active:opacity-85 shadow-sm"
                        onPress={resetBilling}
                      >
                        <Text className="text-brand-cream font-bold text-[13px]">
                          Start New Billing
                        </Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </Modal>
      </ThemedView>

      {/* Confirmation Modal */}
      <ConfirmModal
        visible={modalVisible}
        variant={modalVariant}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setModalVisible(false)}
      />
    </GradientBg>
  );
}
