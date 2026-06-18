import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
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
    ReportsIcon,
    SettingsIcon,
    WarningIcon,
} from "../components/Icons";
import { MiniCalendar } from "../components/mini-calendar";
import { ThemedText } from "../components/themed-text";
import { useStore } from "../store/store";
import { ConfirmModal, ConfirmModalVariant } from "../components/confirm-modal";

type DateFilter = "daily" | "weekly" | "monthly" | "yearly" | "custom";

// Format Date to YYYY-MM-DD using LOCAL date parts — avoids UTC offset shifting the day
const toLocalDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Parse a YYYY-MM-DD string as a LOCAL date (not UTC midnight)
const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export default function DashboardScreen() {
  const store = useStore();
  const initApp = useStore((state) => state.initApp);

  // Local state
  const [filterType, setFilterType] = useState<DateFilter>("monthly");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Date picker state
  const [startDateObj, setStartDateObj] = useState<Date>(new Date());
  const [endDateObj, setEndDateObj] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Settings Form
  const [factoryName, setFactoryName] = useState("");
  const [currency, setCurrency] = useState("");
  const [taxPercent, setTaxPercent] = useState("0");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [backupJson, setBackupJson] = useState("");

  // Modal state for custom ConfirmModal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalVariant, setModalVariant] = useState<ConfirmModalVariant>("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const showModal = (variant: ConfirmModalVariant, title: string, message: string) => {
    setModalVariant(variant);
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const didInitRef = React.useRef(false);

  // Init Store once on mount
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    void initApp();
  }, [initApp]);

  // Update Settings form when settings load
  useEffect(() => {
    if (store.settings) {
      setFactoryName(store.settings.factoryName);
      setCurrency(store.settings.currency);
      setTaxPercent(String(store.settings.taxPercent));
      setReceiptFooter(store.settings.receiptFooter);
    }
  }, [store.settings, showSettingsModal]);

  // Handle Save Settings
  const handleSaveSettings = async () => {
    if (!factoryName.trim()) {
      showModal("warning", "Required Field", "Factory Name is required to save settings.");
      return;
    }
    await store.saveSettings({
      factoryName: factoryName.trim(),
      currency: currency.trim() || "PKR",
      taxPercent: parseFloat(taxPercent) || 0,
      receiptFooter: receiptFooter.trim(),
      darkMode: store.settings.darkMode,
    });
    setShowSettingsModal(false);
    showModal("success", "Settings Saved", "Your factory configurations have been successfully saved.");
  };

  // Backup data
  const handleBackup = async () => {
    try {
      const SQLite = require("../database/db");
      const backup = await SQLite.db.backupData();
      setBackupJson(backup);
      showModal("success", "Backup Generated", "Backup JSON generated successfully. You can copy it from the recovery text area below.");
    } catch (e) {
      console.error(e);
      showModal("error", "Backup Failed", "Failed to generate database backup.");
    }
  };

  // Restore data
  const handleRestore = async () => {
    if (!backupJson.trim()) {
      showModal("warning", "Input Required", "Please paste backup JSON string to restore.");
      return;
    }
    const success = await store.restoreBackup(backupJson);
    if (success) {
      setBackupJson("");
      setShowSettingsModal(false);
      showModal("success", "Restored Successfully", "Data restored successfully!");
    } else {
      showModal("error", "Restoration Failed", "Invalid backup JSON or restoration failed.");
    }
  };

  // Calculate stats based on date filters
  const getFilteredInvoices = () => {
    const now = new Date();
    // Local midnight helpers
    const localMidnight = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());

    return store.invoices.filter((inv) => {
      // Parse stored ISO string and convert to local Date for comparison
      const invDate = new Date(inv.date);

      switch (filterType) {
        case "daily": {
          const startOfToday = localMidnight(now);
          return invDate >= startOfToday;
        }
        case "weekly": {
          // Start of the day, 6 days ago (so "this week" = last 7 days incl. today)
          const weekStart = localMidnight(now);
          weekStart.setDate(weekStart.getDate() - 6);
          return invDate >= weekStart;
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
          const start = parseLocalDate(customStartDate);
          const end = customEndDate
            ? parseLocalDate(customEndDate)
            : new Date();
          end.setHours(23, 59, 59, 999);
          return invDate >= start && invDate <= end;
        }
        default:
          return true;
      }
    });
  };

  const filteredInvoices = getFilteredInvoices();

  // Basic stats
  const activeInvoices = filteredInvoices.filter(
    (inv) => inv.status !== "cancelled",
  );
  const grossSales = activeInvoices.reduce((sum, inv) => sum + inv.subtotal, 0);
  const discountsGiven = activeInvoices.reduce(
    (sum, inv) => sum + inv.discountAmount,
    0,
  );
  const netSales = grossSales - discountsGiven;

  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);

  // Stable IDs string so the effect re-fires whenever the filtered set changes
  const activeInvoiceIds = activeInvoices.map((i) => i.id).join(",");

  useEffect(() => {
    const loadItems = async () => {
      try {
        const SQLite = require("../database/db");
        const itemsList: any[] = [];
        // Use the current filtered invoices captured via activeInvoiceIds
        const currentInvoices = getFilteredInvoices().filter(
          (inv) => inv.status !== "cancelled",
        );
        for (const inv of currentInvoices) {
          const items = await SQLite.db.getInvoiceItems(inv.id);
          itemsList.push(...items);
        }
        setInvoiceItems(itemsList);
      } catch (e) {
        console.error(e);
      }
    };
    if (activeInvoices.length > 0) {
      loadItems();
    } else {
      setInvoiceItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInvoiceIds]);

  const cogs = invoiceItems.reduce((sum, item) => {
    const inv = activeInvoices.find((i) => i.id === item.invoiceId);
    if (!inv) return sum;
    return sum + item.quantityInBaseUnit * item.buyingPrice;
  }, 0);

  const profit = netSales - cogs;
  const isLoss = profit < 0;

  // Inventory value
  const inventoryValue = store.products.reduce(
    (sum, p) => sum + p.currentStock * p.buyingPrice,
    0,
  );

  // Low stock products
  const lowStockProducts = store.products.filter(
    (p) => p.currentStock <= p.minStockAlert,
  );

  // Dead stock check: Products not sold in the last 30 days
  const getDeadStockProducts = () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const soldProductCodes = new Set(
      store.stockMovements
        .filter((m) => m.type === "sale" && new Date(m.date) >= thirtyDaysAgo)
        .map((m) => m.productCode),
    );

    return store.products.filter((p) => !soldProductCodes.has(p.code));
  };

  const deadStockProducts = getDeadStockProducts();

  // Top Selling Products (calculated from invoice items)
  const getTopSellingProducts = () => {
    const salesMap: Record<
      string,
      { name: string; quantity: number; revenue: number }
    > = {};

    invoiceItems.forEach((item) => {
      const code = item.productCode;
      if (!salesMap[code]) {
        salesMap[code] = { name: item.productName, quantity: 0, revenue: 0 };
      }
      salesMap[code].quantity += item.quantityInBaseUnit;
      salesMap[code].revenue += item.subtotal;
    });

    return Object.entries(salesMap)
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  };

  const topSelling = getTopSellingProducts();

  // Render a mini responsive visual bar chart using Views
  const renderMiniChart = () => {
    if (activeInvoices.length === 0) {
      return (
        <View
          style={{
            height: 160,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 13, color: "#A0693A", fontWeight: "600" }}>
            No sales in this period
          </Text>
        </View>
      );
    }

    const groups: Record<string, number> = {};
    activeInvoices.forEach((inv) => {
      const date = new Date(inv.date);
      let label = "";
      if (filterType === "daily") {
        const h = date.getHours();
        label = `${h}:00`;
      } else if (filterType === "weekly") {
        label = date.toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
        });
      } else if (filterType === "monthly") {
        label = `Wk${Math.ceil(date.getDate() / 7)}`;
      } else {
        label = date.toLocaleDateString(undefined, { month: "short" });
      }
      groups[label] = (groups[label] || 0) + inv.finalTotal;
    });

    const data = Object.entries(groups).map(([label, value]) => ({
      label,
      value,
    }));
    const maxValue = Math.max(...data.map((d) => d.value), 100);
    const currency = store.settings.currency;

    // Y-axis ticks: 0, 25%, 50%, 75%, 100%
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
      pct,
      label: pct === 0 ? "0" : Math.round(maxValue * pct).toLocaleString(),
    }));

    const CHART_HEIGHT = 180;
    const Y_AXIS_WIDTH = 44;

    return (
      <View style={{ paddingTop: 8 }}>
        {/* Total summary row */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: "#A0693A",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Period Total
            </Text>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "800",
                color: "#1F150C",
                marginTop: 2,
              }}
            >
              {currency}{" "}
              {data.reduce((s, d) => s + d.value, 0).toLocaleString()}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: "#A0693A",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Peak
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: "#412D15",
                marginTop: 2,
              }}
            >
              {currency} {Math.round(maxValue).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Chart area */}
        <View style={{ flexDirection: "row", height: CHART_HEIGHT }}>
          {/* Y-axis */}
          <View
            style={{
              width: Y_AXIS_WIDTH,
              justifyContent: "space-between",
              alignItems: "flex-end",
              paddingRight: 8,
              paddingBottom: 20,
            }}
          >
            {[...yTicks].reverse().map((t, i) => (
              <Text
                key={i}
                style={{ fontSize: 8, color: "#A0693A", fontWeight: "600" }}
              >
                {t.label}
              </Text>
            ))}
          </View>

          {/* Bars + grid */}
          <View style={{ flex: 1, position: "relative" }}>
            {/* Horizontal grid lines */}
            {yTicks.map((t, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: `${t.pct * 100}%` as any,
                  height: 1,
                  backgroundColor:
                    i === 0 ? "rgba(65,45,21,0.20)" : "rgba(65,45,21,0.07)",
                  marginBottom: 20,
                }}
              />
            ))}

            {/* Bars row */}
            <View
              style={{
                flexDirection: "row",
                height: "100%",
                alignItems: "flex-end",
                paddingBottom: 20,
              }}
            >
              {data.map((item, idx) => {
                const pct = Math.max(4, (item.value / maxValue) * 100);
                const isMax = item.value === maxValue;
                return (
                  <View
                    key={idx}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      height: "100%",
                      justifyContent: "flex-end",
                      paddingHorizontal: 3,
                    }}
                  >
                    {/* Value label */}
                    <Text
                      style={{
                        fontSize: 8,
                        fontWeight: "700",
                        color: isMax ? "#412D15" : "#A0693A",
                        marginBottom: 4,
                        textAlign: "center",
                      }}
                    >
                      {Math.round(item.value).toLocaleString()}
                    </Text>
                    {/* Bar */}
                    <View
                      style={{
                        width: "100%",
                        height: `${pct}%`,
                        backgroundColor: isMax
                          ? "#412D15"
                          : "rgba(65,45,21,0.30)",
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                        borderBottomLeftRadius: 3,
                        borderBottomRightRadius: 3,
                      }}
                    />
                  </View>
                );
              })}
            </View>

            {/* X-axis labels */}
            <View
              style={{
                flexDirection: "row",
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 18,
              }}
            >
              {data.map((item, idx) => (
                <Text
                  key={idx}
                  style={{
                    flex: 1,
                    fontSize: 8,
                    color: "#A0693A",
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <GradientBg>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {/* Header */}
        <View className="flex-row justify-between items-center px-6 py-4">
          <View>
            <ThemedText
              type="subtitle"
              className="text-2xl font-extrabold tracking-tight text-brand-primary"
            >
              {store.settings.factoryName}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textMuted"
              className="font-semibold uppercase tracking-wider text-[11px] mt-0.5"
            >
              Factory Control Center
            </ThemedText>
          </View>
          <Pressable
            className="w-12 h-12 rounded-full bg-brand-glass border border-brand-glass justify-center items-center shadow-sm active:opacity-70"
            onPress={() => setShowSettingsModal(true)}
          >
            <SettingsIcon size={22} color="#000000" />
          </Pressable>
        </View>

        {store.isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#412D15" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingBottom: Platform.OS === "ios" ? 120 : 100,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Filters Bar */}
            <View
              style={{
                flexDirection: "row",
                gap: 6,
                marginBottom: 16,
                backgroundColor: "rgba(255,255,255,0.30)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.20)",
                borderRadius: 999,
                padding: 6,
              }}
            >
              {(
                [
                  "daily",
                  "weekly",
                  "monthly",
                  "yearly",
                  "custom",
                ] as DateFilter[]
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
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                {/* Start Date */}
                <Pressable
                  onPress={() => setShowStartPicker(true)}
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
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: customStartDate ? "#1F150C" : "#999",
                    }}
                  >
                    {customStartDate || "Tap to select"}
                  </Text>
                </Pressable>

                {/* End Date */}
                <Pressable
                  onPress={() => setShowEndPicker(true)}
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
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: customEndDate ? "#1F150C" : "#999",
                    }}
                  >
                    {customEndDate || "Tap to select"}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Start Date Picker - MiniCalendar */}
            <MiniCalendar
              visible={showStartPicker}
              title="Select Start Date"
              selectedDate={startDateObj}
              maximumDate={new Date()}
              onCancel={() => setShowStartPicker(false)}
              onConfirm={(date) => {
                setStartDateObj(date);
                setCustomStartDate(toLocalDateStr(date));
                setShowStartPicker(false);
                // Reset end date if it's before new start
                if (endDateObj < date) {
                  setEndDateObj(date);
                  setCustomEndDate(toLocalDateStr(date));
                }
              }}
            />

            {/* End Date Picker - MiniCalendar */}
            <MiniCalendar
              visible={showEndPicker}
              title="Select End Date"
              selectedDate={endDateObj}
              minimumDate={startDateObj}
              maximumDate={new Date()}
              onCancel={() => setShowEndPicker(false)}
              onConfirm={(date) => {
                setEndDateObj(date);
                setCustomEndDate(toLocalDateStr(date));
                setShowEndPicker(false);
              }}
            />

            {/* Core KPI Cards Grid */}
            <View className="flex-row flex-wrap gap-4 mb-6">
              {/* Gross Sales */}
              <GlassCard
                variant="card"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: "#412D15",
                  overflow: "hidden",
                }}
                className="w-[47%] flex-grow min-h-[105px] justify-between"
              >
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  className="font-semibold"
                >
                  Gross Sales
                </ThemedText>
                <ThemedText
                  type="subtitle"
                  className="text-brand-primary text-[22px] font-extrabold mt-2"
                >
                  {store.settings.currency} {grossSales.toLocaleString()}
                </ThemedText>
              </GlassCard>

              {/* Discounts */}
              <GlassCard
                variant="card"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: "#412D15",
                  overflow: "hidden",
                }}
                className="w-[47%] flex-grow min-h-[105px] justify-between"
              >
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  className="font-semibold"
                >
                  Discounts Given
                </ThemedText>
                <ThemedText
                  type="subtitle"
                  className="text-brand-warning text-[22px] font-extrabold mt-2"
                >
                  {store.settings.currency} {discountsGiven.toLocaleString()}
                </ThemedText>
              </GlassCard>

              {/* Net Sales */}
              <GlassCard
                variant="card"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: "#412D15",
                  overflow: "hidden",
                }}
                className="w-[47%] flex-grow min-h-[105px] justify-between"
              >
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  className="font-semibold"
                >
                  Net Sales (Revenue)
                </ThemedText>
                <ThemedText
                  type="subtitle"
                  className="text-brand-primary text-[22px] font-extrabold mt-2"
                >
                  {store.settings.currency} {netSales.toLocaleString()}
                </ThemedText>
              </GlassCard>

              {/* Net Profit / Loss */}
              <GlassCard
                variant="card"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: isLoss ? "#F4A300" : "#412D15",
                  overflow: "hidden",
                }}
                className="w-[47%] flex-grow min-h-[105px] justify-between"
              >
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  className="font-semibold"
                >
                  Net Profit / Loss
                </ThemedText>
                <ThemedText
                  type="subtitle"
                  className={`text-[22px] font-extrabold mt-2 ${isLoss ? "text-brand-warning" : "text-brand-primary"}`}
                >
                  {store.settings.currency} {profit.toLocaleString()}
                </ThemedText>
              </GlassCard>

              {/* Inventory Valuation */}
              <GlassCard
                variant="card"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: "#412D15",
                  overflow: "hidden",
                }}
                className="w-[47%] flex-grow min-h-[105px] justify-between"
              >
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  className="font-semibold"
                >
                  Inventory Value
                </ThemedText>
                <ThemedText
                  type="subtitle"
                  className="text-brand-primary text-[22px] font-extrabold mt-2"
                >
                  {store.settings.currency} {inventoryValue.toLocaleString()}
                </ThemedText>
              </GlassCard>

              {/* Active Invoices */}
              <GlassCard
                variant="card"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: "#412D15",
                  overflow: "hidden",
                }}
                className="w-[47%] flex-grow min-h-[105px] justify-between"
              >
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  className="font-semibold"
                >
                  Active Invoices
                </ThemedText>
                <ThemedText
                  type="subtitle"
                  className="text-brand-primary text-[22px] font-extrabold mt-2"
                >
                  {activeInvoices.length} orders
                </ThemedText>
              </GlassCard>
            </View>

            {/* Chart Section */}
            <GlassCard
              variant="cardStrong"
              style={{ borderRadius: 32, overflow: "hidden", padding: 0 }}
              className="mb-6"
            >
              {/* Inner white rounded box — contains header + chart */}
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
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: "#1F150C",
                    }}
                  >
                    Revenue Analytics Graph
                  </Text>
                </View>
                {renderMiniChart()}
              </View>
            </GlassCard>

            {/* Low Stock Alerts */}
            {lowStockProducts.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <View
                  style={{
                    backgroundColor: "rgba(244,163,0,0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(244,163,0,0.25)",
                    borderRadius: 32,
                    padding: 0,
                  }}
                >
                  {/* Header */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 16,
                      paddingBottom: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: "rgba(244,163,0,0.15)",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <WarningIcon size={20} color="#F4A300" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#B07820",
                        }}
                      >
                        Low Stock Alert
                      </Text>
                      <Text
                        style={{ fontSize: 11, color: "#B07820", marginTop: 1 }}
                      >
                        {lowStockProducts.length} items need restocking
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: "rgba(244,163,0,0.2)",
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#B07820",
                        }}
                      >
                        {lowStockProducts.length}
                      </Text>
                    </View>
                  </View>
                  {/* Inner white box */}
                  <View
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: 24,
                      marginHorizontal: 8,
                      marginBottom: 8,
                      padding: 12,
                      gap: 6,
                    }}
                  >
                    {lowStockProducts.slice(0, 3).map((p) => (
                      <View
                        key={p.code}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          backgroundColor: "rgba(244,163,0,0.05)",
                          borderRadius: 14,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
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
                              color: "#A0693A",
                              marginTop: 1,
                            }}
                          >
                            Code: {p.code}
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: "rgba(214,69,69,0.1)",
                            borderRadius: 10,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color: "#F4A300",
                            }}
                          >
                            {p.currentStock}/{p.minStockAlert} {p.unitType}
                          </Text>
                        </View>
                      </View>
                    ))}
                    {lowStockProducts.length > 3 && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: "#A0693A",
                          fontWeight: "600",
                          paddingHorizontal: 4,
                          paddingTop: 4,
                        }}
                      >
                        + {lowStockProducts.length - 3} more · Check Inventory
                        tab
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Dead Stock Check */}
            {deadStockProducts.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <View
                  style={{
                    backgroundColor: "rgba(65,45,21,0.06)",
                    borderWidth: 1,
                    borderColor: "rgba(65,45,21,0.15)",
                    borderRadius: 32,
                  }}
                >
                  {/* Header */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 16,
                      paddingBottom: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: "rgba(65,45,21,0.10)",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <WarningIcon size={20} color="#412D15" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#1F150C",
                        }}
                      >
                        Dead Stock Monitor
                      </Text>
                      <Text
                        style={{ fontSize: 11, color: "#A0693A", marginTop: 1 }}
                      >
                        No sales in 30+ days
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: "rgba(65,45,21,0.12)",
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#412D15",
                        }}
                      >
                        {deadStockProducts.length}
                      </Text>
                    </View>
                  </View>
                  {/* Inner white box */}
                  <View
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: 24,
                      marginHorizontal: 8,
                      marginBottom: 8,
                      padding: 12,
                      gap: 6,
                    }}
                  >
                    {deadStockProducts.slice(0, 3).map((p) => (
                      <View
                        key={p.code}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          backgroundColor: "rgba(65,45,21,0.03)",
                          borderRadius: 14,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
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
                              color: "#A0693A",
                              marginTop: 1,
                            }}
                          >
                            Code: {p.code}
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: "rgba(65,45,21,0.08)",
                            borderRadius: 10,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color: "#412D15",
                            }}
                          >
                            {p.currentStock} {p.unitType}
                          </Text>
                        </View>
                      </View>
                    ))}
                    {deadStockProducts.length > 3 && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: "#A0693A",
                          fontWeight: "600",
                          paddingHorizontal: 4,
                          paddingTop: 4,
                        }}
                      >
                        + {deadStockProducts.length - 3} more stagnant products
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Top Selling Products */}
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
                  Top Selling Products
                </Text>
                {topSelling.length === 0 ? (
                  <View style={{ padding: 16, alignItems: "center" }}>
                    <Text style={{ fontSize: 13, color: "#A0693A" }}>
                      No product sales recorded yet.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {topSelling.map((p, idx) => (
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
                            width: 30,
                            height: 30,
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
                              fontSize: 13,
                              fontWeight: "700",
                              color: "#1F150C",
                            }}
                          >
                            {store.settings.currency}{" "}
                            {p.revenue.toLocaleString()}
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              color: "#A0693A",
                              marginTop: 1,
                            }}
                          >
                            Qty: {p.quantity}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </GlassCard>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Settings & DB Backup Modal */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View className="flex-1 justify-end bg-brand-primary/40">
          <View className="bg-brand-surface rounded-t-[32px] p-6 max-h-[85%] border-t border-brand-glass shadow-lg">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-5">
              <ThemedText
                type="subtitle"
                className="text-brand-primary text-xl font-bold"
              >
                ERP System Settings
              </ThemedText>
              <Pressable
                className="w-10 h-10 rounded-full bg-brand-glass border border-brand-glass justify-center items-center active:opacity-75"
                onPress={() => setShowSettingsModal(false)}
              >
                <CloseIcon size={20} color="#000000" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Factory Info */}
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 24,
                  padding: 16,
                  marginBottom: 16,
                  shadowColor: "#412D15",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <ThemedText
                  type="smallBold"
                  className="text-brand-accent text-sm uppercase tracking-wide mb-3"
                >
                  Factory Configuration
                </ThemedText>

                <View className="mb-4">
                  <ThemedText
                    type="small"
                    className="text-brand-secondary font-semibold mb-1"
                  >
                    Factory Name
                  </ThemedText>
                  <TextInput
                    className="h-12 border border-brand-glass rounded-2xl px-4 text-brand-primary text-sm font-inter"
                    style={{ backgroundColor: "#F5F1E8" }}
                    value={factoryName}
                    onChangeText={setFactoryName}
                    placeholder="Enter factory name"
                    placeholderTextColor="#999"
                  />
                </View>

                <View className="mb-4">
                  <ThemedText
                    type="small"
                    className="text-brand-secondary font-semibold mb-1"
                  >
                    Currency Symbol
                  </ThemedText>
                  <TextInput
                    className="h-12 border border-brand-glass rounded-2xl px-4 text-brand-primary text-sm font-inter"
                    style={{ backgroundColor: "#F5F1E8" }}
                    value={currency}
                    onChangeText={setCurrency}
                    placeholder="PKR, $, EUR, etc."
                    placeholderTextColor="#999"
                  />
                </View>

                <View className="mb-4">
                  <ThemedText
                    type="small"
                    className="text-brand-secondary font-semibold mb-1"
                  >
                    Tax Percentage (%)
                  </ThemedText>
                  <TextInput
                    className="h-12 border border-brand-glass rounded-2xl px-4 text-brand-primary text-sm font-inter"
                    style={{ backgroundColor: "#F5F1E8" }}
                    value={taxPercent}
                    onChangeText={setTaxPercent}
                    keyboardType="numeric"
                    placeholder="e.g. 17"
                    placeholderTextColor="#999"
                  />
                </View>

                <View className="mb-5">
                  <ThemedText
                    type="small"
                    className="text-brand-secondary font-semibold mb-1"
                  >
                    Receipt Footer Note
                  </ThemedText>
                  <TextInput
                    className="h-12 border border-brand-glass rounded-2xl px-4 text-brand-primary text-sm font-inter"
                    style={{ backgroundColor: "#F5F1E8" }}
                    value={receiptFooter}
                    onChangeText={setReceiptFooter}
                    placeholder="Thanks for choosing us"
                    placeholderTextColor="#999"
                  />
                </View>

                <Pressable
                  className="flex-row h-12 rounded-2xl justify-center items-center gap-2 shadow-sm active:opacity-85"
                  style={{ backgroundColor: "#412D15" }}
                  onPress={handleSaveSettings}
                >
                  <CheckIcon size={18} color="#FAF8F3" />
                  <Text className="text-brand-cream font-bold text-sm">
                    Save Configurations
                  </Text>
                </Pressable>
              </View>

              {/* Data Backup & Restore */}
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 24,
                  padding: 16,
                  marginBottom: 16,
                  shadowColor: "#412D15",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <ThemedText
                  type="smallBold"
                  className="text-brand-accent-sec text-sm uppercase tracking-wide mb-2"
                >
                  Backup & Disaster Recovery
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  className="mb-3 leading-relaxed"
                >
                  Export database state as a JSON string, or restore it. Ideal
                  for transferring data or offline backups.
                </ThemedText>

                <TextInput
                  className="border border-brand-glass rounded-2xl px-4 py-3 text-xs h-28 text-brand-primary font-mono text-left"
                  style={{
                    backgroundColor: "#F5F1E8",
                    textAlignVertical: "top",
                  }}
                  multiline
                  numberOfLines={4}
                  value={backupJson}
                  onChangeText={setBackupJson}
                  placeholder="Paste backup JSON string here to restore, or click export below to generate one."
                  placeholderTextColor="#999"
                />

                <View className="flex-row gap-4 mt-4">
                  <Pressable
                    className="flex-1 flex-row bg-brand-accent h-11 rounded-2xl justify-center items-center gap-2 shadow-sm active:opacity-85"
                    onPress={handleBackup}
                  >
                    <DatabaseIcon size={16} color="#FAF8F3" />
                    <Text className="text-brand-cream font-bold text-[13px]">
                      Export Backup
                    </Text>
                  </Pressable>

                  <Pressable
                    className="flex-1 flex-row bg-brand-accent-sec h-11 rounded-2xl justify-center items-center gap-2 shadow-sm active:opacity-85"
                    onPress={handleRestore}
                  >
                    <PlusIcon size={16} color="#FAF8F3" />
                    <Text className="text-brand-cream font-bold text-[13px]">
                      Restore Data
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>

          {/* Confirm/Alert overlay — rendered inside this modal to avoid nested Modal issues on iOS */}
          {modalVisible && (
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
              }}
              onPress={() => setModalVisible(false)}
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
                <Pressable
                  onPress={() => setModalVisible(false)}
                  style={({ pressed }) => ({
                    width: "100%",
                    height: 44,
                    borderRadius: 14,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor:
                      modalVariant === "error"
                        ? "#D32F2F"
                        : modalVariant === "warning"
                          ? "#F4A300"
                          : "#412D15",
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
                    OK
                  </Text>
                </Pressable>
              </Pressable>
            </Pressable>
          )}
        </View>
      </Modal>

      {/* Root ConfirmModal for when the Settings Modal is closed */}
      <ConfirmModal
        visible={modalVisible && !showSettingsModal}
        onClose={() => setModalVisible(false)}
        variant={modalVariant}
        title={modalTitle}
        message={modalMessage}
      />
    </GradientBg>
  );
}
