// =======================================================
// LOGIKA UNTUK HALAMAN LAPORAN PENJUALAN
// =======================================================

// PENTING: Salin konfigurasi Firebase Anda dari app.js ke sini
const firebaseConfig = {
  apiKey: "AIzaSyD0Qh1Fimh9iYT8dOi91beIbc1wDe80R0g",
  authDomain: "aplikasikasirpwa.firebaseapp.com",
  projectId: "aplikasikasirpwa",
  storageBucket: "aplikasikasirpwa.firebasestorage.app",
  messagingSenderId: "820452190086",
  appId: "1:820452190086:web:695af51a9d5ac707e22e07"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Menghubungkan variabel dengan elemen di HTML
const filterButtons = document.querySelectorAll('.filter-btn');
const totalRevenueEl = document.getElementById('total-revenue');
const totalTransactionsEl = document.getElementById('total-transactions');
const bestSellingProductEl = document.getElementById('best-selling-product');
const productSalesListEl = document.getElementById('product-sales-list');
let currentReportData = []; // <-- TAMBAHKAN VARIABEL BARU INI
let salesChartInstance = null; // <-- TAMBAHKAN INI
// Di bagian atas laporan.js
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const applyRangeBtn = document.getElementById('apply-range-btn');

// Fungsi untuk mengubah angka menjadi format Rupiah (kita butuh ini lagi di sini)
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
}

// Fungsi untuk mendapatkan rentang tanggal berdasarkan periode
function getDateRange(period) {
    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(now);

    // Set ke awal hari (00:00:00) dan akhir hari (23:59:59)
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    if (period === 'last7days') {
        startDate.setDate(now.getDate() - 6); // 6 hari lalu + hari ini = 7 hari
    } else if (period === 'this_month') {
        startDate.setDate(1); // Set ke tanggal 1 bulan ini
    }
    // Jika period === 'today', kita tidak perlu mengubah apa-apa

    return { startDate, endDate };
}

// Tambahkan fungsi baru ini di laporan.js
// Ganti seluruh fungsi displayStockManagement dengan versi baru ini



// Fungsi utama untuk mengambil, memproses, dan menampilkan laporan
async function generateReport(startDate, endDate) {
    // Tampilkan status memuat...
    totalRevenueEl.textContent = '...';
    totalTransactionsEl.textContent = '...';
    bestSellingProductEl.textContent = '...';
    productSalesListEl.innerHTML = '<p class="loading-text">Mengambil data...</p>';

    // Set waktu agar mencakup satu hari penuh
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    try {
        const snapshot = await db.collection('transactions')
            .where('createdAt', '>=', startDate)
            .where('createdAt', '<=', endDate)
            .orderBy('createdAt', 'desc')
            .get();
        currentReportData = snapshot.docs; // <-- SIMPAN DATA DI SINI

        if (snapshot.empty) {
            totalRevenueEl.textContent = formatRupiah(0);
            totalTransactionsEl.textContent = '0';
            bestSellingProductEl.textContent = '-';
            productSalesListEl.innerHTML = '<p class="loading-text">Tidak ada transaksi pada periode ini.</p>';
            if (salesChartInstance) salesChartInstance.destroy(); // Hapus grafik lama
            return;
        }

        // --- Proses Data ---
        let totalRevenue = 0;
        const totalTransactions = snapshot.size;
        const productSales = {}; // Objek untuk menghitung penjualan per produk

        snapshot.docs.forEach(doc => {
            const tx = doc.data();
            // --- TAMBAHKAN BLOK CONSOLE.LOG UNTUK DEBUGGING DI SINI ---
    // console.log(`--- Memproses Transaksi ID: ${doc.id} ---`);
    // console.log(`Nilai totalAmount dari Firestore: ${tx.totalAmount}`);
    // console.log(`Tipe data dari totalAmount: ${typeof tx.totalAmount}`);
    // console.log(`Total pendapatan SEBELUM ditambah: ${totalRevenue}`);
    
    // Proses penjumlahan
    totalRevenue += tx.totalAmount;
    
    // console.log(`Total pendapatan SETELAH ditambah: ${totalRevenue}`);
    // console.log(`------------------------------------`);
    // --- AKHIR BLOK DEBUGGING ---

            tx.items.forEach(item => {
                if (productSales[item.name]) {
                    productSales[item.name] += item.quantity;
                } else {
                    productSales[item.name] = item.quantity;
                }
            });
        });

        // Cari produk terlaris
        let bestSellingProduct = '-';
        let maxQuantity = 0;
        for (const productName in productSales) {
            if (productSales[productName] > maxQuantity) {
                maxQuantity = productSales[productName];
                bestSellingProduct = productName;
            }
        }

        // --- Tampilkan Data ---
        totalRevenueEl.textContent = formatRupiah(totalRevenue);
        renderSalesChart(productSales);
        totalTransactionsEl.textContent = totalTransactions;
        bestSellingProductEl.textContent = `${bestSellingProduct} (${maxQuantity} terjual)`;
      // PANGGIL FUNGSI GRAFIK DI SINI
renderSalesChart(productSales);

        // Tampilkan rincian penjualan produk
        productSalesListEl.innerHTML = '';
        Object.entries(productSales)
            .sort(([, a], [, b]) => b - a) // Urutkan dari yang paling banyak terjual
            .forEach(([name, quantity]) => {
                const productItem = document.createElement('div');
                productItem.className = 'product-item';
                productItem.innerHTML = `
                    <span class="product-name">${name}</span>
                    <span class="product-quantity">${quantity} terjual</span>
                `;
                productSalesListEl.appendChild(productItem);
            });

    } catch (error) {
        console.error("Gagal membuat laporan: ", error);
        productSalesListEl.innerHTML = '<p class="loading-text">Terjadi error saat mengambil data.</p>';
    }
}
// Tambahkan DUA fungsi baru ini di laporan.js

function exportToCsv(transactions) {
    const headers = ['ID Transaksi', 'Tanggal', 'Nama Pelanggan', 'Nomor Antrian', 'Nama Produk', 'Kuantitas', 'Harga Satuan', 'Subtotal'];
    
    // Fungsi kecil untuk memastikan tidak ada koma yang merusak CSV
    const escapeCsvCell = (cell) => {
        if (cell === undefined || cell === null) return '';
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
    };

    const csvRows = [headers.join(',')];

    transactions.forEach(doc => {
        const tx = doc.data();
        const txDate = tx.createdAt.toDate().toLocaleString('id-ID');

        tx.items.forEach(item => {
            const row = [
                doc.id,
                txDate,
                tx.customerName,
                tx.queueNumber,
                item.name,
                item.quantity,
                item.price,
                item.price * item.quantity
            ];
            csvRows.push(row.map(escapeCsvCell).join(','));
        });
    });

    return csvRows.join('\n');
}

function downloadCsv(csvContent) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    
    const date = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `laporan-penjualan-${date}.csv`);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Tambahkan listener baru ini di laporan.js
const exportCsvButton = document.getElementById('export-csv-button');
exportCsvButton.addEventListener('click', () => {
    if (currentReportData.length === 0) {
        alert('Tidak ada data untuk diekspor. Silakan pilih periode terlebih dahulu.');
        return;
    }
    const csvData = exportToCsv(currentReportData);
    downloadCsv(csvData);
});
// Tambahkan fungsi baru ini di laporan.js
function renderSalesChart(productSales) {
    const ctx = document.getElementById('salesChart').getContext('2d');

    // Hancurkan grafik lama jika sudah ada
    if (salesChartInstance) {
        salesChartInstance.destroy();
    }

    // Urutkan produk dari yang paling laris dan ambil 5 teratas
    const sortedProducts = Object.entries(productSales)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    const labels = sortedProducts.map(item => item[0]); // Nama Produk
    const data = sortedProducts.map(item => item[1]); // Jumlah Terjual

    salesChartInstance = new Chart(ctx, {
        type: 'bar', // Tipe grafik: batang
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Terjual',
                data: data,
                backgroundColor: 'rgba(232, 90, 79, 0.6)', // Warna batang grafik
                borderColor: 'rgba(232, 90, 79, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        // Pastikan angka di sumbu Y adalah bilangan bulat
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // Sembunyikan legenda karena sudah jelas
                },
                title: {
                    display: true,
                    text: '5 Produk Terlaris'
                }
            }
        }
    });
}

// --- Event Listener untuk Tombol Filter ---
// Ganti listener .filter-btn dengan ini
filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Hapus nilai tanggal kustom agar tidak membingungkan
        startDateInput.value = '';
        endDateInput.value = '';

        const period = button.dataset.period;
        const { startDate, endDate } = getDateRange(period); // Fungsi lama kita masih berguna
        generateReport(startDate, endDate);
    });
});

// Tambahkan listener baru ini di laporan.js
applyRangeBtn.addEventListener('click', () => {
    const startDateValue = startDateInput.value;
    const endDateValue = endDateInput.value;

    if (!startDateValue || !endDateValue) {
        alert('Harap pilih tanggal mulai dan tanggal selesai.');
        return;
    }

    const startDate = new Date(startDateValue);
    const endDate = new Date(endDateValue);

    if (endDate < startDate) {
        alert('Tanggal selesai tidak boleh sebelum tanggal mulai.');
        return;
    }

    // Hapus kelas 'active' dari tombol preset
    filterButtons.forEach(btn => btn.classList.remove('active'));

    generateReport(startDate, endDate);
});


// Tambahkan event listener baru ini di laporan.js
// Ganti seluruh event listener untuk stockListEl dengan ini


// Di laporan.js, sebelum --- INISIALISASI ---

// =======================================================
// PENJAGA OTENTIKASI HALAMAN LAPORAN
// =======================================================
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("Pengguna sudah login, laporan dapat diakses.");
                // --- TAMBAHKAN KODE INI UNTUK MEMICU LAPORAN DEFAULT ---
        // Kita cari tombol "Hari Ini" lalu kita panggil .click() padanya.
        const todayButton = document.querySelector('.filter-btn[data-period="today"]');
        if (todayButton) {
            todayButton.click();
        }
        // --- AKHIR KODE TAMBAHAN ---

    } else {
        console.log("Tidak ada pengguna yang login, mengarahkan ke halaman login...");
        window.location.href = 'login.html';
    }
});

// --- Inisialisasi ---
// Secara default, tampilkan laporan untuk "Hari Ini" saat halaman pertama kali dibuka
generateReport('today');
