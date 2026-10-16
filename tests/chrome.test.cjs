const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = (file) => fs.readFileSync(path.join(__dirname, '../chrome', file), 'utf8');
class Today extends Date {
    constructor(...args) {
        super(...(args.length ? args : [2026, 9, 16, 12, 30]));
    }
    static now() { return new Today().getTime(); }
}

function collect(rows, hasHistory = true) {
    const document = {
        querySelector: () => hasHistory ? {} : null,
        querySelectorAll: () => rows.map((cells) => ({
            querySelector: (selector) => {
                const textContent = cells[selector.match(/aria-colindex="(\d+)"/)[1]];
                return textContent === undefined ? null : { textContent };
            }
        }))
    };
    const context = vm.createContext({ document, Date: Today });
    vm.runInContext(source('content.js'), context);
    return JSON.parse(JSON.stringify(context.collectPageData()));
}

function row(side, amount, overrides = {}) {
    return { 1: '2026-10-16 12:22:50', 4: side, 9: amount, 13: 'Đã khớp', ...overrides };
}

function popup(saved = {}, response) {
    const storage = { ...saved };
    const injections = [];
    const elements = {};
    const handlers = {};
    const document = {
        getElementById: (id) => elements[id] ||= {
            value: id === 'selectVolume' ? '1024' : '16',
            textContent: '', className: '', classList: { toggle() {} },
            addEventListener(event, handler) { handlers[`${id}:${event}`] = handler; }
        },
        addEventListener(event, handler) { handlers[event] = handler; }
    };
    const chrome = {
        storage: { local: {
            async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, storage[key]])); },
            async set(data) { Object.assign(storage, data); },
            async remove(keys) { keys.forEach((key) => delete storage[key]); }
        } },
        tabs: { async query() { return [{ id: 1 }]; } },
        scripting: {
            async executeScript(options) {
                injections.push(options);
                if (response instanceof Error) throw response;
                return options.files ? [] : [{ result: response }];
            }
        }
    };
    vm.runInNewContext(source('popup.js'), { document, chrome, Date: Today });
    return {
        elements, storage, injections,
        async trigger(event) { await handlers[event](); }
    };
}

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('collects raw buys/sells, keeps volume x4, filters dates, statuses and quote currency', () => {
    const result = collect([
        row('Mua', '1.024,94797 USDT'), row('Bán', '1024.5 USDT'),
        row('Mua', '10 USDT', { 13: 'Đã hủy' }), row('Bán', '5 USDT', { 13: 'Đã hủy' }),
        row('Mua', '0 USDT', { 13: 'Đã hủy' }),
        row('Mua', '999 USDT', { 1: '2026-10-15 12:00:00' }),
        row('Bán', '999 USDT', { 1: '2026-10-16 06:59:59' }),
        row('Mua', '999 USDT', { 13: 'Đang chờ' }),
        row('Mua', '999 USDC'), row('Bán', 'invalid USDT'),
        row('Mua', '2 USDT', { 1: '2026-10-16 07:00:00' }),
        row('Mua', '999 USDT', { 1: '2026-10-16 invalid' })
    ]);
    closeTo(result.tradeTotals.buyTotal, 1036.94797);
    closeTo(result.tradeTotals.sellTotal, 1029.5);
    closeTo(result.pageTotal, 4147.79188);
    assert.deepEqual(collect([]), { pageTotal: 0, tradeTotals: { buyTotal: 0, sellTotal: 0 } });
    assert.deepEqual(collect([], false), { error: true });
});

test('CT sample: deducts the sell fee from proceeds, persists across reopening and never adds duplicate totals', async () => {
    const buys = [1024.663338, 1024.91822092, 1024.894808, 1024.95670053, 1024.9872267, 1024.55798538, 1024.868847, 1024.81033639];
    const sells = [1024.55982, 1024.78383888, 1023.95083237, 1024.88940325, 1024.86312507, 1024.48514424, 1024.7549956, 1024.722972];
    const response = collect([...buys.map((n) => row('Mua', `${n} USDT`)), ...sells.map((n) => row('Bán', `${n} USDT`))]);
    closeTo(response.tradeTotals.buyTotal, 8198.65746292);
    closeTo(response.tradeTotals.sellTotal, 8197.01013141);
    closeTo(response.pageTotal, 32794.62985168);
    const app = popup({}, response);
    await app.trigger('DOMContentLoaded');
    assert.equal(app.elements.totalFee.textContent, '—');
    await app.trigger('collect:click');
    assert.equal(app.elements.totalFee.textContent, '2.4670');
    assert.equal(app.elements.collectStatus.textContent, '');
    assert.equal(app.elements.collect.disabled, false);
    assert.equal(app.injections[0].files[0], 'content.js');
    assert.equal(typeof app.injections[1].func, 'function');
    await app.trigger('collect:click');
    closeTo(app.storage.total, response.pageTotal);
    assert.equal(app.elements.totalFee.textContent, '2.4670');

    const reopened = popup(app.storage);
    await reopened.trigger('DOMContentLoaded');
    assert.equal(reopened.elements.totalFee.textContent, '2.4670');
    reopened.elements.selectPoint.value = '17';
    await reopened.trigger('selectPoint:change');
    assert.equal(reopened.elements.totalFee.textContent, '2.4670');
});

test('handles negative differences, legacy cache, stale dates, empty trades and collection errors', async () => {
    const saved = { total: 400, tradeTotals: { buyTotal: 100, sellTotal: 110 }, lastCollectedAt: Today.now(), selectedFeeRate: 0.01 };
    const app = popup(saved);
    await app.trigger('DOMContentLoaded');
    assert.equal(app.elements.totalFee.textContent, '-9.9890');

    const old = popup({ total: 400, lastCollectedAt: Today.now() });
    await old.trigger('DOMContentLoaded');
    assert.equal(old.elements.totalFee.textContent, '—');
    const stale = popup({ ...saved, lastCollectedAt: new Date(2026, 9, 15).getTime() });
    await stale.trigger('DOMContentLoaded');
    assert.equal(stale.storage.tradeTotals, undefined);
    assert.equal(stale.elements.totalFee.textContent, '—');

    const empty = popup({}, collect([]));
    await empty.trigger('DOMContentLoaded');
    await empty.trigger('collect:click');
    assert.equal(empty.elements.totalFee.textContent, '0.0000');
    for (const response of [{ error: true }, new Error('Cannot access this tab')]) {
        const failed = popup(saved, response);
        await failed.trigger('DOMContentLoaded');
        await failed.trigger('collect:click');
        assert.match(failed.elements.collectStatus.textContent, /Lịch sử đặt lệnh/);
        assert.equal(failed.elements.collect.disabled, false);
        assert.equal(failed.storage.total, saved.total);
    }
});
