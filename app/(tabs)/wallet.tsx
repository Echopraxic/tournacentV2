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
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { plaidApi } from '@/lib/plaid';
import { PlaidLink } from '@/components/PlaidLink';
import {
  CreditCard,
  Building2,
  CheckCircle,
  Clock,
  XCircle,
  Wallet as WalletIcon,
  Link as LinkIcon,
  RefreshCw,
} from 'lucide-react-native';

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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prizePoolStatus, setPrizePoolStatus] = useState<PrizePoolStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingBuyIn, setPendingBuyIn] = useState<ActiveChallenge | null>(null);
  const [payingIn, setPayingIn] = useState(false);

  // Plaid Link state
  const [plaidLinked, setPlaidLinked] = useState(false);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [showPlaidLink, setShowPlaidLink] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkTokenLoading, setLinkTokenLoading] = useState(false);
  const [syncingTransactions, setSyncingTransactions] = useState(false);

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

      // Load Plaid linked account info
      const linkedAccount = await plaidApi.getLinkedAccount();
      setPlaidLinked(!!linkedAccount);
      setInstitutionName(linkedAccount?.institution_name ?? null);
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

  const handleConnectBank = async () => {
    setLinkTokenLoading(true);
    try {
      const token = await plaidApi.createLinkToken();
      setLinkToken(token);
      setShowPlaidLink(true);
    } catch (error: any) {
      Alert.alert('Connection Error', error.message || 'Failed to start bank connection.');
    } finally {
      setLinkTokenLoading(false);
    }
  };

  const handlePlaidSuccess = async (publicToken: string, metadata: any) => {
    setShowPlaidLink(false);
    setLinkToken(null);
    try {
      await plaidApi.exchangeToken(publicToken, metadata);
      // Sync transactions immediately after linking
      await plaidApi.syncTransactions();
      const linkedAccount = await plaidApi.getLinkedAccount();
      setPlaidLinked(true);
      setInstitutionName(linkedAccount?.institution_name ?? null);
      Alert.alert('Bank Connected', 'Your bank account is now linked and transactions are syncing.');
    } catch (error: any) {
      Alert.alert('Connection Error', error.message || 'Failed to link bank account.');
    }
  };

  const handlePlaidExit = () => {
    setShowPlaidLink(false);
    setLinkToken(null);
  };

  const handleSyncTransactions = async () => {
    setSyncingTransactions(true);
    try {
      const count = await plaidApi.syncTransactions();
      Alert.alert('Synced', `${count} transaction${count !== 1 ? 's' : ''} synced from your bank.`);
    } catch (error: any) {
      Alert.alert('Sync Error', error.message || 'Failed to sync transactions.');
    } finally {
      setSyncingTransactions(false);
    }
  };

  const handleBuyIn = async () => {
    if (!pendingBuyIn || !user) return;
    setPayingIn(true);
    try {
      await supabase
        .from('challenge_participants')
        .update({ payment_status: 'paid' })
        .eq('challenge_id', pendingBuyIn.id)
        .eq('user_id', user.id);

      await supabase
        .from('challenges')
        .update({ prize_pool: pendingBuyIn.prize_pool + pendingBuyIn.buy_in_amount })
        .eq('id', pendingBuyIn.id);

      await supabase.from('transactions').insert({
        user_id: user.id,
        challenge_id: pendingBuyIn.id,
        amount: pendingBuyIn.buy_in_amount,
        transaction_type: 'buy_in',
        status: 'verified',
      });

      setConnected(true);
      setPendingBuyIn(null);
      fetchWalletData();
    } catch (error: any) {
      Alert.alert('Payment Error', error.message || 'Buy-in failed. Please try again.');
    } finally {
      setPayingIn(false);
    }
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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wallet</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wallet</Text>
      </View>

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
          <Text style={styles.sectionTitle}>Payment Method</Text>

          <View style={styles.connectionCard}>
            <View style={styles.connectionHeader}>
              <View style={styles.connectionInfo}>
                <CreditCard color="#6B7280" size={24} />
                <Text style={styles.connectionLabel}>
                  {connected ? 'Connected' : 'Not Connected'}
                </Text>
              </View>
              {connected && <CheckCircle color="#10B981" size={24} />}
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
          </View>
        </View>

        {/* Plaid Bank Connection Section */}
        <View style={styles.plaidSection}>
          <Text style={styles.sectionTitle}>Bank Account (Plaid)</Text>

          <View style={styles.plaidCard}>
            <View style={styles.plaidHeader}>
              <View style={styles.plaidInfo}>
                <Building2 color={plaidLinked ? '#10B981' : '#6B7280'} size={24} />
                <View style={styles.plaidTextGroup}>
                  <Text style={styles.plaidLabel}>
                    {plaidLinked ? 'Bank Connected' : 'No Bank Linked'}
                  </Text>
                  {institutionName && (
                    <Text style={styles.institutionName}>{institutionName}</Text>
                  )}
                </View>
              </View>
              {plaidLinked && <CheckCircle color="#10B981" size={24} />}
            </View>

            {!plaidLinked && (
              <View style={styles.plaidExplainerBox}>
                <Text style={styles.plaidExplainerText}>
                  Connect your bank account to verify deposits, monitor transactions, and
                  automatically track challenge compliance.
                </Text>
              </View>
            )}

            {plaidLinked ? (
              <TouchableOpacity
                style={styles.syncButton}
                onPress={handleSyncTransactions}
                disabled={syncingTransactions}
              >
                {syncingTransactions ? (
                  <ActivityIndicator size="small" color="#10B981" />
                ) : (
                  <RefreshCw size={16} color="#10B981" />
                )}
                <Text style={styles.syncButtonText}>
                  {syncingTransactions ? 'Syncing...' : 'Sync Transactions'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.connectButton}
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
          </View>
        </View>

        {/* Prize Pool Section */}
        {prizePoolStatus && (
          <View style={styles.prizePoolSection}>
            <Text style={styles.sectionTitle}>Current Prize Pool</Text>

            <View style={styles.prizePoolCard}>
              <View style={styles.prizePoolHeader}>
                <WalletIcon color="#10B981" size={32} />
                <Text style={styles.prizePoolAmount}>${prizePoolStatus.total_pool}</Text>
              </View>

              <View style={styles.prizePoolStats}>
                <View style={styles.prizePoolStat}>
                  <Text style={styles.prizePoolStatValue}>{prizePoolStatus.paid_count}</Text>
                  <Text style={styles.prizePoolStatLabel}>Paid</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.prizePoolStat}>
                  <Text style={styles.prizePoolStatValue}>{prizePoolStatus.pending_count}</Text>
                  <Text style={styles.prizePoolStatLabel}>Pending</Text>
                </View>
              </View>

              {prizePoolStatus.pending_count > 0 && (
                <View style={styles.nudgeBox}>
                  <Text style={styles.nudgeText}>
                    Waiting on {prizePoolStatus.pending_count} player
                    {prizePoolStatus.pending_count > 1 ? 's' : ''} to pay their buy-in before
                    the challenge can begin.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Transaction History Section */}
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Transaction History</Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyTransactions}>
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((transaction) => (
                <View key={transaction.id} style={styles.transactionCard}>
                  <View style={styles.transactionLeft}>
                    {getStatusIcon(transaction.status)}
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionType}>
                        {getTransactionTypeLabel(transaction.transaction_type)}
                      </Text>
                      <Text style={styles.transactionChallenge}>
                        {transaction.challenges.name}
                      </Text>
                      <Text style={styles.transactionDate}>
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
                        transaction.transaction_type === 'payout' &&
                          styles.transactionAmountPositive,
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
                </View>
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
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
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
    color: '#6B7280',
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
    color: '#111827',
  },
  connectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    color: '#111827',
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
  // Plaid Section
  plaidSection: {
    gap: 12,
  },
  plaidCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    color: '#111827',
  },
  institutionName: {
    fontSize: 13,
    color: '#10B981',
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
  // Prize Pool
  prizePoolSection: {
    gap: 12,
  },
  prizePoolCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    color: '#10B981',
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
    color: '#111827',
  },
  prizePoolStatLabel: {
    fontSize: 14,
    color: '#6B7280',
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
  // Transactions
  transactionsSection: {
    gap: 12,
  },
  transactionsList: {
    gap: 12,
  },
  emptyTransactions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    color: '#111827',
  },
  transactionChallenge: {
    fontSize: 14,
    color: '#6B7280',
  },
  transactionDate: {
    fontSize: 12,
    color: '#9CA3AF',
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
    color: '#111827',
  },
  transactionAmountPositive: {
    color: '#10B981',
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
