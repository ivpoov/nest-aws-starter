import type { ReactElement } from 'react';
import { TransactionFilterBar } from '../components/Transactions/TransactionFilterBar';
import { TransactionList } from '../components/Transactions/TransactionList';
import { useAdminTransactions } from '../hooks/transactions/useAdminTransactions';
import { useTransactionFilters } from '../hooks/transactions/useTransactionFilters';

export function TransactionsPage(): ReactElement {
  const {
    filters,
    selectedUserLabel,
    toggleStatus,
    clearStatus,
    setDateFrom,
    setDateTo,
    selectUser,
    clearUser,
  } = useTransactionFilters();
  const { transactions, hasMore, isLoading, error, loadMore } = useAdminTransactions(filters);

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <h1 className="text-lg font-semibold">Transactions</h1>
      <TransactionFilterBar
        filters={filters}
        selectedUserLabel={selectedUserLabel}
        onToggleStatus={toggleStatus}
        onClearStatus={clearStatus}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onSelectUser={selectUser}
        onClearUser={clearUser}
      />
      <TransactionList
        transactions={transactions}
        isLoading={isLoading}
        error={error}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
    </div>
  );
}
