import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../types/nav';
import { encodeLoanQR } from '../domain/qr';
import { dueLabel } from '../domain/dates';
import { useApp } from '../ui/AppContext';
import { Button, Card, Header, Screen } from '../ui/components';
import { colors, common } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'LoanQR'>;

export function LoanQRScreen({ route, navigation }: Props) {
  const { state, refresh } = useApp();
  const { loanId } = route.params;
  const [encoded, setEncoded] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  useFocusEffect(
    React.useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  const loan = state?.loans.find((item) => item.id === loanId);
  const tool = state?.tools.find((item) => item.id === loan?.toolId);
  const people = new Map(state?.people.map((person) => [person.id, person] as const) ?? []);

  React.useEffect(() => {
    if (!state || !loan) return;
    try {
      setEncoded(encodeLoanQR(state, loan.id));
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create a QR copy.');
    }
  }, [state, loan]);

  if (!state || !loan) return <Screen><Header title="QR copy unavailable" onBack={() => navigation.goBack()} /><Text style={common.note}>This loan may have been deleted.</Text></Screen>;
  if (error || !encoded) return <Screen><Header title="QR copy unavailable" onBack={() => navigation.goBack()} /><Text style={common.note}>{error ?? 'Preparing the QR code…'}</Text><Button label="Back to loan" onPress={() => navigation.goBack()} variant="secondary" style={styles.backButton} /></Screen>;

  const owner = people.get(loan.ownerId)?.name ?? 'Archived person';
  const borrower = people.get(loan.borrowerId)?.name ?? 'Archived person';
  return (
    <Screen>
      <Header title="Save a QR copy" subtitle="Let the other person review and save an independent copy on their phone." onBack={() => navigation.goBack()} />
      <View style={styles.qrFrame}><QRCode value={encoded} size={246} backgroundColor="#fff" color="#10151d" /></View>
      <Card style={styles.details}>
        <Text style={styles.detailTitle}>{tool?.name ?? 'Unknown tool'}</Text>
        <Text style={styles.detailLine}>Owner: {owner}</Text>
        <Text style={styles.detailLine}>Borrower: {borrower}</Text>
        <Text style={styles.detailLine}>Started: {loan.startedOn}</Text>
        <Text style={styles.detailLine}>Due: {loan.dueOn ? `${dueLabel(loan.dueOn)} (${loan.dueOn})` : 'No due date'}</Text>
      </Card>
      <Text style={styles.note}>The QR copy includes the loan’s identifying details. Photos and private notes stay on this phone. Saving a copy does not notify or confirm anything with the other phone.</Text>
      <Button label="Back to loan" onPress={() => navigation.goBack()} variant="secondary" style={styles.backButton} />
      {loan.returnedOn ? <Text style={styles.returned}>This loan is already returned locally. Re-scanning opens the existing record and does not change it.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  qrFrame: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 18, marginBottom: 22, padding: 14 },
  details: { marginBottom: 16 },
  detailTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', marginBottom: 8 },
  detailLine: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  note: { color: colors.dim, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  backButton: { marginTop: 18 },
  returned: { color: colors.warning, fontSize: 12, lineHeight: 17, marginTop: 14, textAlign: 'center' },
});
