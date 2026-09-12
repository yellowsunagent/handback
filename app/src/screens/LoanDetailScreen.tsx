import React from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../types/nav';
import { localDay, dueLabel } from '../domain/dates';
import { reconcileReminders } from '../services/native';
import { useApp } from '../ui/AppContext';
import { Button, Card, Header, Screen, StatusPill } from '../ui/components';
import { colors, common } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'LoanDetail'>;

export function LoanDetailScreen({ route, navigation }: Props) {
  const { state, refresh, commit } = useApp();
  const { loanId } = route.params;
  const [busy, setBusy] = React.useState(false);
  const lock = React.useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  if (!state) return null;
  const loan = state.loans.find((item) => item.id === loanId);
  if (!loan) return <Screen><Header title="Loan not found" onBack={() => navigation.goBack()} /><Text style={common.note}>This local loan may have been deleted.</Text></Screen>;
  const currentLoan = loan;
  const tool = state.tools.find((item) => item.id === currentLoan.toolId);
  const people = new Map(state.people.map((person) => [person.id, person] as const));
  const owner = people.get(currentLoan.ownerId)?.name ?? 'Archived person';
  const borrower = people.get(currentLoan.borrowerId)?.name ?? 'Archived person';
  const isMineToLend = currentLoan.ownerId === state.profileId;
  const active = !currentLoan.returnedOn;
  const overdue = active && !!currentLoan.dueOn && currentLoan.dueOn < localDay();

  function confirm(title: string, message: string, actionTitle: string, action: () => void, destructive = false) {
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: actionTitle, style: destructive ? 'destructive' : 'default', onPress: action }]);
  }

  function markReturned() {
    if (!active || lock.current) return;
    confirm('Mark this tool returned?', `${tool?.name ?? 'This tool'} will leave outstanding loans and stay in history on this phone.`, 'Mark returned', () => {
      lock.current = true;
      setBusy(true);
      void (async () => {
        try {
          const next = await commit({ type: 'return', loanId: currentLoan.id, on: localDay() });
          let reminderError = false;
          try { await reconcileReminders(next); } catch { reminderError = true; }
          if (reminderError) Alert.alert('Tool marked returned', 'The loan is saved in history. The old notification could not be canceled and may still appear. Use Retry in the reminder banner.');
        } catch (error) {
          Alert.alert('Could not mark returned', error instanceof Error ? error.message : 'No change was made. Please try again.');
        } finally {
          lock.current = false;
          setBusy(false);
        }
      })();
    });
  }

  function undoReturn() {
    if (active || lock.current) return;
    confirm('Undo this return?', 'The loan will become outstanding again if the tool does not already have another active loan.', 'Undo return', () => {
      lock.current = true;
      setBusy(true);
      void (async () => {
        try {
          const next = await commit({ type: 'undo', loanId: currentLoan.id });
          let reminderError = false;
          try { await reconcileReminders(next); } catch { reminderError = true; }
          if (reminderError) Alert.alert('Return undone', 'The loan is outstanding again. Local reminders could not be refreshed, but tracking remains available in the app.');
        } catch (error) {
          Alert.alert('Could not undo return', error instanceof Error ? error.message : 'Another active loan may already exist for this tool. Existing records were preserved.');
        } finally {
          lock.current = false;
          setBusy(false);
        }
      })();
    });
  }

  function deleteLoan() {
    if (lock.current) return;
    confirm('Delete this loan record?', 'This removes the local loan record after confirmation. The tool remains in your inventory and its other history stays intact.', 'Delete loan', () => {
      lock.current = true;
      setBusy(true);
      void (async () => {
        try {
          const next = await commit({ type: 'deleteLoan', loanId: currentLoan.id });
          let reminderError = false;
          try { await reconcileReminders(next); } catch { reminderError = true; }
          if (reminderError) {
            Alert.alert('Loan deleted', 'The local record was deleted. Local reminders could not be refreshed; open the app again to retry.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
          } else {
            navigation.goBack();
          }
        } catch (error) {
          Alert.alert('Could not delete loan', error instanceof Error ? error.message : 'Please try again.');
        } finally {
          lock.current = false;
          setBusy(false);
        }
      })();
    }, true);
  }

  async function shareReminder() {
    if (busy) return;
    const other = isMineToLend ? borrower : owner;
    const due = currentLoan.dueOn ? ` The return date is ${currentLoan.dueOn}.` : '';
    const message = isMineToLend
      ? `Hi ${other}, could you return ${tool?.name ?? 'the tool'}?${due}`
      : `Hi ${other}, I have ${tool?.name ?? 'the tool'} and would like to arrange its return.${due}`;
    try {
      await Share.share({ message });
    } catch (error) {
      Alert.alert('Could not open the share sheet', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <Screen>
      <Header title={tool?.name ?? 'Loan'} subtitle={active ? 'Outstanding on this phone' : 'Completed local history'} onBack={() => navigation.goBack()} />

      <Card style={styles.summaryCard}>
        <View style={styles.summaryTop}><StatusPill label={active ? overdue ? 'Overdue' : 'Outstanding' : 'Returned'} tone={active ? overdue ? 'danger' : 'warning' : 'muted'} /><Text style={styles.role}>{isMineToLend ? 'You lent this' : 'You borrowed this'}</Text></View>
        <Text style={styles.summaryTitle}>{isMineToLend ? `With ${borrower}` : `From ${owner}`}</Text>
        <Text style={styles.detailLine}>Owner: {owner}</Text>
        <Text style={styles.detailLine}>Borrower: {borrower}</Text>
        <Text style={styles.detailLine}>Started: {currentLoan.startedOn}</Text>
        <Text style={styles.detailLine}>Due: {currentLoan.dueOn ? `${dueLabel(currentLoan.dueOn)} (${currentLoan.dueOn})` : 'No due date'}</Text>
        {currentLoan.returnedOn ? <Text style={styles.detailLine}>Returned: {currentLoan.returnedOn}</Text> : null}
        <Text style={styles.detailLine}>9 a.m. reminder preference: {currentLoan.reminder ? 'Requested' : 'Off'}</Text>
      </Card>

      <View style={styles.actions}>
        {active ? <Button label="Edit loan" onPress={() => navigation.navigate('EditLoan', { loanId: currentLoan.id })} variant="secondary" disabled={busy} /> : null}
        {active ? <Button label="Mark returned" onPress={markReturned} variant="primary" busy={busy} /> : <Button label="Undo return" onPress={undoReturn} variant="secondary" busy={busy} />}
        {active ? <Button label="Prepare a reminder" onPress={() => void shareReminder()} variant="secondary" disabled={busy} /> : null}
        {isMineToLend ? <Button label="Show QR copy" onPress={() => navigation.navigate('LoanQR', { loanId: currentLoan.id })} variant="quiet" disabled={busy} /> : null}
        <Button label="Delete loan record" onPress={deleteLoan} variant="quiet" disabled={busy} />
      </View>

      <Text style={styles.localNote}>Loan changes affect this phone only. A share sheet lets you choose whether to send the prepared message.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryCard: { marginBottom: 20 },
  summaryTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13 },
  role: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  summaryTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', marginBottom: 12 },
  detailLine: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  actions: { gap: 9 },
  localNote: { color: colors.dim, fontSize: 12, lineHeight: 18, marginTop: 18, textAlign: 'center' },
});
