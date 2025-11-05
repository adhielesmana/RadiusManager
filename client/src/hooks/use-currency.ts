import { useQuery } from "@tanstack/react-query";
import type { Settings } from "@shared/schema";
import { formatCurrency, getCurrencyByCode } from "@shared/currencies";

export function useCurrency() {
  const { data: settings } = useQuery<Settings>({
    queryKey: ['/api/settings'],
  });

  const currencyCode = settings?.currencyCode || 'IDR';
  const currency = getCurrencyByCode(currencyCode);

  const format = (amount: number | string) => {
    return formatCurrency(amount, currencyCode);
  };

  return {
    currencyCode,
    currency,
    format,
  };
}
