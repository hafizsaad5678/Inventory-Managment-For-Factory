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
import { GradientBg } from "../components/gradient-bg";
import { CloseIcon, SearchIcon, ReportsIcon, WarningIcon, CheckIcon } from "../components/Icons";
import { ThemedText } from "../components/themed-text";
import { useStore } from "../store/store";
import { ConfirmModal, ConfirmModalVariant, ConfirmModalButton } from "../components/confirm-modal";

// ─── Tiny stat box ───────────────────────────────────────────
function StatBox({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: "#FFFFFF",
      borderRadius: 20,
      padding: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(65,45,21,0.08)",
      shadowColor: "#412D15",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    }}>
      <Text style={{ fontSize: 9, fontWeight: "700", color: "#A0693A", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 16, fontWeight: "800", color: accent ?? "#1F150C" }}>
        {value}
      </Text>
      {sub ? <Text style={{ fontSize: 9, color: "#999", marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

export default function CustomersScreen() {
  const store = useStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);
  const [customerInvoiceItems, setCustomerInvoiceItems] = useState<any[]>([]);

  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<any[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Modal state for custom ConfirmModal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalVariant, setModalVariant] = useState<ConfirmModalVariant>("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalButtons, setModalButtons] = useState<ConfirmModalButton[] | undefined>(undefined);

  const showModal = (
    variant: ConfirmModalVariant,
    title: string,
    message: string,
    buttons?: ConfirmModalButton[]
  ) => {
    setModalVariant(variant);
    setModalTitle(title);
    setModalMessage(message);
    setModalButtons(buttons);
    setModalVisible(true);
  };

  const filteredCustomers = store.customers.filter(
    (c) =>
      c.phone.includes(searchQuery) ||
      (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  // Load all invoices + items for a customer
  const loadCustomerData = async (phone: string) => {
    try {
      const invs = store.invoices.filter((i) => i.customerPhone === phone);
      setCustomerInvoices(invs);

      const SQLite = require("../database/db");
      let allItems: any[] = [];
      for (const inv of invs) {
        const items = await SQLite.db.getInvoiceItems(inv.id);
        allItems = [...allItems, ...items];
      }
      setCustomerInvoiceItems(allItems);
    } catch (e) {
      console.error("Error loading customer data:", e);
    }
  };

  useEffect(() => {
    if (selectedCustomer) loadCustomerData(selectedCustomer.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer, store.invoices]);

  const handleOpenInvoice = async (invoice: any) => {
    try {
      const SQLite = require("../database/db");
      const items = await SQLite.db.getInvoiceItems(invoice.id);
      setSelectedInvoice(invoice);
      setSelectedInvoiceItems(items);
      setShowInvoiceModal(true);
    } catch (e) {
      console.error(e);
      showModal("error", "Error", "Failed to load invoice items.");
    }
  };

  const handleCancelInvoice = (invoice: any) => {
    showModal(
      "warning",
      "Cancel Invoice",
      `Are you sure you want to cancel ${invoice.invoiceNumber}? Stock will be restored and customer totals updated.`,
      [
        {
          label: "Keep Invoice",
          style: "secondary",
          onPress: () => {},
        },
        {
          label: "Cancel & Refund",
          style: "danger",
          onPress: async () => {
            try {
              await store.cancelInvoice(invoice.id);
              if (selectedCustomer) {
                await loadCustomerData(selectedCustomer.phone);
                const upd = store.customers.find((c) => c.phone === selectedCustomer.phone);
                if (upd) setSelectedCustomer(upd);
              }
              if (selectedInvoice?.id === invoice.id) {
                const refreshed = store.invoices.find((i) => i.id === invoice.id);
                if (refreshed) setSelectedInvoice(refreshed);
              }
              showModal("success", "Done", "Invoice cancelled and inventory restored.");
            } catch (err) {
              console.error(err);
              showModal("error", "Error", "Cancellation failed.");
            }
          },
        },
      ]
    );
  };

  // ── Analytics helpers ────────────────────────────────────
  const activeInvoices = customerInvoices.filter(i => i.status !== "cancelled");

  const totalOrders = activeInvoices.length;
  const totalSpend = selectedCustomer?.totalPurchases ?? 0;
  const totalDiscount = selectedCustomer?.totalDiscount ?? 0;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 0;

  // Unique products bought
  const uniqueProductCodes = new Set(customerInvoiceItems.map(i => i.productCode));
  const totalUniqueProducts = uniqueProductCodes.size;

  // Total quantity of items (base units)
  const totalItemsQty = customerInvoiceItems.reduce((s, i) => s + (i.quantityInBaseUnit ?? i.quantity), 0);

  // Top products by spend
  const productSpendMap: Record<string, { name: string; qty: number; spend: number; orders: number }> = {};
  customerInvoiceItems.forEach(item => {
    if (!productSpendMap[item.productCode]) {
      productSpendMap[item.productCode] = { name: item.productName, qty: 0, spend: 0, orders: 0 };
    }
    productSpendMap[item.productCode].qty += item.quantityInBaseUnit ?? item.quantity;
    productSpendMap[item.productCode].spend += item.subtotal;
    productSpendMap[item.productCode].orders += 1;
  });
  const topProducts = Object.values(productSpendMap)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  // Monthly spend (last 6 months)
  const monthlySpend: Record<string, number> = {};
  activeInvoices.forEach(inv => {
    const d = new Date(inv.date);
    const key = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    monthlySpend[key] = (monthlySpend[key] ?? 0) + inv.finalTotal;
  });
  const monthlyEntries = Object.entries(monthlySpend).slice(-6);
  const maxMonthly = Math.max(...monthlyEntries.map(e => e[1]), 1);

  // Days since last visit
  const daysSinceLastVisit = selectedCustomer
    ? Math.floor((Date.now() - new Date(selectedCustomer.lastVisit).getTime()) / 86400000)
    : 0;

  const currency = store.settings.currency;

  const renderConfirmOverlay = (onDismiss: () => void) => {
    if (!modalVisible) return null;
    const resolvedButtons: ConfirmModalButton[] =
      modalButtons && modalButtons.length > 0
        ? modalButtons
        : [
            {
              label: "OK",
              onPress: () => {
                setModalVisible(false);
                onDismiss();
              },
              style: "primary",
            },
          ];

    const accent =
      modalVariant === "success"
        ? "#2E7D32"
        : modalVariant === "error"
          ? "#D32F2F"
          : modalVariant === "warning"
            ? "#F4A300"
            : "#412D15";

    const getButtonStyles = (btnStyle?: "primary" | "secondary" | "danger") => {
      switch (btnStyle) {
        case "danger":
          return { bg: "#D32F2F", text: "#FFFFFF", border: "#D32F2F" };
        case "secondary":
          return { bg: "transparent", text: "#412D15", border: "rgba(65, 45, 21, 0.25)" };
        case "primary":
        default:
          return { bg: accent, text: "#FFFFFF", border: accent };
      }
    };

    return (
      <Pressable
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 32,
          zIndex: 9999,
        }}
        onPress={() => {
          setModalVisible(false);
          onDismiss();
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "#FAF8F3",
            borderRadius: 28,
            paddingTop: 32,
            paddingBottom: 24,
            paddingHorizontal: 24,
            alignItems: "center",
            width: "100%",
            maxWidth: 360,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 12,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.6)",
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor:
                modalVariant === "success"
                  ? "rgba(46,125,50,0.12)"
                  : modalVariant === "error"
                    ? "rgba(211,47,47,0.12)"
                    : modalVariant === "warning"
                      ? "rgba(244,163,0,0.12)"
                      : "rgba(65,45,21,0.10)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {modalVariant === "success" && <CheckIcon size={28} color="#2E7D32" />}
            {modalVariant === "error" && <CloseIcon size={28} color="#D32F2F" />}
            {(modalVariant === "warning" || modalVariant === "info") && (
              <WarningIcon
                size={28}
                color={modalVariant === "warning" ? "#F4A300" : "#412D15"}
              />
            )}
          </View>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "800",
              color: "#1F150C",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            {modalTitle}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "500",
              color: "#666",
              marginTop: 8,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            {modalMessage}
          </Text>
          <View
            style={{
              width: "100%",
              height: 1,
              backgroundColor: "rgba(65,45,21,0.08)",
              marginTop: 20,
              marginBottom: 16,
            }}
          />
          <View
            style={{
              flexDirection: resolvedButtons.length > 1 ? "row" : "column",
              gap: 10,
              width: "100%",
            }}
          >
            {resolvedButtons.map((btn, idx) => {
              const s = getButtonStyles(btn.style);
              return (
                <Pressable
                  key={idx}
                  onPress={() => {
                    setModalVisible(false);
                    btn.onPress();
                  }}
                  style={({ pressed }) => ({
                    flex: resolvedButtons.length > 1 ? 1 : undefined,
                    height: 44,
                    borderRadius: 14,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: s.bg,
                    borderWidth: 1.5,
                    borderColor: s.border,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: s.text,
                    }}
                  >
                    {btn.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <GradientBg>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>

        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
          <ThemedText type="subtitle" className="text-2xl font-extrabold text-brand-primary">
            Customers
          </ThemedText>
          <ThemedText type="small" themeColor="textMuted" className="text-[11px] mt-0.5">
            {store.customers.length} registered profiles
          </ThemedText>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
          <View style={{
            flexDirection: "row", alignItems: "center",
            backgroundColor: "#FFFFFF", borderWidth: 1,
            borderColor: "rgba(65,45,21,0.12)", height: 46,
            borderRadius: 23, paddingHorizontal: 16,
            shadowColor: "#412D15", shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
          }}>
            <SearchIcon size={18} color="#666666" />
            <TextInput
              style={{ flex: 1, height: "100%", marginLeft: 8, fontSize: 14, color: "#1F150C" }}
              placeholder="Search by name or phone..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Customer List */}
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: Platform.OS === "ios" ? 140 : 110,
          }}
          showsVerticalScrollIndicator={false}
        >
          {filteredCustomers.length === 0 ? (
            <View style={{ paddingVertical: 48, alignItems: "center" }}>
              <ThemedText type="small" themeColor="textMuted">No customers found.</ThemedText>
            </View>
          ) : (
            filteredCustomers.map((c) => {
              const invoiceCount = store.invoices.filter(i => i.customerPhone === c.phone && i.status !== "cancelled").length;
              return (
                <Pressable key={c.phone} onPress={() => setSelectedCustomer(c)} style={{ marginBottom: 12 }}>
                  <View style={{
                    backgroundColor: "#FFFFFF", borderRadius: 24,
                    padding: 16, borderWidth: 1,
                    borderColor: "rgba(65,45,21,0.09)",
                    shadowColor: "#412D15", shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
                  }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <Text style={{ fontSize: 15, fontWeight: "800", color: "#1F150C" }}>
                            {c.name || "Walk-in Customer"}
                          </Text>
                          {c.isRegular && (
                            <View style={{ backgroundColor: "#412D15", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 8, fontWeight: "800", color: "#FAF8F3", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                ★ Regular
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 11, color: "#A0693A" }}>{c.phone}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#412D15" }}>
                          {currency} {c.totalPurchases.toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 10, color: "#999" }}>
                          {new Date(c.lastVisit).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(65,45,21,0.07)" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#412D15" }} />
                        <Text style={{ fontSize: 10, color: "#666", fontWeight: "600" }}>{invoiceCount} orders</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#F4A300" }} />
                        <Text style={{ fontSize: 10, color: "#666", fontWeight: "600" }}>
                          {currency} {c.totalDiscount.toLocaleString()} saved
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ── Customer Detail Modal ─────────────────────── */}
      <Modal
        visible={selectedCustomer !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedCustomer(null)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(31,21,12,0.45)" }}>
          <View style={{
            backgroundColor: "#FAF8F3", borderTopLeftRadius: 32, borderTopRightRadius: 32,
            maxHeight: "94%", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.5)",
          }}>
            {selectedCustomer && (
              <>
                {/* Modal Header */}
                <View style={{ padding: 24, paddingBottom: 16, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <Text style={{ fontSize: 20, fontWeight: "800", color: "#1F150C" }}>
                        {selectedCustomer.name || "Walk-in Customer"}
                      </Text>
                      {selectedCustomer.isRegular && (
                        <View style={{ backgroundColor: "#412D15", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 9, fontWeight: "800", color: "#FAF8F3", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            ★ Regular
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: "#A0693A", fontWeight: "600" }}>{selectedCustomer.phone}</Text>
                    <Text style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                      Last visit: {new Date(selectedCustomer.lastVisit).toLocaleString()} · {daysSinceLastVisit === 0 ? "Today" : `${daysSinceLastVisit}d ago`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => { setSelectedCustomer(null); setCustomerInvoices([]); setCustomerInvoiceItems([]); }}
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(65,45,21,0.08)", justifyContent: "center", alignItems: "center" }}
                  >
                    <CloseIcon size={18} color="#412D15" />
                  </Pressable>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
                >
                  {/* ── KPI Row 1 ── */}
                  <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                    <StatBox label="Total Orders" value={String(totalOrders)} />
                    <StatBox label="Total Spend" value={`${currency} ${totalSpend.toLocaleString()}`} />
                    <StatBox label="Avg Order" value={`${currency} ${avgOrderValue.toLocaleString()}`} />
                  </View>

                  {/* ── KPI Row 2 ── */}
                  <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
                    <StatBox label="Total Saved" value={`${currency} ${totalDiscount.toLocaleString()}`} accent="#F4A300" />
                    <StatBox label="Unique Products" value={String(totalUniqueProducts)} />
                    <StatBox label="Total Units Bought" value={String(Math.round(totalItemsQty))} />
                  </View>

                  {/* ── Monthly Spend Chart ── */}
                  {monthlyEntries.length > 0 && (
                    <View style={{
                      backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18,
                      marginBottom: 20, borderWidth: 1, borderColor: "rgba(65,45,21,0.08)",
                      shadowColor: "#412D15", shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
                    }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <ReportsIcon size={16} color="#412D15" />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#1F150C" }}>Spend by Month</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 80, gap: 6 }}>
                        {monthlyEntries.map(([month, val], idx) => {
                          const pct = Math.max(0.05, val / maxMonthly);
                          const isMax = val === maxMonthly;
                          return (
                            <View key={idx} style={{ flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                              <Text style={{ fontSize: 7, fontWeight: "700", color: isMax ? "#412D15" : "#A0693A", marginBottom: 3 }}>
                                {currency}{Math.round(val / 1000) > 0 ? `${Math.round(val / 1000)}k` : Math.round(val)}
                              </Text>
                              <View style={{
                                width: "100%", height: `${Math.round(pct * 100)}%`,
                                backgroundColor: isMax ? "#412D15" : "rgba(65,45,21,0.25)",
                                borderTopLeftRadius: 6, borderTopRightRadius: 6,
                                minHeight: 4,
                              }} />
                              <Text style={{ fontSize: 7, color: "#A0693A", marginTop: 4, fontWeight: "600" }}>{month}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* ── Top Products ── */}
                  {topProducts.length > 0 && (
                    <View style={{
                      backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18,
                      marginBottom: 20, borderWidth: 1, borderColor: "rgba(65,45,21,0.08)",
                      shadowColor: "#412D15", shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
                    }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#1F150C", marginBottom: 14 }}>
                        Most Purchased Products
                      </Text>
                      {topProducts.map((p, idx) => {
                        const barPct = p.spend / topProducts[0].spend;
                        return (
                          <View key={idx} style={{ marginBottom: idx < topProducts.length - 1 ? 14 : 0 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                                <View style={{
                                  width: 20, height: 20, borderRadius: 10,
                                  backgroundColor: idx === 0 ? "#412D15" : "rgba(65,45,21,0.12)",
                                  justifyContent: "center", alignItems: "center",
                                }}>
                                  <Text style={{ fontSize: 9, fontWeight: "800", color: idx === 0 ? "#FAF8F3" : "#412D15" }}>
                                    {idx + 1}
                                  </Text>
                                </View>
                                <Text style={{ fontSize: 12, fontWeight: "700", color: "#1F150C", flex: 1 }} numberOfLines={1}>
                                  {p.name}
                                </Text>
                              </View>
                              <Text style={{ fontSize: 11, fontWeight: "700", color: "#412D15" }}>
                                {currency} {Math.round(p.spend).toLocaleString()}
                              </Text>
                            </View>
                            {/* Progress bar */}
                            <View style={{ height: 4, backgroundColor: "rgba(65,45,21,0.08)", borderRadius: 2 }}>
                              <View style={{ height: 4, width: `${Math.round(barPct * 100)}%`, backgroundColor: idx === 0 ? "#412D15" : "rgba(65,45,21,0.35)", borderRadius: 2 }} />
                            </View>
                            <Text style={{ fontSize: 10, color: "#A0693A", marginTop: 4 }}>
                              {p.orders} {p.orders === 1 ? "order" : "orders"} · {Math.round(p.qty * 10) / 10} units
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* ── Invoice History ── */}
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#1F150C", marginBottom: 12 }}>
                    Invoice History ({customerInvoices.length})
                  </Text>

                  {customerInvoices.length === 0 ? (
                    <Text style={{ fontSize: 13, color: "#999", textAlign: "center", paddingVertical: 24 }}>
                      No invoices recorded yet.
                    </Text>
                  ) : (
                    customerInvoices.map((inv) => {
                      const isCancelled = inv.status === "cancelled";
                      const itemCount = customerInvoiceItems.filter(i => i.invoiceId === inv.id).length;
                      return (
                        <Pressable
                          key={inv.id}
                          onPress={() => handleOpenInvoice(inv)}
                          style={{ marginBottom: 10 }}
                        >
                          <View style={{
                            backgroundColor: isCancelled ? "rgba(65,45,21,0.04)" : "#FFFFFF",
                            borderRadius: 18, padding: 14,
                            borderWidth: 1,
                            borderColor: isCancelled ? "rgba(65,45,21,0.08)" : "rgba(65,45,21,0.10)",
                            flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                          }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 12, fontWeight: "700", color: isCancelled ? "#999" : "#1F150C" }}>
                                {inv.invoiceNumber}
                              </Text>
                              <Text style={{ fontSize: 10, color: "#A0693A", marginTop: 2 }}>
                                {new Date(inv.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </Text>
                              <Text style={{ fontSize: 10, color: "#999", marginTop: 1 }}>
                                {itemCount} {itemCount === 1 ? "product" : "products"} · {inv.paymentType}
                              </Text>
                            </View>
                            <View style={{ alignItems: "flex-end", gap: 5 }}>
                              <Text style={{
                                fontSize: 13, fontWeight: "800",
                                color: isCancelled ? "#999" : "#412D15",
                                textDecorationLine: isCancelled ? "line-through" : "none",
                              }}>
                                {currency} {inv.finalTotal.toLocaleString()}
                              </Text>
                              <View style={{
                                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                                backgroundColor: isCancelled ? "rgba(244,163,0,0.12)" : "rgba(65,45,21,0.08)",
                              }}>
                                <Text style={{ fontSize: 9, fontWeight: "700", textTransform: "uppercase", color: isCancelled ? "#F4A300" : "#412D15" }}>
                                  {inv.status}
                                </Text>
                              </View>
                              {inv.discountAmount > 0 && !isCancelled && (
                                <Text style={{ fontSize: 9, color: "#F4A300", fontWeight: "600" }}>
                                  -{currency} {inv.discountAmount.toLocaleString()} disc.
                                </Text>
                              )}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </>
            )}

            {/* Inline Confirm/Alert overlay for Customer detail modal (only if Invoice modal is not open) */}
            {modalVisible && !showInvoiceModal && selectedCustomer !== null && renderConfirmOverlay(() => {})}
          </View>
        </View>
      </Modal>

      {/* ── Invoice Detail Modal ──────────────────────── */}
      <Modal
        visible={showInvoiceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInvoiceModal(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(31,21,12,0.45)" }}>
          <View style={{
            backgroundColor: "#FAF8F3", borderTopLeftRadius: 32, borderTopRightRadius: 32,
            maxHeight: "85%", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.5)",
          }}>
            {selectedInvoice && (
              <>
                <View style={{ padding: 24, paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: "#1F150C" }}>Invoice Details</Text>
                    <Text style={{ fontSize: 11, color: "#A0693A", marginTop: 3 }}>{selectedInvoice.invoiceNumber}</Text>
                  </View>
                  <Pressable
                    onPress={() => setShowInvoiceModal(false)}
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(65,45,21,0.08)", justifyContent: "center", alignItems: "center" }}
                  >
                    <CloseIcon size={18} color="#412D15" />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
                  {/* Meta */}
                  <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "rgba(65,45,21,0.08)" }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, color: "#666", fontWeight: "600" }}>Date</Text>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#1F150C" }}>{new Date(selectedInvoice.date).toLocaleString()}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, color: "#666", fontWeight: "600" }}>Payment</Text>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#1F150C" }}>{selectedInvoice.paymentType}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 11, color: "#666", fontWeight: "600" }}>Status</Text>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: selectedInvoice.status === "cancelled" ? "rgba(244,163,0,0.12)" : "rgba(65,45,21,0.08)" }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", textTransform: "uppercase", color: selectedInvoice.status === "cancelled" ? "#F4A300" : "#412D15" }}>
                          {selectedInvoice.status}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Line items */}
                  <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "rgba(65,45,21,0.08)" }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#1F150C", marginBottom: 12 }}>
                      Items ({selectedInvoiceItems.length})
                    </Text>
                    {/* Table header */}
                    <View style={{ flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "rgba(65,45,21,0.08)", marginBottom: 8 }}>
                      <Text style={{ flex: 2, fontSize: 9, fontWeight: "700", color: "#A0693A", textTransform: "uppercase" }}>Product</Text>
                      <Text style={{ flex: 1, fontSize: 9, fontWeight: "700", color: "#A0693A", textTransform: "uppercase", textAlign: "center" }}>Qty</Text>
                      <Text style={{ flex: 1, fontSize: 9, fontWeight: "700", color: "#A0693A", textTransform: "uppercase", textAlign: "right" }}>Amount</Text>
                    </View>
                    {selectedInvoiceItems.map((item) => (
                      <View key={item.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "rgba(65,45,21,0.05)" }}>
                        <Text style={{ flex: 2, fontSize: 12, fontWeight: "600", color: "#1F150C" }} numberOfLines={1}>{item.productName}</Text>
                        <Text style={{ flex: 1, fontSize: 11, color: "#666", textAlign: "center" }}>{item.quantity} {item.unitSelected}</Text>
                        <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: "#412D15", textAlign: "right" }}>
                          {currency} {Math.round(item.subtotal).toLocaleString()}
                        </Text>
                      </View>
                    ))}

                    {/* Totals */}
                    <View style={{ marginTop: 14, gap: 6 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 11, color: "#666" }}>Subtotal</Text>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: "#1F150C" }}>{currency} {Math.round(selectedInvoice.subtotal).toLocaleString()}</Text>
                      </View>
                      {selectedInvoice.discountAmount > 0 && (
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ fontSize: 11, color: "#F4A300" }}>Discount</Text>
                          <Text style={{ fontSize: 11, fontWeight: "600", color: "#F4A300" }}>- {currency} {Math.round(selectedInvoice.discountAmount).toLocaleString()}</Text>
                        </View>
                      )}
                      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: "rgba(65,45,21,0.12)" }}>
                        <Text style={{ fontSize: 14, fontWeight: "800", color: "#1F150C" }}>Grand Total</Text>
                        <Text style={{ fontSize: 14, fontWeight: "800", color: "#412D15" }}>{currency} {selectedInvoice.finalTotal.toLocaleString()}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={{ gap: 10 }}>
                    {selectedInvoice.status !== "cancelled" && (
                      <Pressable
                        onPress={() => handleCancelInvoice(selectedInvoice)}
                        style={{ height: 48, borderRadius: 16, backgroundColor: "rgba(244,163,0,0.15)", borderWidth: 1, borderColor: "rgba(244,163,0,0.3)", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}
                      >
                        <WarningIcon size={16} color="#F4A300" />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#B07820" }}>Cancel & Refund Invoice</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => setShowInvoiceModal(false)}
                      style={{ height: 48, borderRadius: 16, backgroundColor: "#412D15", justifyContent: "center", alignItems: "center" }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#FAF8F3" }}>Close</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </>
            )}

            {/* Inline Confirm/Alert overlay for Invoice detail modal */}
            {modalVisible && showInvoiceModal && renderConfirmOverlay(() => {})}
          </View>
        </View>
      </Modal>

      {/* Root ConfirmModal for when no other modals are open */}
      <ConfirmModal
        visible={modalVisible && !showInvoiceModal && selectedCustomer === null}
        onClose={() => setModalVisible(false)}
        variant={modalVariant}
        title={modalTitle}
        message={modalMessage}
        buttons={modalButtons}
      />
    </GradientBg>
  );
}
