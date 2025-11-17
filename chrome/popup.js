const collectBtn = document.getElementById('collect');
const showTotalBtn = document.getElementById('showTotal');
const resetBtn = document.getElementById('reset');
const outputDiv = document.getElementById('output');

function formatNumber(num) {
    return num.toLocaleString('en-US');
}

function calculatePoints(totalVolume) {
    if (totalVolume <= 0) return 0;
    const n = Math.log2(totalVolume);
    return Math.floor(n);
}

// ✅ Hàm hiển thị thông tin ra outputDiv
function displayInfo(pageTotal = 0, total = 0) {
    const points = calculatePoints(total);
    outputDiv.textContent =
        `✅ Trang này: ${formatNumber(pageTotal)} USDT\n` +
        `📊 Tổng cộng: ${formatNumber(total)} USDT\n` +
        `⭐ Điểm nhận được: ${points}`;
}

// ✅ Khi popup load → luôn hiển thị thông tin hiện tại (hoặc mặc định 0)
document.addEventListener('DOMContentLoaded', async () => {
    const { total = 0 } = await chrome.storage.local.get('total');
    displayInfo(0, total);
});

collectBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { type: 'COLLECT_PAGE' }, async (response) => {
        if (!response) {
            outputDiv.textContent = '❌ Không thể lấy dữ liệu. Hãy chắc bạn đang ở trang bảng Binance.';
            return;
        }

        const { pageTotal } = response;
        const { total = 0 } = await chrome.storage.local.get('total');
        const newTotal = total + pageTotal;

        await chrome.storage.local.set({ total: newTotal });

        displayInfo(pageTotal, newTotal);
    });
});

showTotalBtn.addEventListener('click', async () => {
    const { total = 0 } = await chrome.storage.local.get('total');
    displayInfo(0, total);
});

resetBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove('total');
    displayInfo(0, 0);
});
