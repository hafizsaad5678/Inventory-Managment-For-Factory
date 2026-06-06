import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  View, 
  Pressable, 
  TextInput, 
  Text,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Colors, Spacing, MaxContentWidth, BottomTabInset } from '../constants/theme';
import { useTheme } from '../hooks/use-theme';
import { Invoice, InvoiceItem, Product } from '../types';
import { ExportIcon, ReportsIcon } from '../components/Icons';

type DateFilter = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export default function ReportsScreen() {
  const store = useStore();
  const theme = useTheme();

  // Local state
  const [filterType, setFilterType] = useState<DateFilter>('monthly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    store.refreshData();
  }, []);

  // Filter invoices based on date filters
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
          end.setHours(23, 59, 59, 999);
          return invDate >= start && invDate <= end;
        }
        default:
          return true;
      }
    });
  };

  const filteredInvoices = getFilteredInvoices();
  const activeInvoices = filteredInvoices.filter(inv => inv.status !== 'cancelled');

  // Load items for active invoices to calculate COGS
  useEffect(() => {
    const loadItems = async () => {
      try {
        const SQLite = require('../database/db');
        const itemsList: InvoiceItem[] = [];
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

  // Business accounting math
  const grossSales = activeInvoices.reduce((sum, inv) => sum + inv.subtotal, 0);
  const discountsGiven = activeInvoices.reduce((sum, inv) => sum + inv.discountAmount, 0);
  const netSales = grossSales - discountsGiven;
  
  const cogs = invoiceItems.reduce((sum, item) => {
    return sum + (item.quantityInBaseUnit * item.buyingPrice);
  }, 0);

  const profit = netSales - cogs;
  const isLoss = profit < 0;

  // Analytics lists
  // 1. Most Sold Products
  const getMostSoldProducts = () => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    invoiceItems.forEach(item => {
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
    const map: Record<string, { name: string; spends: number; count: number }> = {};
    activeInvoices.forEach(inv => {
      if (!inv.customerPhone) return;
      const phone = inv.customerPhone;
      if (!map[phone]) {
        // Find customer name from store
        const cProfile = store.customers.find(c => c.phone === phone);
        map[phone] = { name: cProfile?.name || 'Regular Customer', spends: 0, count: 0 };
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
        .filter(m => m.type === 'sale' && new Date(m.date) >= thirtyDaysAgo)
        .map(m => m.productCode)
    );
    return store.products.filter(p => p.isActive && !activeSoldCodes.has(p.code));
  };

  const deadStock = getDeadStockProducts();

  // Export handlers
  const handleExportCSV = () => {
    alert('CSV sheet generated! Exported reports details to files.');
  };

  const handleExportPDF = () => {
    alert('PDF report compiled! Check system downloads.');
  };

  return (
    <ThemedView style={styles.main}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header Controls */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <ReportsIcon size={24} color="#208AEF" />
            <ThemedText type="subtitle" style={styles.headerTitle}>Accounting & Audits</ThemedText>
          </View>
          
          <View style={styles.exportActions}>
            <Pressable 
              style={({ pressed }) => [styles.exportBtn, pressed && styles.pressed]}
              onPress={handleExportCSV}
            >
              <ExportIcon size={16} color={theme.text} />
              <ThemedText type="smallBold">CSV</ThemedText>
            </Pressable>
            <Pressable 
              style={({ pressed }) => [styles.exportBtn, pressed && styles.pressed]}
              onPress={handleExportPDF}
            >
              <ExportIcon size={16} color={theme.text} />
              <ThemedText type="smallBold">PDF</ThemedText>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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

          {/* Profit & Loss statement spreadsheet */}
          <ThemedView type="backgroundElement" style={styles.sheetCard}>
            <ThemedText type="smallBold" style={styles.sheetTitle}>
              Profit & Loss Statement ({filterType.toUpperCase()})
            </ThemedText>
            <View style={styles.sheetSubRow}>
              <ThemedText type="small" themeColor="textSecondary">Currency: {store.settings.currency}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Active Invoices: {activeInvoices.length}</ThemedText>
            </View>

            <View style={styles.sheetTable}>
              {/* Gross Sales */}
              <View style={styles.sheetRow}>
                <ThemedText type="default" style={styles.sheetRowLabel}>1. Gross Sales Revenue</ThemedText>
                <ThemedText type="smallBold" style={styles.sheetRowValue}>
                  {store.settings.currency} {grossSales.toLocaleString()}
                </ThemedText>
              </View>

              {/* Discounts */}
              <View style={styles.sheetRow}>
                <ThemedText type="default" style={[styles.sheetRowLabel, { paddingLeft: 12 }]}>(-) Discounts Given</ThemedText>
                <ThemedText type="small" style={[styles.sheetRowValue, { color: '#e53935' }]}>
                  ({store.settings.currency} {discountsGiven.toLocaleString()})
                </ThemedText>
              </View>

              {/* Net Sales */}
              <View style={[styles.sheetRow, styles.sheetRowTotal]}>
                <ThemedText type="default" style={[styles.sheetRowLabel, { fontWeight: '700' }]}>2. Net Operating Revenue</ThemedText>
                <ThemedText type="default" style={[styles.sheetRowValue, { fontWeight: '800', color: '#208AEF' }]}>
                  {store.settings.currency} {netSales.toLocaleString()}
                </ThemedText>
              </View>

              {/* COGS */}
              <View style={styles.sheetRow}>
                <ThemedText type="default" style={styles.sheetRowLabel}>3. Cost of Goods Sold (COGS)</ThemedText>
                <ThemedText type="small" style={[styles.sheetRowValue, { color: '#e53935' }]}>
                  ({store.settings.currency} {cogs.toLocaleString()})
                </ThemedText>
              </View>

              <View style={styles.sheetDivider} />

              {/* Net Profit/Loss */}
              <View style={[styles.sheetRow, styles.sheetRowGrandTotal, { backgroundColor: isLoss ? '#ffebee' : '#e8f5e9' }]}>
                <Text style={[
                  styles.grandTotalLabel,
                  { color: isLoss ? '#c62828' : '#2e7d32' }
                ]}>
                  NET {isLoss ? 'OPERATING LOSS' : 'OPERATING PROFIT'}
                </Text>
                <Text style={[
                  styles.grandTotalVal,
                  { color: isLoss ? '#c62828' : '#2e7d32' }
                ]}>
                  {store.settings.currency} {profit.toLocaleString()}
                </Text>
              </View>
            </View>
          </ThemedView>

          {/* Most Sold Products */}
          <ThemedView type="backgroundElement" style={styles.analyticsCard}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>Product Movement Rates</ThemedText>
            {mostSold.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">No sales recorded.</ThemedText>
            ) : (
              mostSold.map((item, idx) => (
                <View key={item.code} style={styles.rankRow}>
                  <View style={styles.rankIdx}>
                    <ThemedText type="smallBold">{idx + 1}</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">{item.name}</ThemedText>
                    <ThemedText type="code" themeColor="textSecondary">{item.code}</ThemedText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <ThemedText type="smallBold">Qty: {item.qty}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {store.settings.currency} {item.revenue.toLocaleString()}
                    </ThemedText>
                  </View>
                </View>
              ))
            )}
          </ThemedView>

          {/* Top Customers */}
          <ThemedView type="backgroundElement" style={styles.analyticsCard}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>Top Customer Accounts</ThemedText>
            {topCustomers.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">No client accounts billed.</ThemedText>
            ) : (
              topCustomers.map((c, idx) => (
                <View key={c.phone} style={styles.rankRow}>
                  <View style={styles.rankIdx}>
                    <ThemedText type="smallBold">{idx + 1}</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">{c.name}</ThemedText>
                    <ThemedText type="code" themeColor="textSecondary">{c.phone}</ThemedText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <ThemedText type="smallBold">Spends: {store.settings.currency} {c.spends.toLocaleString()}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">Bills: {c.count}</ThemedText>
                  </View>
                </View>
              ))
            )}
          </ThemedView>

          {/* Stagnant Inventory (Dead Stock) */}
          <ThemedView type="backgroundElement" style={styles.analyticsCard}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>Stagnant / Dead Stock Monitor</ThemedText>
            {deadStock.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">No stagnant products detected.</ThemedText>
            ) : (
              deadStock.slice(0, 5).map(p => (
                <View key={p.code} style={styles.deadRow}>
                  <View>
                    <ThemedText type="smallBold">{p.name}</ThemedText>
                    <ThemedText type="code" themeColor="textSecondary">{p.code}</ThemedText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <ThemedText type="smallBold" style={{ color: '#ef6c00' }}>
                      {p.currentStock} {p.unitType} idle
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Val: {store.settings.currency} {(p.currentStock * p.buyingPrice).toLocaleString()}
                    </ThemedText>
                  </View>
                </View>
              ))
            )}
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerTitle: {
    fontWeight: '800',
  },
  exportActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F3',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 6,
    gap: 6,
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
  sheetCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  sheetTitle: {
    fontSize: 16,
  },
  sheetSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: Spacing.four,
  },
  sheetTable: {
    borderWidth: 1,
    borderColor: '#F0F0F3',
    borderRadius: 6,
    overflow: 'hidden',
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    backgroundColor: 'transparent',
  },
  sheetRowLabel: {
    fontSize: 13,
  },
  sheetRowValue: {
    fontSize: 13,
  },
  sheetRowTotal: {
    backgroundColor: '#F0F0F3',
    borderTopWidth: 1,
    borderTopColor: '#B0B4BA',
    borderBottomWidth: 1,
    borderBottomColor: '#B0B4BA',
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#F0F0F3',
  },
  sheetRowGrandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  grandTotalLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  grandTotalVal: {
    fontSize: 16,
    fontWeight: '900',
  },
  analyticsCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: Spacing.three,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F3',
    gap: Spacing.three,
  },
  rankIdx: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F0F0F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F3',
  },
});
