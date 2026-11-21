var test = require('node:test');
var assert = require('node:assert/strict');

var tax = require('../lib/tax');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('checkout applies the HSN slab to the discounted taxable value', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var checkout = pricing.computeTotals(items, 'WELCOME');

  assert.equal(tax.getRateForItem(items[0]), 0.05);
  assert.deepEqual(checkout, {
    subtotal: 100,
    discount: 5,
    taxable: 95,
    tax: 4.75,
    cgst: 2.38,
    sgst: 2.37,
    total: 99.75,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 100,
      discount: 5,
      taxable: 95,
      tax: 4.75,
      net: 99.75
    }]
  });
});

test('invoice uses the HSN slab and taxes the gross line at the item rate', function () {
  var result = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.deepEqual(result, {
    subtotal: 100,
    discount: 0,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105,
    rows: [{
      name: 'Rice',
      sku: '-',
      hsn: '1006',
      qty: 1,
      price: 100,
      gstPercent: 5,
      line: 100,
      lineTax: 5
    }]
  });
});

test('invoice accepts an explicit decimal gstRate', function () {
  var result = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', gstRate: 0.05, price: 100, qty: 1 }]
  });

  assert.equal(result.rows[0].gstPercent, 5);
  assert.equal(result.tax, 5);
  assert.equal(result.total, 105);
});

test('invoice applies the checkout coupon to taxable value and respects its cap', function () {
  var order = {
    coupon: 'WELCOME',
    items: [{ name: 'Item', price: 3000, qty: 1 }]
  };

  assert.equal(pricing.computeTotals(order.items, order.coupon).discount, 100);
  assert.equal(invoice.computeInvoiceFigures(order).discount, 100);
  assert.equal(invoice.computeInvoiceFigures(order).tax, 522);
  assert.equal(invoice.computeInvoiceFigures(order).total, 3422);
});

test('GST reconciliation matches an invoice to the stored order figures', function () {
  var order = {
    id: 7,
    date: '2026-11-21',
    customer: 'In-memory customer',
    status: 'completed',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: '',
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };
  var result = reports.getGstReconciliation({ orders: [order], products: [], customers: [] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 7,
    date: '2026-11-21',
    customer: 'In-memory customer',
    coupon: '',
    ledgerSubtotal: 100,
    ledgerDiscount: 0,
    ledgerTax: 5,
    ledgerTotal: 105,
    invoiceDiscount: 0,
    invoiceTax: 5,
    invoiceTotal: 105,
    delta: 0,
    matched: true
  });
});
