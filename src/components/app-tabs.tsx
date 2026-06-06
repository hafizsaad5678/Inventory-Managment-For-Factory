import { Tabs } from 'expo-router';
import { useColorScheme, Platform, StyleSheet, View } from 'react-native';
import { 
  DashboardIcon, 
  InventoryIcon, 
  POSIcon, 
  CustomersIcon, 
  ReportsIcon 
} from './Icons';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.backgroundSelected,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: colors.text,
          fontSize: 18,
          fontWeight: '700',
        },
        tabBarActiveTintColor: '#208AEF',
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.backgroundSelected,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 12,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => <DashboardIcon size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarLabel: 'Inventory',
          tabBarIcon: ({ color }) => <InventoryIcon size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: 'POS Billing',
          tabBarLabel: 'POS',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.posButton, 
              { backgroundColor: focused ? '#1e7cd8' : '#208AEF' }
            ]}>
              <POSIcon size={24} color="#fff" />
            </View>
          ),
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700',
            color: '#208AEF',
            marginTop: 18,
          }
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarLabel: 'Customers',
          tabBarIcon: ({ color }) => <CustomersIcon size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports & P&L',
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color }) => <ReportsIcon size={24} color={color} />,
        }}
      />
      
      {/* Hide explore route from tabs if it exists, or keep hidden */}
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  posButton: {
    position: 'absolute',
    top: -22,
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#208AEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
});
