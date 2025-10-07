function collectPageData() {
    let pageTotal = 0;

    const rows = document.querySelectorAll('tbody.bn-web-table-tbody tr[role="row"]');
    rows.forEach(row => {
        const typeCell = row.querySelector('td[aria-colindex="4"] div');   // Cột Loại (Mua/Bán)
        const statusCell = row.querySelector('td[aria-colindex="11"] div'); // 🟡 Cột Trạng thái
        const amountCell = row.querySelector('td[aria-colindex="9"] div');  // Cột Số tiền USDT

        const typeText = typeCell ? typeCell.textContent.trim() : '';
        const statusText = statusCell ? statusCell.textContent.trim() : '';
        const amountText = amountCell ? amountCell.textContent.trim() : '';
        console.log(statusText)
        if (typeText === 'Mua' && statusText === 'Đã khớp') {
            const num = parseFloat(amountText.replace(/[^\d.,]/g, '').replace(/,/g, ''));
            if (!isNaN(num)) {
                pageTotal += num * 4; // ✅ Nhân 4
            }
        }
    });

    return pageTotal;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'COLLECT_PAGE') {
        const total = collectPageData();
        sendResponse({ pageTotal: total });
    }
});
  