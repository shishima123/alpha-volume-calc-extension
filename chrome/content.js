function collectPageData() {
    const historyEl = document.querySelector('#trd-order-history');
    if (!historyEl) {
        return { error: true };
    }

    let buyTotal = 0;
    let sellTotal = 0;

    const todayStr = (() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    })();

    const rows = document.querySelectorAll(
        '#trd-order-history tbody.bn-web-table-tbody tr[role="row"]'
    );

    rows.forEach((row) => {
        // Thời gian tạo (col 1): "2025-12-24 17:50:35"
        const timeCell = row.querySelector('td[aria-colindex="1"]');
        const createdAt = timeCell ? timeCell.textContent.trim() : '';
        const createdDate = createdAt.slice(0, 10); // lấy phần YYYY-MM-DD

        // ✅ Chỉ tính row của ngày hiện tại và sau 7h sáng
        if (createdDate !== todayStr) return;
        const createdHour = parseInt(createdAt.slice(11, 13), 10);
        if (!Number.isFinite(createdHour) || createdHour < 7) return;

        const typeCell = row.querySelector('td[aria-colindex="4"] div');     // Hướng (Mua/Bán)
        const statusCell = row.querySelector('td[aria-colindex="13"] div');  // Trạng thái (HTML mới)
        const amountCell = row.querySelector('td[aria-colindex="9"] div');   // Tổng (USDT)

        const typeText = typeCell ? typeCell.textContent.trim() : '';
        const statusText = statusCell ? statusCell.textContent.trim() : '';
        const amountText = amountCell ? amountCell.textContent.trim() : '';

        // Chỉ tính phần đã giao dịch của lệnh mua/bán bằng USDT.
        if ((typeText === 'Mua' || typeText === 'Bán') &&
            (statusText === 'Đã khớp' || statusText === 'Đã hủy') &&
            /\sUSDT\s*$/i.test(amountText)) {
            // USDT mới dùng dấu chấm thập phân; vẫn hỗ trợ "1.024,94797 USDT".
            let normalized = amountText.replace(/\s*USDT\s*/i, '').trim();
            if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
                normalized = normalized.replace(/\./g, '').replace(/,/g, '.');
            } else {
                normalized = normalized.replace(/,/g, '');
            }

            const num = parseFloat(normalized);
            if (Number.isFinite(num) && num > 0) {
                if (typeText === 'Mua') buyTotal += num;
                else sellTotal += num;
            }
        }
    });

    // Volume tính điểm nhân 4; tổng mua/bán dùng giá trị gốc.
    return { pageTotal: buyTotal * 4, tradeTotals: { buyTotal, sellTotal } };
}
