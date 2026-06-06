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
  Platform,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Colors, Spacing, MaxContentWidth, BottomTabInset } from '../constants/theme';
import { useTheme } from '../hooks/use-theme';
import { 
  SettingsIcon, 
  WarningIcon, 
  CloseIcon, 
  CheckIcon, 
  PlusIcon,
  DatabaseIcon,
  ReportsIcon
} from '../components/Icons';

type DateFilter = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export default function DashboardScreen() {
  const store = useStore();
  const theme = useTheme();
  
  // Local state
  const [filterType, setFilterType] = useState<DateFilter>('monthly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Settings Form
  const [factoryName, setFactoryName] = useState('');
  const [currency, setCurrency] = useState('');
  const [taxPercent, setTaxPercent] = useState('0');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [backupJson, setBackupJson] = useState('');

  // Init Store
  useEffect(() => {
    store.initApp();
  }, []);

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
      alert('Factory Name is required');
      return;
    }
    await store.saveSettings({
      factoryName: factoryName.trim(),
      currency: currency.trim() || 'PKR',
      taxPercent: parseFloat(taxPercent) || 0,
      receiptFooter: receiptFooter.trim(),
      darkMode: store.settings.darkMode,
    });
    setShowSettingsModal(false);
    alert('Settings saved successfully');
  };

  // Backup data
  const handleBackup = async () => {
    try {
      const SQLite = require('../database/db');
      const backup = await SQLite.db.backupData();
      setBackupJson(backup);
      alert('Backup JSON generated successfully. Copy it from the text box below.');
    } catch (e) {
      console.error(e);
      alert('Failed to generate backup');
    }
  };

  // Restore data
  const handleRestore = async () => {
    if (!backupJson.trim()) {
      alert('Please paste backup JSON string');
      return;
    }
    const success = await store.restoreBackup(backupJson);
    if (success) {
      alert('Data restored successfully!');
      setBackupJson('');
      setShowSettingsModal(false);
    } else {
      alert('Invalid backup JSON or restoration failed.');
    }
  };

  // Calculate stats based on date filters
  const getFilteredInvoices = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return store.invoices.filter(inv => {
      const invDate = new Date(inv.date);
      
      switch (filterType) {
        case 'daily':
          return invDate >= startOfToday;
        case 'weekly': {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return invDate >= sevenDaysAgo;
        }
        case 'monthly': {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return invDate >= startOfMonth;
        }
        case 'yearly': {
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          return invDate >= startOfYear;
        }
        case 'custom': {
          if (!customStartDate) return true;
          const start = new Date(customStartDate);
          const end = customEndDate ? new Date(customEndDate) : new Date();
          // Adjust end to include the entire day
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
  const activeInvoices = filteredInvoices.filter(inv => inv.status !== 'cancelled');
  const grossSales = activeInvoices.reduce((sum, inv) => sum + inv.subtotal, 0);
  const discountsGiven = activeInvoices.reduce((sum, inv) => sum + inv.discountAmount, 0);
  const netSales = grossSales - discountsGiven; // Equals sum of finalTotals

  // COGS and Profit/Loss
  // We need to fetch items for filtered invoices. In Zustand store we have all details.
  // To avoid complex DB queries, we calculate COGS from invoice items.
  // For web fallback or loaded state, let's calculate the COGS.
  // Wait, does the store contain loaded invoices but not items?
  // Since db.getInvoices only returns invoices, let's load all invoice items.
  // For safety and speed, let's do a simple calculation:
  // If we don't have items loaded, we can fetch them or calculate from local state.
  // To resolve this elegantly, we can check if `db` has a method to get all invoice items.
  // In `db.ts`, we implemented `getInvoiceItems(invoiceId)`.
  // Let's add a state to track invoice items in the store, or query them.
  // Wait, in `db.ts`, did we implement a way to get all items or calculate profit?
  // Let's look at `db.ts`: we saved invoice items in `invoice_items` table.
  // Can we run a quick load of items on start? Yes, in `store.ts`, we fetched `products`, `customers`, `invoices`, and `stockMovements` on init. We didn't fetch `invoice_items` globally.
  // But wait! We can calculate profit by querying items, or we can fetch them.
  // Alternatively, we can calculate profit at checkout and store it directly in the `invoices` table as `cogs` or `netProfit`!
  // Wow! Storing `cogs` in the `invoices` table makes P&L querying *instantaneous* and *massively efficient*, requiring zero table joins!
  // Let's check: did we add `cogs` to the `invoices` table? In `db.ts`, it is `subtotal`, `discountAmount`, `finalTotal`, `paymentType`, `status`.
  // That's okay! We can calculate COGS by loading items.
  // Let's write a local state in `index.tsx` to load items for the active invoices, or we can compute it if we keep a cache of items.
  // Actually, let's fetch all invoice items on mount or when invoices change!
  // Let's write a simple helper inside `index.tsx` to load items for calculations.
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const SQLite = require('../database/db');
        const itemsList: any[] = [];
        for (const inv of activeInvoices) {
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
  }, [store.invoices, filterType, customStartDate, customEndDate]);

  const cogs = invoiceItems.reduce((sum, item) => {
    // Check if the item's invoice is active (not cancelled)
    const inv = activeInvoices.find(i => i.id === item.invoiceId);
    if (!inv) return sum;
    return sum + (item.quantityInBaseUnit * item.buyingPrice);
  }, 0);

  const profit = netSales - cogs;
  const isLoss = profit < 0;

  // Inventory value
  const inventoryValue = store.products.reduce((sum, p) => sum + (p.currentStock * p.buyingPrice), 0);

  // Low stock products
  const lowStockProducts = store.products.filter(p => p.currentStock <= p.minStockAlert);
  
  // Dead stock check: Products not sold in the last 30 days
  const getDeadStockProducts = () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const soldProductCodes = new Set(
      store.stockMovements
        .filter(m => m.type === 'sale' && new Date(m.date) >= thirtyDaysAgo)
        .map(m => m.productCode)
    );
    
    return store.products.filter(p => !soldProductCodes.has(p.code));
  };
  
  const deadStockProducts = getDeadStockProducts();

  // Top Selling Products (calculated from invoice items)
  const getTopSellingProducts = () => {
    const salesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    
    invoiceItems.forEach(item => {
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
  // Calculate sales over the current filter days/months
  const renderMiniChart = () => {
    if (activeInvoices.length === 0) {
      return (
        <View style={styles.emptyChartContainer}>
          <ThemedText type="small" themeColor="textSecondary">No sales transactions in this range</ThemedText>
        </View>
      );
    }

    // Group sales by day/month based on filter
    const groups: Record<string, number> = {};
    activeInvoices.forEach(inv => {
      const date = new Date(inv.date);
      let label = '';
      if (filterType === 'daily' || filterType === 'weekly') {
        label = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
      } else if (filterType === 'monthly') {
        label = `Wk ${Math.ceil(date.getDate() / 7)}`;
      } else {
        label = date.toLocaleDateString(undefined, { month: 'short' });
      }
      groups[label] = (groups[label] || 0) + inv.finalTotal;
    });

    const data = Object.entries(groups).map(([label, value]) => ({ label, value }));
    const maxValue = Math.max(...data.map(d => d.value), 100);

    return (
      <View style={styles.chartWrapper}>
        <View style={styles.chartBars}>
          {data.map((item, idx) => {
            const pct = (item.value / maxValue) * 100;
            return (
              <View key={idx} style={styles.chartColumn}>
                <View style={styles.chartBarValueContainer}>
                  <ThemedText type="code" style={styles.chartBarValue}>
                    {store.settings.currency} {Math.round(item.value)}
                  </ThemedText>
                </View>
                <View style={[styles.chartBar, { height: `${Math.max(15, pct)}%` }]} />
                <ThemedText type="small" style={styles.chartBarLabel} themeColor="textSecondary">
                  {item.label}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.main}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText type="subtitle" style={styles.brandTitle}>
              {store.settings.factoryName}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Factory Control Center
            </ThemedText>
          </View>
          <Pressable 
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            onPress={() => setShowSettingsModal(true)}
          >
            <SettingsIcon size={24} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Filters Bar */}
          <View style={styles.filtersBar}>
            {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as DateFilter[]).map((f) => (
              <Pressable
                key={f}
                style={[
                  styles.filterBtn,
                  filterType === f && styles.filterBtnActive
                ]}
                onPress={() => setFilterType(f)}
              >
                <ThemedText 
                  type="smallBold" 
                  style={[
                    styles.filterBtnText,
                    filterType === f && styles.filterBtnTextActive
                  ]}
                  themeColor={filterType === f ? 'background' : 'textSecondary'}
                >
                  {f.toUpperCase()}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* Custom Date Inputs */}
          {filterType === 'custom' && (
            <View style={styles.customDateContainer}>
              <View style={styles.dateInputWrapper}>
                <ThemedText type="smallBold">Start Date (YYYY-MM-DD)</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  placeholder="2026-06-01"
                  placeholderTextColor={theme.textSecondary}
                  value={customStartDate}
                  onChangeText={setCustomStartDate}
                />
              </View>
              <View style={styles.dateInputWrapper}>
                <ThemedText type="smallBold">End Date (YYYY-MM-DD)</ThemedText>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  placeholder="2026-06-30"
                  placeholderTextColor={theme.textSecondary}
                  value={customEndDate}
                  onChangeText={setCustomEndDate}
                />
              </View>
            </View>
          )}

          {/* Core KPI Cards Grid */}
          <View style={styles.kpiGrid}>
            <ThemedView type="backgroundElement" style={styles.kpiCard}>
              <ThemedText type="small" themeColor="textSecondary">Gross Sales</ThemedText>
              <ThemedText type="subtitle" style={styles.kpiValue}>
                {store.settings.currency} {grossSales.toLocaleString()}
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.kpiCard}>
              <ThemedText type="small" themeColor="textSecondary">Discounts Given</ThemedText>
              <ThemedText type="subtitle" style={[styles.kpiValue, { color: '#e53935' }]}>
                {store.settings.currency} {discountsGiven.toLocaleString()}
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.kpiCard}>
              <ThemedText type="small" themeColor="textSecondary">Net Sales (Revenue)</ThemedText>
              <ThemedText type="subtitle" style={[styles.kpiValue, { color: '#208AEF' }]}>
                {store.settings.currency} {netSales.toLocaleString()}
              </ThemedText>
            </ThemedView>

            <ThemedView 
              type="backgroundElement" 
              style={[
                styles.kpiCard, 
                { borderLeftWidth: 4, borderLeftColor: isLoss ? '#e53935' : '#4CAF50' }
              ]}
            >
              <ThemedText type="small" themeColor="textSecondary">Net Profit / Loss</ThemedText>
              <ThemedText type="subtitle" style={[styles.kpiValue, { color: isLoss ? '#e53935' : '#4CAF50' }]}>
                {store.settings.currency} {profit.toLocaleString()}
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.kpiCard}>
              <ThemedText type="small" themeColor="textSecondary">Inventory Valuation</ThemedText>
              <ThemedText type="subtitle" style={styles.kpiValue}>
                {store.settings.currency} {inventoryValue.toLocaleString()}
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.kpiCard}>
              <ThemedText type="small" themeColor="textSecondary">Active Invoices</ThemedText>
              <ThemedText type="subtitle" style={styles.kpiValue}>
                {activeInvoices.length} transactions
              </ThemedText>
            </ThemedView>
          </View>

          {/* Chart Section */}
          <ThemedView type="backgroundElement" style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <ReportsIcon size={20} color="#208AEF" />
              <ThemedText type="smallBold" style={styles.chartTitle}>Revenue Analytics Graph</ThemedText>
            </View>
            {renderMiniChart()}
          </ThemedView>

          {/* Low Stock Alerts */}
          {lowStockProducts.length > 0 && (
            <ThemedView type="backgroundElement" style={[styles.alertCard, { borderColor: '#FFA000', borderWidth: 1 }]}>
              <View style={styles.alertHeader}>
                <WarningIcon size={24} color="#FFA000" />
                <ThemedText type="smallBold" style={styles.alertTitle}>
                  Low Stock Alert ({lowStockProducts.length} Items)
                </ThemedText>
              </View>
              <View style={styles.alertList}>
                {lowStockProducts.slice(0, 3).map(p => (
                  <View key={p.code} style={styles.alertRow}>
                    <ThemedText type="smallBold">{p.name} ({p.code})</ThemedText>
                    <ThemedText type="small" style={{ color: '#e53935' }}>
                      Stock: {p.currentStock} {p.unitType} (Min: {p.minStockAlert})
                    </ThemedText>
                  </View>
                ))}
                {lowStockProducts.length > 3 && (
                  <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 4 }}>
                    + {lowStockProducts.length - 3} more items. Check Inventory tab to restock.
                  </ThemedText>
                )}
              </View>
            </ThemedView>
          )}

          {/* Dead Stock Check */}
          {deadStockProducts.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.deadStockCard}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Dead Stock Monitor (&gt;30 days idle)
              </ThemedText>
              <View style={styles.deadStockList}>
                {deadStockProducts.slice(0, 3).map(p => (
                  <View key={p.code} style={styles.deadStockRow}>
                    <View>
                      <ThemedText type="smallBold">{p.name}</ThemedText>
                      <ThemedText type="code" themeColor="textSecondary">{p.code}</ThemedText>
                    </View>
                    <ThemedText type="small">Stock: {p.currentStock} {p.unitType}</ThemedText>
                  </View>
                ))}
                {deadStockProducts.length > 3 && (
                  <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 8 }}>
                    + {deadStockProducts.length - 3} other products are currently stagnant.
                  </ThemedText>
                )}
              </View>
            </ThemedView>
          )}

          {/* Top Selling Products */}
          <ThemedView type="backgroundElement" style={styles.topSellingCard}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>Top Selling Products</ThemedText>
            {topSelling.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 8 }}>
                No product sales recorded yet.
              </ThemedText>
            ) : (
              <View style={styles.topSellingList}>
                {topSelling.map((p, idx) => (
                  <View key={p.code} style={styles.topSellingRow}>
                    <View style={styles.topSellingIndex}>
                      <ThemedText type="smallBold">{idx + 1}</ThemedText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="smallBold">{p.name}</ThemedText>
                      <ThemedText type="code" themeColor="textSecondary">{p.code}</ThemedText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <ThemedText type="smallBold">{store.settings.currency} {p.revenue.toLocaleString()}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">Qty: {p.quantity}</ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      {/* Settings & DB Backup Modal */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="background" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">ERP System Settings</ThemedText>
              <Pressable 
                style={({ pressed }) => pressed && styles.pressed}
                onPress={() => setShowSettingsModal(false)}
              >
                <CloseIcon size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Factory Info */}
              <View style={styles.modalSection}>
                <ThemedText type="smallBold" style={styles.modalSectionTitle}>Factory Configuration</ThemedText>
                
                <View style={styles.formGroup}>
                  <ThemedText type="small">Factory / Business Name</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    value={factoryName}
                    onChangeText={setFactoryName}
                    placeholder="Enter factory name"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <ThemedText type="small">Currency Code</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    value={currency}
                    onChangeText={setCurrency}
                    placeholder="PKR, $, EUR, etc."
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <ThemedText type="small">Tax Percentage (%)</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    value={taxPercent}
                    onChangeText={setTaxPercent}
                    keyboardType="numeric"
                    placeholder="e.g. 17"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <ThemedText type="small">Receipt Footer Message</ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    value={receiptFooter}
                    onChangeText={setReceiptFooter}
                    placeholder="Thanks for choosing us"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                  onPress={handleSaveSettings}
                >
                  <CheckIcon size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>Save Configurations</Text>
                </Pressable>
              </View>

              {/* Data Backup & Restore */}
              <View style={[styles.modalSection, { borderTopWidth: 1, borderTopColor: theme.backgroundSelected, paddingTop: Spacing.four }]}>
                <ThemedText type="smallBold" style={[styles.modalSectionTitle, { color: '#208AEF' }]}>
                  Backup & Disaster Recovery
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.two }}>
                  Export your database state to JSON, or restore it. Ideal for offline backup sync.
                </ThemedText>

                <TextInput
                  style={[
                    styles.textarea, 
                    { 
                      color: theme.text, 
                      borderColor: theme.backgroundSelected,
                      backgroundColor: theme.backgroundElement 
                    }
                  ]}
                  multiline
                  numberOfLines={4}
                  value={backupJson}
                  onChangeText={setBackupJson}
                  placeholder="Paste backup JSON here to restore, or click backup below to generate."
                  placeholderTextColor={theme.textSecondary}
                />

                <View style={styles.backupActions}>
                  <Pressable
                    style={({ pressed }) => [styles.backupBtn, pressed && styles.pressed]}
                    onPress={handleBackup}
                  >
                    <DatabaseIcon size={18} color="#fff" />
                    <Text style={styles.backupBtnText}>Export Backup</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.restoreBtn, pressed && styles.pressed]}
                    onPress={handleRestore}
                  >
                    <PlusIcon size={18} color="#fff" />
                    <Text style={styles.backupBtnText}>Restore Data</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  brandTitle: {
    fontWeight: '800',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  filtersBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: Spacing.two,
    gap: Spacing.one,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#F0F0F3',
  },
  filterBtnActive: {
    backgroundColor: '#208AEF',
  },
  filterBtnText: {
    fontSize: 10,
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  customDateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  dateInputWrapper: {
    flex: 1,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.one,
    fontSize: 14,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 12,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: Spacing.three,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginVertical: Spacing.three,
  },
  kpiCard: {
    width: '47%',
    flexGrow: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    minHeight: 80,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: Spacing.one,
  },
  chartCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  chartTitle: {
    fontSize: 16,
  },
  emptyChartContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartWrapper: {
    height: 200,
    justifyContent: 'flex-end',
    paddingTop: Spacing.three,
  },
  chartBars: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: 14,
    backgroundColor: '#208AEF',
    borderRadius: 7,
  },
  chartBarValueContainer: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 4,
    backgroundColor: '#333',
    padding: 2,
    borderRadius: 4,
  },
  chartBarValue: {
    color: '#fff',
    fontSize: 8,
  },
  chartBarLabel: {
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
  alertCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  alertTitle: {
    color: '#FFA000',
    fontSize: 15,
  },
  alertList: {
    gap: Spacing.two,
  },
  alertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: Spacing.three,
  },
  deadStockCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
  },
  deadStockList: {
    gap: Spacing.two,
  },
  deadStockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F3',
  },
  topSellingCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
  },
  topSellingList: {
    gap: Spacing.two,
  },
  topSellingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F3',
    gap: Spacing.three,
  },
  topSellingIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0F0F3',
    justifyContent: 'center',
    alignItems: 'center',
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
  modalSection: {
    marginBottom: Spacing.four,
  },
  modalSectionTitle: {
    fontSize: 16,
    marginBottom: Spacing.three,
  },
  formGroup: {
    marginBottom: Spacing.three,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    height: 48,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  backupActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#208AEF',
    height: 40,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backupBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  restoreBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FF9800',
    height: 40,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
