import React from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Loan, Tool } from '../types/models';
import type { RootStackParamList } from '../types/nav';
import { newId } from '../lib/id';
import { isCalendarDay, localDay, dueLabel } from '../domain/dates';
import { reconcileReminders, requestReminderPermission } from '../services/native';
import { useApp } from '../ui/AppContext';
import { Button, Card, Field, Header, KeyboardScreen, PersonPicker, StatusPill, ToggleRow } from '../ui/components';
import { colors, common } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'StartLoan'>;

export function StartLoanScreen({ route, navigation }: Props) {
  const { state, refresh, commit } = useApp();
  const { mode, toolId } = route.params;
  const [selectedToolId, setSelectedToolId] = React.useState(toolId);
  const [otherPersonId, setOtherPersonId] = React.useState<string>();
  const [dueOn, setDueOn] = React.useState('');
  const [reminder, setReminder] = React.useState(false);
  const [showTools, setShowTools] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dateError, setDateError] = React.useState<string>();
  const lock = React.useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  React.useEffect(() => {
    if (!state) return;
    const tool = state.tools.find((item) => item.id === selectedToolId);
    if (mode === 'borrow' && tool) setOtherPersonId(tool.ownerId);
  }, [state, mode, selectedToolId]);

  if (!state) return null;
  const currentState = state;
  const profile = currentState.people.find((person) => person.id === currentState.profileId);
  const activeToolIds = new Set(currentState.loans.filter((loan) => !loan.returnedOn).map((loan) => loan.toolId));
  const availableTools = currentState.tools.filter((tool) => {
    if (tool.archived || activeToolIds.has(tool.id)) return false;
    const owner = currentState.people.find((person) => person.id === tool.ownerId);
    if (!owner || owner.archived) return false;
    return mode === 'lend' ? tool.ownerId === currentState.profileId : tool.ownerId !== currentState.profileId;
  });
  const selectedTool = currentState.tools.find((tool) => tool.id === selectedToolId);
  const selectedOwner = selectedTool ? currentState.people.find((person) => person.id === selectedTool.ownerId) : undefined;
  const personOptions = currentState.people.filter((person) => !person.archived || person.id === otherPersonId);

  function selectTool(tool: Tool) {
    setSelectedToolId(tool.id);
    if (mode === 'borrow') setOtherPersonId(tool.ownerId);
    setShowTools(false);
  }

  async function saveLoan() {
    if (lock.current || saving || !selectedTool) return;
    if (selectedTool.archived || activeToolIds.has(selectedTool.id)) {
      Alert.alert('Tool is already in an active loan', 'Choose another tool or resolve its current loan first.');
      return;
    }
    if (mode === 'lend' && selectedTool.ownerId !== currentState.profileId) {
      Alert.alert('You can only lend your own tool', 'Record someone else’s tool as borrowed instead.');
      return;
    }
    if (dueOn && !isCalendarDay(dueOn)) {
      setDateError('Use a real calendar date in YYYY-MM-DD format.');
      return;
    }
    setDateError(undefined);
    const borrowerId = mode === 'lend' ? otherPersonId : currentState.profileId;
    const ownerId = selectedTool.ownerId;
    if (!borrowerId || borrowerId === ownerId) {
      Alert.alert(mode === 'lend' ? 'Choose the borrower' : 'Choose the owner', 'Pick a person so the loan has a clear other side.');
      return;
    }
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
      const loan: Loan = {
        id: await newId('loan'),
        toolId: selectedTool.id,
        ownerId,
        borrowerId,
        startedOn: localDay(),
        dueOn: dueOn || undefined,
        reminder,
      };
      const next = await commit({ type: 'loan', loan });
      try {
        await reconcileReminders(next);
      } catch {
        reminderWarning = true;
      }
      const detail = mode === 'lend' ? `You lent ${selectedTool.name} to ${currentState.people.find((p) => p.id === borrowerId)?.name ?? 'your friend'}.` : `You recorded ${selectedTool.name} from ${selectedOwner?.name ?? 'the owner'}.`;
      const actions = [
        { text: 'Open loan', onPress: () => navigation.replace('LoanDetail', { loanId: loan.id }) },
        ...(mode === 'lend' ? [{ text: 'Show QR copy', onPress: () => navigation.replace('LoanQR', { loanId: loan.id }) }] : []),
      ];
      Alert.alert('Loan saved', reminderWarning ? `${detail}\n\nThe loan is saved. Local notifications are unavailable right now, so you can still track it in the app.` : detail, actions);
    } catch (error) {
      Alert.alert('Could not save loan', error instanceof Error ? error.message : 'No loan was saved. Please try again.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return (
    <KeyboardScreen>
      <Header
        title={mode === 'lend' ? 'I lent a tool' : 'I borrowed a tool'}
        subtitle={mode === 'lend' ? 'Save the loan now. The other person does not need HandBack.' : 'Keep a local record of someone else’s tool so you know to return it.'}
        onBack={() => navigation.goBack()}
      />

      <Text style={common.sectionTitle}>Choose a tool</Text>
      <Pressable accessibilityRole="button" onPress={() => setShowTools(true)} style={styles.toolSelect}>
        <View style={styles.toolSelectMain}>
          <Text style={selectedTool ? styles.selectedToolName : styles.selectPlaceholder}>{selectedTool?.name ?? 'Choose an available tool'}</Text>
          {selectedTool ? <Text style={common.rowSub}>{mode === 'lend' ? 'Owned by you' : `Owned by ${selectedOwner?.name ?? 'an archived person'}`}</Text> : null}
        </View>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>
      {availableTools.length === 0 ? <Text style={styles.warningText}>{mode === 'lend' ? 'You have no available owned tools yet.' : 'Add a borrowed tool to your inventory first.'}</Text> : null}
      <Button label="Add a new tool" onPress={() => navigation.navigate('AddTool', { borrowed: mode === 'borrow', ownerId: mode === 'lend' ? currentState.profileId : undefined })} variant="quiet" style={styles.addToolButton} />

      {selectedTool ? (
        <Card style={styles.formCard}>
          {mode === 'lend' ? (
            <PersonPicker label="Borrower" people={personOptions} value={otherPersonId} onChange={setOtherPersonId} excludeIds={[state.profileId]} placeholder="Choose the borrower" />
          ) : (
            <View style={styles.ownerReadOnly}>
              <Text style={common.label}>Owner</Text>
              <Text style={styles.ownerName}>{selectedOwner?.name ?? 'Archived person'}</Text>
              <Text style={common.note}>Ownership comes from this tool’s saved details.</Text>
            </View>
          )}
          <Field
            label="Due date (optional)"
            value={dueOn}
            onChangeText={(value) => { setDueOn(value); setDateError(undefined); if (!value) setReminder(false); }}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            error={dateError}
            hint={dueOn && isCalendarDay(dueOn) ? `${dueLabel(dueOn)} (${dueOn})` : 'It stays due all day, then becomes overdue the next day.'}
          />
          <ToggleRow label="Remind me on the due date" description={dueOn ? 'At 9 a.m. on this phone. Permission is optional.' : 'Add a due date to turn on a local reminder.'} value={reminder} onChange={setReminder} disabled={!dueOn || !isCalendarDay(dueOn)} />
        </Card>
      ) : null}

      <Button label={saving ? 'Saving…' : 'Save loan'} onPress={() => void saveLoan()} variant="primary" busy={saving} disabled={!selectedTool || (mode === 'lend' && !otherPersonId)} style={styles.saveButton} />
      <Text style={styles.localNote}>This saves an independent local record. It does not notify or create a shared claim on another phone.</Text>

      <Modal visible={showTools} animationType="slide" transparent onRequestClose={() => setShowTools(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Available tools</Text><Pressable onPress={() => setShowTools(false)}><Text style={styles.link}>Close</Text></Pressable></View>
            {availableTools.length === 0 ? <Text style={common.note}>There are no available tools for this journey yet.</Text> : null}
            <ScrollView style={styles.toolList} keyboardShouldPersistTaps="handled">
            {availableTools.map((tool) => (
              <Pressable key={tool.id} style={styles.toolOption} onPress={() => selectTool(tool)}>
                <View style={styles.toolOptionMain}><Text style={styles.toolOptionTitle}>{tool.name}</Text><Text style={common.note}>{mode === 'lend' ? 'Owned by you' : `Owner: ${currentState.people.find((person) => person.id === tool.ownerId)?.name ?? 'Archived person'}`}</Text></View>
                {selectedToolId === tool.id ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            ))}
            </ScrollView>
            <Button label="Cancel" onPress={() => setShowTools(false)} variant="quiet" />
          </View>
        </View>
      </Modal>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  toolSelect: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 65, paddingHorizontal: 15 },
  toolSelectMain: { flex: 1 },
  selectedToolName: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  selectPlaceholder: { color: colors.dim, fontSize: 16 },
  chevron: { color: colors.muted, fontSize: 22, marginLeft: 10 },
  warningText: { color: colors.warning, fontSize: 13, lineHeight: 18, marginTop: 8 },
  addToolButton: { alignSelf: 'flex-start', marginTop: 2 },
  formCard: { marginTop: 19, paddingBottom: 4 },
  ownerReadOnly: { marginBottom: 17 },
  ownerName: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 5 },
  saveButton: { marginTop: 12 },
  localNote: { color: colors.dim, fontSize: 12, lineHeight: 18, marginTop: 14, textAlign: 'center' },
  modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.62)', flex: 1, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.canvas, borderColor: colors.line, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '86%', padding: 18 },
  modalHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  modalTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  link: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  toolList: { maxHeight: 420 },
  toolOption: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 65, paddingVertical: 10 },
  toolOptionMain: { flex: 1 },
  toolOptionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  check: { color: colors.primary, fontSize: 19, fontWeight: '800', marginLeft: 10 },
});
