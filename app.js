// =================================================================
// FASE 3: KODE BARU DENGAN INTEGRASI FIREBASE
// =================================================================

// Langkah 1: Konfigurasi Firebase Anda
// GANTI DENGAN KONFIGURASI DARI PROYEK FIREBASE ANDA!
const firebaseConfig = {
  apiKey: "AIzaSyD0Qh1Fimh9iYT8dOi91beIbc1wDe80R0g",
  authDomain: "aplikasikasirpwa.firebaseapp.com",
  projectId: "aplikasikasirpwa",
  storageBucket: "aplikasikasirpwa.firebasestorage.app",
  messagingSenderId: "820452190086",
  appId: "1:820452190086:web:695af51a9d5ac707e22e07"
};

// Langkah 2: Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(); // Inisialisasi Firestore
const auth = firebase.auth(); // <-- TAMBAHKAN INI

// --- VARIABEL GLOBAL & ELEMEN DOM (Masih sama) ---
let cart = JSON.parse(localStorage.getItem('keranjangBelanja')) || [];
let products = []; // Sekarang produk akan diisi dari Firestore

const productListEl = document.getElementById('product-list');
const cartItemsEl = document.getElementById('cart-items');
const totalPriceEl = document.getElementById('total-price');
const btnPay = document.getElementById('btn-pay');
const validationListEl = document.getElementById('validation-list');

// --- FUNGSI ---

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
}

async function fetchProducts() {
    productListEl.innerHTML = '<p>Memuat produk...</p>';
    try {
        const snapshot = await db.collection('products').get();
        if (snapshot.empty) {
            productListEl.innerHTML = '<p>Belum ada produk yang ditambahkan.</p>';
            return;
        }
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts();
    } catch (error) {
        console.error("Error mengambil produk: ", error);
        productListEl.innerHTML = '<p>Gagal memuat produk. Coba lagi.</p>';
    }
}

// Tambahkan fungsi baru ini di app.js
// Ganti seluruh fungsi finalizeTransaction di app.js
async function finalizeTransaction(items, customerName = 'Walk-in Customer', pendingOrderId = null) {
    // 1. Validasi dan kurangi stok (sudah benar)
    await updateStock(items);

    // 2. Dapatkan nomor antrian baru (sudah benar)
    const queueNumber = await getNextQueueNumber();
    
    // 3. Siapkan data transaksi final
    const totalAmount = items.reduce((total, item) => total + (Number(item.price) * Number(item.quantity)), 0);
    const finalTransactionData = {
        items: items,
        totalAmount: totalAmount,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "Sedang Disiapkan",
        queueNumber: queueNumber,
        customerName: customerName,
        // Tautkan ID pesanan asli jika ada
        originalOrderId: pendingOrderId 
    };

    // 4. Simpan ke koleksi 'transactions' utama
    const docRef = await db.collection('transactions').add(finalTransactionData);
    
    // 5. HAPUS pesanan tertunda SETELAH semuanya selesai (jika ada)
    if (pendingOrderId) {
        await db.collection('pending_orders').doc(pendingOrderId).delete();
    }
    
    // 6. Kembalikan data transaksi yang sudah lengkap untuk dicetak
    const newTransaction = await docRef.get();
    return { id: newTransaction.id, ...newTransaction.data() };
}



// Tambahkan fungsi baru ini di app.js
async function getNextQueueNumber() {
    let newQueueNumber = 1;
    const counterRef = db.collection('counters').doc('dailyQueue');
    const todayStr = new Date().toISOString().slice(0, 10);

    try {
        const counterDoc = await counterRef.get();
        if (counterDoc.exists) {
            const data = counterDoc.data();
            if (data.lastResetDate === todayStr) {
                newQueueNumber = data.lastNumber + 1;
            }
        }
        // Update counter langsung di dalam fungsi ini
        await counterRef.set({
            lastNumber: newQueueNumber,
            lastResetDate: todayStr
        });
        return newQueueNumber; // Kembalikan nomor baru
    } catch (error) {
        console.error("Gagal mendapatkan nomor antrian:", error);
        // Jika gagal, berikan nomor acak sebagai fallback darurat
        return Math.floor(Math.random() * 100); 
    }
}

// Tambahkan fungsi baru ini di app.js
// Ganti seluruh fungsi processPaidOrder dengan versi ini
// async function processPaidOrder(pendingOrderDoc) {
//     const orderData = pendingOrderDoc.data();
//     const originalOrderId = pendingOrderDoc.id; // Simpan ID asli
//     console.log(`Memproses pesanan dari pelanggan: ${originalOrderId}`);

//     const queueNumber = await getNextQueueNumber();

//     const finalTransactionData = {
//         items: orderData.items,
//         totalAmount: orderData.totalAmount,
//         createdAt: orderData.createdAt,
//         status: "Sedang Disiapkan",
//         queueNumber: queueNumber,
//         originalOrderId: originalOrderId,
//         customerName: orderData.customerName // <-- TAMBAHKAN JEMBATAN INI
//     };

//     try {
//       await updateStock(orderData.items);
//         await db.collection('transactions').add(finalTransactionData);
//         await db.collection('pending_orders').doc(originalOrderId).delete();

//         alert(`Pesanan Baru Masuk! Antrian #${queueNumber}`);

//     } catch (error) {
//         console.error("Gagal memproses pesanan pelanggan:", error);
//     }
// }


// Tambahkan fungsi terakhir ini di app.js
// Ganti fungsi lama dengan ini
function listenForPendingOrders() {
    console.log("Mendengarkan pesanan yang menunggu validasi...");
    db.collection('pending_orders').where('status', '==', 'menunggu_validasi')
        .onSnapshot(snapshot => {
            validationListEl.innerHTML = ''; // Kosongkan daftar setiap ada perubahan
            if (snapshot.empty) {
                validationListEl.innerHTML = '<p class="info-text">Belum ada pembayaran yang perlu divalidasi.</p>';
            } else {
                snapshot.docs.forEach(doc => {
                    const order = doc.data();
                    const validationItem = document.createElement('div');
                    validationItem.className = 'validation-item';
                    let itemsSummary = order.items.map(item => `${item.name} (x${item.quantity})`).join(', ');

                    validationItem.innerHTML = `
                        <p class="validation-name">${order.customerName}</p>
                        <p class="validation-details">${itemsSummary}</p>
                        <p class="validation-details"><strong>Total: ${formatRupiah(order.totalAmount)}</strong></p>
                        <div class="validation-actions">
                            <button class="btn-approve" data-id="${doc.id}">✔️ Setujui</button>
                            <button class="btn-reject" data-id="${doc.id}">❌ Tolak</button>
                        </div>
                    `;
                    validationListEl.appendChild(validationItem);
                });
            }
        });
}


// Tambahkan fungsi baru ini di bagian --- FUNGSI --- di app.js
function createReceiptLine(leftText, rightText, maxChars = 30) {
    const leftLength = leftText.length;
    const rightLength = rightText.length;
    const spacesNeeded = maxChars - leftLength - rightLength;

    if (spacesNeeded < 1) {
        // Jika teks terlalu panjang, buat harga di baris baru
        return `${leftText}\n${' '.repeat(maxChars - rightLength)}${rightText}`;
    }

    const spaces = ' '.repeat(spacesNeeded);
    return `${leftText}${spaces}${rightText}`;
}

// Ganti seluruh fungsi renderProducts lama Anda dengan versi DEFINITIF ini
function renderProducts() {
    productListEl.innerHTML = '';
    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        // --- LOGIKA BARU UNTUK STOK ---
        // LOGIKA BARU: Cek stok berdasarkan stock_id produk
        let isOutOfStock = false;
        if (product.stock_id && inventory[product.stock_id] <= 0) {
            isOutOfStock = true;
        }

        if (isOutOfStock) {
            productCard.classList.add('out-of-stock');
        }
        // --- AKHIR LOGIKA BARU ---
        productCard.innerHTML = `
            <img src="${product.image || 'https://placehold.co/100x100?text=Produk'}" alt="${product.name}">
            <div class="product-name">${product.name}</div>
            <div class="product-price">${formatRupiah(product.price)}</div>
        `;

        // --- Logika Definitif untuk Menangani Semua Interaksi ---
        let pressTimer;
        let longPressTriggered = false;
        let isScrolling = false;

        const longPressAmount = 5;
        const longPressDuration = 600;

        // Handler untuk memulai interaksi (baik mouse maupun sentuhan)
        const startPress = (e) => {
            isScrolling = false;
            longPressTriggered = false;
            
            pressTimer = setTimeout(() => {
                if (!isScrolling) {
                    longPressTriggered = true;
                    addToCart(product.id, longPressAmount);
                }
            }, longPressDuration);
        };

        // Handler untuk membatalkan interaksi (karena scroll atau mouse keluar)
        const cancelPress = () => {
            isScrolling = true;
            clearTimeout(pressTimer);
        };

        // Handler untuk mengakhiri interaksi (jari/mouse diangkat)
        const endPress = (e) => {
            clearTimeout(pressTimer);
            if (!longPressTriggered && !isScrolling) {
                addToCart(product.id, 1);
            }
            // Mencegah "klik hantu" setelah event sentuhan selesai
            e.preventDefault(); 
        };

        // --- Pemasangan Event Listener yang Diperbarui ---
        // Ubah cara pemasangan event listener agar tidak bisa diklik jika habis
        if (!isOutOfStock) {
            // Pasang semua event listener (click, mousedown, dll) hanya jika stok ada
        // Untuk Mouse
        productCard.addEventListener('mousedown', startPress);
        productCard.addEventListener('mouseup', endPress);
        productCard.addEventListener('mouseleave', cancelPress);

        // Untuk Sentuhan
        productCard.addEventListener('touchstart', startPress);
        productCard.addEventListener('touchend', endPress);
        productCard.addEventListener('touchmove', cancelPress);
        }
        productListEl.appendChild(productCard);
    });
}


// Ganti seluruh fungsi updateStock dengan versi final ini di app.js
// Ganti fungsi updateStock dengan versi ini di app.js
async function updateStock(items) {
    console.log("Memulai proses update stok dari penjualan...");
    const stockRef = db.collection('counters').doc('stock_tracker');
    const stockToReduce = {};

    items.forEach(item => {
        if (item.stock_id) {
            stockToReduce[item.stock_id] = (stockToReduce[item.stock_id] || 0) + item.quantity;
        }
    });

    if (Object.keys(stockToReduce).length === 0) return;

    return db.runTransaction(async (transaction) => {
        const stockDoc = await transaction.get(stockRef);
        if (!stockDoc.exists) throw new Error("Dokumen stok tidak ditemukan!");

        const currentStock = stockDoc.data();
        const updates = {};
        const historyBatch = db.batch(); // Batch terpisah untuk history

        for (const stockId in stockToReduce) {
            const reductionAmount = stockToReduce[stockId];
            if (!currentStock[stockId] || currentStock[stockId] < reductionAmount) {
                throw new Error(`Stok untuk ${stockId} tidak mencukupi!`);
            }
            updates[stockId] = firebase.firestore.FieldValue.increment(-reductionAmount);

            // Siapkan pencatatan riwayat untuk setiap item yang terjual
            const historyRef = db.collection('stock_history').doc();
            historyBatch.set(historyRef, {
                stock_id: stockId,
                change: -reductionAmount,
                reason: "Penjualan",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        transaction.update(stockRef, updates);
        // Commit batch history setelah transaksi utama berhasil
        return historyBatch.commit();
    });
}





// Ganti seluruh fungsi addToCart di app.js dengan versi ini
function addToCart(productId, quantityToAdd = 1) {
    const product = products.find(p => p.id === productId);
    if (!product || !product.stock_id) {
        alert("Produk ini tidak memiliki ID Stok, tidak bisa diproses.");
        return;
    }

    // --- LOGIKA VALIDASI STOK MENYELURUH ---
    const stockId = product.stock_id;
    const stockAvailable = inventory[stockId] || 0;

    // Hitung total kuantitas untuk kategori stok yang sama yang sudah ada di keranjang
    let quantityOfSameStockInCart = 0;
    cart.forEach(item => {
        if (item.stock_id === stockId) {
            quantityOfSameStockInCart += item.quantity;
        }
    });

    // Cek apakah penambahan baru akan melebihi stok yang tersedia
    if (quantityOfSameStockInCart + quantityToAdd > stockAvailable) {
        alert(`Maaf, stok untuk kategori ini hanya tersisa ${stockAvailable}. Anda sudah memiliki ${quantityOfSameStockInCart} di keranjang.`);
        return;
    }
    // --- AKHIR VALIDASI STOK ---

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += quantityToAdd;
    } else {
        cart.push({ ...product, quantity: quantityToAdd });
    }
    
    renderCart();
}



// Buat fungsi baru ini untuk mengubah kuantitas
function updateCartItemQuantity(productId, action) {
    const itemIndex = cart.findIndex(item => item.id === productId);

    if (itemIndex > -1) {
        if (action === 'increase') {
            cart[itemIndex].quantity++;
        } else if (action === 'decrease') {
            cart[itemIndex].quantity--;
            // Jika kuantitas jadi 0, hapus item dari keranjang
            if (cart[itemIndex].quantity <= 0) {
                cart.splice(itemIndex, 1);
            }
        }
        renderCart(); // Update tampilan setelah mengubah data
    }
}

// Tambahkan fungsi baru ini
function setCartItemQuantity(productId, newQuantity) {
    const itemIndex = cart.findIndex(item => item.id === productId);

    if (itemIndex > -1) {
        // Validasi: pastikan kuantitas adalah angka dan minimal 1
        if (newQuantity >= 1) {
            cart[itemIndex].quantity = newQuantity;
        } else {
            // Jika kuantitas kurang dari 1 (misal 0 atau -1), hapus item
            cart.splice(itemIndex, 1);
        }
        renderCart(); // Update tampilan
    }
}

function renderCart() {
    cartItemsEl.innerHTML = ''; // Kosongkan dulu keranjangnya.
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p>Keranjang masih kosong.</p>';
    } else {
        cart.forEach(item => {
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            // Ganti bagian di bawah ini
    cartItem.innerHTML = `
        <span class="cart-item-name">${item.name}</span>
        <div class="cart-item-controls">
            <button class="btn-quantity" data-id="${item.id}" data-action="decrease">-</button>
            <input type="number" class="cart-item-quantity" value="${item.quantity}" min="1" data-id="${item.id}">
            <button class="btn-quantity" data-id="${item.id}" data-action="increase">+</button>
        </div>
        <span class="cart-item-price">${formatRupiah(item.price * item.quantity)}</span>
    `;
    cartItemsEl.appendChild(cartItem);
});
    }

    // Hitung total harga dengan memperhitungkan kuantitas
    const totalPrice = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    totalPriceEl.textContent = formatRupiah(totalPrice);
    localStorage.setItem('keranjangBelanja', JSON.stringify(cart));
}

// Pastikan fungsi ini ada di app.js dan menu.js
async function fetchInventory() {
    try {
        const doc = await db.collection('counters').doc('stock_tracker').get();
        if (doc.exists) {
            inventory = doc.data(); // Mengisi variabel global 'inventory'
            console.log("Data stok berhasil dimuat:", inventory);
        } else {
            console.error("Dokumen pelacak stok ('stock_tracker') tidak ditemukan!");
        }
    } catch (error) {
        console.error("Gagal memuat data stok:", error);
    }
}

// Ganti seluruh fungsi fetchTransactions lama Anda dengan yang ini
function fetchTransactions() {
    const transactionListEl = document.getElementById('transaction-list');
    
    // Menggunakan onSnapshot untuk update real-time
    db.collection('transactions').orderBy('createdAt', 'desc').limit(20)
        .onSnapshot(snapshot => {
            if (snapshot.empty) {
                transactionListEl.innerHTML = '<p>Belum ada riwayat transaksi.</p>';
                return;
            }

            transactionListEl.innerHTML = ''; // Kosongkan daftar setiap kali ada update
            snapshot.docs.forEach(doc => {
                const tx = { id: doc.id, ...doc.data() };
                const txDate = tx.createdAt.toDate().toLocaleString('id-ID', {
                    hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
                });
                
                // Menentukan style & teks untuk status
                const isReady = tx.status === "Siap Diambil";
                const statusClass = isReady ? 'status-ready' : 'status-preparing';
                const buttonText = isReady ? 'Selesai' : 'Tandai Siap';

                const txItem = document.createElement('div');
                txItem.className = 'transaction-item';
                txItem.innerHTML = `
    <div class="tx-info">
        <span class="tx-queue">#${tx.queueNumber}</span>
        <div class="tx-details">
            <span class="tx-customer-name">${tx.customerName || ''}</span>
            <span class="tx-total">${formatRupiah(tx.totalAmount)}</span>
            <span class="tx-date">${txDate}</span>
        </div>
    </div>
    <div class="tx-status">
        <span class="status-badge ${
            tx.status === 'Selesai' ? 'status-complete' : (tx.status === 'Siap Diambil' ? 'status-ready' : 'status-preparing')
        }">${tx.status}</span>
    </div>
    <div class="tx-actions">
        <button class="btn-action btn-reprint" data-id="${tx.id}">Cetak Ulang</button>
        <button class="btn-action btn-change-status" 
                data-id="${tx.id}" 
                data-status="${tx.status}" 
                ${tx.status === 'Selesai' ? 'disabled' : ''}>
            ${tx.status === 'Sedang Disiapkan' ? 'Tandai Siap' : 'Selesaikan'}
        </button>
    </div>
                `;
                transactionListEl.appendChild(txItem);
            });
        }, err => {
            console.error("Error mendengarkan transaksi: ", err);
            transactionListEl.innerHTML = '<p>Gagal memuat riwayat.</p>';
        });
}


// Ganti seluruh fungsi printReceipt lama dengan yang ini
// GANTI SELURUH FUNGSI printReceipt ANDA DENGAN VERSI FINAL INI
// Ganti seluruh fungsi printReceipt dengan versi final ini
// GANTI SELURUH FUNGSI printReceipt DENGAN VERSI FINAL INI
function printReceipt(transaction) {
    const storeInfo = {
        name: "Dimsum Denaya",
        address: "Jl. Pucung No.13, Pucung, Kec. Kota Baru, Karawang, Jawa Barat 41374<br>(Teras Abu Bakar Mart)",
        phone: "WA: 0878-2603-6767",
    };

    const txDate = transaction.createdAt.toDate().toLocaleString('id-ID', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    let itemsHtml = '';
    transaction.items.forEach(item => {
        itemsHtml += `
            <div class="item-line">
                <div>${item.name} (x${item.quantity})</div>
                <div class="text-center">${formatRupiah(item.price * item.quantity)}</div>
            </div>
        `;
    });
    
    // Kita gunakan fungsi createReceiptLine yang sudah ada untuk Total
    const totalLine = createReceiptLine('TOTAL', formatRupiah(transaction.totalAmount));

    const baseUrl = window.location.origin;
    const statusUrl = `${baseUrl}/status.html?id=${transaction.originalOrderId || transaction.id}`;
    let qrCodeHtml = '<p>Gagal memuat QR Code.</p>';

    const qrOptions = { width: 300, margin: 1, errorCorrectionLevel: 'H' };

    QRCode.toDataURL(statusUrl, qrOptions)
        .then(url => {
            qrCodeHtml = `<img src="${url}" alt="QR Code Status Pesanan" style="width: 100%; max-width: 200px;">`;
        })
        .catch(err => {
            console.error('Gagal membuat QR Code', err);
        })
        .finally(() => {
            const receiptHtml = `
                <html>
                <head>
                    <title>Struk Transaksi</title>
                    <style>
                        /* ... (seluruh bagian CSS tidak perlu diubah dari versi terakhir) ... */
                        body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; width: 100%; max-width: 280px; margin: 0; padding: 5px; }
                        p { margin: 2px 0; }
                        .text-center { text-align: center; }
                        h1 { font-size: 16px; margin: 0; }
                        .header p { font-size: 10px; word-break: break-word; }
                        .queue-number { font-size: 28px; font-weight: bold; margin: 10px 0; padding: 5px; border: 2px dashed #000; }
                        .separator { border-top: 1px dashed #000; margin: 10px 0; }
                        .item-line { margin-bottom: 5px; }
                        pre {
                            white-space: pre-wrap; margin: 0; font-family: 'Courier New', monospace; 
                            font-size: 12px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; font-weight: bold;
                        }
                        .footer { margin-top: 15px; }
                    </style>
                </head>
                <body>
                    <div class="text-center"><h1>${storeInfo.name}</h1><p>${storeInfo.address}</p><p>${storeInfo.phone}</p></div>
                    <div class="separator"></div>
                    <p>No: ${transaction.id.substring(0, 8)}</p>
                    <p>Tgl: ${txDate}</p>
                    <p>Antrian: #${transaction.queueNumber}</p>
                    <div class="separator"></div>
                    <div>${itemsHtml}</div>
                    <pre>${totalLine}</pre>
                    <div class="footer text-center">
                        <p>Terima kasih sudah jajan di Jajanan Denaya!</p>
                        <p>Pantau status pesanan Anda.</p>
                        <div style="margin-top:10px;">${qrCodeHtml}</div>
                    </div>
                </body>
                </html>
            `;

            const printWindow = window.open('', '_blank');
            printWindow.document.write(receiptHtml);
            printWindow.document.close();
            printWindow.focus();
            
            printWindow.onload = function() {
                printWindow.print();
            };
        });
}





// Catatan: Saya sedikit mengubah cara QR Code dibuat (menggunakan .then() daripada async/await)
// untuk menghindari race condition dengan window.open, ini lebih aman.
// Anda tidak perlu mengubah kode lain, hanya fungsi printReceipt ini saja.


// HAPUS SEMUA DARI SINI KE BAWAH DI FILE ANDA, LALU GANTI DENGAN INI

// =======================================================
// --- EVENT LISTENERS & INISIALISASI ---
// =======================================================

// --- EVENT LISTENER UNTUK TOMBOL-TOMBOL ---

// Listener untuk keranjang belanja (+, -, input manual)
cartItemsEl.addEventListener('click', (event) => {
    if (event.target.classList.contains('btn-quantity')) {
        const productId = event.target.dataset.id;
        const action = event.target.dataset.action;
        updateCartItemQuantity(productId, action);
    }
});
cartItemsEl.addEventListener('change', (event) => {
    if (event.target.classList.contains('cart-item-quantity')) {
        const productId = event.target.dataset.id;
        const newQuantity = parseInt(event.target.value);
        setCartItemQuantity(productId, newQuantity);
    }
});

// Listener untuk panel validasi pembayaran
validationListEl.addEventListener('click', async (event) => {
    const target = event.target;
    const orderId = target.dataset.id;
    if (!orderId) return;

    // Di dalam validationListEl.addEventListener
if (target.classList.contains('btn-approve')) {
    target.disabled = true;
    target.textContent = 'Memproses...';
    try {
        const pendingOrderRef = db.collection('pending_orders').doc(orderId);
        const pendingOrderDoc = await pendingOrderRef.get();
        if (!pendingOrderDoc.exists) throw new Error("Pesanan tidak ditemukan lagi.");

        const orderData = pendingOrderDoc.data();
        
        // Panggil fungsi master dan serahkan semua tugas padanya
        await finalizeTransaction(orderData.items, orderData.customerName, orderId);

        alert(`Pesanan untuk ${orderData.customerName} berhasil disetujui.`);
        // Tidak perlu hapus apa-apa lagi di sini, sudah dihandle

    } catch (error) {
        alert(`Gagal menyetujui pesanan: ${error.message}`);
        target.disabled = false;
        target.textContent = '✔️ Setujui';
    }
}


    if (target.classList.contains('btn-reject')) {
        if (confirm(`Anda yakin ingin menolak pesanan ini?`)) {
            try {
                await db.collection('pending_orders').doc(orderId).delete();
                alert('Pesanan berhasil ditolak.');
            } catch (error) {
                alert('Gagal menolak pesanan.');
            }
        }
    }
});

// Listener untuk panel riwayat transaksi
const transactionListEl = document.getElementById('transaction-list');
transactionListEl.addEventListener('click', async (event) => {
    const target = event.target;
    if (target.classList.contains('btn-change-status')) {
    const transactionId = target.dataset.id;
    const currentStatus = target.dataset.status;
    let newStatus = '';

    // Tentukan status berikutnya
    if (currentStatus === "Sedang Disiapkan") {
        newStatus = "Siap Diambil";
    } else if (currentStatus === "Siap Diambil") {
        newStatus = "Selesai";
    }

    // Jalankan update jika ada status baru yang akan di-set
    if (newStatus) {
        try {
            await db.collection('transactions').doc(transactionId).update({
                status: newStatus
            });
            // Tampilan akan update otomatis berkat onSnapshot
        } catch (error) {
            console.error("Gagal update status: ", error);
            alert("Gagal update status.");
        }
    }
}
    // ...DENGAN BLOK YANG LEBIH SIMPEL INI
if (target.classList.contains('btn-reprint')) {
    const transactionId = target.dataset.id;
    try {
        const doc = await db.collection('transactions').doc(transactionId).get();
        if (doc.exists) {
            const transactionData = { id: doc.id, ...doc.data() };
            // Panggil printReceipt secara langsung tanpa parameter kedua
            printReceipt(transactionData); 
        }
    } catch (error) {
        console.error("Gagal mengambil data untuk cetak ulang: ", error);
        alert("Gagal mencetak ulang struk.");
    }
}

    
});

// Listener untuk tombol BAYAR utama
// Ganti seluruh event listener btnPay Anda dengan versi final ini
btnPay.addEventListener('click', async () => {
    if (cart.length === 0) {
        alert('Keranjang Anda masih kosong!');
        return;
    }

    try {
        // Langsung panggil fungsi master untuk memproses keranjang kasir
        // Customer name tidak diisi, jadi akan menggunakan nilai default 'Walk-in Customer'
        const finalTransactionData = await finalizeTransaction(cart);
        
        // Cetak struk setelah transaksi selesai
        printReceipt(finalTransactionData);

        // Reset aplikasi seperti biasa
        cart = [];
        localStorage.removeItem('keranjangBelanja');
        renderCart();

    } catch (error) {
        console.error("Error pada proses pembayaran kasir:", error);
        alert(`Transaksi gagal: ${error.message}`);
    }
});



// --- INISIALISASI APLIKASI UTAMA ---

// Fungsi ini berisi semua yang perlu dimuat setelah login berhasil
async function initializeApp() {
    await fetchInventory();
    await fetchProducts();
    renderCart();
    fetchTransactions();
    listenForPendingOrders();
}

// PENJAGA OTENTIKASI: Ini adalah titik masuk utama aplikasi
auth.onAuthStateChanged(user => {
    if (user) {
        // Jika pengguna sudah login, jalankan fungsi inisialisasi
        console.log("Pengguna sudah login, memulai aplikasi...");
        initializeApp();
    } else {
        // Jika tidak, arahkan ke halaman login
        console.log("Tidak ada pengguna yang login, mengarahkan ke halaman login...");
        window.location.href = 'login.html';
    }
});

