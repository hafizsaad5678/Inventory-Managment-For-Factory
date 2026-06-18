import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';

import { DashboardIcon, InventoryIcon, POSIcon, CustomersIcon, ReportsIcon } from './Icons';

export default function AppTabs() {
  const activeColor = '#412D15';
  const inactiveColor = '#666666';
  const barBg = 'rgba(250, 248, 243, 0.90)'; // Secondary Background with high opacity
  const barBorder = 'rgba(255, 255, 255, 0.45)';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: barBg,
          borderBottomWidth: 1,
          borderBottomColor: barBorder,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: '#000000',
          fontSize: 18,
          fontWeight: '700',
          fontFamily: 'Inter',
        },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: barBg,
          borderTopColor: barBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 64 : 58,
          paddingBottom: 0,
          paddingTop: 0,
          paddingHorizontal: 0,
          marginBottom: Platform.OS === 'ios' ? 32 : 20,
          marginHorizontal: 16,
          borderRadius: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.10,
          shadowRadius: 12,
          elevation: 10,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          fontFamily: 'Inter',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => <DashboardIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarLabel: 'Inventory',
          tabBarIcon: ({ color }) => <InventoryIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: 'POS Billing',
          tabBarLabel: 'POS',
          tabBarIcon: ({ color, focused }) => (
            <View
              className={`absolute -top-5 w-[52px] h-[52px] rounded-full justify-center items-center shadow-md`}
              style={{ backgroundColor: focused ? '#5C3D1E' : '#412D15' }}
            >
              <POSIcon size={22} color="#FAF8F3" />
            </View>
          ),
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
            marginTop: 22,
            fontFamily: 'Inter',
            color: activeColor,
          },
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarLabel: 'Customers',
          tabBarIcon: ({ color }) => <CustomersIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports & P&L',
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color }) => <ReportsIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
