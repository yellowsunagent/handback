import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Loan } from '../types/models';
import type { RootStackParamList } from '../types/nav';
import { isCalendarDay, dueLabel } from '../domain/dates';
import { reconcileReminders, requestReminderPermission } from '../services/native';
import { useApp } from '../ui/AppContext';
import { Button, Card, Field, Header, KeyboardScreen, PersonPicker, ToggleRow } from '../ui/components';
import { colors, common } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditLoan'>;

export function EditLoanScreen({ route, navigation }: Props) {
  const { state, refresh, commit } = useApp();
  const { loanId } = route.params;
  const [borrowerId, setBorrowerId] = React.useState<string>();
  const [startedOn, setStartedOn] = React.useState('');
  const [dueOn, setDueOn] = React.useState('');
  const [reminder, setReminder] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dateError, setDateError] = React.useState<string>();
  const lock = React.useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  const loan = state?.loans.find((item) => item.id === loanId);
  React.useEffect(() => {
    if (!loan) return;
    setBorrowerId(loan.borrowerId);
    setStartedOn(loan.startedOn);
    setDueOn(loan.dueOn ?? '');
    setReminder(loan.reminder);
  }, [loan]);

  if (!state || !loan) return <KeyboardScreen><Header title="Loan not found" onBack={() => navigation.goBack()} /><Text style={common.note}>This local loan may have been deleted.</Text></KeyboardScreen>;
  if (loan.returnedOn) return <KeyboardScreen><Header title="Completed loan" onBack={() => navigation.goBack()} /><Text style={common.note}>Completed loans are kept in history. Undo the return first if you need to correct this record.</Text><Button label="Back to loan" onPress={() => navigation.goBack()} variant="secondary" style={styles.backButton} /></KeyboardScreen>;

  const currentLoan = loan;

  const tool = state.tools.find((item) => item.id === loan.toolId);
  const owner = state.people.find((person) => person.id === loan.ownerId);
  const isLender = loan.ownerId === state.profileId;

  async function save() {
    if (!borrowerId || lock.current || saving) return;
    if (!isCalendarDay(startedOn)) {
      setDateError('Use a real start date in YYYY-MM-DD format.');
      return;
    }
    if (dueOn && (!isCalendarDay(dueOn) || dueOn < startedOn)) {
      setDateError(!isCalendarDay(dueOn) ? 'Use a real calendar date in YYYY-MM-DD format.' : 'The due date cannot be before the start date.');
      return;
    }
    setDateError(undefined);
    lock.current = true;
    setSaving(true);
    let reminderWarning = false;
    try {
      if (reminder) {
        try {
          if (!(await requestReminderPermission())) reminderWarning = true;
        } catch {
          reminderWarning = true;
        }
      }
      const nextLoan: Loan = { ...currentLoan, borrowerId, startedOn, dueOn: dueOn || undefined, reminder };
      const next = await commit({ type: 'loan', loan: nextLoan });
      try {
        await reconcileReminders(next);
      } catch {
        reminderWarning = true;
      }
      if (reminderWarning) Alert.alert('Loan updated', 'The loan is saved. Local notifications are unavailable right now, so you can still track it in the app.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could not update loan', error instanceof Error ? error.message : 'No change was saved. Please try again.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return (
    <KeyboardScreen>
      <Header title="Edit loan" subtitle="Correct this local record without changing the tool’s identity." onBack={() => navigation.goBack()} />
      <Card style={styles.summary}>
        <Text style={styles.toolName}>{tool?.name ?? 'Unknown tool'}</Text>
        <Text style={common.note}>Owner: {owner?.name ?? 'Archived person'}</Text>
        <Text style={common.note}>The tool and owner stay fixed so their history remains connected.</Text>
      </Card>
      {isLender ? <PersonPicker label="Borrower" people={state.people} value={borrowerId} onChange={setBorrowerId} excludeIds={[state.profileId]} placeholder="Choose the borrower" /> : <View style={styles.fixedPerson}><Text style={common.label}>Borrower</Text><Text style={styles.fixedPersonName}>{state.people.find((person) => person.id === loan.borrowerId)?.name ?? 'You'}</Text><Text style={common.note}>This phone records you as the borrower.</Text></View>}
      <Field label="Started on" value={startedOn} onChangeText={(value) => { setStartedOn(value); setDateError(undefined); }} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} error={!isCalendarDay(startedOn) ? dateError : undefined} hint={isCalendarDay(startedOn) ? `Started ${startedOn}` : 'Use the calendar day the handoff happened.'} />
      <Field label="Due date (optional)" value={dueOn} onChangeText={(value) => { setDueOn(value); setDateError(undefined); if (!value) setReminder(false); }} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} error={dateError} hint={dueOn && isCalendarDay(dueOn) ? `${dueLabel(dueOn)} (${dueOn})` : 'Due all day; overdue beginning the next calendar day.'} />
      <ToggleRow label="Remind me on the due date" description={dueOn ? 'At 9 a.m. on this phone. Permission is optional.' : 'Add a due date to turn on a local reminder.'} value={reminder} onChange={setReminder} disabled={!dueOn || !isCalendarDay(dueOn)} />
      <Button label="Save changes" onPress={() => void save()} variant="primary" busy={saving} disabled={!borrowerId} style={styles.saveButton} />
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  summary: { marginBottom: 22 },
  toolName: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  fixedPerson: { marginBottom: 18 },
  fixedPersonName: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 5 },
  saveButton: { marginTop: 18 },
  backButton: { marginTop: 20 },
});
