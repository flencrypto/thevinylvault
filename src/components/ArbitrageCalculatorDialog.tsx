import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Calculator, CurrencyGbp, ArrowRight, TrendUp, TrendDown, Scales } from '@phosphor-icons/react'

type ProfitRating = 'PASS' | 'MARGINAL' | 'GOOD' | 'EXCELLENT'

function getProfitRating(roi: number): ProfitRating {
  if (roi <= 0) return 'PASS'
  if (roi <= 20) return 'MARGINAL'
  if (roi <= 50) return 'GOOD'
  return 'EXCELLENT'
}

function getRatingColor(rating: ProfitRating): string {
  switch (rating) {
    case 'PASS':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'MARGINAL':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'GOOD':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'EXCELLENT':
      return 'bg-amber-400/20 text-amber-300 border-amber-400/30'
  }
}

function getValueColor(value: number): string {
  if (value < 0) return 'text-red-400'
  if (value === 0) return 'text-slate-300'
  return 'text-green-400'
}

interface ArbitrageCalculatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ArbitrageCalculatorDialog({ open, onOpenChange }: ArbitrageCalculatorDialogProps) {
  const [buyPrice, setBuyPrice] = useState(0)
  const [sellPrice, setSellPrice] = useState(0)
  const [buyShipping, setBuyShipping] = useState(0)
  const [sellShipping, setSellShipping] = useState(0)
  const [ebayFeePercent, setEbayFeePercent] = useState(13.15)
  const [perTransactionFee, setPerTransactionFee] = useState(0.30)
  const [packagingCost, setPackagingCost] = useState(0)

  const calculations = useMemo(() => {
    const totalCost = buyPrice + buyShipping + packagingCost
    const grossRevenue = sellPrice
    const ebayFees = (sellPrice * ebayFeePercent) / 100 + perTransactionFee
    const netRevenue = grossRevenue - ebayFees - sellShipping
    const netProfit = netRevenue - totalCost
    const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0
    // Break-even: the sell price where net profit = 0
    // netRevenue - totalCost = 0
    // sellPrice - (sellPrice * feePercent/100 + txFee) - sellShipping - totalCost = 0
    // sellPrice * (1 - feePercent/100) = totalCost + txFee + sellShipping
    const feeMultiplier = 1 - ebayFeePercent / 100
    const breakEvenSellPrice = feeMultiplier > 0
      ? (totalCost + perTransactionFee + sellShipping) / feeMultiplier
      : 0
    const rating = getProfitRating(roi)

    return { totalCost, grossRevenue, ebayFees, netRevenue, netProfit, roi, breakEvenSellPrice, rating }
  }, [buyPrice, sellPrice, buyShipping, sellShipping, ebayFeePercent, perTransactionFee, packagingCost])

  const handleReset = () => {
    setBuyPrice(0)
    setSellPrice(0)
    setBuyShipping(0)
    setSellShipping(0)
    setEbayFeePercent(13.15)
    setPerTransactionFee(0.30)
    setPackagingCost(0)
  }

  const parseNum = (val: string): number => {
    const n = parseFloat(val)
    return isNaN(n) ? 0 : n
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scales className="w-5 h-5 text-accent" weight="fill" />
            Arbitrage / Profit Calculator
          </DialogTitle>
          <DialogDescription>
            Calculate potential profit when buying from one marketplace and selling on another
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Buy / Sell Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="buy-price" className="text-xs text-slate-400">
                Buy Price
              </Label>
              <div className="relative">
                <CurrencyGbp size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  id="buy-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={buyPrice || ''}
                  onChange={(e) => setBuyPrice(parseNum(e.target.value))}
                  placeholder="0.00"
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sell-price" className="text-xs text-slate-400">
                Expected Sell Price
              </Label>
              <div className="relative">
                <CurrencyGbp size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  id="sell-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={sellPrice || ''}
                  onChange={(e) => setSellPrice(parseNum(e.target.value))}
                  placeholder="0.00"
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Shipping Costs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="buy-shipping" className="text-xs text-slate-400">
                Buy Shipping
              </Label>
              <div className="relative">
                <CurrencyGbp size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  id="buy-shipping"
                  type="number"
                  min={0}
                  step={0.01}
                  value={buyShipping || ''}
                  onChange={(e) => setBuyShipping(parseNum(e.target.value))}
                  placeholder="0.00"
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sell-shipping" className="text-xs text-slate-400">
                Sell Shipping
              </Label>
              <div className="relative">
                <CurrencyGbp size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  id="sell-shipping"
                  type="number"
                  min={0}
                  step={0.01}
                  value={sellShipping || ''}
                  onChange={(e) => setSellShipping(parseNum(e.target.value))}
                  placeholder="0.00"
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* eBay Fee % Slider */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">
              eBay Fee: {ebayFeePercent.toFixed(2)}%
            </Label>
            <Slider
              value={[ebayFeePercent]}
              onValueChange={([v]) => setEbayFeePercent(v)}
              min={0}
              max={25}
              step={0.05}
            />
            <p className="text-[10px] text-slate-500">
              eBay UK managed payments default: 13.15%
            </p>
          </div>

          {/* Per-Transaction Fee + Packaging */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-fee" className="text-xs text-slate-400">
                Per-Transaction Fee
              </Label>
              <div className="relative">
                <CurrencyGbp size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  id="tx-fee"
                  type="number"
                  min={0}
                  step={0.01}
                  value={perTransactionFee || ''}
                  onChange={(e) => setPerTransactionFee(parseNum(e.target.value))}
                  placeholder="0.30"
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="packaging" className="text-xs text-slate-400">
                Packaging Cost
              </Label>
              <div className="relative">
                <CurrencyGbp size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  id="packaging"
                  type="number"
                  min={0}
                  step={0.01}
                  value={packagingCost || ''}
                  onChange={(e) => setPackagingCost(parseNum(e.target.value))}
                  placeholder="0.00"
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Results */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Calculator size={16} className="text-accent" />
                  Breakdown
                </span>
                <Badge className={`text-[10px] px-2 border ${getRatingColor(calculations.rating)}`}>
                  {calculations.rating}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Cost</span>
                  <span className="text-white font-medium">
                    <CurrencyGbp size={11} className="inline -mt-0.5" />
                    {calculations.totalCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Gross Revenue</span>
                  <span className="text-white font-medium">
                    <CurrencyGbp size={11} className="inline -mt-0.5" />
                    {calculations.grossRevenue.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">eBay Fees</span>
                  <span className="text-red-400 font-medium">
                    −<CurrencyGbp size={11} className="inline -mt-0.5" />
                    {calculations.ebayFees.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Net Revenue</span>
                  <span className="text-white font-medium">
                    <CurrencyGbp size={11} className="inline -mt-0.5" />
                    {calculations.netRevenue.toFixed(2)}
                  </span>
                </div>

                <Separator className="my-1" />

                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-semibold flex items-center gap-1">
                    {calculations.netProfit >= 0
                      ? <TrendUp size={14} className="text-green-400" />
                      : <TrendDown size={14} className="text-red-400" />}
                    Net Profit
                  </span>
                  <span className={`font-bold text-sm ${getValueColor(calculations.netProfit)}`}>
                    {calculations.netProfit < 0 ? '−' : ''}
                    <CurrencyGbp size={12} className="inline -mt-0.5" />
                    {Math.abs(calculations.netProfit).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-semibold">ROI</span>
                  <span className={`font-bold text-sm ${getValueColor(calculations.roi)}`}>
                    {calculations.roi.toFixed(1)}%
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1">
                    <ArrowRight size={12} />
                    Break-even Sell Price
                  </span>
                  <span className="text-slate-300 font-medium">
                    <CurrencyGbp size={11} className="inline -mt-0.5" />
                    {calculations.breakEvenSellPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" size="sm" onClick={handleReset} className="w-full text-xs border-slate-700">
            Reset Calculator
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
