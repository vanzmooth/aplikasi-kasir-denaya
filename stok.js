// PENTING: Salin konfigurasi Firebase Anda dari file lain ke sini
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
const stockListContainer = document.getElementById('stock-list-container');
const addProductForm = document.getElementById('add-product-form');
// =======================================================
// PENJAGA OTENTIKASI HALAMAN
// =======================================================
auth.onAuthStateChanged(user => {
    if (user) {
        // TAMPILKAN HALAMAN
        document.body.classList.add('visible');
        console.log("Pengguna sudah login, menampilkan manajemen stok.");
        // Jika sudah login, baru jalankan fungsi utama
        listenForStockUpdates();
        listenForStockHistory();
        populateStockIdDropdown();
    } else {
        console.log("Tidak ada pengguna yang login, mengarahkan ke halaman login...");
        window.location.href = 'login.html';
    }

    // Tambahkan di app.js, laporan.js, dan stok.js
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            auth.signOut().then(() => {
                console.log('Pengguna berhasil logout.');
                // Halaman akan otomatis redirect karena ada "penjaga" onAuthStateChanged
            }).catch((error) => {
                console.error('Error saat logout:', error);
            });
        });
    }
});

// =======================================================
// FUNGSI UTAMA
// =======================================================

// Fungsi untuk mendengarkan perubahan stok secara real-time
function listenForStockUpdates() {
    stockListContainer.innerHTML = '<p class="loading-text">Memuat data stok...</p>';
    const stockRef = db.collection('counters').doc('stock_tracker');

    stockRef.onSnapshot(doc => {
        if (!doc.exists) {
            stockListContainer.innerHTML = '<p class="loading-text">Dokumen stok tidak ditemukan.</p>';
            return;
        }

        const stockData = doc.data();
        stockListContainer.innerHTML = ''; // Kosongkan daftar

        for (const stockId in stockData) {
            // Kita hanya tampilkan field yang relevan
            if (stockId.startsWith('dimsum_') || stockId.startsWith('saus_')) {
                const displayName = stockId.replace(/_/g, ' ');

                const stockItem = document.createElement('div');
                stockItem.className = 'stock-item';
                stockItem.innerHTML = `
                    <div class="stock-info">
                        <span class="stock-name">${displayName}</span>
                        <span class="stock-quantity">${stockData[stockId]}</span>
                    </div>
                    <div class="stock-actions">
                        <button class="btn-adjust" data-stockid="${stockId}">- Sesuaikan</button>
                        <button class="btn-add" data-stockid="${stockId}">+ Tambah</button>
                    </div>
                `;
                stockListContainer.appendChild(stockItem);
            }
        }
    }, error => {
        console.error("Gagal mendengarkan update stok: ", error);
        stockListContainer.innerHTML = '<p class="loading-text">Gagal memuat data stok. Cek console.</p>';
    });
}

// Tambahkan fungsi baru ini di stok.js
function listenForStockHistory() {
    const historyBody = document.getElementById('stock-history-body');

    // Mendengarkan 50 perubahan terakhir, diurutkan dari yang paling baru
    db.collection('stock_history').orderBy('timestamp', 'desc').limit(50)
        .onSnapshot(snapshot => {
            if (snapshot.empty) {
                historyBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada riwayat.</td></tr>';
                return;
            }

            historyBody.innerHTML = ''; // Kosongkan riwayat setiap ada update
            snapshot.docs.forEach(doc => {
                const log = doc.data();
                const logDate = log.timestamp ? log.timestamp.toDate().toLocaleString('id-ID') : 'N/A';
                const changeAmount = log.change > 0 ? `+${log.change}` : log.change;
                const changeClass = log.change > 0 ? 'stock-in' : 'stock-out';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${logDate}</td>
                    <td>${log.stock_id.replace(/_/g, ' ')}</td>
                    <td><span class="stock-change ${changeClass}">${changeAmount}</span></td>
                    <td>${log.reason}</td>
                `;
                historyBody.appendChild(row);
            });

        }, error => {
            console.error("Gagal memuat riwayat stok:", error);
            historyBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Gagal memuat riwayat.</td></tr>';
        });
}
// Tambahkan DUA blok kode baru ini di stok.js

// 1. Fungsi untuk menangani penambahan kategori stok baru
async function handleAddNewStockCategory() {
    const stockIdSelect = document.getElementById('product-stock-id');
    const newCategoryName = prompt("Masukkan nama untuk kategori stok baru (misal: Minuman Dingin):");

    if (!newCategoryName || newCategoryName.trim() === '') {
        alert("Nama kategori tidak boleh kosong.");
        stockIdSelect.value = ""; // Kembalikan ke pilihan default
        return;
    }

    const initialStockStr = prompt(`Masukkan jumlah stok awal untuk "${newCategoryName}":`);
    const initialStock = parseInt(initialStockStr);

    if (isNaN(initialStock) || initialStock < 0) {
        alert("Harap masukkan jumlah stok yang valid (angka positif).");
        stockIdSelect.value = "";
        return;
    }

    // Buat field key yang valid untuk Firestore (huruf kecil, spasi jadi _)
    const newStockId = `stok_${newCategoryName.trim().toLowerCase().replace(/\s+/g, '_')}`;

    try {
        // Update dokumen stock_tracker dengan field baru
        const stockRef = db.collection('counters').doc('stock_tracker');
        await stockRef.update({
            [newStockId]: initialStock
        });

        alert(`Kategori stok "${newCategoryName}" berhasil dibuat!`);

        // Muat ulang dropdown dan pilih kategori yang baru dibuat
        await populateStockIdDropdown();
        stockIdSelect.value = newStockId;

    } catch (error) {
        console.error("Gagal membuat kategori stok baru:", error);
        alert(`Gagal: ${error.message}`);
        stockIdSelect.value = "";
    }
}

// 2. Event listener untuk dropdown kategori stok
document.addEventListener('DOMContentLoaded', () => {
    // ... (listener untuk addProductForm dan stockListEl yang sudah ada) ...

    const stockIdSelect = document.getElementById('product-stock-id');
    if (stockIdSelect) {
        stockIdSelect.addEventListener('change', (event) => {
            if (event.target.value === '--add_new--') {
                handleAddNewStockCategory();
            }
        });
    }
});
// Tambahkan fungsi baru ini di stok.js
// Ganti fungsi ini di stok.js
async function populateStockIdDropdown() {
    const stockIdSelect = document.getElementById('product-stock-id');
    // Simpan opsi pertama ("-- Pilih Kategori --")
    const firstOption = stockIdSelect.options[0];
    stockIdSelect.innerHTML = ''; // Kosongkan dropdown
    stockIdSelect.appendChild(firstOption); // Tambahkan kembali opsi pertama

    try {
        const doc = await db.collection('counters').doc('stock_tracker').get();
        if (doc.exists) {
            const stockData = doc.data();
            for (const stockId in stockData) {
                if (!stockId.includes('Date')) { // Filter field non-stok
                    const option = document.createElement('option');
                    option.value = stockId;
                    option.textContent = stockId.replace(/_/g, ' ');
                    stockIdSelect.appendChild(option);
                }
            }
        }
    } catch (error) {
        console.error("Gagal mengisi dropdown stok:", error);
    } finally {
        // --- TAMBAHAN BARU DI SINI ---
        // Selalu tambahkan opsi untuk membuat kategori baru di akhir
        const addNewOption = document.createElement('option');
        addNewOption.value = '--add_new--'; // Beri nilai unik
        addNewOption.textContent = '++ Tambah Kategori Baru ++';
        stockIdSelect.appendChild(addNewOption);
    }
}
// Event listener untuk tombol-tombol aksi
stockListContainer.addEventListener('click', async (event) => {
    const target = event.target;
    const stockId = target.dataset.stockid;

    if (!stockId) return; // Keluar jika yang diklik bukan tombol

    let amount = 0;
    let reason = '';

    if (target.classList.contains('btn-add')) {
        const amountStr = prompt(`Jumlah stok masuk untuk ${stockId.replace(/_/g, ' ')}:`);
        if (!amountStr) return;
        amount = parseInt(amountStr);
        reason = "Stok Masuk (Manual)";
    } else if (target.classList.contains('btn-adjust')) {
        const amountStr = prompt(`Jumlah stok keluar/rusak untuk ${stockId.replace(/_/g, ' ')}:`);
        if (!amountStr) return;
        amount = -Math.abs(parseInt(amountStr)); // Pastikan nilainya negatif
        reason = prompt("Alasan penyesuaian (contoh: Rusak, Tumpah, Konsumsi):", "Rusak/Terbuang");
        if (!reason) return;
    }

    if (isNaN(amount) || amount === 0) {
        alert("Harap masukkan jumlah yang valid.");
        return;
    }

    // Proses update menggunakan batch write
    try {
        target.disabled = true; // Nonaktifkan tombol saat proses
        const stockRef = db.collection('counters').doc('stock_tracker');
        const historyRef = db.collection('stock_history').doc(); // Dokumen baru di koleksi riwayat

        const batch = db.batch();

        // 1. Update jumlah stok di 'stock_tracker'
        batch.update(stockRef, { [stockId]: firebase.firestore.FieldValue.increment(amount) });

        // 2. Catat pergerakan di 'stock_history'
        batch.set(historyRef, {
            stock_id: stockId,
            change: amount,
            reason: reason,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        alert('Stok berhasil diperbarui!');

    } catch (error) {
        console.error("Gagal update stok:", error);
        alert(`Gagal memperbarui stok: ${error.message}`);
    } finally {
        target.disabled = false; // Aktifkan kembali tombolnya
    }
});
// Tambahkan listener baru ini di stok.js
addProductForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Mencegah form melakukan refresh halaman
    const saveButton = document.getElementById('save-product-btn');
    saveButton.disabled = true;
    saveButton.textContent = 'Menyimpan...';

    try {
        // Ambil semua nilai dari form
        const name = document.getElementById('product-name').value;
        const price = parseInt(document.getElementById('product-price').value);
        const image = document.getElementById('product-image').value;
        const stock_id = document.getElementById('product-stock-id').value;
        const min_order = parseInt(document.getElementById('product-min-order').value) || 1;

        if (!name || !price || !stock_id) {
            throw new Error('Nama, Harga, dan Kategori Stok wajib diisi.');
        }

        // Siapkan objek produk baru
        const newProduct = { name, price, stock_id, min_order };
        if (image) newProduct.image = image; // Hanya tambahkan image jika diisi

        // Simpan ke koleksi 'products'
        await db.collection('products').add(newProduct);

        alert(`Menu "${name}" berhasil ditambahkan!`);
        addProductForm.reset(); // Kosongkan form

    } catch (error) {
        console.error("Gagal menambah menu:", error);
        alert(`Gagal menambah menu: ${error.message}`);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Simpan Menu';
    }
});