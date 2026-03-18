import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  CreditCard,
  Building2,
  CheckCircle,
  Clock,
  XCircle,
  Wallet as WalletIcon,
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

export default function Wallet() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [prizePoolStatus, setPrizePoolStatus] = useState<PrizePoolStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchWalletData = async () => {
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

        const paidCount = allParticipants?.filter(p => p.payment_status === 'paid').length || 0;
        const pendingCount = allParticipants?.filter(p => p.payment_status === 'pending').length || 0;

        setPrizePoolStatus({
          total_pool: challengeData.prize_pool,
          paid_count: paidCount,
          pending_count: pendingCount,
        });

        setConnected(participantData.payment_status === 'paid');
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWalletData();
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
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
                  Your buy-in is held securely until the challenge ends. The
                  winner receives the full pool automatically.
                </Text>
              </View>
            )}

            <View style={styles.paymentOptions}>
              <TouchableOpacity style={styles.paymentOption}>
                <Building2 color="#374151" size={20} />
                <Text style={styles.paymentOptionText}>Bank Account</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.paymentOption}>
                <CreditCard color="#374151" size={20} />
                <Text style={styles.paymentOptionText}>Debit Card</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {prizePoolStatus && (
          <View style={styles.prizePoolSection}>
            <Text style={styles.sectionTitle}>Current Prize Pool</Text>

            <View style={styles.prizePoolCard}>
              <View style={styles.prizePoolHeader}>
                <WalletIcon color="#10B981" size={32} />
                <Text style={styles.prizePoolAmount}>
                  ${prizePoolStatus.total_pool}
                </Text>
              </View>

              <View style={styles.prizePoolStats}>
                <View style={styles.prizePoolStat}>
                  <Text style={styles.prizePoolStatValue}>
                    {prizePoolStatus.paid_count}
                  </Text>
                  <Text style={styles.prizePoolStatLabel}>Paid</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.prizePoolStat}>
                  <Text style={styles.prizePoolStatValue}>
                    {prizePoolStatus.pending_count}
                  </Text>
                  <Text style={styles.prizePoolStatLabel}>Pending</Text>
                </View>
              </View>

              {prizePoolStatus.pending_count > 0 && (
                <View style={styles.nudgeBox}>
                  <Text style={styles.nudgeText}>
                    Waiting on {prizePoolStatus.pending_count} player
                    {prizePoolStatus.pending_count > 1 ? 's' : ''} to pay their
                    buy-in before the challenge can begin.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

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
                        <Text style={styles.denialReason}>
                          {transaction.denial_reason}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text
                      style={[
                        styles.transactionAmount,
                        transaction.transaction_type === 'payout' && styles.transactionAmountPositive,
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
  paymentOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
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
