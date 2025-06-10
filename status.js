// =======================================================
// HALAMAN STATUS PESANAN PELANGGAN - VERSI FINAL
// =======================================================

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

// --- ELEMEN DOM ---
const queueNumberEl = document.getElementById('queue-number-display');
const statusEl = document.getElementById('status-display');
const customerNameEl = document.getElementById('customer-name-display'); // Pastikan ID ini ada di status.html

// --- FUNGSI TAMPILAN ---
function displayStatus(transaction) {
    if (!transaction) {
        statusEl.innerText = "Data pesanan tidak ditemukan.";
        statusEl.className = 'status-error';
        return;
    };

    queueNumberEl.innerText = transaction.queueNumber || '-';
    statusEl.innerText = transaction.status || 'Menunggu Status';
    if (customerNameEl && transaction.customerName) {
        customerNameEl.innerText = `Pesanan a/n: ${transaction.customerName}`;
    }

    // Atur warna dan gaya berdasarkan status
    let statusClass = 'loading';
    let bgColor = '#f0f2f5'; // Warna background default
    
    switch (transaction.status) {
        case "Sedang Disiapkan":
            statusClass = 'status-preparing';
            break;
        case "Siap Diambil":
            statusClass = 'status-ready';
            bgColor = '#d4edda'; // Latar hijau muda
            break;
        case "Selesai":
            statusClass = 'status-complete';
            bgColor = '#e2e3e5'; // Latar abu-abu
            break;
    }
    statusEl.className = `status-display ${statusClass}`; // Tambahkan kelas dasar dan kelas status
    document.body.style.backgroundColor = bgColor;
}

// --- LOGIKA UTAMA ---
const lookupId = new URLSearchParams(window.location.search).get('id');

if (!lookupId) {
    queueNumberEl.innerText = "Error";
    statusEl.innerText = "ID Pesanan tidak valid.";
    statusEl.className = 'status-error';
} else {
    // Tampilkan status awal saat mencari
    statusEl.innerText = "Mencari pesanan...";
    statusEl.className = 'loading';

    let unsubscribe = null; // Variabel untuk menghentikan listener jika perlu

    // Fungsi utama yang akan mencari dan mendengarkan
    const findAndListen = () => {
        // Pasang listener yang mencari berdasarkan ID pesanan asli (untuk pelanggan)
        unsubscribe = db.collection('transactions')
            .where('originalOrderId', '==', lookupId)
            .onSnapshot(snapshot => {
                if (!snapshot.empty) {
                    // Jika ketemu, tampilkan datanya
                    console.log("Transaksi ditemukan dari pesanan pelanggan.");
                    const transactionData = snapshot.docs[0].data();
                    displayStatus(transactionData);
                } else {
                    // Jika tidak ketemu, tampilkan status menunggu
                    console.log("Menunggu konfirmasi dari kasir...");
                    statusEl.innerText = "Menunggu konfirmasi kasir...";
                    statusEl.className = 'loading';
                }
            }, err => {
                console.error("Error pada listener 'originalOrderId':", err);
                statusEl.innerText = "Gagal terhubung ke server.";
                statusEl.className = 'status-error';
            });
    };

    // Cek dulu apakah ID ini adalah ID transaksi final (untuk kasir)
    db.collection('transactions').doc(lookupId).get()
        .then(doc => {
            if (doc.exists) {
                // Jika ya, langsung dengarkan dokumen ini
                console.log("Mendengarkan update pada transaksi kasir.");
                db.collection('transactions').doc(lookupId).onSnapshot(docSnapshot => {
                    displayStatus(docSnapshot.data());
                });
            } else {
                // Jika tidak, jalankan pencarian untuk pesanan pelanggan
                findAndListen();
            }
        })
        .catch(err => {
            console.error("Error saat memeriksa ID final:", err);
            statusEl.innerText = "Gagal memeriksa pesanan.";
            statusEl.className = 'status-error';
        });
}
