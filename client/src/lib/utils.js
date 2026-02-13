import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"


export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const num = parseFloat(String(value).replace(/[^0-9.-]+/g,""));
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

export const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const num = parseFloat(String(value).replace(/,/g, ''));
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatPercentage = (value) => {
    if (value === null || value === undefined || value === '') return '';
    // Check if already has %
    if (String(value).includes('%')) return value;
    const num = parseFloat(String(value));
    if (isNaN(num)) return value;
    return `${num}%`;
};
