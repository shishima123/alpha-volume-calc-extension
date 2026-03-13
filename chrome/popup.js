const collectBtn = document.getElementById('collect');
const resetBtn = document.getElementById('reset');
const selectVolume = document.getElementById('selectVolume');
const selectPoint = document.getElementById('selectPoint');

const volCurrentEl = document.getElementById('volCurrent');
const currentPointEl = document.getElementById('currentPoint');
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
    currentPointEl.textContent = currentPt;
    currentPointEl.className = currentPt >= targetPoint ? 'badge badge-green' : 'badge badge-red';

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
    const data = await chrome.storage.local.get(['total', 'selectedVolume', 'selectedPoint', 'lastCollectedAt']);
    const total = data.total || 0;
    if (data.selectedVolume) selectVolume.value = data.selectedVolume;
    if (data.selectedPoint) selectPoint.value = data.selectedPoint;
    updateDisplay(total);
    showLastCollected(data.lastCollectedAt, true);
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { type: 'COLLECT_PAGE' }, async (response) => {
        if (!response) {
            alert('Không tìm thấy bảng lịch sử đặt lệnh.\nHãy mở tab "Lịch sử đặt lệnh" trên trang Binance Alpha trước.');
            return;
        }

        if (response.error) {
            alert(response.error);
            return;
        }

        const { pageTotal } = response;
        const now = Date.now();

        await chrome.storage.local.set({ total: pageTotal, lastCollectedAt: now });
        updateDisplay(pageTotal);
        showLastCollected(now, false);
    });
});

resetBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove(['total', 'lastCollectedAt']);
    updateDisplay(0);
    showLastCollected(null);
});
