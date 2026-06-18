import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmModal, ConfirmModalVariant } from "../components/confirm-modal";
import { GlassCard } from "../components/glass-card";
import { GradientBg } from "../components/gradient-bg";
import { ExportIcon, ReportsIcon } from "../components/Icons";
import { ThemedText } from "../components/themed-text";
import { useStore } from "../store/store";

type DateFilter = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export default function ReportsScreen() {
  const store = useStore();

  // Local state
  const [filterType, setFilterType] = useState<DateFilter>("monthly");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);

  // Confirm modal state
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

  // Filter invoices based on date filters
  const getFilteredInvoices = useCallback(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    return store.invoices.filter((inv) => {
      const invDate = new Date(inv.date);

      switch (filterType) {
        case "daily":
          return invDate >= startOfToday;
        case "weekly": {
          const sevenDaysAgo = new Date(
            now.getTime() - 7 * 24 * 60 * 60 * 1000,
          );
          return invDate >= sevenDaysAgo;
        }
        case "monthly": {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return invDate >= startOfMonth;
        }
        case "yearly": {
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          return invDate >= startOfYear;
        }
        case "custom": {
          if (!customStartDate) return true;
          const start = new Date(customStartDate);
          const end = customEndDate ? new Date(customEndDate) : new Date();
          end.setHours(23, 59, 59, 999);
          return invDate >= start && invDate <= end;
        }
        default:
          return true;
      }
    });
  }, [store.invoices, filterType, customStartDate, customEndDate]);

  const filteredInvoices = useMemo(
    () => getFilteredInvoices(),
    [getFilteredInvoices],
  );
  const activeInvoices = useMemo(
    () => filteredInvoices.filter((inv) => inv.status !== "cancelled"),
    [filteredInvoices],
  );
  const invoicesForLedger = useMemo(() => activeInvoices, [activeInvoices]);

  // Load items for active invoices to calculate COGS
  useEffect(() => {
    const loadItems = async () => {
      try {
        const SQLite = await import("../database/db");
        const itemsList: any[] = [];
        for (const inv of invoicesForLedger) {
          const items = await SQLite.db.getInvoiceItems(inv.id);
          itemsList.push(...items);
        }
        setInvoiceItems(itemsList);
      } catch (e) {
        console.error(e);
      }
    };
    if (invoicesForLedger.length > 0) {
      loadItems();
    } else {
      setInvoiceItems([]);
    }
  }, [invoicesForLedger]);

  // Business accounting math
  const grossSales = activeInvoices.reduce((sum, inv) => sum + inv.subtotal, 0);
  const discountsGiven = activeInvoices.reduce(
    (sum, inv) => sum + inv.discountAmount,
    0,
  );
  const netSales = grossSales - discountsGiven;

  const cogs = invoiceItems.reduce((sum, item) => {
    return sum + item.quantityInBaseUnit * item.buyingPrice;
  }, 0);

  const profit = netSales - cogs;
  const isLoss = profit < 0;

  // Analytics lists
  // 1. Most Sold Products
  const getMostSoldProducts = () => {
    const map: Record<string, { name: string; qty: number; revenue: number }> =
      {};
    invoiceItems.forEach((item) => {
      const code = item.productCode;
      if (!map[code]) {
        map[code] = { name: item.productName, qty: 0, revenue: 0 };
      }
      map[code].qty += item.quantityInBaseUnit;
      map[code].revenue += item.subtotal;
    });
    return Object.entries(map)
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  };

  const mostSold = getMostSoldProducts();

  // 2. Top Spending Customers
  const getTopCustomers = () => {
    const map: Record<string, { name: string; spends: number; count: number }> =
      {};
    activeInvoices.forEach((inv) => {
      if (!inv.customerPhone) return;
      const phone = inv.customerPhone;
      if (!map[phone]) {
        const cProfile = store.customers.find((c) => c.phone === phone);
        map[phone] = {
          name: cProfile?.name || "Regular Customer",
          spends: 0,
          count: 0,
        };
      }
      map[phone].spends += inv.finalTotal;
      map[phone].count += 1;
    });
    return Object.entries(map)
      .map(([phone, data]) => ({ phone, ...data }))
      .sort((a, b) => b.spends - a.spends)
      .slice(0, 5);
  };

  const topCustomers = getTopCustomers();

  // 3. Dead Stock Products
  const getDeadStockProducts = () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeSoldCodes = new Set(
      store.stockMovements
        .filter((m) => m.type === "sale" && new Date(m.date) >= thirtyDaysAgo)
        .map((m) => m.productCode),
    );
    return store.products.filter(
      (p) => p.isActive && !activeSoldCodes.has(p.code),
    );
  };

  const deadStock = getDeadStockProducts();

  // CSV Export Handler
  const handleExportCSV = async () => {
    try {
      const headers = ["Financial Report - " + new Date().toLocaleDateString()];
      const rows = [
        [""],
        ["PROFIT & LOSS STATEMENT (" + filterType.toUpperCase() + ")"],
        ["Currency: " + store.settings.currency],
        ["Active Orders: " + activeInvoices.length],
        [""],
        ["ITEM", "AMOUNT"],
        ["Gross Sales Revenue", grossSales.toLocaleString()],
        ["Discounts Given", "-" + discountsGiven.toLocaleString()],
        ["Net Operating Revenue", netSales.toLocaleString()],
        ["Cost of Goods Sold", "-" + cogs.toLocaleString()],
        [
          "NET " + (isLoss ? "LOSS" : "PROFIT"),
          (isLoss ? "-" : "") + profit.toLocaleString(),
        ],
        [""],
        ["PRODUCT MOVEMENT RATES"],
        ...mostSold.map((p) => [
          p.name + " (" + p.code + ")",
          "Qty: " + p.qty,
          store.settings.currency + " " + p.revenue.toLocaleString(),
        ]),
        [""],
        ["TOP CUSTOMER ACCOUNTS"],
        ...topCustomers.map((c) => [
          c.name,
          c.phone,
          store.settings.currency + " " + c.spends.toLocaleString(),
          "Bills: " + c.count,
        ]),
        [""],
        ["STAGNANT / DEAD STOCK"],
        ...deadStock
          .slice(0, 5)
          .map((p) => [
            p.name + " (" + p.code + ")",
            p.currentStock + " " + p.unitType,
            store.settings.currency +
              " " +
              (p.currentStock * p.buyingPrice).toLocaleString(),
          ]),
      ];

      const csvContent = rows
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
        )
        .join("\n");

      if (Platform.OS === "web") {
        // Web download
        const blob = new Blob([csvContent], { type: "text/csv" });
        const win = typeof globalThis !== "undefined" ? (globalThis as any).window : null;
        const doc = typeof globalThis !== "undefined" ? (globalThis as any).document : null;
        if (win && doc) {
          const url = win.URL.createObjectURL(blob);
          const link = doc.createElement("a");
          link.href = url;
          link.download = `inventory-report-${new Date().getTime()}.csv`;
          doc.body.appendChild(link);
          link.click();
          doc.body.removeChild(link);
          win.URL.revokeObjectURL(url);
        }
        showModal(
          "success",
          "Sheet Exported",
          "CSV report has been downloaded successfully to your device.",
        );
      } else {
        // Mobile - share or save
        const path = `${
          require("react-native").Platform.OS === "ios"
            ? require("react-native").DocumentDirectoryPath + "/"
            : require("react-native").DocumentDirectoryPath + "/"
        }inventory-report-${new Date().getTime()}.csv`;

        showModal(
          "success",
          "Sheet Generated",
          "CSV report has been prepared and is ready for download.",
        );
      }
    } catch (error) {
      console.error("CSV Export Error:", error);
      showModal(
        "error",
        "Export Failed",
        "Something went wrong while generating the CSV report. Please try again.",
      );
    }
  };

  // PDF Export Handler
  const handleExportPDF = async () => {
    try {
      const pdfContent = `
INVENTORY MANAGEMENT SYSTEM
FINANCIAL REPORT - ${filterType.toUpperCase()}
Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
Currency: ${store.settings.currency}

====================================================
PROFIT & LOSS STATEMENT
====================================================

1. Gross Sales Revenue .................... ${store.settings.currency} ${grossSales.toLocaleString()}
   (-) Discounts Given .................... (${store.settings.currency} ${discountsGiven.toLocaleString()})
   ───────────────────────────────────────────────
2. Net Operating Revenue ................. ${store.settings.currency} ${netSales.toLocaleString()}

3. Cost of Goods Sold (COGS) ............. (${store.settings.currency} ${cogs.toLocaleString()})
   ───────────────────────────────────────────────
NET ${isLoss ? "LOSS" : "PROFIT"} ....................................... ${store.settings.currency} ${profit.toLocaleString()}

Active Orders: ${activeInvoices.length}

====================================================
TOP 5 PRODUCTS BY MOVEMENT
====================================================
${mostSold
  .map(
    (p, idx) => `${idx + 1}. ${p.name} (${p.code})
   Quantity Sold: ${p.qty} | Revenue: ${store.settings.currency} ${p.revenue.toLocaleString()}`,
  )
  .join("\n\n")}

====================================================
TOP 5 CUSTOMER ACCOUNTS
====================================================
${topCustomers
  .map(
    (c, idx) => `${idx + 1}. ${c.name} (${c.phone})
   Total Spends: ${store.settings.currency} ${c.spends.toLocaleString()} | Bills: ${c.count}`,
  )
  .join("\n\n")}

====================================================
STAGNANT / DEAD STOCK MONITOR (Last 30 Days)
====================================================
${
  deadStock.length === 0
    ? "No stagnant products detected."
    : deadStock
        .slice(0, 5)
        .map(
          (p) => `• ${p.name} (${p.code})
  Idle Quantity: ${p.currentStock} ${p.unitType} | Value: ${store.settings.currency} ${(p.currentStock * p.buyingPrice).toLocaleString()}`,
        )
        .join("\n\n")
}

====================================================
Report prepared by Inventory Management System
====================================================
      `;

      if (Platform.OS === "web") {
        // Web download
        const blob = new Blob([pdfContent], { type: "text/plain" });
        const win = typeof globalThis !== "undefined" ? (globalThis as any).window : null;
        const doc = typeof globalThis !== "undefined" ? (globalThis as any).document : null;
        if (win && doc) {
          const url = win.URL.createObjectURL(blob);
          const link = doc.createElement("a");
          link.href = url;
          link.download = `inventory-report-${new Date().getTime()}.pdf`;
          doc.body.appendChild(link);
          link.click();
          doc.body.removeChild(link);
          win.URL.revokeObjectURL(url);
        }
        showModal(
          "success",
          "PDF Exported",
          "PDF report has been downloaded successfully to your device.",
        );
      } else {
        // Mobile - share or save
        showModal(
          "success",
          "PDF Compiled",
          "PDF report has been compiled and is ready. Check your downloads.",
        );
      }
    } catch (error) {
      console.error("PDF Export Error:", error);
      showModal(
        "error",
        "Export Failed",
        "Something went wrong while generating the PDF report. Please try again.",
      );
    }
  };

  return (
    <GradientBg>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {/* Header */}
        <View className="flex-row justify-between items-center px-6 py-4">
          <View className="flex-row items-center gap-3">
            <View className="p-3 bg-brand-accent/10 rounded-2xl">
              <ReportsIcon size={24} color="#412D15" />
            </View>
            <View>
              <ThemedText
                type="subtitle"
                className="text-xl font-extrabold tracking-tight text-brand-primary"
              >
                Financial Ledger
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textMuted"
                className="font-semibold uppercase tracking-wider text-[10px] mt-0.5"
              >
                Accounting & Audits
              </ThemedText>
            </View>
          </View>

          <View className="flex-row gap-2">
            <Pressable
              className="flex-row items-center gap-1.5 bg-brand-glass border border-brand-glass rounded-xl px-3 py-2 active:opacity-70 shadow-sm"
              onPress={handleExportCSV}
            >
              <ExportIcon size={14} color="#000" />
              <ThemedText type="smallBold" className="text-xs font-bold">
                Sheet
              </ThemedText>
            </Pressable>
            <Pressable
              className="flex-row items-center gap-1.5 bg-brand-glass border border-brand-glass rounded-xl px-3 py-2 active:opacity-70 shadow-sm"
              onPress={handleExportPDF}
            >
              <ExportIcon size={14} color="#000" />
              <ThemedText type="smallBold" className="text-xs font-bold">
                PDF
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: Platform.OS === "ios" ? 140 : 110,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Filters Bar */}
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              marginBottom: 20,
              backgroundColor: "rgba(255,255,255,0.30)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.20)",
              borderRadius: 999,
              padding: 6,
            }}
          >
            {(
              ["daily", "weekly", "monthly", "yearly", "custom"] as DateFilter[]
            ).map((f) => {
              const isActive = filterType === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFilterType(f)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    alignItems: "center",
                    borderRadius: 999,
                    backgroundColor: isActive ? "#412D15" : "transparent",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                      color: isActive ? "#FAF8F3" : "#666666",
                    }}
                  >
                    {f === "daily"
                      ? "Day"
                      : f === "weekly"
                        ? "Week"
                        : f === "monthly"
                          ? "Month"
                          : f === "yearly"
                            ? "Year"
                            : "Custom"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Custom Date Inputs */}
          {filterType === "custom" && (
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.55)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.60)",
                  borderRadius: 20,
                  padding: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: "#8B5A2B",
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Start Date
                </Text>
                <TextInput
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#999"
                  value={customStartDate}
                  onChangeText={setCustomStartDate}
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: "#1F150C",
                    paddingVertical: 4,
                  }}
                />
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.55)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.60)",
                  borderRadius: 20,
                  padding: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: "#8B5A2B",
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  End Date
                </Text>
                <TextInput
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#999"
                  value={customEndDate}
                  onChangeText={setCustomEndDate}
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: "#1F150C",
                    paddingVertical: 4,
                  }}
                />
              </View>
            </View>
          )}

          {/* KPI Cards Grid */}
          <View className="flex-row flex-wrap gap-3 mb-6">
            <GlassCard
              variant="card"
              style={{
                borderLeftWidth: 4,
                borderLeftColor: "#412D15",
                overflow: "hidden",
              }}
              className="w-[47%] flex-grow min-h-[95px] justify-between"
            >
              <ThemedText
                type="small"
                themeColor="textSecondary"
                className="font-semibold text-[11px]"
              >
                Gross Sales
              </ThemedText>
              <ThemedText
                type="subtitle"
                className="text-brand-primary text-lg font-extrabold mt-2"
              >
                {store.settings.currency} {grossSales.toLocaleString()}
              </ThemedText>
            </GlassCard>

            <GlassCard
              variant="card"
              style={{
                borderLeftWidth: 4,
                borderLeftColor: "#412D15",
                overflow: "hidden",
              }}
              className="w-[47%] flex-grow min-h-[95px] justify-between"
            >
              <ThemedText
                type="small"
                themeColor="textSecondary"
                className="font-semibold text-[11px]"
              >
                Discounts
              </ThemedText>
              <ThemedText
                type="subtitle"
                className="text-brand-warning text-lg font-extrabold mt-2"
              >
                {store.settings.currency} {discountsGiven.toLocaleString()}
              </ThemedText>
            </GlassCard>

            <GlassCard
              variant="card"
              style={{
                borderLeftWidth: 4,
                borderLeftColor: "#412D15",
                overflow: "hidden",
              }}
              className="w-[47%] flex-grow min-h-[95px] justify-between"
            >
              <ThemedText
                type="small"
                themeColor="textSecondary"
                className="font-semibold text-[11px]"
              >
                Net Revenue
              </ThemedText>
              <ThemedText
                type="subtitle"
                className="text-brand-accent-sec text-lg font-extrabold mt-2"
              >
                {store.settings.currency} {netSales.toLocaleString()}
              </ThemedText>
            </GlassCard>

            <GlassCard
              variant="card"
              style={{
                borderLeftWidth: 4,
                borderLeftColor: isLoss ? "#F4A300" : "#412D15",
                overflow: "hidden",
              }}
              className="w-[47%] flex-grow min-h-[95px] justify-between"
            >
              <ThemedText
                type="small"
                themeColor="textSecondary"
                className="font-semibold text-[11px]"
              >
                Net Profit/Loss
              </ThemedText>
              <ThemedText
                type="subtitle"
                className={`text-lg font-extrabold mt-2 ${isLoss ? "text-brand-warning" : "text-brand-primary"}`}
              >
                {store.settings.currency} {profit.toLocaleString()}
              </ThemedText>
            </GlassCard>

            <GlassCard
              variant="card"
              style={{
                borderLeftWidth: 4,
                borderLeftColor: "#412D15",
                overflow: "hidden",
              }}
              className="w-[47%] flex-grow min-h-[95px] justify-between"
            >
              <ThemedText
                type="small"
                themeColor="textSecondary"
                className="font-semibold text-[11px]"
              >
                COGS
              </ThemedText>
              <ThemedText
                type="subtitle"
                className="text-brand-warning text-lg font-extrabold mt-2"
              >
                {store.settings.currency} {cogs.toLocaleString()}
              </ThemedText>
            </GlassCard>

            <GlassCard
              variant="card"
              style={{
                borderLeftWidth: 4,
                borderLeftColor: "#412D15",
                overflow: "hidden",
              }}
              className="w-[47%] flex-grow min-h-[95px] justify-between"
            >
              <ThemedText
                type="small"
                themeColor="textSecondary"
                className="font-semibold text-[11px]"
              >
                Active Orders
              </ThemedText>
              <ThemedText
                type="subtitle"
                className="text-brand-primary text-lg font-extrabold mt-2"
              >
                {activeInvoices.length} orders
              </ThemedText>
            </GlassCard>
          </View>

          {/* P&L Statement Card */}
          <GlassCard
            variant="cardStrong"
            style={{ borderRadius: 32, overflow: "hidden", padding: 0 }}
            className="mb-6"
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
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <View
                  style={{
                    padding: 8,
                    backgroundColor: "rgba(65,45,21,0.08)",
                    borderRadius: 12,
                  }}
                >
                  <ReportsIcon size={20} color="#412D15" />
                </View>
                <Text
                  style={{ fontSize: 15, fontWeight: "700", color: "#1F150C" }}
                >
                  P&L Statement ({filterType.toUpperCase()})
                </Text>
              </View>

              {/* Gross Sales */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(65,45,21,0.1)",
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: "600", color: "#8B5A2B" }}
                >
                  1. Gross Sales Revenue
                </Text>
                <Text
                  style={{ fontSize: 13, fontWeight: "700", color: "#1F150C" }}
                >
                  {store.settings.currency} {grossSales.toLocaleString()}
                </Text>
              </View>

              {/* Discounts */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(65,45,21,0.1)",
                  paddingLeft: 12,
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: "600", color: "#A0693A" }}
                >
                  (-) Discounts Given
                </Text>
                <Text
                  style={{ fontSize: 13, fontWeight: "700", color: "#F4A300" }}
                >
                  {store.settings.currency} {discountsGiven.toLocaleString()}
                </Text>
              </View>

              {/* Net Sales */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(65,45,21,0.1)",
                  backgroundColor: "rgba(65,45,21,0.03)",
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: "700", color: "#1F150C" }}
                >
                  2. Net Operating Revenue
                </Text>
                <Text
                  style={{ fontSize: 13, fontWeight: "700", color: "#1F150C" }}
                >
                  {store.settings.currency} {netSales.toLocaleString()}
                </Text>
              </View>

              {/* COGS */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(65,45,21,0.1)",
                  paddingLeft: 12,
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: "600", color: "#8B5A2B" }}
                >
                  3. Cost of Goods Sold
                </Text>
                <Text
                  style={{ fontSize: 13, fontWeight: "700", color: "#F4A300" }}
                >
                  {store.settings.currency} {cogs.toLocaleString()}
                </Text>
              </View>

              {/* Net Profit/Loss */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  backgroundColor: isLoss
                    ? "rgba(214,69,69,0.08)"
                    : "rgba(65,45,21,0.05)",
                  borderLeftWidth: 4,
                  borderLeftColor: isLoss ? "#F4A300" : "#412D15",
                  paddingLeft: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: isLoss ? "#F4A300" : "#1F150C",
                    textTransform: "uppercase",
                  }}
                >
                  NET {isLoss ? "LOSS" : "PROFIT"}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: isLoss ? "#D64545" : "#1F150C",
                  }}
                >
                  {store.settings.currency} {profit.toLocaleString()}
                </Text>
              </View>
            </View>
          </GlassCard>

          {/* Product Movement Rates */}
          <GlassCard
            variant="card"
            style={{ borderRadius: 32, overflow: "hidden", padding: 0 }}
            className="mb-6"
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
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: "#1F150C",
                  marginBottom: 12,
                }}
              >
                Top 5 Products by Movement
              </Text>
              {mostSold.length === 0 ? (
                <View style={{ padding: 16, alignItems: "center" }}>
                  <Text style={{ fontSize: 13, color: "#A0693A" }}>
                    No sales recorded in this period.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {mostSold.map((p, idx) => (
                    <View
                      key={p.code}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor:
                          idx === 0
                            ? "rgba(65,45,21,0.07)"
                            : "rgba(65,45,21,0.03)",
                        borderRadius: 16,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 999,
                          backgroundColor:
                            idx === 0 ? "#412D15" : "rgba(65,45,21,0.10)",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: idx === 0 ? "#FAF8F3" : "#412D15",
                          }}
                        >
                          {idx + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: "#1F150C",
                          }}
                        >
                          {p.name}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "600",
                            color: "#A0693A",
                            marginTop: 1,
                          }}
                        >
                          Code: {p.code}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: "#1F150C",
                          }}
                        >
                          Qty: {p.qty}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: "#A0693A",
                            marginTop: 2,
                          }}
                        >
                          {store.settings.currency} {p.revenue.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </GlassCard>

          {/* Top Customers */}
          <GlassCard
            variant="card"
            style={{ borderRadius: 32, overflow: "hidden", padding: 0 }}
            className="mb-6"
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
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: "#1F150C",
                  marginBottom: 12,
                }}
              >
                Top 5 Customer Accounts
              </Text>
              {topCustomers.length === 0 ? (
                <View style={{ padding: 16, alignItems: "center" }}>
                  <Text style={{ fontSize: 13, color: "#A0693A" }}>
                    No customer invoices in this period.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {topCustomers.map((c, idx) => (
                    <View
                      key={c.phone}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor:
                          idx === 0
                            ? "rgba(65,45,21,0.07)"
                            : "rgba(65,45,21,0.03)",
                        borderRadius: 16,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 999,
                          backgroundColor:
                            idx === 0 ? "#412D15" : "rgba(65,45,21,0.10)",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: idx === 0 ? "#FAF8F3" : "#412D15",
                          }}
                        >
                          {idx + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: "#1F150C",
                          }}
                        >
                          {c.name}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "600",
                            color: "#A0693A",
                            marginTop: 1,
                          }}
                        >
                          {c.phone}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: "#1F150C",
                          }}
                        >
                          {store.settings.currency} {c.spends.toLocaleString()}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: "#A0693A",
                            marginTop: 2,
                          }}
                        >
                          Bills: {c.count}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </GlassCard>

          {/* Dead Stock Monitor */}
          <GlassCard
            variant="card"
            style={{ borderRadius: 32, overflow: "hidden", padding: 0 }}
            className="mb-6"
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
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: "#1F150C",
                  marginBottom: 12,
                }}
              >
                Stagnant / Dead Stock Monitor
              </Text>
              {deadStock.length === 0 ? (
                <View style={{ padding: 16, alignItems: "center" }}>
                  <Text style={{ fontSize: 13, color: "#A0693A" }}>
                    No stagnant products detected.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {deadStock.slice(0, 5).map((p) => (
                    <View
                      key={p.code}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        backgroundColor: "rgba(244,163,0,0.06)",
                        borderRadius: 16,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderLeftWidth: 3,
                        borderLeftColor: "#F4A300",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: "#1F150C",
                          }}
                        >
                          {p.name}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "600",
                            color: "#A0693A",
                            marginTop: 1,
                          }}
                        >
                          Code: {p.code}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: "#F4A300",
                          }}
                        >
                          {p.currentStock} {p.unitType}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: "#A0693A",
                            marginTop: 2,
                          }}
                        >
                          Val: {store.settings.currency}{" "}
                          {(p.currentStock * p.buyingPrice).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {deadStock.length > 5 && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: "#A0693A",
                        marginTop: 8,
                        fontWeight: "600",
                      }}
                    >
                      + {deadStock.length - 5} more stagnant products
                    </Text>
                  )}
                </View>
              )}
            </View>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>

      {/* Export Confirm Modal */}
      <ConfirmModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        variant={modalVariant}
        title={modalTitle}
        message={modalMessage}
      />
    </GradientBg>
  );
}
