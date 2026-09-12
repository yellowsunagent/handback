import React from 'react';
import { Alert, AppState as NativeAppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RootStackParamList } from './src/types/nav';
import { AppProvider, useApp } from './src/ui/AppContext';
import { Button } from './src/ui/components';
import { colors } from './src/ui/theme';
import { discardBackup, pickBackup, reconcileReminders } from './src/services/native';
import { SetupScreen } from './src/screens/SetupScreen';
import { ToolsListScreen } from './src/screens/ToolsListScreen';
import { LoansScreen } from './src/screens/LoansScreen';
import { PeopleScreen } from './src/screens/PeopleScreen';
import { AddToolScreen } from './src/screens/AddToolScreen';
import { ToolDetailScreen } from './src/screens/ToolDetailScreen';
import { StartLoanScreen } from './src/screens/StartLoanScreen';
import { EditLoanScreen } from './src/screens/EditLoanScreen';
import { LoanDetailScreen } from './src/screens/LoanDetailScreen';
import { LoanQRScreen } from './src/screens/LoanQRScreen';
import { ScanLoanScreen } from './src/screens/ScanLoanScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.canvas,
    card: colors.canvas,
    text: colors.ink,
    border: colors.line,
    primary: colors.primary,
  },
};

function LoadingView() {
  return (
    <View style={styles.center}>
      <Text style={styles.loadingMark}>↩</Text>
      <Text style={styles.loadingTitle}>HandBack</Text>
      <Text style={styles.loadingText}>Reading your local records…</Text>
    </View>
  );
}

function ReadErrorView({ message, onRetry, retrying, onRestore, restoring }: { message: string; onRetry: () => void; retrying: boolean; onRestore: () => void; restoring: boolean }) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorMark}>!</Text>
      <Text style={styles.loadingTitle}>Could not read local data</Text>
      <Text style={styles.loadingText}>{message}</Text>
      <Button label="Try again" onPress={onRetry} variant="primary" busy={retrying} style={styles.retry} />
      <Button label="Restore from backup" onPress={onRestore} variant="secondary" busy={restoring} style={styles.retry} />
      <Text style={styles.loadingText}>Your records have not been replaced.</Text>
    </View>
  );
}

function ReadWarning({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) {
  return (
    <View style={styles.readWarning}>
      <Text style={styles.readWarningText}>Could not refresh local data. Existing records are still shown.</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} disabled={retrying}><Text style={styles.reminderRetry}>{retrying ? 'Trying…' : 'Retry'}</Text></Pressable>
      <Text accessibilityLabel="Read error details" style={styles.readWarningDetails}>{message}</Text>
    </View>
  );
}

function ReminderLifecycle() {
  const { state } = useApp();
  const latest = React.useRef(state);
  const [failure, setFailure] = React.useState<string>();
  latest.current = state;

  const reconcile = React.useCallback(async (snapshot: typeof state) => {
    if (!snapshot) return;
    try {
      await reconcileReminders(snapshot);
      setFailure(undefined);
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Local reminders could not be refreshed.');
    }
  }, []);

  React.useEffect(() => {
    if (!state) return;
    void reconcile(state);
  }, [state, reconcile]);

  React.useEffect(() => {
    const subscription = NativeAppState.addEventListener('change', (next) => {
      if (next === 'active' && latest.current) void reconcile(latest.current);
    });
    return () => subscription.remove();
  }, [reconcile]);
  if (!failure) return null;
  return <View style={styles.reminderBanner}><Text style={styles.reminderText}>Loan data is saved, but local reminders need attention.</Text><Pressable accessibilityRole="button" onPress={() => void reconcile(latest.current)}><Text style={styles.reminderRetry}>Retry</Text></Pressable></View>;
}

function AppNavigator() {
  const { state, loading, error, refresh, restore } = useApp();
  const [retrying, setRetrying] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);

  async function restoreAfterReadError() {
    if (restoring) return;
    setRestoring(true);
    try {
      const candidate = await pickBackup();
      if (!candidate) return;
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert('Use this backup?', `It contains ${candidate.people.length} people, ${candidate.tools.length} tools, and ${candidate.loans.length} loans. It will replace the unreadable local snapshot on this phone.`, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Restore', onPress: () => resolve(true) },
        ]);
      });
      if (!confirmed) {
        await discardBackup(candidate);
        return;
      }
      try {
        const result = await restore(candidate);
        Alert.alert('Data restored', result.reminderError
          ? 'Your records were restored. Local reminders could not be refreshed; use Retry in the reminder banner.'
          : 'Your HandBack records are now restored on this phone.');
      } catch (caught) {
        Alert.alert('Restore failed', caught instanceof Error ? caught.message : 'Your unreadable local records were preserved.');
      }
    } catch (caught) {
      Alert.alert('Could not read backup', caught instanceof Error ? caught.message : 'The backup was rejected. Existing data was left untouched.');
    } finally {
      setRestoring(false);
    }
  }

  if (loading && !state) return <LoadingView />;
  if (error && !state) {
    return (
      <ReadErrorView
        message={error}
        retrying={retrying}
        restoring={restoring}
        onRestore={() => { void restoreAfterReadError(); }}
        onRetry={() => {
          setRetrying(true);
          void refresh().catch(() => undefined).finally(() => setRetrying(false));
        }}
      />
    );
  }
  if (!state) return <LoadingView />;

  const warning = error ? <ReadWarning message={error} retrying={retrying} onRetry={() => { setRetrying(true); void refresh().catch(() => undefined).finally(() => setRetrying(false)); }} /> : null;

  if (!state.setupComplete) {
    return (
      <>
        {warning}
        <ReminderLifecycle />
        <Stack.Navigator key="setup" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Setup" component={SetupScreen} />
        </Stack.Navigator>
      </>
    );
  }

  return (
    <>
      {warning}
      <ReminderLifecycle />
      <Stack.Navigator key="main" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ToolsList" component={ToolsListScreen} />
        <Stack.Screen name="Loans" component={LoansScreen} />
        <Stack.Screen name="People" component={PeopleScreen} />
        <Stack.Screen name="AddTool" component={AddToolScreen} />
        <Stack.Screen name="ToolDetail" component={ToolDetailScreen} />
        <Stack.Screen name="StartLoan" component={StartLoanScreen} />
        <Stack.Screen name="EditLoan" component={EditLoanScreen} />
        <Stack.Screen name="LoanDetail" component={LoanDetailScreen} />
        <Stack.Screen name="LoanQR" component={LoanQRScreen} />
        <Stack.Screen name="ScanLoan" component={ScanLoanScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </>
  );
}

export default function App() {
  return (
    <NavigationContainer theme={theme}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppProvider>
          <AppNavigator />
        </AppProvider>
      </SafeAreaProvider>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', backgroundColor: colors.canvas, flex: 1, justifyContent: 'center', padding: 28 },
  loadingMark: { color: colors.primary, fontSize: 52, fontWeight: '300', marginBottom: 8 },
  errorMark: { alignItems: 'center', borderColor: colors.danger, borderRadius: 99, borderWidth: 2, color: colors.danger, fontSize: 24, fontWeight: '800', height: 42, lineHeight: 38, marginBottom: 16, textAlign: 'center', width: 42 },
  loadingTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  loadingText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 330, textAlign: 'center' },
  retry: { marginTop: 24, minWidth: 170 },
  reminderBanner: { alignItems: 'center', backgroundColor: '#4a3720', borderColor: '#83672c', borderRadius: 12, bottom: 18, flexDirection: 'row', left: 18, paddingHorizontal: 13, paddingVertical: 11, position: 'absolute', right: 18, zIndex: 20 },
  reminderText: { color: '#f8dda0', flex: 1, fontSize: 12, lineHeight: 17, paddingRight: 12 },
  reminderRetry: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  readWarning: { alignItems: 'center', backgroundColor: '#422c2d', borderBottomColor: '#704547', borderBottomWidth: 1, flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 9, zIndex: 30 },
  readWarningText: { color: '#f6c9c7', flex: 1, fontSize: 12, lineHeight: 17, paddingRight: 10 },
  readWarningDetails: { height: 1, opacity: 0, position: 'absolute', width: 1 },
});
