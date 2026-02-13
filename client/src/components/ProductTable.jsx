import { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from '@tanstack/react-table';
// import {
//   DndContext,
//   closestCenter,
//   KeyboardSensor,
//   PointerSensor,
//   useSensor,
//   useSensors,
//   DragOverlay,
// } from '@dnd-kit/core';
// import {
//   arrayMove,
//   SortableContext,
//   horizontalListSortingStrategy,
// } from '@dnd-kit/sortable';
import { Plus, Trash, Download, Upload, Save, RefreshCw } from 'lucide-react';
import api from '../lib/axios';
import { cn, formatCurrency, formatNumber, formatPercentage } from '../lib/utils';
import ImportModal from './ImportModal';
import AmazonMatchDetails from './AmazonMatchDetails';
import ExcelColumnFilter from './ExcelColumnFilter';
import ColumnManager from './ColumnManager';
import { toast } from 'sonner';
import { calculateFeesAndProfit, determineBestVariants, getSmartColor, parseCleanNumber } from '../lib/calculations';


export default function ProductTable({ vendorName }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editedRows, setEditedRows] = useState({});
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);

  const [selectedAsins, setSelectedAsins] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null); // Context for Amazon Match
  const [isImportModalOpen, setIsImportModalOpen] = useState(false); // RENAMED
  const [columnOrder, setColumnOrder] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [activeId, setActiveId] = useState(null);
  
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 50, // User requested 50 per page
  });
  const [columnFilters, setColumnFilters] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // Safe filter function that handles null/undefined/numbers
  const safeFilter = (row, columnId, filterValue) => {
    const value = row.getValue(columnId);
    
    // Multi-select filter (Array)
    if (Array.isArray(filterValue)) {
        if (value === null || value === undefined) {
             return filterValue.includes("(Blanks)");
        }
        return filterValue.includes(String(value));
    }

    // Text search (String)
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
  };

  // Search State
  const [globalFilter, setGlobalFilter] = useState('');
  const [debouncedGlobalFilter, setDebouncedGlobalFilter] = useState("");
  
  // Debounce search
  useEffect(() => {
      const handler = setTimeout(() => {
          setDebouncedGlobalFilter(globalFilter || "");
      }, 500);
      return () => clearTimeout(handler);
  }, [globalFilter]);
  


  // Global Calculation Settings
  const [shippingCost, setShippingCost] = useState(0); // Default $0
  const [miscCost, setMiscCost] = useState(0);     // Default $0

  // Amazon Data Map (UPC -> Data)
  const [amazonDataMap, setAmazonDataMap] = useState({});
  const [processedData, setProcessedData] = useState([]); // Data with calculated metrics

  // Load column order from local storage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem('tableColumnOrder_products');
    if (savedOrder) {
      try {
        setColumnOrder(JSON.parse(savedOrder));
      } catch (e) {
        console.error("Failed to parse column order", e);
      }
    }
  }, []);

  // Save column order when it changes
  useEffect(() => {
    if (columnOrder.length > 0) {
      localStorage.setItem('tableColumnOrder_products', JSON.stringify(columnOrder));
    }
  }, [columnOrder]);



  // const sensors = useSensors(
  //   useSensor(PointerSensor, {
  //       activationConstraint: {
  //           distance: 8,
  //       },
  //   }),
  //   useSensor(KeyboardSensor)
  // );

  // const handleDragStart = (event) => {
  //   setActiveId(event.active.id);
  // };

  // const handleDragEnd = (event) => {
  //   const { active, over } = event;
  //   if (active && over && active.id !== over.id) {
  //     setColumnOrder((order) => {
  //       const oldIndex = order.indexOf(active.id);
  //       const newIndex = order.indexOf(over.id);
  //       return arrayMove(order, oldIndex, newIndex);
  //     });
  //   }
  //   setActiveId(null);
  // };

  // Fetch Amazon Data lookup map
  useEffect(() => {
    if (vendorName === 'Amazon Data') return; // Don't fetch if we are looking at Amazon Data itself

    const fetchAmazonData = async () => {
        try {
            // Fetch all Amazon Data products
            const response = await api.get('/products?vendor=Amazon%20Data&limit=5000'); 
            const products = response.data.data || response.data || [];
            
            const map = {};
            products.forEach(p => {
                // We map by UPC (ImportedBy) and ASIN (sku) and potentially other IDs
                // Clean key logic from Import Modal:
                // UPC -> ImportedBy
                // ASIN -> sku
                
                // 1. Map by UPC (ImportedBy field in Amazon Data)
                const upc = p.additional_data?.ImportedBy || p.upc;
                if (upc) {
                    const cleanUpc = String(upc).trim();
                    if (!map[cleanUpc]) map[cleanUpc] = [];
                    map[cleanUpc].push(p);
                }

                // 2. Map by ASIN (sku)
                if (p.sku) {
                     const cleanAsin = String(p.sku).trim();
                     if (!map[cleanAsin]) map[cleanAsin] = [];
                     map[cleanAsin].push(p);
                }

                 // 3. Map by "ASIN" field in additional_data (just in case)
                if (p.additional_data?.ASIN) {
                    const cleanAsin2 = String(p.additional_data.ASIN).trim();
                     if (!map[cleanAsin2]) map[cleanAsin2] = [];
                     map[cleanAsin2].push(p);
                }
            });
            console.log("Amazon Data Map built:", Object.keys(map).length, "keys");
            setAmazonDataMap(map);
        } catch (error) {
            console.error("Failed to fetch Amazon Data for lookup", error);
        }
    };

    fetchAmazonData();
  }, [vendorName]);

  // Process Data (Merge & Calculate)
  useEffect(() => {
    if (vendorName === 'Amazon Data') {
        setProcessedData(data);
        return;
    }

    if (!data.length) {
        setProcessedData([]);
        return;
    }

    // 1. Merge Amazon Data
    // 2. Calculate Metrics
    const withMetrics = data.map(item => {
        // Lookup Amazon Data
        // Try exact UPC/ASIN match first
        // We now have arrays in the map, so we get all matches
        const upcKey = String(item.upc || '').trim();
        const skuKey = String(item.sku || '').trim(); // Fallback if they use ASIN as SKU
        
        // potentialMatches is an array of products
        let amazonMatches = [];
        if (upcKey && amazonDataMap[upcKey]) {
            amazonMatches = amazonDataMap[upcKey];
        } else if (skuKey && amazonDataMap[skuKey]) {
            amazonMatches = amazonDataMap[skuKey];
        }

        // --- NEW: Robust Lookup using Raw Keys if Clean Keys fail ---
        // If we didn't find matches via standard keys, try looking up via the raw keys the user might be seeing
        // (This part might be less relevant now that we have robust import, but good for safety)
        // ... (Skipping complex raw lookup for now as the Array logic is the main change, and we trust the Import Modal fix)
        
        // Use the FIRST match for the main table row metrics
        // (User said: "IF there are multiple upc matches just choose a random one" -> we pick index 0)
        let amazonData = null;
        if (amazonMatches && amazonMatches.length > 0) {
             amazonData = amazonMatches[0];
        }
        // -----------------------------------------------------------

        // Calculate Fees & Profit
        const metrics = calculateFeesAndProfit(item, amazonData, shippingCost, miscCost);

        return {
            ...item,
            amazonData, // The selected "representative" match
            amazonMatches, // ALL matches (for the modal)
            metrics,
            _isBestVariant: false // Will set below
        };
    });

    // 3. Determine Best Variant
    const bestVariantIds = determineBestVariants(withMetrics);
    
    // 4. Sort: Best Variant First
    const finalData = withMetrics.map(item => ({
        ...item,
        _isBestVariant: bestVariantIds.has(item.id)
    })).sort((a, b) => {
        if (a._isBestVariant && !b._isBestVariant) return -1;
        if (!a._isBestVariant && b._isBestVariant) return 1;
        return 0;
    });

    setProcessedData(finalData);

  }, [data, amazonDataMap, shippingCost, miscCost, vendorName]);
  
  // Fetch when pagination, vendor, or SEARCH changes
  useEffect(() => {
      fetchProducts();
  }, [pagination.pageIndex, pagination.pageSize, vendorName, debouncedGlobalFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { pageIndex, pageSize } = pagination;
      const searchParam = debouncedGlobalFilter ? `&search=${encodeURIComponent(debouncedGlobalFilter)}` : '';
      const response = await api.get(`/products?vendor=${encodeURIComponent(vendorName)}&page=${pageIndex + 1}&limit=${pageSize}${searchParam}`);
      // Handle { data, count } or fallback to array
      if (response.data && response.data.data) {
          setData(response.data.data);
          setTotalCount(response.data.count || 0);
      } else {
          // Fallback if backend not returning structure yet
          setData(response.data);
          setTotalCount(response.data.length);
      }
    } catch (error) {
      console.error("Error fetching products", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCell = async (id, field, value) => {
    // Optimistic update
    setData(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
    
    try {
      await api.put(`/products/${id}`, { [field]: value });
    } catch (error) {
       console.error("Failed to save", error);
       // Revert or show error
       fetchProducts();
    }
  };

  const handleAddRow = async () => {
    const newProduct = {
      vendor_name: vendorName,
      title: 'New Product',
      sku: `SKU-${Date.now()}`
    };
    
    try {
       const response = await api.post('/products', newProduct);
       setData([...data, response.data]);
    } catch (error) {
       console.error("Failed to add product", error);
    }
  };

  const handleDeleteRow = async (id) => {
    if (!confirm("Delete this product?")) return;
    
    try {
      await api.delete(`/products/${id}`);
      setData(prev => prev.filter(row => row.id !== id));
    } catch (error) {
      console.error("Failed to delete", error);
    }
  };

  const handleSyncAmazon = async () => {
    // Optimistic UI not possible, just loading state
    const originalLoading = loading;
    setLoading(true);
    try {
      await api.post('/products/match-amazon');
      toast.success("Amazon mapping synced successfully");
      await fetchProducts();
    } catch (error) {
       console.error("Match failed", error);
       toast.error("Failed to sync Amazon mapping");
       setLoading(originalLoading);
    }
  };
  
  // We need to disable client-side filtering because we are doing it on the server
  // and we only have a page of data, so client filtering would be wrong.
  // We just rely on the server returning the correct filtered data.

  // Determine dynamic columns from data (only if NOT Amazon Data)
  const dynamicColumns = useMemo(() => {
    if (vendorName === 'Amazon Data') return []; // Amazon has fixed columns

    const allKeys = new Set();
    data.forEach(item => {
      if (item.additional_data) {
        Object.keys(item.additional_data).forEach(key => allKeys.add(key));
      }
    });
    
    // Filter out 'quantity' to avoid duplication since we map it explicitly
    return Array.from(allKeys)
      .filter(key => key !== 'quantity')
      .map(key => ({
      accessorFn: row => row.additional_data?.[key], // Accessor function for nested data
      id: `dynamic_${key}`,
      header: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize header
      cell: ({ getValue, row, column: { id } }) => (
         <EditableCell 
            value={getValue()} 
            row={row} 
            columnId={key} // Pass original key for saving
            onSave={(id, field, value) => handleSaveCell(id, `additional_data.${field}`, value)} 
         />
      )
    }));
  }, [data, vendorName]);

  const columns = useMemo(() => {
    if (vendorName === 'Amazon Data') {
        const LEGACY_MAPPING = {
            'ImportedBy': 'Imported by Code',
            'Rating': 'Reviews: Rating Count',
            'ReviewCount': 'Reviews: Review Count - Format Specific',
            'BoughtLastMonth': 'Bought in past month',
            'BuyBoxCurrent': 'Buy Box 🚚: Current',
            'BuyBox30': 'Buy Box 🚚: 30 days avg.',
            'BuyBox90': 'Buy Box 🚚: 90 days avg.',
            'BuyBox180': 'Buy Box 🚚: 180 days avg.',
            'RankCurrent': 'Sales Rank: Current',
            'Rank30': 'Sales Rank: 30 days avg.',
            'AmzAvailability': 'Amazon: Availability of the Amazon offer',
            'AmzBuyBox90': 'Buy Box: % Amazon 90 days',
            'ReferralFee': 'Referral Fee %',
            'FBAFee': 'FBA Pick&Pack Fee',
            'FBMOffers': 'Count of retrieved live offers: New, FBM',
            'FBAOffers': 'Count of retrieved live offers: New, FBA',
            'TotalOffers': 'Total Offer Count'
        };

        const createCell = (key, label, formatter = null) => ({
            id: key,
            // Check for the clean key first, then fall back to the legacy "raw" header key
            accessorFn: row => row.additional_data?.[key] || row.additional_data?.[LEGACY_MAPPING[key]],
            header: label,
            cell: ({ getValue, row }) => (
                <EditableCell 
                    value={getValue()} 
                    row={row} 
                    columnId={key} 
                    onSave={(id, field, value) => handleSaveCell(id, `additional_data.${field}`, value)} 
                    formatter={formatter}
                />
            )
        });

        return [
            createCell('ImportedBy', 'Imported by Code'),
            {
                accessorKey: 'vendor_image',
                header: 'Image',
                cell: ({ getValue, row, column: { id } }) => (
                   <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} type="image" />
                ),
            },
            {
                accessorKey: 'brand',
                header: 'Brand',
                cell: ({ getValue, row, column: { id } }) => (
                  <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} />
                ),
            },
            {
                accessorKey: 'parent_sku',
                header: 'Parent ASIN',
                cell: ({ getValue, row, column: { id } }) => (
                  <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} />
                ),
            },
            {
                accessorKey: 'sku',
                header: 'ASIN',
                cell: ({ getValue, row, column: { id } }) => (
                  <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} />
                ),
            },
            {
                accessorKey: 'title',
                header: 'Title',
                size: 400,
                cell: ({ getValue, row, column: { id } }) => (
                  <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} />
                ),
            },
            {
                accessorKey: 'color',
                header: 'Color',
                cell: ({ getValue, row, column: { id } }) => (
                  <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} />
                ),
            },
            {
                accessorKey: 'size',
                header: 'Size',
                cell: ({ getValue, row, column: { id } }) => (
                  <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} />
                ),
            },
            createCell('Rating', 'Rating', formatNumber),
            createCell('ReviewCount', 'Review Count', formatNumber),
            createCell('BoughtLastMonth', 'Bought (Month)', formatNumber),
            createCell('BuyBoxCurrent', 'Buy Box Current', formatCurrency),
            createCell('BuyBox30', 'Buy Box 30d', formatCurrency),
            createCell('BuyBox90', 'Buy Box 90d', formatCurrency),
            createCell('BuyBox180', 'Buy Box 180d', formatCurrency),
            createCell('RankCurrent', 'Rank Current', formatNumber),
            createCell('Rank30', 'Rank 30d', formatNumber),
            createCell('AmzAvailability', 'Amz Availability'),
            createCell('AmzBuyBox90', 'Amz Buy Box %', formatPercentage),
            createCell('ReferralFee', 'Referral Fee', formatPercentage),
            createCell('FBAFee', 'FBA Fee', formatCurrency),
            createCell('FBMOffers', 'FBM Offers', formatNumber),
            createCell('FBAOffers', 'FBA Offers', formatNumber),
            createCell('TotalOffers', 'Total Offers', formatNumber),
            {
              id: 'actions',
              header: '',
              cell: ({ row }) => (
                <button onClick={() => handleDeleteRow(row.original.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash size={16} />
                </button>
              ),
            }
        ];
    }

    // --- VENDORS TAB COLUMNS ---
    return [
    {
      accessorKey: 'vendor_image',
      header: 'Image',
      cell: ({ getValue, row, column: { id } }) => (
         <EditableCell
            value={getValue()}
            row={row}
            columnId={id}
            onSave={handleSaveCell}
            type="image"
         />
      ),
    },
    {
      accessorKey: 'parent_sku',
      header: 'Parent SKU',
      cell: ({ getValue, row, column: { id } }) => (
        <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} />
      ),
    },
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ getValue, row, column: { id } }) => (
        <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} />
      ),
    },
    {
      accessorKey: 'upc',
      header: 'UPC',
      cell: ({ getValue, row, column: { id } }) => (
        <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} />
      ),
    },
    {
       id: 'amazon_match',
       header: 'Amazon Match',
       accessorFn: row => (row.amazonMatches && row.amazonMatches.length > 0) ? "Yes" : "No",
       cell: ({ row }) => {
          const matches = row.original.amazonMatches || [];
          const count = matches.length;
          const hasMatch = count > 0;
          
          return (
            <div 
                className={`cursor-pointer font-medium ${hasMatch ? 'text-green-600 hover:text-green-800' : 'text-gray-400'}`}
                onClick={() => {
                    if (hasMatch) {
                        setSelectedProduct(row.original);
                        // Pass ALL matching SKUs to the modal
                        const skus = matches.map(m => m.sku);
                        setSelectedAsins(skus);
                        setIsMatchModalOpen(true);
                    }
                }}
            >
                {hasMatch ? `Yes (${count})` : 'No'}
            </div>
          );
       }
    },
    {
      accessorKey: 'title',
      header: 'Title',
      size: 400, // Fixed width for title
      cell: ({ getValue, row, column: { id } }) => (
        <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} />
      ),
    },
    {
      accessorKey: 'brand',
      header: 'Brand',
      cell: ({ getValue, row, column: { id } }) => (
        <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} />
      ),
    },
    {
      accessorKey: 'msrp',
      header: 'MSRP',
      cell: ({ getValue, row, column: { id } }) => (
        <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} type="number" />
      ),
    },
     {
      accessorKey: 'cost',
      header: 'Cost',
      cell: ({ getValue, row, column: { id } }) => (
        <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} type="number" />
      ),
    },
    {
      id: 'quantity', // explicitly added as per user request to see it, relying on additional_data workaround
      header: 'Qty',
      accessorFn: row => row.additional_data?.quantity,
      cell: ({ getValue, row }) => (
        <EditableCell 
            value={getValue()} 
            row={row} 
            columnId="quantity" 
            onSave={(id, field, value) => handleSaveCell(id, `additional_data.${field}`, value)}
            type="number"
        />
      )
    },
     {
      accessorKey: 'size',
      header: 'Size',
      cell: ({ getValue, row, column: { id } }) => (
        <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} />
      ),
    },
    {
      accessorKey: 'color',
      header: 'Color',
      cell: ({ getValue, row, column: { id } }) => (
        <EditableCell value={getValue()} row={row} columnId={id} onSave={handleSaveCell} />
      ),
    },
    
    // Spread dynamic columns from vendor sheet
    ...dynamicColumns,

    // --- NEW CALCULATED COLUMNS ---
        {
            id: 'referral_fee',
            header: 'Referral Fee',
            accessorFn: row => row.metrics?.referralFeePercent,
            cell: ({ getValue }) => {
                const val = getValue();
                return <div className="text-right">{(val * 100).toFixed(0)}%</div>;
            }
        },
        {
            id: 'pick_pack_fee',
            header: 'Pick & Pack',
            accessorFn: row => row.metrics?.pickAndPackFee,
            cell: ({ getValue }) => <div className="text-right">{formatCurrency(getValue())}</div>
        },
        {
            id: 'total_cost',
            header: 'Total Cost',
            accessorFn: row => row.metrics?.totalCost,
            cell: ({ getValue }) => <div className="text-right">{formatCurrency(getValue())}</div>
        },
        {
            id: 'sale_price',
            header: 'Sale Price', // Buy Box Waterfall
            accessorFn: row => row.metrics?.salePrice,
            cell: ({ getValue }) => <div className="text-right">{formatCurrency(getValue())}</div>
        },
        {
            id: 'profit',
            header: 'Profit',
            accessorFn: row => row.metrics?.profit,
            cell: ({ getValue }) => {
                const val = getValue();
                const colorClass = getSmartColor('Profit', val);
                return <div className={`text-right ${colorClass}`}>{formatCurrency(val)}</div>;
            }
        },
        {
            id: 'roi',
            header: 'ROI',
            accessorFn: row => row.metrics?.roi,
            cell: ({ getValue }) => {
                const val = getValue();
                const colorClass = getSmartColor('ROI', val);
                return <div className={`text-right ${colorClass}`}>{val?.toFixed(1)}%</div>;
            }
        },
        {
            id: 'margin_buybox',
            header: 'Margin (BB)',
            accessorFn: row => row.metrics?.marginBuyBox,
            cell: ({ getValue, row }) => {
                const val = getValue();
                const processedRow = row.original;
                const noBuyBox = !processedRow.metrics?.salePrice; // Check if sale price exists
                
                if (noBuyBox) return <div className="text-right text-red-600 font-medium whitespace-nowrap">No Buybox</div>;
                
                const colorClass = getSmartColor('MarginBuyBox', val, { noBuyBox });
                return <div className={`text-right ${colorClass}`}>{val?.toFixed(1)}%</div>;
            }
        },
         {
            id: 'margin_msrp',
            header: 'Margin (MSRP)',
            accessorFn: row => row.metrics?.marginMSRP,
            cell: ({ getValue }) => <div className="text-right">{getValue()?.toFixed(1)}%</div>
        },
        {
            id: 'msrp_diff',
            header: 'MSRP Diff',
            accessorFn: row => row.metrics?.msrpDiff,
            cell: ({ getValue }) => {
                const val = getValue();
                const colorClass = getSmartColor('MSRPDiff', val);
                return <div className={`text-right ${colorClass}`}>{val?.toFixed(1)}%</div>;
            }
        },
    {
      id: 'margin_div',
      header: 'Price/Cost',
      // Calculated on the fly for coloring
      accessorFn: row => {
           const price = row.metrics?.salePrice || 0;
           const cost = parseCleanNumber(row.cost);
           if (!cost || cost === 0) return 0; // Avoid division by zero
           return price / cost;
      },
      cell: ({ getValue }) => {
            const val = getValue();
            const colorClass = getSmartColor('MarginDiv', val);
            return <div className={`text-right ${colorClass}`}>{val?.toFixed(2)}x</div>;
      }
    },
     {
      id: 'sales_rank_smart',
      header: 'Sales Rank',
      accessorFn: row => {
           // Try clean key, then legacy raw key
           return row.amazonData?.['Sales Rank: Current'] || row.amazonData?.RankCurrent;
      }, 
      cell: ({ getValue }) => {
          const val = getValue();
          const colorClass = getSmartColor('SalesRank', parseCleanNumber(val), val); // pass val for N/A check
          return <div className={colorClass}>{val || 'N/A'}</div>
      }
    },
    {
      id: 'amz_availability_smart',
      header: 'Amz Avail',
      accessorFn: row => {
           // Try clean key, then legacy raw key
           return row.amazonData?.['Amazon: Availability of the Amazon offer'] || row.amazonData?.AmzAvailability;
      },
      cell: ({ getValue }) => {
          const val = getValue();
          const colorClass = getSmartColor('AmazonAvailability', val);
          return <div className={colorClass}>{val}</div>
      }
    },
    {
       id: 'is_best_variant',
       header: 'Best Var.',
       accessorFn: row => row._isBestVariant,
       cell: ({ getValue }) => getValue() ? <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-1 rounded">BEST</span> : null
    },

    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button onClick={() => handleDeleteRow(row.original.id)} className="text-muted-foreground hover:text-destructive">
          <Trash size={16} />
        </button>
      ),
    }
  ]}, [dynamicColumns, vendorName, data /* Re-calc if data changes */, amazonDataMap, shippingCost, miscCost]);

  // Initialize column order if empty and data is loaded
  useEffect(() => {
     if (columnOrder.length === 0 && columns.length > 0) {
         setColumnOrder(columns.map(c => c.id || c.accessorKey));
     }
  }, [columns, columnOrder.length]);



  const table = useReactTable({
    data: processedData, // Use processed data with metrics
    columns,
    pageCount: Math.ceil(totalCount / pagination.pageSize), // Calculate total pages
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // getFilteredRowModel: getFilteredRowModel(), // Disable client-side filtering
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    manualPagination: true, // Enable server-side pagination
    manualFiltering: true, // Server-side filtering
    filterFns: {
       safe: safeFilter, 
    },
    state: {
       pagination,
       globalFilter,
       columnFilters,
       columnOrder,
       columnVisibility,
    },
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    defaultColumn: {
       filterFn: 'safe',
    }
  });

  // Reset pagination when search changes
  useEffect(() => {
      table.setPageIndex(0);
  }, [debouncedGlobalFilter]);

  // Re-fetch when pagination changes
  useEffect(() => {
     fetchProducts();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.pageIndex, pagination.pageSize, vendorName, debouncedGlobalFilter]);

  return (
    // <DndContext
    //     collisionDetection={closestCenter}
    //     onDragStart={handleDragStart}
    //     onDragEnd={handleDragEnd}
    //     sensors={sensors}
    // >
    <div className="space-y-4">
       <ImportModal 
         isOpen={isImportModalOpen} // RENAMED
         onClose={() => setIsImportModalOpen(false)} // RENAMED
         vendorName={vendorName}
         onImportSuccess={fetchProducts}
       />
       <AmazonMatchDetails 
         isOpen={isMatchModalOpen} 
         onClose={() => setIsMatchModalOpen(false)} 
         asins={selectedAsins}
         referenceProduct={selectedProduct}
         shippingCost={shippingCost} 
         miscCost={miscCost}
       />
       {/* Global Cost Inputs */}
       {vendorName !== 'Amazon Data' && (
           <div className="flex gap-4 items-center bg-muted/30 p-2 rounded border">
                <span className="text-sm font-medium">Global Costs:</span>
                <div className="flex items-center gap-2">
                    <label className="text-xs">Shipping:</label>
                    <input 
                        type="number" 
                        value={shippingCost} 
                        onChange={e => setShippingCost(parseFloat(e.target.value) || 0)} 
                        className="w-20 px-2 py-1 text-sm border rounded"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs">Misc:</label>
                    <input 
                        type="number" 
                        value={miscCost} 
                        onChange={e => setMiscCost(parseFloat(e.target.value) || 0)} 
                        className="w-20 px-2 py-1 text-sm border rounded"
                    />
                </div>
           </div>
       )}

       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <h2 className="text-xl font-semibold whitespace-nowrap">Products ({data.length})</h2>
         
         {/* Search Bar */}
         <div className="w-full sm:max-w-md">
            <input
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              placeholder="Search all columns..."
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
         </div>

         <div className="flex gap-2">
          <ColumnManager table={table} /> {/* ADDED */}
           <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded hover:bg-muted whitespace-nowrap"> {/* RENAMED */}
             <Upload size={16} /> Import
           </button>
           <button 
             onClick={handleSyncAmazon}
             className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded hover:bg-muted whitespace-nowrap text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
             title="Match UPCs to Amazon Data"
           >
             <RefreshCw size={16} /> Sync Map
           </button>
           <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded hover:bg-muted whitespace-nowrap">
             <Download size={16} /> Export
           </button>
         </div>
      </div>

      <div className="rounded-md border border-border overflow-hidden bg-card h-[70vh] flex flex-col">
         <div className="overflow-auto flex-1 relative">
            <table className="min-w-full text-sm relative">
              <thead className="bg-muted/50 border-b border-border text-left sticky top-0 z-10 shadow-sm">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id} 
                        style={{ width: header.column.id === 'title' ? header.getSize() : 'auto' }}
                        className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap bg-muted/90 backdrop-blur-sm group/header relative select-none border-r border-border/50 last:border-r-0"
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
                {loading ? (
                  <tr><td colSpan={columns.length} className="p-4 text-center">Loading...</td></tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr><td colSpan={columns.length} className="p-4 text-center text-muted-foreground">No products found.</td></tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-muted/30 group">
                      {row.getVisibleCells().map(cell => (
                        <td 
                            key={cell.id} 
                            style={{ 
                                width: cell.column.id === 'title' ? cell.column.getSize() : 'auto',
                                maxWidth: cell.column.id === 'title' ? cell.column.getSize() : 'none'
                             }}
                            className={cn(
                                "px-3 py-2 align-middle whitespace-nowrap",
                                cell.column.id === 'title' && "overflow-hidden text-ellipsis"
                            )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
         </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </button>
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}



function EditableCell({ value: initialValue, row, columnId, onSave, type = 'text', formatter }) {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onBlur = () => {
    setIsEditing(false);
    if (value !== initialValue) {
      onSave(row.original.id, columnId, value);
    }
  };

  if (type === 'image') {
     return (
       <div className="w-10 h-10 bg-muted rounded overflow-hidden flex items-center justify-center cursor-pointer border hover:border-primary shrink-0" onClick={() => setIsEditing(true)}>
          {value ? <img src={value} alt="Product" className="w-full h-full object-cover" /> : <span className="text-xs text-muted-foreground">Img</span>}
          {isEditing && (
             <div className="absolute z-10 p-2 bg-card border shadow-lg rounded">
               <input 
                  autoFocus
                  className="w-40 text-xs border p-1 rounded" 
                  placeholder="Image URL"
                  value={value || ''} 
                  onChange={e => setValue(e.target.value)} 
                  onBlur={onBlur}
                  onKeyDown={e => e.key === 'Enter' && onBlur()}
               />
             </div>
          )}
       </div>
     );
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        value={value || ''}
        onChange={e => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        className="w-full bg-background border border-primary rounded px-2 py-1 outline-none text-foreground"
      />
    );
  }

  return (
    <div 
        onClick={() => setIsEditing(true)}
        className="cursor-text hover:bg-muted/50 rounded px-1 py-0.5 min-h-[1.5em] min-w-[20px]"
        title={value}
    >
        {value ? (formatter ? formatter(value) : value) : <span className="text-muted-foreground/30 text-xs italic">Empty</span>}
    </div>
  );
}
