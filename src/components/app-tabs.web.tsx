import React from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, useColorScheme, View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { 
  DashboardIcon, 
  InventoryIcon, 
  POSIcon, 
  CustomersIcon, 
  ReportsIcon 
} from './Icons';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon={<DashboardIcon size={16} />}>Dashboard</TabButton>
          </TabTrigger>
          <TabTrigger name="inventory" href="/inventory" asChild>
            <TabButton icon={<InventoryIcon size={16} />}>Inventory</TabButton>
          </TabTrigger>
          <TabTrigger name="billing" href="/billing" asChild>
            <TabButton icon={<POSIcon size={16} color="#fff" />} isPOS>POS Billing</TabButton>
          </TabTrigger>
          <TabTrigger name="customers" href="/customers" asChild>
            <TabButton icon={<CustomersIcon size={16} />}>Customers</TabButton>
          </TabTrigger>
          <TabTrigger name="reports" href="/reports" asChild>
            <TabButton icon={<ReportsIcon size={16} />}>Reports</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

interface TabButtonProps extends TabTriggerSlotProps {
  icon?: React.ReactNode;
  isPOS?: boolean;
}

export function TabButton({ children, isFocused, icon, isPOS, ...props }: TabButtonProps) {
  const scheme = useColorScheme();
  const themeColors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[
          styles.tabButtonView,
          isPOS && [styles.posButtonWeb, { backgroundColor: isFocused ? '#1e7cd8' : '#208AEF' }]
        ]}>
        {icon && (
          <View style={styles.iconContainer}>
            {React.cloneElement(icon as React.ReactElement<any>, {
              color: isPOS ? '#fff' : (isFocused ? '#208AEF' : themeColors.textSecondary)
            })}
          </View>
        )}
        <ThemedText 
          type="smallBold" 
          themeColor={isPOS ? 'background' : (isFocused ? 'text' : 'textSecondary')}
          style={isPOS && { color: '#fff' }}
        >
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="subtitle" style={styles.brandText}>
          Factory <ThemedText type="subtitle" style={{ color: '#208AEF' }}>ERP</ThemedText>
        </ThemedText>

        <View style={styles.tabsGroup}>
          {props.children}
        </View>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    top: 0,
    zIndex: 100,
  },
  innerContainer: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  brandText: {
    fontWeight: '800',
    fontSize: 20,
  },
  tabsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginLeft: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  posButtonWeb: {
    borderRadius: Spacing.three,
    shadowColor: '#208AEF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
