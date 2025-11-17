function collectPageData() {
    let pageTotal = 0;

    // Lấy tất cả hàng dữ liệu trong tbody
    const rows = document.querySelectorAll('#trd-order-history tbody.bn-web-table-tbody tr[role="row"]');

    rows.forEach(row => {
        const typeCell = row.querySelector('td[aria-colindex="4"] div');   // Cột Loại (Mua/Bán)
        const statusCell = row.querySelector('td[aria-colindex="12"] div'); // Cột Trạng thái
        const amountCell = row.querySelector('td[aria-colindex="9"] div');  // Cột Tổng (USDT)

        const typeText = typeCell ? typeCell.textContent.trim() : '';
        const statusText = statusCell ? statusCell.textContent.trim() : '';
        const amountText = amountCell ? amountCell.textContent.trim() : '';

        // Lọc điều kiện: Mua và Đã khớp
        if (typeText === 'Mua' && statusText === 'Đã khớp') {
            // Ví dụ: "1.024,99863 USDT" → "1024.99863"
            const normalized = amountText
                .replace(/\s*USDT\s*/i, '')  // bỏ chữ USDT
                .replace(/\./g, '')          // bỏ dấu . ngăn cách phần nghìn
                .replace(/,/g, '.');         // đổi dấu phẩy thành chấm

            const num = parseFloat(normalized);
            if (!isNaN(num)) {
                pageTotal += num * 4; // ✅ Nhân 4
            } else {
                console.warn('Không parse được số:', amountText);
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