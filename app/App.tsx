import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from './src/types/nav';
import { ToolsListScreen } from './src/screens/ToolsListScreen';
import { LoansScreen } from './src/screens/LoansScreen';
import { AddToolScreen } from './src/screens/AddToolScreen';
import { ToolDetailScreen } from './src/screens/ToolDetailScreen';
import { StartLoanScreen } from './src/screens/StartLoanScreen';
import { ScanLoanScreen } from './src/screens/ScanLoanScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer theme={DarkTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ToolsList" component={ToolsListScreen} />
        <Stack.Screen name="Loans" component={LoansScreen} />
        <Stack.Screen name="AddTool" component={AddToolScreen} />
        <Stack.Screen name="ToolDetail" component={ToolDetailScreen} />
        <Stack.Screen name="StartLoan" component={StartLoanScreen} />
        <Stack.Screen name="ScanLoan" component={ScanLoanScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
