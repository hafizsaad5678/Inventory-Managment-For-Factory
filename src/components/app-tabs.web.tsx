import React from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
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
            <TabButton icon={<POSIcon size={16} color="#FAF8F3" />} isPOS>POS Billing</TabButton>
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
  // Accent colors
  const activeIconColor = '#412D15';
  const inactiveIconColor = '#666666';

  let btnClass = 'flex flex-row items-center gap-2 py-2.5 px-4 rounded-xl ';
  if (isPOS) {
    btnClass += isFocused 
      ? 'bg-brand-accent-sec border border-brand-accent' 
      : 'bg-brand-accent border border-brand-accent-sec shadow-sm';
  } else {
    btnClass += isFocused 
      ? 'bg-brand-accent/10 border border-brand-accent/20' 
      : 'bg-transparent border border-transparent';
  }

  return (
    <Pressable {...props} className="active:opacity-80">
      <View className={btnClass}>
        {icon && (
          <View className="justify-center items-center">
            {React.cloneElement(icon as React.ReactElement<any>, {
              color: isPOS ? '#FAF8F3' : (isFocused ? activeIconColor : inactiveIconColor)
            })}
          </View>
        )}
        <ThemedText 
          type="smallBold" 
          themeColor={isPOS ? 'textInverse' : (isFocused ? 'accent' : 'textSecondary')}
          className="font-inter font-bold"
        >
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} className="absolute w-full p-4 flex flex-row justify-center items-center top-0 z-50">
      <ThemedView type="backgroundElement" className="flex flex-row items-center py-4 px-6 rounded-2xl w-full max-w-[800px] shadow-sm border border-brand-glass">
        <ThemedText type="subtitle" className="font-inter font-extrabold text-[22px] tracking-tight">
          Factory <ThemedText type="subtitle" className="text-brand-accent font-extrabold text-[22px] tracking-tight">ERP</ThemedText>
        </ThemedText>

        <View className="flex flex-row items-center gap-2 ml-auto">
          {props.children}
        </View>
      </ThemedView>
    </View>
  );
}
