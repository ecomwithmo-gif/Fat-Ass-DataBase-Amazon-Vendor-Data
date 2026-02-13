import { useState, useEffect, useMemo } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import api from '../lib/axios';
import { cn, formatCurrency, formatNumber, formatPercentage } from '../lib/utils';
import { calculateFeesAndProfit, getSmartColor } from '../lib/calculations';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import ExcelColumnFilter from './ExcelColumnFilter';

export default function AmazonMatchDetails({ isOpen, onClose, asins = [], initialMatches = [], referenceProduct = {}, shippingCost = 0, miscCost = 0 }) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  useEffect(() => {
    if (isOpen) {
        if (initialMatches && initialMatches.length > 0) {
            // Use provided data directly
            const productsWithMetrics = initialMatches.map(p => {
                const metrics = calculateFeesAndProfit(referenceProduct || {}, p, shippingCost, miscCost);
                return { ...p, metrics };
            });
            setProducts(productsWithMetrics);
        } else if (asins.length > 0) {
            // Fallback to fetch if only ASINs provided
            fetchAmazonProducts();
        } else {
            setProducts([]);
        }
    }
  }, [isOpen, asins, initialMatches, referenceProduct, shippingCost, miscCost]);

  const fetchAmazonProducts = async () => {
    setLoading(true);
    try {
      // Fetch products that match the ASINs (which are stored as SKU for Amazon Data)
      const response = await api.post('/products/by-skus', { 
          vendor: 'Amazon Data',
          skus: asins 
      });
      
      const rawProducts = response.data;
      
      // Calculate metrics for each Amazon product using the Vendor Product (referenceProduct) as the cost basis
      const productsWithMetrics = rawProducts.map(p => {
          const metrics = calculateFeesAndProfit(referenceProduct || {}, p, shippingCost, miscCost);
          return {
              ...p,
              metrics // Attach metrics
          };
      });

      setProducts(productsWithMetrics);

    } catch (error) {
      console.error("Failed to fetch match details", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract value similar to original logic
  // hierarchy: product[key] -> additional_data[key] -> additional_data[legacyHeader] -> additional_data[fallbackKey]
  const getValue = (row, colConfig) => {
      let value = row[colConfig.key];
      if (value === undefined && row.additional_data) {
          value = row.additional_data[colConfig.key];
      }
      if (value === undefined && row.additional_data && colConfig.legacyHeader) {
          value = row.additional_data[colConfig.legacyHeader];
      }
      if (value === undefined && colConfig.fallbackKey && row.additional_data) {
          value = row.additional_data[colConfig.fallbackKey];
      }
      return value;
  };

  const safeFilter = (row, columnId, filterValue) => {
    const value = row.getValue(columnId);
    if (Array.isArray(filterValue)) {
        if (value === null || value === undefined) {
             return filterValue.includes("(Blanks)");
        }
        return filterValue.includes(String(value));
    }
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
  };

  const columns = useMemo(() => {
      const config = [
          { header: 'Imported by Code', key: 'ImportedBy', legacyHeader: 'Imported by Code' },
          { header: 'Image', key: 'vendor_image', type: 'image' },
          { header: 'Brand', key: 'brand' },
          { header: 'Parent ASIN', key: 'parent_sku', fallbackKey: 'ParentASIN' },
          { header: 'ASIN', key: 'sku' },
          { header: 'Title', key: 'title', className: 'max-w-xs truncate' },
          // Financials
          { 
              header: 'Referral Fee', 
              id: 'referral_fee',
              accessorFn: row => row.metrics?.referralFeePercent ? (row.metrics.referralFeePercent * 100).toFixed(0) + '%' : '-' 
          },
          { 
              header: 'Pick & Pack', 
              id: 'pick_pack',
              accessorFn: row => formatCurrency(row.metrics?.pickAndPackFee) 
          },
          { 
              header: 'Total Cost', 
              id: 'total_cost',
              accessorFn: row => formatCurrency(row.metrics?.totalCost) 
          },
          { 
              header: 'Sale Price', 
              id: 'sale_price',
              accessorFn: row => formatCurrency(row.metrics?.salePrice) 
          },
          { 
              header: 'Profit', 
              id: 'profit',
              accessorFn: row => row.metrics?.profit, // Access raw number for sorting
              cell: ({ getValue }) => {
                  const val = getValue();
                  const color = getSmartColor('Profit', val);
                  return <span className={color}>{formatCurrency(val)}</span>;
              }
          },
          { 
              header: 'ROI', 
              id: 'roi',
              accessorFn: row => row.metrics?.roi,
              cell: ({ getValue }) => {
                  const val = getValue();
                  const color = getSmartColor('ROI', val);
                  return <span className={color}>{val?.toFixed(1)}%</span>;
              }
          },
          { 
              header: 'Margin (BB)', 
              id: 'margin_bb',
              accessorFn: row => row.metrics?.marginBuyBox,
              cell: ({ getValue, row }) => {
                  const val = getValue();
                  const noBuyBox = !row.original.metrics?.salePrice;
                  if (noBuyBox) return <span className="text-red-500">No BB</span>;
                  const color = getSmartColor('MarginBuyBox', val, { noBuyBox });
                  return <span className={color}>{val?.toFixed(1)}%</span>;
              }
          },
          { 
              header: 'MSRP Diff', 
              id: 'msrp_diff',
              accessorFn: row => row.metrics?.msrpDiff,
              cell: ({ getValue }) => {
                  const val = getValue();
                  const color = getSmartColor('MSRPDiff', val);
                  return <span className={color}>{val?.toFixed(1)}%</span>;
              }
          },
          { header: 'Rating', key: 'Rating', legacyHeader: 'Reviews: Rating Count', formatter: formatNumber },
          { header: 'Review Count', key: 'ReviewCount', legacyHeader: 'Reviews: Review Count - Format Specific', formatter: formatNumber },
          { header: 'Rank Current', key: 'RankCurrent', legacyHeader: 'Sales Rank: Current', formatter: formatNumber, smartType: 'SalesRank' },
          { header: 'Amz Avail', key: 'AmzAvailability', legacyHeader: 'Amazon: Availability of the Amazon offer', smartType: 'AmazonAvailability' },
          { header: 'Amz BB %', key: 'AmzBuyBox90', legacyHeader: 'Buy Box: % Amazon 90 days', formatter: formatPercentage },
          { header: 'FBA Offers', key: 'FBAOffers', legacyHeader: 'Count of retrieved live offers: New, FBA', formatter: formatNumber },
          { header: 'FBM Offers', key: 'FBMOffers', legacyHeader: 'Count of retrieved live offers: New, FBM', formatter: formatNumber },
          { header: 'Total Offers', key: 'TotalOffers', legacyHeader: 'Total Offer Count', formatter: formatNumber },
      ];

      // Transform config into TanStack columns
      return [
        {
            id: 'actions',
            header: 'Actions',
            enableSorting: false,
            enableColumnFilter: false,
            cell: ({ row }) => (
                <a 
                    href={`https://www.amazon.com/dp/${row.original.sku}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs font-medium"
                >
                    View <ExternalLink size={10} />
                </a>
            )
        },
        ...config.map(col => {
            // If accessorFn is provided (calculated fields), use it
            if (col.accessorFn) {
                return {
                    id: col.id,
                    header: col.header,
                    accessorFn: col.accessorFn,
                    cell: col.cell ? col.cell : ({ getValue }) => getValue(),
                };
            }

            // Otherwise usage generic extractor
            return {
                id: col.key,
                header: col.header,
                accessorFn: row => getValue(row, col),
                cell: ({ getValue }) => {
                    const value = getValue();
                    
                    if (col.type === 'image') {
                        return (
                            <div className="w-10 h-10 bg-muted rounded overflow-hidden border">
                                {value ? (
                                    <img src={value} alt="" className="w-full h-full object-contain bg-white" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">No Img</div>
                                )}
                            </div>
                        );
                    }

                    // Smart Styling
                    let className = "";
                    if (col.className) className += ` ${col.className}`;
                    
                    let content = value !== null && value !== undefined ? (col.formatter ? col.formatter(value) : String(value)) : '-';
                    
                    if (col.smartType) {
                        const colorClass = getSmartColor(col.smartType, value);
                        content = <span className={colorClass}>{content}</span>;
                    }

                    return <div className={className} title={String(value)}>{content}</div>;
                }
            };
        })
      ];
  }, []);

  const table = useReactTable({
    data: products,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    filterFns: {
       safe: safeFilter, // Register custom filter
    },
    defaultColumn: {
       filterFn: 'safe', // Use it by default
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-background rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col border border-border">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Amazon Matches</h2>
            <p className="text-sm text-muted-foreground">Found {asins.length} linked ASIN(s)</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-0 flex flex-col">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Loader2 className="animate-spin mb-2" size={32} />
                    <p>Loading Amazon data...</p>
                </div>
            ) : products.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
                    <p>No details found for these ASINs in the database.</p>
                    <p className="text-xs mt-2 opacity-70">Ensure "Amazon Data" contains these ASINs as SKUs.</p>
                </div>
            ) : (
                <div className="flex-1 overflow-auto relative">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-muted/50 sticky top-0 z-10 border-b border-border font-medium text-muted-foreground shadow-sm">
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th 
                                            key={header.id} 
                                            className="p-3 whitespace-nowrap bg-muted/90 backdrop-blur-sm border-r border-border/50 first:sticky first:left-0 first:z-20 min-w-[100px]"
                                            style={header.column.id === 'actions' ? { width: '80px', minWidth: '80px' } : {}}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                {header.column.getCanFilter() && (
                                                    <ExcelColumnFilter column={header.column} table={table} />
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-border">
                            {table.getRowModel().rows.map(row => (
                                <tr key={row.id} className="hover:bg-muted/20">
                                    {row.getVisibleCells().map(cell => (
                                        <td 
                                            key={cell.id} 
                                            className={cn(
                                                "p-3 whitespace-nowrap border-r border-border/50",
                                                cell.column.id === 'actions' && "sticky left-0 z-10 bg-background/50 border-r-2"
                                            )}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex justify-end shrink-0">
            <button onClick={onClose} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm font-medium">
                Close
            </button>
        </div>
      </div>
    </div>
  );
}
