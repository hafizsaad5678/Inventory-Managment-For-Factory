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
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Colors, Spacing, MaxContentWidth, BottomTabInset } from '../constants/theme';
import { useTheme } from '../hooks/use-theme';
import { Customer, Invoice, InvoiceItem } from '../types';
import { 
  SearchIcon, 
  CloseIcon, 
  CheckIcon, 
  WarningIcon, 
  TrashIcon, 
  ExportIcon 
} from '../components/Icons';

export default function CustomersScreen() {
  const store = useStore();
  const theme = useTheme();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  
  // Selected invoice overlay
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<InvoiceItem[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    store.refreshData();
  }, []);

  // Filter customers list
  const filteredCustomers = store.customers.filter(c => 
    c.phone.includes(searchQuery) || 
    (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Load selected customer's historical invoices
  const loadCustomerData = async (phone: string) => {
    const invs = store.invoices.filter(i => i.customerPhone === phone);
    setCustomerInvoices(invs);
  };

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerData(selectedCustomer.phone);
    }
  }, [selectedCustomer, store.invoices]);

  // Load items when an invoice is clicked
  const handleOpenInvoice = async (invoice: Invoice) => {
    try {
      const SQLite = require('../database/db');
      const items = await SQLite.db.getInvoiceItems(invoice.id);
      setSelectedInvoice(invoice);
      setSelectedInvoiceItems(items);
      setShowInvoiceModal(true);
    } catch (e) {
      console.error(e);
      alert('Failed to load invoice items');
    }
  };

  // Cancel/Refund an Invoice
  const handleCancelInvoice = (invoice: Invoice) => {
    Alert.alert(
      'Cancel Invoice',
      `Are you sure you want to cancel invoice ${invoice.invoiceNumber}? This will return all items to stock and deduct total purchase value from customer profile.`,
      [
        { text: 'No, Keep Invoice', style: 'cancel' },
        { 
          text: 'Yes, Cancel & Refund', 
          style: 'destructive',
          onPress: async () => {
            try {
              await store.cancelInvoice(invoice.id);
              
              // Refresh details
              if (selectedCustomer) {
                await loadCustomerData(selectedCustomer.phone);
                // update customer totals locally in modal
                const updatedCustomer = store.customers.find(c => c.phone === selectedCustomer.phone);
                if (updatedCustomer) setSelectedCustomer(updatedCustomer);
              }
              
              if (selectedInvoice && selectedInvoice.id === invoice.id) {
                const refreshedInv = store.invoices.find(i => i.id === invoice.id);
                if (refreshedInv) setSelectedInvoice(refreshedInv);
              }

              alert('Invoice cancelled successfully! Inventory restored.');
            } catch (err) {
              console.error(err);
              alert('Cancellation failed');
            }
          }
        }
      ]
    );
  };

  // Customer purchase behavior helper
  const getCustomerTopItems = () => {
    if (customerInvoices.length === 0) return 'No purchase history yet';
    // Load all items for these invoices
    // Since it's calculated on demand, we show brief description
    return 'Regular billing customer';
  };

  return (
    <ThemedView style={styles.main}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Search Bar */}
        <View style={styles.searchBarRow}>
          <View style={styles.searchWrapper}>
            <SearchIcon size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by customer phone, name..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Customer Profiles Scroll */}
        <ScrollView contentContainerStyle={styles.listScroll} showsVerticalScrollIndicator={false}>
          {filteredCustomers.length === 0 ? (
            <View style={styles.emptyView}>
              <ThemedText type="small" themeColor="textSecondary">No customer profiles found.</ThemedText>
            </View>
          ) : (
            filteredCustomers.map(c => (
              <Pressable
                key={c.phone}
                style={({ pressed }) => pressed && styles.pressed}
                onPress={() => setSelectedCustomer(c)}
              >
                <ThemedView type="backgroundElement" style={styles.customerCard}>
                  <View style={styles.cardHeader}>
                    <View>
                      <ThemedText type="smallBold">{c.name || 'Regular Customer'}</ThemedText>
                      <ThemedText type="code" themeColor="textSecondary">{c.phone}</ThemedText>
                    </View>
                    <ThemedView type="backgroundSelected" style={styles.visitTag}>
                      <Text style={[styles.visitTagText, { color: theme.text }]}>
                        Last Visit: {new Date(c.lastVisit).toLocaleDateString()}
                      </Text>
                    </ThemedView>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.statLine}>
                      <ThemedText type="small" themeColor="textSecondary">Purchases:</ThemedText>
                      <ThemedText type="smallBold" style={{ marginLeft: 4 }}>
                        {store.settings.currency} {c.totalPurchases.toLocaleString()}
                      </ThemedText>
                    </View>
                    <View style={styles.statLine}>
                      <ThemedText type="small" themeColor="textSecondary">Discount Given:</ThemedText>
                      <ThemedText type="smallBold" style={{ color: '#e53935', marginLeft: 4 }}>
                        {store.settings.currency} {c.totalDiscount.toLocaleString()}
                      </ThemedText>
                    </View>
                  </View>
                </ThemedView>
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Customer Detail History Modal */}
      <Modal
        visible={selectedCustomer !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedCustomer(null)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="background" style={[styles.modalContent, { maxHeight: '90%' }]}>
            {selectedCustomer && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <ThemedText type="subtitle">{selectedCustomer.name || 'Regular Customer'}</ThemedText>
                    <ThemedText type="code" themeColor="textSecondary">{selectedCustomer.phone}</ThemedText>
                  </View>
                  <Pressable onPress={() => {
                    setSelectedCustomer(null);
                    setCustomerInvoices([]);
                  }}>
                    <CloseIcon size={24} color={theme.text} />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* KPI boxes */}
                  <View style={styles.detailKpis}>
                    <ThemedView type="backgroundSelected" style={styles.kpiBox}>
                      <Text style={styles.kpiLabel}>Total Orders</Text>
                      <Text style={styles.kpiValue}>{customerInvoices.length}</Text>
                    </ThemedView>
                    <ThemedView type="backgroundSelected" style={styles.kpiBox}>
                      <Text style={styles.kpiLabel}>Total Spend</Text>
                      <Text style={styles.kpiValue}>
                        {store.settings.currency} {selectedCustomer.totalPurchases.toLocaleString()}
                      </Text>
                    </ThemedView>
                    <ThemedView type="backgroundSelected" style={styles.kpiBox}>
                      <Text style={styles.kpiLabel}>Savings Benefit</Text>
                      <Text style={[styles.kpiValue, { color: '#e53935' }]}>
                        {store.settings.currency} {selectedCustomer.totalDiscount.toLocaleString()}
                      </Text>
                    </ThemedView>
                  </View>

                  <View style={styles.behaviorSection}>
                    <ThemedText type="small">Last Visit Date: <ThemedText type="smallBold">{new Date(selectedCustomer.lastVisit).toLocaleString()}</ThemedText></ThemedText>
                    <ThemedText type="small" style={{ marginTop: 2 }}>Behavior: <ThemedText type="smallBold">{getCustomerTopItems()}</ThemedText></ThemedText>
                  </View>

                  {/* Previous Invoices list */}
                  <View style={styles.invoicesSection}>
                    <ThemedText type="smallBold" style={styles.sectionTitle}>Invoice History</ThemedText>
                    
                    {customerInvoices.length === 0 ? (
                      <ThemedText type="small" themeColor="textSecondary">No order history recorded.</ThemedText>
                    ) : (
                      customerInvoices.map(inv => (
                        <Pressable 
                          key={inv.id} 
                          style={({ pressed }) => [pressed && styles.pressed]}
                          onPress={() => handleOpenInvoice(inv)}
                        >
                          <ThemedView type="backgroundElement" style={styles.invoiceRow}>
                            <View>
                              <ThemedText type="smallBold">{inv.invoiceNumber}</ThemedText>
                              <ThemedText type="small" themeColor="textSecondary">
                                {new Date(inv.date).toLocaleDateString()}
                              </ThemedText>
                            </View>
                            
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <ThemedText type="smallBold" style={{ color: inv.status === 'cancelled' ? '#60646C' : '#208AEF' }}>
                                {store.settings.currency} {inv.finalTotal.toLocaleString()}
                              </ThemedText>
                              
                              <View style={[
                                styles.statusBadge,
                                { backgroundColor: inv.status === 'cancelled' ? '#ffebee' : '#e8f5e9' }
                              ]}>
                                <Text style={[
                                  styles.statusBadgeText,
                                  { color: inv.status === 'cancelled' ? '#c62828' : '#2e7d32' }
                                ]}>
                                  {inv.status.toUpperCase()}
                                </Text>
                              </View>
                            </View>
                          </ThemedView>
                        </Pressable>
                      ))
                    )}
                  </View>
                </ScrollView>
              </>
            )}
          </ThemedView>
        </View>
      </Modal>

      {/* Invoice Detail modal */}
      <Modal
        visible={showInvoiceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInvoiceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView type="background" style={[styles.modalContent, { maxWidth: 500 }]}>
            {selectedInvoice && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <ThemedText type="subtitle">Invoice details</ThemedText>
                    <ThemedText type="code" themeColor="textSecondary">{selectedInvoice.invoiceNumber}</ThemedText>
                  </View>
                  <Pressable onPress={() => setShowInvoiceModal(false)}>
                    <CloseIcon size={24} color={theme.text} />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.invoiceDetailCard}>
                    <Text style={styles.detailLabel}>Status: {selectedInvoice.status.toUpperCase()}</Text>
                    <Text style={styles.detailLabel}>Date: {new Date(selectedInvoice.date).toLocaleString()}</Text>
                    <Text style={styles.detailLabel}>Payment Mode: {selectedInvoice.paymentType}</Text>
                    
                    <View style={styles.divider} />

                    <View style={styles.itemsList}>
                      {selectedInvoiceItems.map(item => (
                        <View key={item.id} style={styles.itemRow}>
                          <Text style={[styles.itemText, { fontWeight: '700' }]}>{item.productName}</Text>
                          <Text style={styles.itemText}>{item.quantity} {item.unitSelected}</Text>
                          <Text style={[styles.itemText, { textAlign: 'right' }]}>
                            {store.settings.currency} {Math.round(item.subtotal)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.totalsGroup}>
                      <View style={styles.totalsRow}>
                        <Text style={styles.totalsLabel}>Gross subtotal:</Text>
                        <Text style={styles.totalsVal}>{store.settings.currency} {Math.round(selectedInvoice.subtotal)}</Text>
                      </View>
                      {selectedInvoice.discountAmount > 0 && (
                        <View style={styles.totalsRow}>
                          <Text style={[styles.totalsLabel, { color: '#e53935' }]}>Discount given:</Text>
                          <Text style={[styles.totalsVal, { color: '#e53935' }]}>
                            - {store.settings.currency} {Math.round(selectedInvoice.discountAmount)}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.totalsRow, { borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 4, marginTop: 4 }]}>
                        <Text style={[styles.totalsLabel, { fontWeight: '800' }]}>GRAND TOTAL:</Text>
                        <Text style={[styles.totalsVal, { fontWeight: '800' }]}>
                          {store.settings.currency} {selectedInvoice.finalTotal.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.invoiceActionsRow}>
                    {selectedInvoice.status !== 'cancelled' && (
                      <Pressable 
                        style={({ pressed }) => [styles.cancelInvoiceBtn, pressed && styles.pressed]}
                        onPress={() => handleCancelInvoice(selectedInvoice)}
                      >
                        <TrashIcon size={18} color="#fff" />
                        <Text style={styles.cancelInvoiceBtnText}>Cancel & Refund Invoice</Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={({ pressed }) => [styles.dismissInvoiceBtn, pressed && styles.pressed]}
                      onPress={() => setShowInvoiceModal(false)}
                    >
                      <Text style={styles.dismissInvoiceBtnText}>Close Window</Text>
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
  searchBarRow: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
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
  listScroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
  },
  emptyView: {
    paddingVertical: Spacing.six,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.three,
  },
  visitTag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  visitTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: Spacing.two,
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContent: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    width: '100%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  detailKpis: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  kpiBox: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  behaviorSection: {
    marginBottom: Spacing.four,
  },
  invoicesSection: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  invoiceDetailCard: {
    backgroundColor: '#fff',
    borderColor: '#eee',
    borderWidth: 1,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  detailLabel: {
    fontSize: 11,
    color: '#333',
    marginBottom: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginVertical: Spacing.two,
  },
  itemsList: {
    gap: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemText: {
    fontSize: 11,
    color: '#000',
  },
  totalsGroup: {
    alignSelf: 'flex-end',
    width: 150,
    gap: 2,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalsLabel: {
    fontSize: 11,
    color: '#333',
  },
  totalsVal: {
    fontSize: 11,
    color: '#000',
  },
  invoiceActionsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.four,
    marginBottom: Spacing.five,
  },
  cancelInvoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#e53935',
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
  },
  cancelInvoiceBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  dismissInvoiceBtn: {
    flex: 0.8,
    backgroundColor: '#F0F0F3',
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissInvoiceBtnText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '700',
  },
});
