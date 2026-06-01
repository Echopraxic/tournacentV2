import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { usePaymentSheet } from '@stripe/stripe-react-native';
import { supabase } from '@/lib/supabase';
import { stripeApi } from '@/lib/stripe';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { plaidApi } from '@/lib/plaid';
import { PlaidLink } from '@/components/PlaidLink';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  CreditCard,
  Building2,
  CheckCircle,
  Clock,
  XCircle,
  Wallet as WalletIcon,
  Link as LinkIcon,
  RefreshCw,
  Shield,
  Trash2,
  Banknote,
} from 'lucide-react-native';

const PLAID_CONSENT_VERSION = '1.0';
const PLAID_CONSENT_TEXT =
  'I authorise Tournacent to access my bank account transaction history via Plaid ' +
  'to verify challenge task completion. This data is encrypted in transit and at rest, ' +
  'used only for challenge verification, and never sold to third parties. ' +
  'I have read and agree to the Privacy Policy.';

interface Transaction {
  id: string;
  amount: number;
  transaction_type: 'buy_in' | 'payout' | 'refund';
  status: 'pending' | 'verified' | 'in_progress' | 'denied';
  denial_reason: string | null;
  created_at: string;
  challenges: {
    name: string;
  };
}

interface PrizePoolStatus {
  total_pool: number;
  paid_count: number;
  pending_count: number;
}

interface ActiveChallenge {
  id: string;
  name: string;
  buy_in_amount: number;
  prize_pool: number;
  buyin_deadline: string | null;
}

export default function Wallet() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prizePoolStatus, setPrizePoolStatus] = useState<PrizePoolStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingBuyIn, setPendingBuyIn] = useState<ActiveChallenge | null>(null);
  const [payingIn, setPayingIn] = useState(false);

  // Stripe payout account state
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [stripeOnboardingComplete, setStripeOnboardingComplete] = useState(false);
  const [stripeOnboarding, setStripeOnboarding] = useState(false);

  // Consent modal state
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [pendingLinkAction, setPendingLinkAction] = useState<(() => void) | null>(null);

  // Plaid Link state — savings account
  const [plaidLinked, setPlaidLinked] = useState(false);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [showPlaidLink, setShowPlaidLink] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkTokenLoading, setLinkTokenLoading] = useState(false);
  const [syncingTransactions, setSyncingTransactions] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [plaidError, setPlaidError] = useState<string | null>(null);

  // Plaid Link state — debt/credit card account
  const [isDebtChallenge, setIsDebtChallenge] = useState(false);
  const [debtLinked, setDebtLinked] = useState(false);
  const [debtInstitutionName, setDebtInstitutionName] = useState<string | null>(null);
  const [debtLastSyncedAt, setDebtLastSyncedAt] = useState<string | null>(null);
  const [debtLinkTokenLoading, setDebtLinkTokenLoading] = useState(false);
  const [debtSyncing, setDebtSyncing] = useState(false);
  const [debtError, setDebtError] = useState<string | null>(null);
  const [pendingLinkType, setPendingLinkType] = useState<'savings' | 'debt'>('savings');

  const fetchWalletData = useCallback(async () => {
    if (!user) return;

    try {
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*, challenges(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setTransactions((transactionsData as any) || []);

      const { data: participantData } = await supabase
        .from('challenge_participants')
        .select('challenge_id, payment_status, challenges(*)')
        .eq('user_id', user.id)
        .eq('challenges.status', 'active')
        .maybeSingle();

      if (participantData) {
        const challengeData = participantData.challenges as any;

        const { data: allParticipants } = await supabase
          .from('challenge_participants')
          .select('payment_status')
          .eq('challenge_id', participantData.challenge_id);

        const paidCount =
          allParticipants?.filter((p) => p.payment_status === 'paid').length ?? 0;
        const pendingCount =
          allParticipants?.filter((p) => p.payment_status === 'pending').length ?? 0;

        setPrizePoolStatus({
          total_pool: challengeData.prize_pool,
          paid_count: paidCount,
          pending_count: pendingCount,
        });

        const isPaid = participantData.payment_status === 'paid';
        setConnected(isPaid);

        // Expose challenge for the buy-in button if user hasn't paid yet
        if (!isPaid && challengeData.status === 'active') {
          setPendingBuyIn({
            id: challengeData.id,
            name: challengeData.name,
            buy_in_amount: challengeData.buy_in_amount,
            prize_pool: challengeData.prize_pool,
            buyin_deadline: challengeData.buyin_deadline,
          });
        } else {
          setPendingBuyIn(null);
        }
      } else {
        setPendingBuyIn(null);
      }

      // Load Stripe payout account status
      const stripeStatus = await stripeApi.getStripeAccountStatus();
      setStripeAccountId(stripeStatus.stripe_account_id);
      setStripeOnboardingComplete(stripeStatus.stripe_onboarding_complete);

      // Load Plaid linked savings account info
      const linkedAccount = await plaidApi.getLinkedAccount();
      setPlaidLinked(!!linkedAccount);
      setInstitutionName(linkedAccount?.institution_name ?? null);
      setLastSyncedAt(linkedAccount?.last_synced_at ?? null);

      // Determine if the active challenge has debt tasks (show credit card section)
      if (participantData) {
        const { count: debtTaskCount } = await supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('challenge_id', participantData.challenge_id)
          .eq('task_type', 'debt_payment');
        setIsDebtChallenge((debtTaskCount ?? 0) > 0);
      } else {
        setIsDebtChallenge(false);
      }

      // Load linked debt/credit card account info
      const debtAccount = await plaidApi.getLinkedDebtAccount();
      setDebtLinked(!!debtAccount);
      setDebtInstitutionName(debtAccount?.institution_name ?? null);
      setDebtLastSyncedAt(debtAccount?.last_synced_at ?? null);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWalletData();
  };

  const checkExistingConsent = async (): Promise<boolean> => {
    if (!user) return false;
    const { data } = await supabase
      .from('user_consents')
      .select('id')
      .eq('user_id', user.id)
      .eq('consent_type', 'plaid')
      .eq('version', PLAID_CONSENT_VERSION)
      .is('withdrawn_at', null)
      .maybeSingle();
    return !!data;
  };

  const recordConsent = async () => {
    if (!user) return;
    await supabase.from('user_consents').upsert(
      {
        user_id: user.id,
        consent_type: 'plaid',
        version: PLAID_CONSENT_VERSION,
        consent_string: PLAID_CONSENT_TEXT,
        accepted_at: new Date().toISOString(),
        withdrawn_at: null,
      },
      { onConflict: 'user_id,consent_type,version' }
    );
  };

  const openPlaidWithConsent = async (launchFn: () => void) => {
    const alreadyConsented = await checkExistingConsent();
    if (alreadyConsented) {
      launchFn();
    } else {
      setConsentChecked(false);
      setPendingLinkAction(() => launchFn);
      setShowConsentModal(true);
    }
  };

  const handleConsentAccept = async () => {
    if (!consentChecked || !pendingLinkAction) return;
    setConsentSubmitting(true);
    try {
      await recordConsent();
      setShowConsentModal(false);
      pendingLinkAction();
      setPendingLinkAction(null);
    } catch {
      Alert.alert('Error', 'Failed to record consent. Please try again.');
    } finally {
      setConsentSubmitting(false);
    }
  };

  const launchSavingsLink = async () => {
    setLinkTokenLoading(true);
    setPlaidError(null);
    try {
      const token = await plaidApi.createLinkToken();
      if (!token) {
        setPlaidError('No link token returned from server. Check edge function logs.');
        return;
      }
      setLinkToken(token);
      setShowPlaidLink(true);
    } catch (error: any) {
      setPlaidError(error.message || 'Failed to start bank connection.');
    } finally {
      setLinkTokenLoading(false);
    }
  };

  const launchDebtLink = async () => {
    setDebtLinkTokenLoading(true);
    setDebtError(null);
    try {
      const token = await plaidApi.createLinkToken();
      if (!token) {
        setDebtError('No link token returned from server. Check edge function logs.');
        return;
      }
      setLinkToken(token);
      setShowPlaidLink(true);
    } catch (error: any) {
      setDebtError(error.message || 'Failed to start credit card connection.');
    } finally {
      setDebtLinkTokenLoading(false);
    }
  };

  const handleConnectBank = () => {
    setPendingLinkType('savings');
    openPlaidWithConsent(launchSavingsLink);
  };

  const handleConnectDebtAccount = () => {
    setPendingLinkType('debt');
    openPlaidWithConsent(launchDebtLink);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, all challenge history, bank connections, and personal data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('delete_user_data');
              if (error) throw error;
              await supabase.auth.signOut();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete account. Please contact support.');
            }
          },
        },
      ]
    );
  };

  const handlePlaidSuccess = async (publicToken: string, metadata: any) => {
    setShowPlaidLink(false);
    setLinkToken(null);
    try {
      await plaidApi.exchangeToken(publicToken, metadata, pendingLinkType);
      if (pendingLinkType === 'debt') {
        // Force sync so debt transactions and balances populate immediately
        await plaidApi.syncDebtTransactions(true);
        setDebtLinked(true);
        setDebtInstitutionName(metadata?.institution?.name ?? null);
        Alert.alert('Credit Card Connected', 'Your credit card account is now linked and syncing.');
      } else {
        const result = await plaidApi.syncTransactions(true);
        setLastSyncedAt(result.last_synced_at);
        const linkedAccount = await plaidApi.getLinkedAccount();
        setPlaidLinked(true);
        setInstitutionName(linkedAccount?.institution_name ?? null);
        Alert.alert('Bank Connected', 'Your bank account is now linked and transactions are syncing.');
      }
    } catch (error: any) {
      Alert.alert('Connection Error', error.message || 'Failed to link account.');
    }
  };

  const handlePlaidExit = () => {
    setShowPlaidLink(false);
    setLinkToken(null);
  };

  const handleSyncDebtTransactions = async () => {
    setDebtSyncing(true);
    try {
      const result = await plaidApi.syncDebtTransactions();
      setDebtLastSyncedAt(result.last_synced_at);
      Alert.alert('Synced', `${result.synced} transaction${result.synced !== 1 ? 's' : ''} synced from your credit card.`);
    } catch (error: any) {
      if (error.rateLimited) {
        Alert.alert('Already Up to Date', error.message || `Next sync available in ${error.retryAfterMinutes} minutes.`);
        if (error.lastSyncedAt) setDebtLastSyncedAt(error.lastSyncedAt);
      } else {
        Alert.alert('Sync Error', error.message || 'Failed to sync credit card transactions.');
      }
    } finally {
      setDebtSyncing(false);
    }
  };

  const handleSyncTransactions = async () => {
    setSyncingTransactions(true);
    try {
      const result = await plaidApi.syncTransactions();
      setLastSyncedAt(result.last_synced_at);
      Alert.alert('Synced', `${result.synced} transaction${result.synced !== 1 ? 's' : ''} synced from your bank.`);
    } catch (error: any) {
      if (error.rateLimited) {
        Alert.alert(
          'Already Up to Date',
          error.message || `Next sync available in ${error.retryAfterMinutes} minutes.`
        );
        if (error.lastSyncedAt) setLastSyncedAt(error.lastSyncedAt);
      } else {
        Alert.alert('Sync Error', error.message || 'Failed to sync transactions.');
      }
    } finally {
      setSyncingTransactions(false);
    }
  };

  const handleBuyIn = async () => {
    if (!pendingBuyIn || !user) return;
    setPayingIn(true);
    try {
      const { client_secret } = await stripeApi.createPaymentIntent(pendingBuyIn.id);

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: client_secret,
        merchantDisplayName: 'Tournacent',
        returnURL: 'tournacent://wallet',
        applePay: { merchantCountryCode: 'US' },
        googlePay: { merchantCountryCode: 'US', testEnv: false },
      });

      if (initError) {
        Alert.alert('Setup Error', initError.message);
        return;
      }

      const { error } = await presentPaymentSheet();
      if (!error) {
        // stripe-webhook handles DB update; optimistically update UI
        setConnected(true);
        setPendingBuyIn(null);
        Alert.alert('Payment Successful', 'Your buy-in has been confirmed!');
        fetchWalletData();
      } else if (error.code !== 'Canceled') {
        Alert.alert('Payment Failed', error.message);
      }
    } catch (error: any) {
      Alert.alert('Payment Error', error.message || 'Buy-in failed. Please try again.');
    } finally {
      setPayingIn(false);
    }
  };

  const handleSetupPayoutAccount = async () => {
    setStripeOnboarding(true);
    try {
      const { url } = await stripeApi.createStripeAccount();
      await Linking.openURL(url);
      // stripe-webhook will set stripe_onboarding_complete=true when Stripe fires account.updated
    } catch (error: any) {
      Alert.alert('Setup Error', error.message || 'Failed to start payout account setup.');
    } finally {
      setStripeOnboarding(false);
    }
  };

  const SYNC_COOLDOWN_MS = 60 * 60 * 1000;
  const msSinceSync = lastSyncedAt ? Date.now() - new Date(lastSyncedAt).getTime() : null;
  const syncOnCooldown = msSinceSync !== null && msSinceSync < SYNC_COOLDOWN_MS;
  const minutesUntilSync = syncOnCooldown
    ? Math.ceil((SYNC_COOLDOWN_MS - msSinceSync!) / 60000)
    : 0;

  const formatLastSynced = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  };

  const hoursUntil = (iso: string | null) => {
    if (!iso) return null;
    const h = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60));
    return h > 0 ? h : 0;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle color="#10B981" size={20} />;
      case 'in_progress':
        return <Clock color="#F59E0B" size={20} />;
      case 'denied':
        return <XCircle color="#EF4444" size={20} />;
      default:
        return <Clock color="#6B7280" size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return '#D1FAE5';
      case 'in_progress':
        return '#FEF3C7';
      case 'denied':
        return '#FEE2E2';
      default:
        return '#E5E7EB';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'verified':
        return '#059669';
      case 'in_progress':
        return '#D97706';
      case 'denied':
        return '#DC2626';
      default:
        return '#6B7280';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      buy_in: 'Buy-In Payment',
      payout: 'Prize Payout',
      refund: 'Refund',
    };
    return labels[type] || type;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Wallet</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.subtext }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Wallet</Text>
      </View>

      {/* Plaid Consent Modal */}
      <Modal
        visible={showConsentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowConsentModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowConsentModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Bank Data Consent</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView style={styles.consentScroll} contentContainerStyle={styles.consentContent}>
            <View style={styles.consentIconRow}>
              <Shield color="#10B981" size={32} />
              <Text style={styles.consentHeading}>Your Privacy Matters</Text>
            </View>
            <Text style={styles.consentBody}>{PLAID_CONSENT_TEXT}</Text>
            <TouchableOpacity
              style={styles.consentCheckRow}
              onPress={() => setConsentChecked((v) => !v)}
            >
              <View style={[styles.checkbox, consentChecked && styles.checkboxChecked]}>
                {consentChecked && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.consentCheckLabel}>
                I agree to the above and confirm I am 13 years of age or older
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://tournacent.com/privacy')}>
              <Text style={styles.privacyLinkSmall}>Read full Privacy Policy →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.consentAcceptBtn, (!consentChecked || consentSubmitting) && styles.consentAcceptBtnDisabled]}
              onPress={handleConsentAccept}
              disabled={!consentChecked || consentSubmitting}
            >
              {consentSubmitting
                ? <ActivityIndicator size="small" color="#ffffff" />
                : <Text style={styles.consentAcceptBtnText}>Connect Bank Account</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Plaid Link Modal */}
      <Modal
        visible={showPlaidLink && !!linkToken}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handlePlaidExit}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handlePlaidExit}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Connect Bank Account</Text>
            <View style={{ width: 60 }} />
          </View>
          {linkToken && (
            <PlaidLink
              linkToken={linkToken}
              onSuccess={handlePlaidSuccess}
              onExit={handlePlaidExit}
            />
          )}
        </View>
      </Modal>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Payment Method Section */}
        <View style={styles.connectionSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment Method</Text>

          <Card style={styles.connectionCard}>
            <View style={styles.connectionHeader}>
              <View style={styles.connectionInfo}>
                <CreditCard color={theme.subtext} size={24} />
                <Text style={[styles.connectionLabel, { color: theme.text }]}>
                  {connected ? 'Connected' : 'Not Connected'}
                </Text>
              </View>
              {connected && <CheckCircle color={theme.primary} size={24} />}
            </View>

            {!connected && (
              <View style={styles.explainerBox}>
                <Text style={styles.explainerText}>
                  Your buy-in is held securely until the challenge ends. The winner receives the
                  full pool automatically.
                </Text>
              </View>
            )}

            <View style={styles.paymentOptions}>
              <TouchableOpacity
                style={[styles.paymentOption, pendingBuyIn ? styles.paymentOptionActive : null]}
                onPress={pendingBuyIn ? handleBuyIn : undefined}
                disabled={payingIn || !pendingBuyIn}
              >
                <CreditCard color={pendingBuyIn ? '#10B981' : '#374151'} size={20} />
                <Text style={[styles.paymentOptionText, pendingBuyIn ? styles.paymentOptionActiveText : null]}>
                  {payingIn ? 'Processing...' : 'Debit Card'}
                </Text>
              </TouchableOpacity>
            </View>

            {pendingBuyIn && (
              <View style={styles.buyInBanner}>
                <Text style={styles.buyInTitle}>Buy-In Required</Text>
                <Text style={styles.buyInAmount}>${pendingBuyIn.buy_in_amount}</Text>
                <Text style={styles.buyInChallenge}>{pendingBuyIn.name}</Text>
                {pendingBuyIn.buyin_deadline && (
                  <Text style={styles.buyInDeadline}>
                    {hoursUntil(pendingBuyIn.buyin_deadline)}h left to pay
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.buyInButton, payingIn ? styles.buyInButtonDisabled : null]}
                  onPress={handleBuyIn}
                  disabled={payingIn}
                >
                  <Text style={styles.buyInButtonText}>
                    {payingIn ? 'Processing...' : `Confirm Buy-In · $${pendingBuyIn.buy_in_amount}`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        </View>

        {/* Payout Account Section */}
        <View style={styles.connectionSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Payout Account</Text>
          <Card style={styles.connectionCard}>
            <View style={styles.connectionHeader}>
              <View style={styles.connectionInfo}>
                <Banknote color={stripeOnboardingComplete ? theme.primary : theme.subtext} size={24} />
                <Text style={[styles.connectionLabel, { color: theme.text }]}>
                  {stripeOnboardingComplete ? 'Payout Ready' : stripeAccountId ? 'Setup Incomplete' : 'Not Set Up'}
                </Text>
              </View>
              {stripeOnboardingComplete && <CheckCircle color={theme.primary} size={24} />}
            </View>

            {!stripeOnboardingComplete && (
              <View style={styles.explainerBox}>
                <Text style={styles.explainerText}>
                  Set up a payout account to receive your prize if you win. Powered by Stripe — your bank details are entered directly with Stripe and never stored by Tournacent.
                </Text>
              </View>
            )}

            {!stripeOnboardingComplete && (
              <TouchableOpacity
                style={[styles.connectButton, { backgroundColor: '#6366F1' }]}
                onPress={handleSetupPayoutAccount}
                disabled={stripeOnboarding}
              >
                {stripeOnboarding
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <Banknote size={16} color="#ffffff" />
                }
                <Text style={styles.connectButtonText}>
                  {stripeOnboarding ? 'Opening...' : stripeAccountId ? 'Resume Payout Setup' : 'Set Up Payout Account'}
                </Text>
              </TouchableOpacity>
            )}
          </Card>
        </View>

        {/* Plaid Bank Connection Section */}
        <View style={styles.plaidSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Bank Account (Plaid)</Text>

          <Card style={styles.plaidCard}>
            <View style={styles.plaidHeader}>
              <View style={styles.plaidInfo}>
                <Building2 color={plaidLinked ? theme.primary : theme.subtext} size={24} />
                <View style={styles.plaidTextGroup}>
                  <Text style={[styles.plaidLabel, { color: theme.text }]}>
                    {plaidLinked ? 'Bank Connected' : 'No Bank Linked'}
                  </Text>
                  {institutionName && (
                    <Text style={[styles.institutionName, { color: theme.primary }]}>{institutionName}</Text>
                  )}
                </View>
              </View>
              {plaidLinked && <CheckCircle color={theme.primary} size={24} />}
            </View>

            {!plaidLinked && (
              <View style={styles.plaidExplainerBox}>
                <Text style={styles.plaidExplainerText}>
                  Connect your bank account to verify deposits, monitor transactions, and
                  automatically track challenge compliance.
                </Text>
              </View>
            )}

            {plaidError && (
              <View style={styles.plaidErrorBox}>
                <Text style={styles.plaidErrorText}>{plaidError}</Text>
              </View>
            )}

            {plaidLinked ? (
              <>
                {lastSyncedAt && (
                  <Text style={[styles.lastSyncedText, { color: theme.subtext }]}>
                    Last synced {formatLastSynced(lastSyncedAt)}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.syncButton, { borderColor: theme.primary, backgroundColor: theme.background }, syncOnCooldown && styles.syncButtonDisabled]}
                  onPress={handleSyncTransactions}
                  disabled={syncingTransactions || syncOnCooldown}
                >
                  {syncingTransactions ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <RefreshCw size={16} color={syncOnCooldown ? theme.subtext : theme.primary} />
                  )}
                  <Text style={[styles.syncButtonText, { color: theme.primary }, syncOnCooldown && styles.syncButtonTextDisabled]}>
                    {syncingTransactions
                      ? 'Syncing...'
                      : syncOnCooldown
                        ? `Available in ${minutesUntilSync}m`
                        : 'Sync Transactions'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.connectButton, { backgroundColor: theme.primary }]}
                onPress={handleConnectBank}
                disabled={linkTokenLoading}
              >
                {linkTokenLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <LinkIcon size={16} color="#ffffff" />
                )}
                <Text style={styles.connectButtonText}>
                  {linkTokenLoading ? 'Preparing...' : 'Connect Bank via Plaid'}
                </Text>
              </TouchableOpacity>
            )}
          </Card>
        </View>

        {/* Credit Card (Debt) Section — shown only for debt challenges */}
        {isDebtChallenge && (
          <View style={styles.plaidSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Credit Card (Plaid)</Text>
            <Text style={[styles.debtSectionHint, { color: theme.subtext }]}>
              Connect your credit card or loan account so the app can verify your payments and monitor new charges during the Debt Destroyer challenge.
            </Text>

            <Card style={styles.plaidCard}>
              <View style={styles.plaidHeader}>
                <View style={styles.plaidInfo}>
                  <CreditCard color={debtLinked ? theme.primary : theme.subtext} size={24} />
                  <View style={styles.plaidTextGroup}>
                    <Text style={[styles.plaidLabel, { color: theme.text }]}>
                      {debtLinked ? 'Credit Card Connected' : 'No Credit Card Linked'}
                    </Text>
                    {debtInstitutionName && (
                      <Text style={[styles.institutionName, { color: theme.primary }]}>{debtInstitutionName}</Text>
                    )}
                  </View>
                </View>
                {debtLinked && <CheckCircle color={theme.primary} size={24} />}
              </View>

              {!debtLinked && (
                <View style={styles.plaidExplainerBox}>
                  <Text style={styles.plaidExplainerText}>
                    Required to verify debt payments and detect new charges that break your spending freeze streak.
                  </Text>
                </View>
              )}

              {debtError && (
                <View style={styles.plaidErrorBox}>
                  <Text style={styles.plaidErrorText}>{debtError}</Text>
                </View>
              )}

              {debtLinked ? (
                <>
                  {debtLastSyncedAt && (
                    <Text style={[styles.lastSyncedText, { color: theme.subtext }]}>
                      Last synced {formatLastSynced(debtLastSyncedAt)}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={[styles.syncButton, { borderColor: theme.primary, backgroundColor: theme.background }]}
                    onPress={handleSyncDebtTransactions}
                    disabled={debtSyncing}
                  >
                    {debtSyncing ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <RefreshCw size={16} color={theme.primary} />
                    )}
                    <Text style={[styles.syncButtonText, { color: theme.primary }]}>
                      {debtSyncing ? 'Syncing...' : 'Sync Credit Card'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.connectButton, { backgroundColor: '#F97316' }]}
                  onPress={handleConnectDebtAccount}
                  disabled={debtLinkTokenLoading}
                >
                  {debtLinkTokenLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <LinkIcon size={16} color="#ffffff" />
                  )}
                  <Text style={styles.connectButtonText}>
                    {debtLinkTokenLoading ? 'Preparing...' : 'Connect Credit Card via Plaid'}
                  </Text>
                </TouchableOpacity>
              )}
            </Card>
          </View>
        )}

        {/* Prize Pool Section */}
        {prizePoolStatus && (
          <View style={styles.prizePoolSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Current Prize Pool</Text>

            <Card style={styles.prizePoolCard}>
              <View style={styles.prizePoolHeader}>
                <WalletIcon color={theme.primary} size={32} />
                <Text style={[styles.prizePoolAmount, { color: theme.primary }]}>${prizePoolStatus.total_pool}</Text>
              </View>

              <View style={styles.prizePoolStats}>
                <View style={styles.prizePoolStat}>
                  <Text style={[styles.prizePoolStatValue, { color: theme.text }]}>{prizePoolStatus.paid_count}</Text>
                  <Text style={[styles.prizePoolStatLabel, { color: theme.subtext }]}>Paid</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.prizePoolStat}>
                  <Text style={[styles.prizePoolStatValue, { color: theme.text }]}>{prizePoolStatus.pending_count}</Text>
                  <Text style={[styles.prizePoolStatLabel, { color: theme.subtext }]}>Pending</Text>
                </View>
              </View>

              <ProgressBar
                progress={
                  prizePoolStatus.paid_count + prizePoolStatus.pending_count > 0
                    ? prizePoolStatus.paid_count / (prizePoolStatus.paid_count + prizePoolStatus.pending_count)
                    : 0
                }
                height={6}
              />

              {prizePoolStatus.pending_count > 0 && (
                <View style={styles.nudgeBox}>
                  <Text style={styles.nudgeText}>
                    Waiting on {prizePoolStatus.pending_count} player
                    {prizePoolStatus.pending_count > 1 ? 's' : ''} to pay their buy-in before
                    the challenge can begin.
                  </Text>
                </View>
              )}
            </Card>
          </View>
        )}

        {/* Privacy & Account Section */}
        <View style={styles.privacySection}>
          <TouchableOpacity
            style={styles.privacyLinkRow}
            onPress={() => Linking.openURL('https://tournacent.com/privacy')}
          >
            <Shield color={theme.subtext} size={16} />
            <Text style={[styles.privacyLinkText, { color: theme.subtext }]}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteAccountRow} onPress={handleDeleteAccount}>
            <Trash2 color="#DC2626" size={16} />
            <Text style={styles.deleteAccountText}>Delete My Account</Text>
          </TouchableOpacity>
        </View>

        {/* Transaction History Section */}
        <View style={styles.transactionsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Transaction History</Text>

          {transactions.length === 0 ? (
            <Card style={styles.emptyTransactions}>
              <Text style={[styles.emptyText, { color: theme.subtext }]}>No transactions yet</Text>
            </Card>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((transaction) => (
                <Card key={transaction.id} style={styles.transactionCard}>
                  <View style={styles.transactionLeft}>
                    {getStatusIcon(transaction.status)}
                    <View style={styles.transactionInfo}>
                      <Text style={[styles.transactionType, { color: theme.text }]}>
                        {getTransactionTypeLabel(transaction.transaction_type)}
                      </Text>
                      <Text style={[styles.transactionChallenge, { color: theme.subtext }]}>
                        {transaction.challenges.name}
                      </Text>
                      <Text style={[styles.transactionDate, { color: theme.subtext }]}>
                        {formatDate(transaction.created_at)}
                      </Text>
                      {transaction.status === 'denied' && transaction.denial_reason && (
                        <Text style={styles.denialReason}>{transaction.denial_reason}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text
                      style={[
                        styles.transactionAmount,
                        { color: theme.text },
                        transaction.transaction_type === 'payout' && { color: theme.primary },
                      ]}
                    >
                      {transaction.transaction_type === 'payout' ? '+' : '-'}$
                      {transaction.amount}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(transaction.status) },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusTextColor(transaction.status) },
                        ]}
                      >
                        {transaction.status}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCancel: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
    width: 60,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  // Payment Method
  connectionSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  connectionCard: {
    gap: 16,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  connectionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  explainerBox: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
  },
  explainerText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  paymentOptions: {
    gap: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentOptionActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  paymentOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  paymentOptionActiveText: {
    color: '#10B981',
  },
  buyInBanner: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  buyInTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  buyInAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  buyInChallenge: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  buyInDeadline: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
    marginBottom: 8,
  },
  buyInButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buyInButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buyInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  debtSectionHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
  },
  // Plaid Section
  plaidSection: {
    gap: 12,
  },
  plaidCard: {
    gap: 16,
  },
  plaidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  plaidInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  plaidTextGroup: {
    gap: 2,
  },
  plaidLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  institutionName: {
    fontSize: 13,
    fontWeight: '500',
  },
  plaidExplainerBox: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
  },
  plaidExplainerText: {
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
  plaidErrorBox: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
  },
  plaidErrorText: {
    fontSize: 13,
    color: '#DC2626',
    lineHeight: 18,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  syncButtonText: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '600',
  },
  syncButtonDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  syncButtonTextDisabled: {
    color: '#9CA3AF',
  },
  lastSyncedText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: -4,
  },
  // Prize Pool
  prizePoolSection: {
    gap: 12,
  },
  prizePoolCard: {
    gap: 16,
  },
  prizePoolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  prizePoolAmount: {
    fontSize: 36,
    fontWeight: '700',
  },
  prizePoolStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  prizePoolStat: {
    alignItems: 'center',
    gap: 4,
  },
  prizePoolStatValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  prizePoolStatLabel: {
    fontSize: 14,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  nudgeBox: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
  },
  nudgeText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  // Consent modal
  consentScroll: {
    flex: 1,
  },
  consentContent: {
    padding: 24,
    gap: 20,
  },
  consentIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  consentHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  consentBody: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  consentCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  consentCheckLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  privacyLinkSmall: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '500',
  },
  consentAcceptBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  consentAcceptBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  consentAcceptBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Privacy & account
  privacySection: {
    gap: 8,
    paddingVertical: 8,
  },
  privacyLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  privacyLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  deleteAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  deleteAccountText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#DC2626',
  },
  // Transactions
  transactionsSection: {
    gap: 12,
  },
  transactionsList: {
    gap: 12,
  },
  emptyTransactions: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionLeft: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  transactionInfo: {
    gap: 4,
    flex: 1,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: '600',
  },
  transactionChallenge: {
    fontSize: 14,
  },
  transactionDate: {
    fontSize: 12,
  },
  denialReason: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
