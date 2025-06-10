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

// =======================================================
// PENJAGA OTENTIKASI HALAMAN
// =======================================================
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("Pengguna sudah login, menampilkan manajemen stok.");
        // Jika sudah login, baru jalankan fungsi utama
        listenForStockUpdates();
    } else {
        console.log("Tidak ada pengguna yang login, mengarahkan ke halaman login...");
        window.location.href = 'login.html';
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
