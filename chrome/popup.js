const collectBtn = document.getElementById('collect');
const selectVolume = document.getElementById('selectVolume');
const selectPoint = document.getElementById('selectPoint');
const totalFeeEl = document.getElementById('totalFee');
const collectStatusEl = document.getElementById('collectStatus');

let currentTradeTotals = null;

const volCurrentEl = document.getElementById('volCurrent');
const currentPointEl = document.getElementById('currentPoint');
const currentPointRowEl = document.getElementById('currentPointRow');
const tradeCountEl = document.getElementById('tradeCount');
const volRemainingEl = document.getElementById('volRemaining');
const volBaseNeededEl = document.getElementById('volBaseNeeded');
const tradesRemainingEl = document.getElementById('tradesRemaining');
const lastCollectedEl = document.getElementById('lastCollected');

function formatNumber(num) {
    return num.toLocaleString('en-US');
}

function calculatePoints(totalVolume) {
    if (totalVolume <= 0) return 0;
    return Math.floor(Math.log2(totalVolume));
}

function updateFeeDisplay() {
    if (!currentTradeTotals) {
        totalFeeEl.textContent = '—';
        return;
    }

    const { buyTotal, sellTotal } = currentTradeTotals;
    // Phí bán BSC giả định 0,01% trừ vào USDT nhận về.
    // Phí mua đã trừ bằng token nên không cộng thêm vào USDT chi ra.
    const netSellTotal = sellTotal * (1 - 0.0001);
    totalFeeEl.textContent = (buyTotal - netSellTotal).toLocaleString('en-US', {
        minimumFractionDigits: 4, maximumFractionDigits: 4
    });
}

function showLastCollected(timestamp, isCached) {
    if (!timestamp) {
        lastCollectedEl.textContent = '';
        return;
    }
    const d = new Date(timestamp);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = d.toLocaleDateString('vi-VN');
    const prefix = isCached ? '(dữ liệu cũ) ' : '';
    lastCollectedEl.textContent = `${prefix}Cập nhật lúc ${time} - ${date}`;
}

function updateDisplay(total) {
    const volumePerOrder = parseInt(selectVolume.value);
    const targetPoint = parseInt(selectPoint.value);
    const targetVol = Math.pow(2, targetPoint);

    volCurrentEl.textContent = formatNumber(Math.round(total));

    const currentPt = calculatePoints(total);
    const achieved = currentPt >= targetPoint;
    currentPointEl.textContent = achieved ? `✓ ${currentPt}` : currentPt;
    currentPointEl.className = achieved ? 'badge badge-green badge-pulse' : 'badge badge-red';
    currentPointRowEl.classList.toggle('row-achieved', achieved);

    const volPerTrade = volumePerOrder * 4;
    const trades = Math.floor(total / volPerTrade);
    tradeCountEl.textContent = trades;

    const volShort = Math.max(0, targetVol - total);
    volRemainingEl.textContent = formatNumber(Math.round(volShort));

    const volBase = volShort > 0 ? Math.ceil(volShort / 4) + 3 : 0;
    volBaseNeededEl.textContent = formatNumber(Math.round(volBase));

    const remaining = volShort > 0 ? Math.ceil(volShort / (volumePerOrder * 4)) : 0;
    tradesRemainingEl.textContent = remaining;
}

// Load saved state
async function init() {
    const data = await chrome.storage.local.get(['total', 'selectedVolume', 'selectedPoint', 'lastCollectedAt', 'tradeTotals']);
    if (data.selectedVolume) selectVolume.value = data.selectedVolume;
    if (data.selectedPoint) selectPoint.value = data.selectedPoint;

    // Chỉ giữ dữ liệu cũ nếu cùng ngày
    const today = new Date().toLocaleDateString('vi-VN');
    const savedDay = data.lastCollectedAt ? new Date(data.lastCollectedAt).toLocaleDateString('vi-VN') : null;

    if (savedDay && savedDay === today) {
        currentTradeTotals = data.tradeTotals || null;
        updateDisplay(data.total || 0);
        showLastCollected(data.lastCollectedAt, true);
    } else {
        await chrome.storage.local.remove(['total', 'lastCollectedAt', 'tradeTotals']);
        currentTradeTotals = null;
        updateDisplay(0);
        showLastCollected(null);
    }
    updateFeeDisplay();
}

document.addEventListener('DOMContentLoaded', init);

selectVolume.addEventListener('change', async () => {
    await chrome.storage.local.set({ selectedVolume: selectVolume.value });
    const { total = 0 } = await chrome.storage.local.get('total');
    updateDisplay(total);
});

selectPoint.addEventListener('change', async () => {
    await chrome.storage.local.set({ selectedPoint: selectPoint.value });
    const { total = 0 } = await chrome.storage.local.get('total');
    updateDisplay(total);
});

collectBtn.addEventListener('click', async () => {
    collectBtn.disabled = true;
    collectStatusEl.textContent = '';
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        // Nạp mã hiện tại để Collect dùng được ngay sau khi reload extension.
        const target = { tabId: tab.id };
        await chrome.scripting.executeScript({ target, files: ['content.js'] });
        const [result] = await chrome.scripting.executeScript({ target, func: () => collectPageData() });
        const { pageTotal, tradeTotals } = result.result || {};
        if (!Number.isFinite(pageTotal) || !tradeTotals ||
            !Number.isFinite(tradeTotals.buyTotal) || !Number.isFinite(tradeTotals.sellTotal)) {
            throw new Error('Missing order history');
        }
        const now = Date.now();

        await chrome.storage.local.set({ total: pageTotal, tradeTotals, lastCollectedAt: now });
        currentTradeTotals = tradeTotals;
        updateDisplay(pageTotal);
        updateFeeDisplay();
        showLastCollected(now, false);
    } catch {
        collectStatusEl.textContent = 'Hãy mở tab "Lịch sử đặt lệnh" trên Binance Alpha rồi nhấn Collect.';
    } finally {
        collectBtn.disabled = false;
    }
});

